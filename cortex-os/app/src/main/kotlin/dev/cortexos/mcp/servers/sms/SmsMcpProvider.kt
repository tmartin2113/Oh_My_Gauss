package dev.cortexos.mcp.servers.sms

import android.content.Context
import android.provider.Telephony
import android.telephony.SmsManager
import dagger.hilt.android.qualifiers.ApplicationContext
import dev.cortexos.mcp.McpServerProvider
import dev.cortexos.mcp.model.Tool
import dev.cortexos.mcp.model.ToolResult
import dev.cortexos.mcp.model.ToolUseBlock
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

data class SmsMessage(
    val id: String,
    val address: String,
    val body: String,
    val timestampMs: Long,
    val isIncoming: Boolean
)

@Singleton
class SmsMcpProvider @Inject constructor(
    @ApplicationContext private val context: Context
) : McpServerProvider {

    companion object {
        const val TOOL_LIST = "sms.list"
        const val TOOL_SEND = "sms.send"
        private val DATE_FORMAT = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
    }

    override val toolDefinitions: List<Tool> = listOf(
        Tool(
            name        = TOOL_LIST,
            description = "List recent SMS messages. Optionally filter by phone number or contact name. " +
                          "Returns messages in reverse chronological order.",
            inputSchema = buildJsonObject {
                put("type", "object")
                putJsonObject("properties") {
                    putJsonObject("address") {
                        put("type", "string")
                        put("description", "Phone number or partial address to filter by (optional)")
                    }
                    putJsonObject("limit") {
                        put("type", "integer")
                        put("description", "Number of messages to return (default 20, max 50)")
                    }
                }
            }
        ),
        Tool(
            name        = TOOL_SEND,
            description = "Send an SMS message to a phone number. " +
                          "Long messages are automatically split into multiple parts.",
            inputSchema = buildJsonObject {
                put("type", "object")
                putJsonObject("properties") {
                    putJsonObject("to") {
                        put("type", "string")
                        put("description", "Recipient phone number in E.164 format or local format")
                    }
                    putJsonObject("body") {
                        put("type", "string")
                        put("description", "Message text to send")
                    }
                }
                putJsonArray("required") {
                    add(kotlinx.serialization.json.JsonPrimitive("to"))
                    add(kotlinx.serialization.json.JsonPrimitive("body"))
                }
            }
        )
    )

    override suspend fun callTool(block: ToolUseBlock): ToolResult {
        return when (block.name) {
            TOOL_LIST -> handleList(block)
            TOOL_SEND -> handleSend(block)
            else -> ToolResult(block.id, "Unknown SMS tool: ${block.name}", isError = true)
        }
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    private suspend fun handleList(block: ToolUseBlock): ToolResult =
        withContext(Dispatchers.IO) {
            val addressFilter = block.input["address"]?.jsonPrimitive?.content
            val limit = block.input["limit"]?.jsonPrimitive?.int?.coerceIn(1, 50) ?: 20

            val uri        = Telephony.Sms.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE
            )
            val selection     = addressFilter?.let { "${Telephony.Sms.ADDRESS} LIKE ?" }
            val selectionArgs = addressFilter?.let { arrayOf("%$it%") }
            val order         = "${Telephony.Sms.DATE} DESC"

            val messages = mutableListOf<SmsMessage>()

            context.contentResolver.query(uri, projection, selection, selectionArgs, order)
                ?.use { cursor ->
                    val idCol   = cursor.getColumnIndexOrThrow(Telephony.Sms._ID)
                    val addrCol = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                    val bodyCol = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
                    val dateCol = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
                    val typeCol = cursor.getColumnIndexOrThrow(Telephony.Sms.TYPE)

                    while (cursor.moveToNext() && messages.size < limit) {
                        messages.add(
                            SmsMessage(
                                id          = cursor.getString(idCol),
                                address     = cursor.getString(addrCol) ?: "Unknown",
                                body        = cursor.getString(bodyCol) ?: "",
                                timestampMs = cursor.getLong(dateCol),
                                isIncoming  = cursor.getInt(typeCol) == Telephony.Sms.MESSAGE_TYPE_INBOX
                            )
                        )
                    }
                }

            if (messages.isEmpty()) {
                return@withContext ToolResult(block.id, "No SMS messages found.")
            }

            val text = buildString {
                appendLine("${messages.size} SMS message(s):")
                messages.forEach { msg ->
                    val direction = if (msg.isIncoming) "From" else "To"
                    val dateStr   = DATE_FORMAT.format(Date(msg.timestampMs))
                    appendLine("[$dateStr] $direction ${msg.address}: ${msg.body.take(160)}")
                }
            }
            ToolResult(block.id, text.trim())
        }

    private suspend fun handleSend(block: ToolUseBlock): ToolResult =
        withContext(Dispatchers.IO) {
            val to = block.input["to"]?.jsonPrimitive?.content
                ?: return@withContext ToolResult(block.id, "Missing required parameter: to", isError = true)
            val body = block.input["body"]?.jsonPrimitive?.content
                ?: return@withContext ToolResult(block.id, "Missing required parameter: body", isError = true)

            if (to.isBlank()) {
                return@withContext ToolResult(block.id, "Recipient phone number cannot be blank", isError = true)
            }
            if (body.isBlank()) {
                return@withContext ToolResult(block.id, "Message body cannot be blank", isError = true)
            }

            runCatching {
                val smsManager = context.getSystemService(SmsManager::class.java)
                    ?: return@withContext ToolResult(block.id, "SmsManager not available", isError = true)

                // divideMessage handles multi-part SMS automatically
                val parts = smsManager.divideMessage(body)
                if (parts.size == 1) {
                    smsManager.sendTextMessage(to, null, body, null, null)
                } else {
                    smsManager.sendMultipartTextMessage(to, null, parts, null, null)
                }
                ToolResult(block.id, "SMS sent to $to.")
            }.getOrElse { e ->
                ToolResult(block.id, "Failed to send SMS: ${e.message}", isError = true)
            }
        }
}
