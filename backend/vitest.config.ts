import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Run each test file in its own context so module-level singletons (session store, MCP client) reset
    isolate: true,
  },
});
