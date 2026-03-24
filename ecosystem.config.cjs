// CJS extension required — root package.json has "type": "module"
module.exports = {
  apps: [
    {
      name: "mcp",
      script: "./dist/mcp/server.js",
      cwd: "/app",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        MCP_PORT: "3100",
      },
      error_file: "/dev/stderr",
      out_file: "/dev/stdout",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "backend",
      script: "./dist/index.js",
      cwd: "/app/backend",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        MCP_URL: "http://127.0.0.1:3100/mcp",
      },
      error_file: "/dev/stderr",
      out_file: "/dev/stdout",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
