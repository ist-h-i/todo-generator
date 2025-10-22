# MCP Helper Servers

Launch the Model Context Protocol helper servers when you need Codex or other MCP-aware tooling to interact with this repository. The batch script starts the following services:

- Filesystem (`@modelcontextprotocol/server-filesystem`)
- Memory (`@modelcontextprotocol/server-memory`)
- Fetch (`mcp-server-fetch`)
- Puppeteer (`@modelcontextprotocol/server-puppeteer`)
- Sequential thinking (`@modelcontextprotocol/server-sequential-thinking`)
- Time (`mcp-server-time`)
- Serena (`serena start-mcp-server`)
- Optional adapters: Brave Search (when `BRAVE_API_KEY` is defined), Magic (`@21st-dev/magic`) when `MAGIC_API_KEY` is available, and Playwright (`@playwright/mcp`).

## Prerequisites

- Ensure `uvx` is available (`uv` 0.4.0+). See <https://docs.astral.sh/uv/getting-started/> for installation guidance.
- Ensure `npx` is available (install Node.js 20+ from <https://nodejs.org/>).

## Windows

Run the batch helper from the repository root. A separate terminal window opens for each server. Optional adapters only start when their required environment variables are present. Close the windows to stop the services.

```@bash
start-mcp-servers.bat
```

## macOS/Linux

Grant execute permission once, then launch the script. It keeps the full MCP server suite running until you press Ctrl+C.

```@linux
chmod +x scripts/start-mcp-servers.sh
./scripts/start-mcp-servers.sh
```

The script backgrounds each server and registers a trap so they are terminated cleanly when the process exits.
