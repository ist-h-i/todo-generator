# MCP Helper Servers

Launch the Model Context Protocol helper servers when you need Codex or other MCP-aware tooling to interact with this repository. The helper pair exposes Git operations through the `mcp-server-git` package and filesystem APIs through `@modelcontextprotocol/server-filesystem`.

## Prerequisites
- Ensure `uvx` is available (`uv` 0.4.0+). See https://docs.astral.sh/uv/getting-started/ for installation guidance.
- Ensure `npx` is available (install Node.js 20+ from https://nodejs.org/).

## Windows
Run the batch helper from the repository root. It opens two terminals that host the MCP Git and filesystem servers. Close the windows to stop the services.

```
start-mcp-servers.bat
```

## macOS/Linux
Grant execute permission once, then launch the script. It keeps both servers running until you press Ctrl+C.

```
chmod +x scripts/start-mcp-servers.sh
./scripts/start-mcp-servers.sh
```

The script backgrounds each server and registers a trap so they are terminated cleanly when the process exits.

