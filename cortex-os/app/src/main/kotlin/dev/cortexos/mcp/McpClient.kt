package dev.cortexos.mcp

import dev.cortexos.mcp.model.ToolResult
import dev.cortexos.mcp.model.ToolUseBlock
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import javax.inject.Inject
import javax.inject.Singleton

/**
 * High-level entry point for executing tool calls on behalf of [dev.cortexos.llm.LlmEngine].
 *
 * Dispatches a list of [ToolUseBlock]s in parallel using [coroutineScope] + [async],
 * then awaits all results before returning. The Anthropic API may request multiple
 * tools in a single turn; running them concurrently minimises round-trip latency.
 *
 * Results are returned in the same order as the input list so callers can zip them
 * trivially with the original [ToolUseBlock]s.
 */
@Singleton
class McpClient @Inject constructor(
    private val registry: McpToolRegistry
) {

    /**
     * Executes all [blocks] concurrently and returns their [ToolResult]s in input order.
     * Never throws — individual failures are captured as [ToolResult.isError] = true.
     */
    suspend fun dispatch(blocks: List<ToolUseBlock>): List<ToolResult> = coroutineScope {
        blocks
            .map { block -> async { registry.dispatch(block) } }
            .map { it.await() }
    }
}
