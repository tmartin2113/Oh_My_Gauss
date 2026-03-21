package dev.cortexos.llm.model

import dev.cortexos.mcp.model.ToolUseBlock

/**
 * Every event that can be emitted from [dev.cortexos.llm.AnthropicApiClient.streamMessages].
 *
 * Consumers must handle all branches:
 *  - [TextDelta]    → append text to the current assistant message
 *  - [ToolUseBlock] → a complete tool call ready for MCP dispatch (emitted after input JSON assembled)
 *  - [MessageStop]  → the turn is complete; stopReason == "tool_use" means dispatch pending blocks
 *  - [ApiError]     → HTTP-level or API-level error; surface to the user
 *  - [NetworkError] → connectivity failure; retry or surface to the user
 */
sealed class StreamEvent {

    /** A chunk of assistant text to append to the UI. */
    data class TextDelta(val text: String) : StreamEvent()

    /**
     * A fully-assembled tool_use block, emitted once the streaming input JSON
     * accumulation for that block is complete (on content_block_stop).
     */
    data class ToolUseBlock(val block: dev.cortexos.mcp.model.ToolUseBlock) : StreamEvent()

    /**
     * The API has finished the message.
     * @param stopReason One of: "end_turn", "max_tokens", "stop_sequence", "tool_use"
     *                   When "tool_use", pending [ToolUseBlock] events have been emitted
     *                   and are ready for MCP dispatch.
     */
    data class MessageStop(val stopReason: String?) : StreamEvent()

    /**
     * An error returned by the Anthropic API (HTTP 4xx / 5xx).
     * @param statusCode HTTP status code
     * @param apiMessage Human-readable message from the API error body
     */
    data class ApiError(val statusCode: Int, val apiMessage: String) : StreamEvent()

    /** A network or IO error that prevented the request from completing. */
    data class NetworkError(val cause: String) : StreamEvent()
}
