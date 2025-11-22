#!/usr/bin/env node
/**
 * MCP NLP Server CLI
 *
 * Starts the Model Context Protocol server for NLP operations.
 *
 * Usage:
 *   npx tsx bin/mcp-nlp-server.ts
 *
 * Or add to Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "adjunct-nlp": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/adjunct/bin/mcp-nlp-server.ts"]
 *       }
 *     }
 *   }
 */

import { NodeRuntime } from "@effect/platform-node"
import { runServer } from "../src/Mcp/Server.js"
import { getToolNames } from "../src/Mcp/Tools.js"

const main = () => {
  const name = process.env.MCP_SERVER_NAME ?? "adjunct-nlp"
  const version = process.env.MCP_SERVER_VERSION ?? "1.0.0"

  // Log startup to stderr (stdout is reserved for MCP protocol)
  console.error(`Starting ${name} v${version}...`)
  console.error("Available tools:")

  for (const toolName of getToolNames()) {
    console.error(`  - ${toolName}`)
  }

  console.error("")
  console.error("Waiting for MCP client connection...")

  // Run the Effect-based server with NodeRuntime
  NodeRuntime.runMain(runServer({ name, version }))
}

main()
