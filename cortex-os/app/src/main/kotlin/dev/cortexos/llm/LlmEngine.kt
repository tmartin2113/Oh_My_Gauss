package dev.cortexos.llm

import dev.cortexos.mcp.McpClient
import dev.cortexos.mcp.McpToolRegistry
import dev.cortexos.mcp.model.ToolUseBlock
import dev.cortexos.llm.model.StreamEvent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Orchestrates the full multi-turn tool-use loop for a single conversation turn.
 *
 * Flow for each user input:
 *  1. Add user message to state.
 *  2. Snapshot API history and open a streaming request with the registered tools.
 *  3. Stream text deltas to the caller and accumulate tool_use blocks.
 *  4. On MessageStop:
 *     - If stopReason == "end_turn" → finalise assistant message, done.
 *     - If stopReason == "tool_use" → dispatch tool calls via [McpClient],
 *       append results to history, and re-enter the loop.
 *  5. Loop is capped at [ConversationStateManager.MAX_TOOL_TURNS] to prevent runaway chains.
 */
@Singleton
class LlmEngine @Inject constructor(
    private val apiClient: AnthropicApiClient,
    private val conversationState: ConversationStateManager,
    private val mcpClient: McpClient,
    private val toolRegistry: McpToolRegistry
) {

    companion object {
        private val SYSTEM_PROMPT = """
            You are Cortex, the AI core of an intelligent Android operating system.
            You are the primary interface between the user and their device.

            Behavioural guidelines:
            - Be concise. This is a mobile interface — prefer short, direct answers.
            - Use plain prose, not Markdown formatting (no headers, no bullet lists unless essential).
            - When performing device actions (SMS, contacts, calendar, settings), call the appropriate
              tool directly. Do not ask the user to confirm before calling read-only tools.
              Always confirm before sending messages, deleting data, or making changes.
            - If a tool returns an error, explain what went wrong in plain language.
            - If you are uncertain, say so honestly.
        """.trimIndent()
    }

    /**
     * Processes a user message and returns a [Flow] that emits streamed text deltas.
     *
     * The flow completes when the final end_turn response has been streamed.
     * Errors are wrapped as [LlmException] and thrown into the flow.
     *
     * @param userInput Raw text from the chat input bar or STT.
     */
    fun chat(userInput: String): Flow<String> = flow {
        conversationState.addUserMessage(userInput)

        val tools      = toolRegistry.allTools
        var toolTurns  = 0
        var continueLoop = true

        while (continueLoop) {
            // Snapshot before creating the placeholder so no empty assistant
            // message is accidentally included in the API payload.
            val apiMessages = conversationState.getApiMessages()
            conversationState.beginAssistantMessage()

            val fullText      = StringBuilder()
            val toolUseBlocks = mutableListOf<ToolUseBlock>()
            var stopReason: String? = null

            apiClient.streamMessages(
                messages     = apiMessages,
                systemPrompt = SYSTEM_PROMPT,
                tools        = tools
            ).collect { event ->
                when (event) {
                    is StreamEvent.TextDelta -> {
                        fullText.append(event.text)
                        conversationState.appendToLastAssistantMessage(event.text)
                        emit(event.text)
                    }
                    is StreamEvent.ToolUseBlock -> {
                        toolUseBlocks.add(event.block)
                        Timber.d("Tool call queued: ${event.block.name} (${event.block.id})")
                    }
                    is StreamEvent.MessageStop -> {
                        stopReason = event.stopReason
                        conversationState.finaliseAssistantTurn(fullText.toString(), toolUseBlocks)
                    }
                    is StreamEvent.ApiError -> {
                        conversationState.removeLastMessage()
                        throw LlmException.ApiError(event.statusCode, event.apiMessage)
                    }
                    is StreamEvent.NetworkError -> {
                        conversationState.removeLastMessage()
                        throw LlmException.NetworkError(event.cause)
                    }
                }
            }

            // Decide whether to loop for tool dispatch
            if (stopReason == "tool_use" && toolUseBlocks.isNotEmpty() && toolTurns < ConversationStateManager.MAX_TOOL_TURNS) {
                toolTurns++
                Timber.d("Dispatching ${toolUseBlocks.size} tool call(s) (turn $toolTurns)")

                val results = mcpClient.dispatch(toolUseBlocks)
                conversationState.addToolResults(results)

                // Emit a brief status line so the UI isn't silent during tool execution
                results.forEach { result ->
                    if (!result.isError) {
                        // No visible delta — tool results feed into the next API turn silently
                    } else {
                        emit("\n[Tool error: ${result.content}]")
                    }
                }
                // Loop continues — re-enter with tool results appended
            } else {
                if (stopReason == "tool_use" && toolTurns >= ConversationStateManager.MAX_TOOL_TURNS) {
                    Timber.w("Tool use loop capped at ${ConversationStateManager.MAX_TOOL_TURNS} turns")
                }
                continueLoop = false
            }
        }
    }
}

/** Typed exceptions thrown by [LlmEngine.chat] collectors. */
sealed class LlmException(message: String) : Exception(message) {
    class ApiError(val statusCode: Int, val apiMessage: String)
        : LlmException("API error $statusCode: $apiMessage")
    class NetworkError(val cause: String)
        : LlmException("Network error: $cause")
}
