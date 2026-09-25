# @arclighthq/mcp

An [MCP](https://modelcontextprotocol.io/) server that lets AI agents such as Claude and Hermes Agent use [Arclight](https://github.com/yordanchusein1/arclight) as their lead generation tool: the daily briefing, leads with evidence, Google Maps search, drafts, the pipeline and hunts. It never sends messages; it gives you links that open WhatsApp or email with the draft filled in. MIT-licensed.

Run it with two environment variables:

```sh
ARCLIGHT_API_URL=http://localhost:8787 ARCLIGHT_API_KEY=arc_... npx -y @arclighthq/mcp
```

Claude Code:

```sh
claude mcp add arclight -e ARCLIGHT_API_URL=http://localhost:8787 -e ARCLIGHT_API_KEY=arc_... -- npx -y @arclighthq/mcp
```

Setup for Claude Desktop and other clients, and the list of tools: [AI agents (MCP)](https://github.com/yordanchusein1/arclight/blob/main/docs/mcp.md).
