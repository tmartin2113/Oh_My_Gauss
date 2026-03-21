package dev.cortexos.llm

import dev.cortexos.llm.model.ApiMessage
import dev.cortexos.llm.model.StreamEvent
import dev.cortexos.mcp.model.Tool
import dev.cortexos.mcp.model.ToolUseBlock
import dev.cortexos.security.SecureCredentialManager
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.preparePost
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsChannel
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.utils.io.ByteReadChannel
import io.ktor.utils.io.readUTF8Line
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AnthropicApiClient @Inject constructor(
    private val httpClient: HttpClient,
    private val credentialManager: SecureCredentialManager,
    private val json: Json
) {

    companion object {
        private const val MESSAGES_ENDPOINT = "https://api.anthropic.com/v1/messages"
        private const val ANTHROPIC_VERSION  = "2023-06-01"
        private const val DEFAULT_MODEL      = "claude-sonnet-4-6"
        private const val DEFAULT_MAX_TOKENS = 4096
    }

    /**
     * Opens a streaming connection to the Anthropic Messages API and emits [StreamEvent]s
     * as they arrive over SSE.
     *
     * The returned [Flow] is cold — the HTTP request is only made when the flow is collected.
     * Cancelling collection cancels the underlying request immediately.
     *
     * @param messages     Conversation history in chronological order.
     * @param systemPrompt System-level instruction defining the OS persona.
     * @param tools        MCP tool definitions to inject into the API request.
     *                     Pass an empty list for tool-free turns.
     * @param model        Anthropic model identifier; defaults to [DEFAULT_MODEL].
     * @param maxTokens    Token cap for this completion; defaults to [DEFAULT_MAX_TOKENS].
     */
    fun streamMessages(
        messages: List<ApiMessage>,
        systemPrompt: String,
        tools: List<Tool> = emptyList(),
        model: String = DEFAULT_MODEL,
        maxTokens: Int = DEFAULT_MAX_TOKENS
    ): Flow<StreamEvent> = flow {

        val apiKey = credentialManager.getAnthropicApiKey()
        if (apiKey == null) {
            emit(StreamEvent.ApiError(statusCode = 401, apiMessage = "No API key configured."))
            return@flow
        }

        // Build request manually using JsonElement so we can conditionally include 'tools'
        val requestBody = buildRequestBody(
            model        = model,
            maxTokens    = maxTokens,
            systemPrompt = systemPrompt,
            messages     = messages,
            tools        = tools
        )

        try {
            httpClient.preparePost(MESSAGES_ENDPOINT) {
                header("x-api-key", apiKey)
                header("anthropic-version", ANTHROPIC_VERSION)
                contentType(ContentType.Application.Json)
                setBody(requestBody)
            }.execute { response ->

                if (!response.status.isSuccess()) {
                    val body = runCatching { response.bodyAsChannel().readUTF8Line() }.getOrNull() ?: ""
                    val apiMessage = extractApiErrorMessage(body) ?: "HTTP ${response.status.value}"
                    emit(StreamEvent.ApiError(response.status.value, apiMessage))
                    return@execute
                }

                parseSseChannel(response.bodyAsChannel()).collect { event ->
                    emit(event)
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Timber.e(e, "Network error during Anthropic stream")
            emit(StreamEvent.NetworkError(e.message ?: "Unknown network error"))
        }
    }

    // ── Request construction ──────────────────────────────────────────────────

    /**
     * Builds the JSON request body. Serialises [ApiMessage.content] as either a
     * JSON string (JsonPrimitive) or JSON array (JsonArray) depending on the turn type.
     * Omits the "tools" key entirely when the list is empty — the API behaves
     * differently when an empty tools array is sent vs when the key is absent.
     */
    private fun buildRequestBody(
        model: String,
        maxTokens: Int,
        systemPrompt: String,
        messages: List<ApiMessage>,
        tools: List<Tool>
    ): String {
        val obj = buildJsonObject {
            put("model", model)
            put("max_tokens", maxTokens)
            put("stream", true)
            put("system", systemPrompt)
            put("messages", json.encodeToJsonElement(
                kotlinx.serialization.serializer<List<ApiMessage>>(), messages
            ))
            if (tools.isNotEmpty()) {
                put("tools", json.encodeToJsonElement(
                    kotlinx.serialization.serializer<List<ToolApiSchema>>(),
                    tools.map { it.toApiSchema() }
                ))
            }
        }
        return json.encodeToString(JsonObject.serializer(), obj)
    }

    private fun Tool.toApiSchema() = ToolApiSchema(
        name        = name,
        description = description,
        inputSchema = inputSchema
    )

    // ── SSE parsing ───────────────────────────────────────────────────────────

    /**
     * Reads the SSE channel line-by-line, accumulating tool_use input JSON across
     * multiple input_json_delta events, and emits fully-assembled [StreamEvent]s.
     *
     * Per-block state:
     *  [pendingToolBlocks] maps content_block index → [PendingToolBlock] being assembled.
     *  Each block starts on content_block_start(type=tool_use), accumulates deltas,
     *  and is emitted as [StreamEvent.ToolUseBlock] on content_block_stop.
     */
    private fun parseSseChannel(channel: ByteReadChannel): Flow<StreamEvent> = flow {
        var currentEventType          = ""
        var messageComplete           = false
        val pendingToolBlocks         = mutableMapOf<Int, PendingToolBlock>()

        while (!channel.isClosedForRead && !messageComplete) {
            val line = channel.readUTF8Line() ?: break

            when {
                line.startsWith("event:") -> {
                    currentEventType = line.removePrefix("event:").trim()
                }
                line.startsWith("data:") -> {
                    val data = line.removePrefix("data:").trim()
                    if (data == "[DONE]") return@flow

                    val obj = runCatching {
                        json.parseToJsonElement(data).jsonObject
                    }.getOrNull() ?: continue

                    when (currentEventType) {

                        "content_block_start" -> {
                            val index        = obj["index"]?.jsonPrimitive?.content?.toIntOrNull() ?: continue
                            val contentBlock = obj["content_block"]?.jsonObject ?: continue
                            val blockType    = contentBlock["type"]?.jsonPrimitive?.content

                            if (blockType == "tool_use") {
                                val id   = contentBlock["id"]?.jsonPrimitive?.content ?: continue
                                val name = contentBlock["name"]?.jsonPrimitive?.content ?: continue
                                pendingToolBlocks[index] = PendingToolBlock(id = id, name = name)
                            }
                        }

                        "content_block_delta" -> {
                            val index = obj["index"]?.jsonPrimitive?.content?.toIntOrNull() ?: continue
                            val delta = obj["delta"]?.jsonObject ?: continue

                            when (delta["type"]?.jsonPrimitive?.content) {
                                "text_delta" -> {
                                    val text = delta["text"]?.jsonPrimitive?.content ?: continue
                                    emit(StreamEvent.TextDelta(text))
                                }
                                "input_json_delta" -> {
                                    val partial = delta["partial_json"]?.jsonPrimitive?.content ?: continue
                                    pendingToolBlocks[index]?.inputJsonAccumulator?.append(partial)
                                }
                            }
                        }

                        "content_block_stop" -> {
                            val index = obj["index"]?.jsonPrimitive?.content?.toIntOrNull() ?: continue
                            val pending = pendingToolBlocks.remove(index) ?: continue

                            // Parse the fully-accumulated input JSON
                            val inputJson = pending.inputJsonAccumulator.toString()
                                .takeIf { it.isNotBlank() } ?: "{}"

                            val inputObject = runCatching {
                                json.parseToJsonElement(inputJson).jsonObject
                            }.getOrElse {
                                Timber.w("Failed to parse tool input JSON for ${pending.name}: $inputJson")
                                JsonObject(emptyMap())
                            }

                            emit(StreamEvent.ToolUseBlock(
                                ToolUseBlock(
                                    id    = pending.id,
                                    name  = pending.name,
                                    input = inputObject
                                )
                            ))
                        }

                        "message_delta" -> {
                            val delta      = obj["delta"]?.jsonObject
                            val stopReason = delta?.get("stop_reason")?.jsonPrimitive?.content
                            val event      = StreamEvent.MessageStop(stopReason)
                            emit(event)
                            messageComplete = true
                        }

                        "error" -> {
                            val error   = obj["error"]?.jsonObject
                            val message = error?.get("message")?.jsonPrimitive?.content ?: "Unknown API error"
                            emit(StreamEvent.ApiError(statusCode = 0, apiMessage = message))
                            messageComplete = true
                        }

                        // message_start, message_stop, ping — safely ignored
                    }
                }
                line.isEmpty() -> {
                    currentEventType = ""
                }
            }
        }
    }

    private fun extractApiErrorMessage(body: String): String? = runCatching {
        json.parseToJsonElement(body).jsonObject["error"]
            ?.jsonObject?.get("message")?.jsonPrimitive?.content
    }.getOrNull()

    // ── Internal types ────────────────────────────────────────────────────────

    /** Mutable accumulator for a tool_use block being assembled from streaming deltas. */
    private data class PendingToolBlock(
        val id: String,
        val name: String,
        val inputJsonAccumulator: StringBuilder = StringBuilder()
    )

    /** Wire schema for the Anthropic API tools array. */
    @Serializable
    private data class ToolApiSchema(
        val name: String,
        val description: String,
        @SerialName("input_schema") val inputSchema: JsonObject
    )
}
