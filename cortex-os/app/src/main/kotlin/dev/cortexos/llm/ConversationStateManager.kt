package dev.cortexos.llm

import dev.cortexos.llm.model.ApiMessage
import dev.cortexos.llm.model.ApiMessageFactory
import dev.cortexos.llm.model.Message
import dev.cortexos.llm.model.Role
import dev.cortexos.mcp.model.ToolResult
import dev.cortexos.mcp.model.ToolUseBlock
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages conversation state for both the UI layer and the Anthropic API layer.
 *
 * Two parallel lists are maintained:
 *
 *  [_messages]  — Domain [Message] list for the Compose UI. Always contains plain-text
 *                 content. Tool calls appear as a human-readable summary line rather
 *                 than raw JSON. This list drives the chat bubbles.
 *
 *  [_apiHistory] — [ApiMessage] list for the Anthropic API. Content is [JsonElement],
 *                  supporting both plain-text strings and structured content arrays
 *                  (tool_use, tool_result). This list is what gets sent to the API.
 *
 * The two lists are always updated together so they never diverge.
 */
@Singleton
class ConversationStateManager @Inject constructor() {

    companion object {
        /** Approximate character budget for API history (≈ 120k tokens at 4 chars/token). */
        private const val MAX_HISTORY_CHARS = 480_000

        /**
         * Maximum number of tool-use turns per [LlmEngine.chat] invocation.
         * Prevents runaway tool loops on misbehaving models or infinite tool chains.
         */
        const val MAX_TOOL_TURNS = 5
    }

    private val _messages    = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()

    // Not exposed as StateFlow — only consumed by LlmEngine for API calls.
    private val _apiHistory  = mutableListOf<ApiMessage>()

    // ── User messages ─────────────────────────────────────────────────────────

    /** Appends a user text message to both UI state and API history. */
    fun addUserMessage(text: String): Message {
        val msg = Message(role = Role.user, content = text)
        _messages.update { it + msg }
        _apiHistory.add(ApiMessageFactory.userText(text))
        return msg
    }

    // ── Assistant message lifecycle ───────────────────────────────────────────

    /**
     * Adds an empty assistant placeholder to the UI list.
     * Must be called before streaming begins so the UI can show the typing indicator.
     * Does NOT add to API history — the history entry is created in [finaliseAssistantTurn].
     */
    fun beginAssistantMessage(): Message {
        val msg = Message(role = Role.assistant, content = "")
        _messages.update { it + msg }
        return msg
    }

    /**
     * Appends a text delta to the last assistant message in the UI list.
     * Called on every [StreamEvent.TextDelta] during streaming.
     */
    fun appendToLastAssistantMessage(delta: String) {
        _messages.update { list ->
            if (list.isEmpty()) return@update list
            val last = list.last()
            if (last.role != Role.assistant) return@update list
            list.dropLast(1) + last.copy(content = last.content + delta)
        }
    }

    /**
     * Finalises the assistant's turn in both UI state and API history.
     *
     * Called when [StreamEvent.MessageStop] is received.
     *
     * @param displayText    The full streamed text content. Stored in the UI message.
     * @param toolUseBlocks  Any tool_use blocks emitted during this turn. If present,
     *                       the API history entry uses the structured content array format.
     *                       A summary of tool calls is appended to the UI display text.
     */
    fun finaliseAssistantTurn(displayText: String, toolUseBlocks: List<ToolUseBlock>) {
        // Update UI message — append tool call summary if tools were invoked
        val uiContent = if (toolUseBlocks.isNotEmpty()) {
            val summary = toolUseBlocks.joinToString("\n") { "⚙ ${it.name}" }
            if (displayText.isNotBlank()) "$displayText\n\n$summary" else summary
        } else {
            displayText
        }

        _messages.update { list ->
            if (list.isEmpty()) return@update list
            val last = list.last()
            if (last.role != Role.assistant) return@update list
            list.dropLast(1) + last.copy(content = uiContent)
        }

        // Add structured API history entry
        _apiHistory.add(ApiMessageFactory.assistantWithToolUse(displayText, toolUseBlocks))
    }

    /**
     * Adds tool results to the API history as a user turn.
     * No corresponding UI message is created — tool results are internal plumbing.
     */
    fun addToolResults(results: List<ToolResult>) {
        _apiHistory.add(ApiMessageFactory.toolResults(results))
    }

    /** Removes the last message from the UI list. Used for error rollback. */
    fun removeLastMessage() {
        _messages.update { if (it.isEmpty()) it else it.dropLast(1) }
        if (_apiHistory.isNotEmpty()) _apiHistory.removeLastOrNull()
    }

    /** Clears all session state — both UI messages and API history. */
    fun clear() {
        _messages.update { emptyList() }
        _apiHistory.clear()
    }

    // ── API payload ───────────────────────────────────────────────────────────

    /**
     * Returns a pruned copy of the API history suitable for inclusion in an
     * Anthropic API request body.
     *
     * Pruning drops the oldest messages when the total serialised character count
     * exceeds [MAX_HISTORY_CHARS]. The API's alternating-role constraint is always
     * satisfied by construction because [addUserMessage], [finaliseAssistantTurn],
     * and [addToolResults] never produce two consecutive same-role messages.
     */
    fun getApiMessages(): List<ApiMessage> = pruneToTokenBudget(_apiHistory.toList())

    // ── Internal helpers ──────────────────────────────────────────────────────

    private fun pruneToTokenBudget(messages: List<ApiMessage>): List<ApiMessage> {
        if (messages.isEmpty()) return messages

        var totalChars = messages.sumOf { it.content.toString().length }
        var startIndex = 0

        // Drop from the front, always retaining at least the last exchange
        while (totalChars > MAX_HISTORY_CHARS && startIndex < messages.size - 2) {
            totalChars -= messages[startIndex].content.toString().length
            startIndex++
        }

        // After pruning, ensure we still start with a user message
        var adjustedStart = startIndex
        while (adjustedStart < messages.size && messages[adjustedStart].role != "user") {
            adjustedStart++
        }

        return if (adjustedStart >= messages.size) emptyList()
        else messages.subList(adjustedStart, messages.size)
    }
}
