package dev.cortexos.mcp

import dev.cortexos.mcp.model.Tool
import dev.cortexos.mcp.model.ToolResult
import dev.cortexos.mcp.model.ToolUseBlock
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Central registry that aggregates [Tool] definitions from every [McpServerProvider]
 * and routes [ToolUseBlock] dispatches to the correct provider.
 *
 * Populated at startup via Hilt multibindings — no runtime registration needed.
 */
@Singleton
class McpToolRegistry @Inject constructor(
    private val providers: Set<@JvmSuppressWildcards McpServerProvider>
) {

    /**
     * Flat list of all tools contributed by all providers.
     * Passed directly to the Anthropic API's `tools` array on each request.
     * Computed lazily once and cached — providers are immutable after injection.
     */
    val allTools: List<Tool> by lazy {
        val tools = providers.flatMap { it.toolDefinitions }

        // Detect duplicate tool names at startup — a misconfigured provider causes
        // silent routing failures at runtime if left undetected.
        val duplicates = tools.groupBy { it.name }.filter { it.value.size > 1 }.keys
        if (duplicates.isNotEmpty()) {
            Timber.e("Duplicate tool names detected — only the first registration will be used: $duplicates")
        }

        tools.distinctBy { it.name }.also {
            Timber.d("McpToolRegistry initialised with ${it.size} tools: ${it.map { t -> t.name }}")
        }
    }

    /**
     * Dispatches a single [ToolUseBlock] to the provider that owns that tool name.
     *
     * Returns a [ToolResult] with [ToolResult.isError] = true if no provider claims
     * the tool, rather than throwing. This lets the LLM see the failure and recover.
     */
    suspend fun dispatch(block: ToolUseBlock): ToolResult {
        val provider = routingMap[block.name]
        if (provider == null) {
            Timber.w("No provider found for tool '${block.name}'")
            return ToolResult(
                toolUseId = block.id,
                content   = "Tool '${block.name}' is not available on this device.",
                isError   = true
            )
        }

        return runCatching { provider.callTool(block) }.getOrElse { e ->
            Timber.e(e, "Tool '${block.name}' threw an uncaught exception")
            ToolResult(
                toolUseId = block.id,
                content   = "Tool '${block.name}' failed: ${e.message ?: "unknown error"}",
                isError   = true
            )
        }
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    /**
     * Eagerly built reverse index: tool name → owning provider.
     * Computed alongside [allTools] to guarantee consistency.
     */
    private val routingMap: Map<String, McpServerProvider> by lazy {
        buildMap {
            for (provider in providers) {
                for (tool in provider.toolDefinitions) {
                    putIfAbsent(tool.name, provider)
                }
            }
        }
    }
}
