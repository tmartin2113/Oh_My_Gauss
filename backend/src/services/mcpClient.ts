import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpToolResult } from "../types.js";

const MCP_URL = process.env.MCP_URL ?? "http://127.0.0.1:3100/mcp";

export const ALLOWED_TOOLS = new Set(["search_papers", "scrape_science", "search_science", "list_sources"]);

let _client: Client | null = null;
let _initPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (_client) return _client;
  if (!_initPromise) {
    _initPromise = (async () => {
      const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
      const client = new Client({ name: "oh-my-gauss-backend", version: "1.0.0" });
      await client.connect(transport);
      _client = client;
      return client;
    })().catch((err) => {
      _initPromise = null;
      throw err;
    });
  }
  return _initPromise;
}

/** Reset singleton — used when connection is lost */
function resetClient(): void {
  _client = null;
  _initPromise = null;
}

export async function listTools(): Promise<{ name: string; description?: string; inputSchema: unknown }[]> {
  const client = await getClient();
  try {
    const result = await client.listTools({}, { signal: AbortSignal.timeout(30_000) });
    return result.tools.filter((t) => ALLOWED_TOOLS.has(t.name));
  } catch (err) {
    resetClient();
    throw err;
  }
}

export async function callTool(toolName: string, args: Record<string, unknown>): Promise<McpToolResult> {
  if (!ALLOWED_TOOLS.has(toolName)) {
    throw new Error(`Tool "${toolName}" is not allowed`);
  }

  const client = await getClient();
  try {
    const result = await client.callTool({ name: toolName, arguments: args }, undefined, { signal: AbortSignal.timeout(60_000) });
    return result as McpToolResult;
  } catch (err) {
    resetClient();
    throw err;
  }
}
