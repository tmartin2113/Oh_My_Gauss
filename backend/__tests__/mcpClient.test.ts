import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these are created before module mocks run (avoids temporal dead zone)
const mockConnect = vi.hoisted(() => vi.fn());
const mockListToolsCall = vi.hoisted(() => vi.fn());
const mockCallToolCall = vi.hoisted(() => vi.fn());

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn(function (this: Record<string, unknown>) {
    this.connect = mockConnect;
    this.listTools = mockListToolsCall;
    this.callTool = mockCallToolCall;
  }),
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn(),
}));

// Import after mocks are set up
import { listTools, callTool, ALLOWED_TOOLS } from "../src/services/mcpClient.js";

describe("ALLOWED_TOOLS whitelist", () => {
  it("contains exactly the 4 expected tools", () => {
    expect(ALLOWED_TOOLS.size).toBe(4);
    expect(ALLOWED_TOOLS.has("search_papers")).toBe(true);
    expect(ALLOWED_TOOLS.has("scrape_science")).toBe(true);
    expect(ALLOWED_TOOLS.has("search_science")).toBe(true);
    expect(ALLOWED_TOOLS.has("list_sources")).toBe(true);
  });

  it("does not allow arbitrary tools", () => {
    expect(ALLOWED_TOOLS.has("exec_code")).toBe(false);
    expect(ALLOWED_TOOLS.has("delete_files")).toBe(false);
    expect(ALLOWED_TOOLS.has("__proto__")).toBe(false);
  });
});

describe("callTool — whitelist enforcement", () => {
  it("throws when calling a non-whitelisted tool", async () => {
    await expect(callTool("evil_tool", {})).rejects.toThrow(/not allowed/i);
  });

  it("does not call SDK for non-whitelisted tools", async () => {
    mockCallToolCall.mockReset();
    try {
      await callTool("admin_panel", {});
    } catch {
      // expected rejection
    }
    expect(mockCallToolCall).not.toHaveBeenCalled();
  });
});

describe("listTools — SDK integration", () => {
  beforeEach(() => {
    mockConnect.mockReset();
    mockListToolsCall.mockReset();
    mockCallToolCall.mockReset();
    mockConnect.mockResolvedValue(undefined);
  });

  it("returns only whitelisted tools from MCP response", async () => {
    mockListToolsCall.mockResolvedValueOnce({
      tools: [
        { name: "search_papers", description: "Search", inputSchema: {} },
        { name: "admin_tool", description: "Admin", inputSchema: {} }, // filtered out
        { name: "list_sources", description: "Sources", inputSchema: {} },
      ],
    });
    const tools = await listTools();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(["search_papers", "list_sources"]);
  });

  it("resets client singleton when listTools throws so next call reconnects", async () => {
    // Trigger an error to force the singleton reset
    mockListToolsCall.mockRejectedValueOnce(new Error("Connection lost"));
    await expect(listTools()).rejects.toThrow("Connection lost");

    // After reset, the next call must reconnect transparently and succeed
    mockConnect.mockResolvedValue(undefined);
    mockListToolsCall.mockResolvedValueOnce({ tools: [] });
    const tools = await listTools();
    expect(Array.isArray(tools)).toBe(true);
  });
});

describe("callTool — SDK integration", () => {
  beforeEach(() => {
    mockConnect.mockReset();
    mockListToolsCall.mockReset();
    mockCallToolCall.mockReset();
    mockConnect.mockResolvedValue(undefined);
  });

  it("returns tool result for whitelisted tool", async () => {
    const expected = { content: [{ type: "text", text: "results" }], isError: false };
    mockCallToolCall.mockResolvedValueOnce(expected);
    const result = await callTool("search_papers", { query: "test" });
    expect(result).toEqual(expected);
    expect(mockCallToolCall).toHaveBeenCalledWith({
      name: "search_papers",
      arguments: { query: "test" },
    });
  });

  it("resets client singleton when callTool throws so next call reconnects", async () => {
    // Trigger an error to force the singleton reset
    mockCallToolCall.mockRejectedValueOnce(new Error("Stream closed"));
    await expect(callTool("list_sources", {})).rejects.toThrow("Stream closed");

    // After reset, the next call must reconnect transparently and succeed
    mockConnect.mockResolvedValue(undefined);
    mockCallToolCall.mockResolvedValueOnce({ content: [], isError: false });
    const result = await callTool("list_sources", {});
    expect(result).toBeDefined();
  });
});
