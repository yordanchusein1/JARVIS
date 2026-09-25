# AI agents (MCP)

Arclight includes an [MCP](https://modelcontextprotocol.io/) server, so AI agents such as Claude Desktop, Claude Code, Hermes Agent or any other MCP client can use Arclight as their lead generation tool. You can then ask things like:

- _"What's new today?"_
- _"Find dental clinics in Surabaya with at least 50 reviews and track the best five."_
- _"Write a message for Klinik Gigi Senyum and give me the WhatsApp link."_
- _"Hunt for private schools in Bandung every morning at 6."_

The MCP server is a client of Arclight's [HTTP API](api.md), like the dashboard. It runs on the computer of the person using the agent and talks to your Arclight server with an API key. It is MIT-licensed ([`apps/mcp`](../apps/mcp)).

> [!IMPORTANT]
> The agent can do what the dashboard can do, except send messages: there is no tool for that ([D4](DECISIONS.md#d4-no-automated-sending-in-v01)). The agent shows you the drafts and links that open WhatsApp or your email program with the message filled in, and you press send.

## Set it up

You need Node.js 22.12 or newer on the computer that runs the agent.

Create an API key for the agent on your Arclight server, separate from the dashboard's:

```sh
docker compose exec api tsx src/cli/create-api-key.ts agent
```

The server is the npm package [`@arclighthq/mcp`](https://www.npmjs.com/package/@arclighthq/mcp), started with `npx -y @arclighthq/mcp` and two environment variables:

| Variable           | Value                                            |
| ------------------ | ------------------------------------------------ |
| `ARCLIGHT_API_URL` | Where the API is, e.g. `http://localhost:8787`   |
| `ARCLIGHT_API_KEY` | The key you just created (it starts with `arc_`) |

### Claude Code

```sh
claude mcp add arclight \
  -e ARCLIGHT_API_URL=http://localhost:8787 \
  -e ARCLIGHT_API_KEY=arc_... \
  -- npx -y @arclighthq/mcp
```

### Claude Desktop and other clients

Add a stdio server to the client's MCP configuration. For Claude Desktop, that is `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "arclight": {
      "command": "npx",
      "args": ["-y", "@arclighthq/mcp"],
      "env": {
        "ARCLIGHT_API_URL": "http://localhost:8787",
        "ARCLIGHT_API_KEY": "arc_..."
      }
    }
  }
}
```

Other MCP clients, such as Hermes Agent, take the same command, arguments and environment variables in their own configuration format.

### From a copy of this repository

To run your own changes, clone the repository, run `pnpm install`, and use `/path/to/arclight/node_modules/.bin/tsx /path/to/arclight/apps/mcp/src/stdio.ts` as the command instead of `npx -y @arclighthq/mcp`.

> [!WARNING]
> The API key gives full access to your leads. Keep it in the client's configuration on your own computer, and don't share that file. If your Arclight API runs on a server, reach it over HTTPS or a private network, not plain HTTP on the internet.

## Tools

| Tool                                                   | What it does                                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `get_briefing`                                         | New leads, drafts ready to send, follow-ups due and hunt results since yesterday (or a given time)  |
| `list_leads`                                           | Leads, highest priority first                                                                       |
| `get_lead`                                             | One lead with its evidence, contacts, drafts and WhatsApp and email links with the drafts filled in |
| `search_places`                                        | Live Google Maps search with ratings (nothing is stored)                                            |
| `track_places`                                         | Start tracking places from a search                                                                 |
| `track_websites`                                       | Start tracking businesses by website                                                                |
| `audit_lead`                                           | Audit a lead's website again                                                                        |
| `write_drafts`                                         | Write a WhatsApp message and an email from the audit evidence                                       |
| `update_lead`                                          | Move a lead through the pipeline or rate it 👍/👎                                                   |
| `add_do_not_contact`                                   | Add a domain, email address or phone number to the do-not-contact list                              |
| `list_hunts`, `create_hunt`, `update_hunt`, `run_hunt` | Manage [hunts](user-guide.md#hunts-finding-leads-on-its-own)                                        |

The server also gives the agent instructions: never send messages itself, mark a lead contacted only after you have sent the message, and respect do-not-contact requests.

## Troubleshooting

| Problem                                      | What to do                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| The client says the server failed to start   | Run the command in a terminal with the two variables set. It prints the problem.               |
| Every tool says `Missing or invalid API key` | Check `ARCLIGHT_API_KEY`, and that the key was created on the server the URL points to.        |
| `Could not reach the Arclight API`           | Check `ARCLIGHT_API_URL` and that the API is running (`/v1/health` answers `{"status":"ok"}`). |
| `Set GOOGLE_API_KEY to search Google Places` | Google search is off on your Arclight server; see [Configuration](configuration.md).           |
