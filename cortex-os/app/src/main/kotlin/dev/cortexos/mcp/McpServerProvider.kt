package dev.cortexos.mcp

import dev.cortexos.mcp.model.Tool
import dev.cortexos.mcp.model.ToolResult
import dev.cortexos.mcp.model.ToolUseBlock

/**
 * Contract for every on-device MCP server.
 *
 * Each capability (Contacts, SMS, Calendar, Settings) provides a set of [Tool]
 * definitions that get registered with the Anthropic API, and implements [callTool]
 * to execute those tools when the LLM dispatches them.
 *
 * Implementations are injected into [McpToolRegistry] via Hilt multibindings.
 * They run in-process and have direct access to Android APIs — there is no IPC
 * overhead for on-device tools.
 *
 * Remote MCP servers (web search, etc.) are wired through [RemoteMcpProvider], which
 * speaks the standard MCP HTTP/SSE transport instead of implementing this interface
 * directly.
 */
interface McpServerProvider {

    /**
     * The set of tools this provider contributes to the global registry.
     * Called once at startup during registry initialisation.
     */
    val toolDefinitions: List<Tool>

    /**
     * Executes the named tool with the given arguments.
     *
     * @param block The [ToolUseBlock] as extracted from the Anthropic stream. Contains
     *              the tool name, a unique call ID, and the fully-parsed input arguments.
     * @return A [ToolResult] whose [ToolResult.toolUseId] mirrors [ToolUseBlock.id].
     *         Always returns a result — never throws. Errors are captured in
     *         [ToolResult.isError] so the LLM can reason about failures gracefully.
     */
    suspend fun callTool(block: ToolUseBlock): ToolResult
}
