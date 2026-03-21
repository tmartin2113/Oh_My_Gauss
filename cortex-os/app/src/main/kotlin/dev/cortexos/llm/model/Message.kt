package dev.cortexos.llm.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import dev.cortexos.mcp.model.ToolResult
import dev.cortexos.mcp.model.ToolUseBlock
import java.util.UUID

enum class Role { user, assistant }

/**
 * A single conversation turn as stored in-memory for UI display.
 * Content is always a plain string — structured API content is tracked separately
 * in [dev.cortexos.llm.ConversationStateManager.apiHistory].
 */
data class Message(
    val id: String = UUID.randomUUID().toString(),
    val role: Role,
    val content: String,
    val timestampMs: Long = System.currentTimeMillis()
)

/**
 * Wire-format message sent to / received from the Anthropic API.
 *
 * [content] is a [JsonElement] because the API accepts two shapes:
 *  - JsonPrimitive(string) — for plain user/assistant text turns
 *  - JsonArray([...blocks]) — for turns containing tool_use or tool_result blocks
 *
 * Use [ApiMessageFactory] helpers to construct correct instances.
 */
@Serializable
data class ApiMessage(
    val role: String,
    val content: JsonElement
)

/**
 * Constructs [ApiMessage] instances for every turn shape the Anthropic API accepts.
 */
object ApiMessageFactory {

    /** Simple user text message. */
    fun userText(text: String): ApiMessage =
        ApiMessage(role = "user", content = JsonPrimitive(text))

    /** Simple assistant text message (no tool calls). */
    fun assistantText(text: String): ApiMessage =
        ApiMessage(role = "assistant", content = JsonPrimitive(text))

    /**
     * Assistant turn that includes text and/or tool_use blocks in the content array.
     * If [toolUseBlocks] is empty, returns a plain text message with JsonPrimitive content
     * (avoids sending an unnecessarily structured payload).
     */
    fun assistantWithToolUse(
        textContent: String,
        toolUseBlocks: List<ToolUseBlock>
    ): ApiMessage {
        if (toolUseBlocks.isEmpty()) return assistantText(textContent)

        val blocks = buildJsonArray {
            if (textContent.isNotBlank()) {
                add(buildJsonObject {
                    put("type", "text")
                    put("text", textContent)
                })
            }
            toolUseBlocks.forEach { block ->
                add(buildJsonObject {
                    put("type", "tool_use")
                    put("id", block.id)
                    put("name", block.name)
                    put("input", block.input)
                })
            }
        }
        return ApiMessage(role = "assistant", content = blocks)
    }

    /**
     * User turn wrapping one or more tool results.
     * Each result corresponds to a tool_use block the assistant previously called.
     */
    fun toolResults(results: List<ToolResult>): ApiMessage {
        val blocks = buildJsonArray {
            results.forEach { result ->
                add(buildJsonObject {
                    put("type", "tool_result")
                    put("tool_use_id", result.toolUseId)
                    put("content", result.content)
                    if (result.isError) put("is_error", true)
                })
            }
        }
        return ApiMessage(role = "user", content = blocks)
    }
}
