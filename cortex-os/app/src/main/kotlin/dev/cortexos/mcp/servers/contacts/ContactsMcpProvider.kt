package dev.cortexos.mcp.servers.contacts

import dev.cortexos.mcp.McpServerProvider
import dev.cortexos.mcp.model.Tool
import dev.cortexos.mcp.model.ToolResult
import dev.cortexos.mcp.model.ToolUseBlock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * MCP provider for device contacts.
 *
 * Tools:
 *  - [TOOL_SEARCH]  — full-text search across names and phone numbers
 *  - [TOOL_GET]     — fetch all details for a known contact ID
 */
@Singleton
class ContactsMcpProvider @Inject constructor(
    private val repository: ContactsRepository
) : McpServerProvider {

    companion object {
        const val TOOL_SEARCH = "contacts.search"
        const val TOOL_GET    = "contacts.get"
    }

    override val toolDefinitions: List<Tool> = listOf(
        Tool(
            name        = TOOL_SEARCH,
            description = "Search the device contact book by name or phone number. " +
                          "Returns a list of matching contacts with their phone numbers.",
            inputSchema = buildJsonObject {
                put("type", "object")
                putJsonObject("properties") {
                    putJsonObject("query") {
                        put("type", "string")
                        put("description", "Name or phone number substring to search for")
                    }
                    putJsonObject("limit") {
                        put("type", "integer")
                        put("description", "Maximum number of contacts to return (default 10, max 25)")
                    }
                }
                putJsonArray("required") { add(kotlinx.serialization.json.JsonPrimitive("query")) }
            }
        ),
        Tool(
            name        = TOOL_GET,
            description = "Retrieve full contact details (all phone numbers) for a specific contact ID " +
                          "previously returned by contacts.search.",
            inputSchema = buildJsonObject {
                put("type", "object")
                putJsonObject("properties") {
                    putJsonObject("contactId") {
                        put("type", "string")
                        put("description", "The contact ID returned by contacts.search")
                    }
                }
                putJsonArray("required") { add(kotlinx.serialization.json.JsonPrimitive("contactId")) }
            }
        )
    )

    override suspend fun callTool(block: ToolUseBlock): ToolResult {
        return when (block.name) {
            TOOL_SEARCH -> handleSearch(block)
            TOOL_GET    -> handleGet(block)
            else -> ToolResult(
                toolUseId = block.id,
                content   = "Unknown contacts tool: ${block.name}",
                isError   = true
            )
        }
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    private suspend fun handleSearch(block: ToolUseBlock): ToolResult {
        val query = block.input["query"]?.jsonPrimitive?.content
            ?: return ToolResult(block.id, "Missing required parameter: query", isError = true)

        val limit = block.input["limit"]?.jsonPrimitive?.int?.coerceIn(1, 25) ?: 10

        val contacts = repository.search(query, limit)

        if (contacts.isEmpty()) {
            return ToolResult(block.id, "No contacts found matching \"$query\".")
        }

        val text = buildString {
            appendLine("Found ${contacts.size} contact(s) matching \"$query\":")
            contacts.forEach { contact ->
                appendLine("• ${contact.displayName} (ID: ${contact.id})")
                contact.phoneNumbers.forEach { phone ->
                    appendLine("  ${phone.label}: ${phone.number}")
                }
            }
        }
        return ToolResult(block.id, text.trim())
    }

    private suspend fun handleGet(block: ToolUseBlock): ToolResult {
        val contactId = block.input["contactId"]?.jsonPrimitive?.content
            ?: return ToolResult(block.id, "Missing required parameter: contactId", isError = true)

        val contact = repository.getById(contactId)
            ?: return ToolResult(block.id, "No contact found with ID: $contactId", isError = true)

        val text = buildString {
            appendLine("${contact.displayName}:")
            contact.phoneNumbers.forEach { phone ->
                appendLine("  ${phone.label}: ${phone.number}")
            }
        }
        return ToolResult(block.id, text.trim())
    }
}
