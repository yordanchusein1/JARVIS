import type { ArclightClient } from '@arclighthq/sdk';
import { ToolError, tools, type Tool } from './tools.ts';

/**
 * A Model Context Protocol server (JSON-RPC 2.0) that exposes Arclight as tools. It speaks only to
 * Arclight's public API, with an API key, like any other client. It has no tool that sends a
 * message to a prospect (docs/DECISIONS.md, D4 and D10).
 */

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export const SERVER_VERSION = '0.2.1';

const INSTRUCTIONS = `Arclight is an agency's lead generation engine. It finds businesses, audits their websites, scores each lead on need and capacity with evidence, and drafts outreach.

- Arclight never sends messages, and neither should you. Show the person the drafts and the WhatsApp or email links from get_lead; they review and send.
- Only mark a lead "contacted" after the person says they sent the message.
- When a business asks not to be contacted, use add_do_not_contact.
- Google Maps details (names, ratings) are live and must not be saved elsewhere.
- For "what's new?" or "what should I do today?", call get_briefing first.`;

interface Request {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

type Response =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | {
      jsonrpc: '2.0';
      id: string | number | null;
      error: { code: number; message: string; data?: unknown };
    };

const toolsByName = new Map(tools.map((t) => [t.name, t]));

function describe(tool: Tool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: { title: tool.title, ...tool.annotations },
  };
}

/** Checks required arguments and simple types; the Arclight API validates the rest. */
function checkArguments(tool: Tool, args: Record<string, unknown>): string | null {
  const schema = tool.inputSchema as {
    properties: Record<string, { type?: string | string[] }>;
    required: string[];
  };
  for (const name of schema.required) {
    if (args[name] === undefined) return `Missing required argument "${name}".`;
  }
  for (const [name, value] of Object.entries(args)) {
    const property = schema.properties[name];
    if (!property) return `Unknown argument "${name}".`;
    const types = [property.type ?? []].flat();
    const actual =
      value === null
        ? 'null'
        : Array.isArray(value)
          ? 'array'
          : Number.isInteger(value)
            ? 'integer'
            : typeof value;
    const ok = types.some((t) => t === actual || (t === 'number' && actual === 'integer'));
    if (types.length > 0 && !ok) return `Argument "${name}" must be ${types.join(' or ')}.`;
  }
  return null;
}

async function callTool(arclight: ArclightClient, params: Record<string, unknown> = {}) {
  const tool = toolsByName.get(String(params.name));
  if (!tool) return null;
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  const invalid = checkArguments(tool, args);
  if (invalid) return { content: [{ type: 'text', text: invalid }], isError: true };
  try {
    const result = await tool.run(arclight, args);
    const structured =
      result && typeof result === 'object' && !Array.isArray(result) ? result : { result };
    return {
      content: [{ type: 'text', text: JSON.stringify(result ?? { ok: true }, null, 2) }],
      structuredContent: structured,
    };
  } catch (error) {
    if (error instanceof ToolError) {
      return { content: [{ type: 'text', text: error.message }], isError: true };
    }
    // Network failures and the like: tell the agent without leaking internals.
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Could not reach the Arclight API: ${message}` }],
      isError: true,
    };
  }
}

export function createMcpServer({ arclight }: { arclight: ArclightClient }) {
  /** Handles one JSON-RPC message; returns the response, or null for notifications. */
  async function handle(message: unknown): Promise<Response | null> {
    const request = message as Partial<Request>;
    const id = request?.id ?? null;
    const isNotification = request?.id === undefined;
    if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
      return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid request' } };
    }
    const reply = (result: unknown): Response | null =>
      isNotification ? null : { jsonrpc: '2.0', id, result };
    const fail = (code: number, text: string): Response | null =>
      isNotification ? null : { jsonrpc: '2.0', id, error: { code, message: text } };

    switch (request.method) {
      case 'initialize': {
        const requested = String(request.params?.protocolVersion ?? '');
        return reply({
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
            ? requested
            : SUPPORTED_PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'arclight', title: 'Arclight', version: SERVER_VERSION },
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping':
        return reply({});
      case 'tools/list':
        return reply({ tools: tools.map(describe) });
      case 'tools/call': {
        const result = await callTool(arclight, request.params);
        if (!result) return fail(-32602, `Unknown tool: ${String(request.params?.name)}`);
        return reply(result);
      }
      default:
        // Notifications such as notifications/initialized need no answer.
        if (request.method.startsWith('notifications/')) return null;
        return fail(-32601, `Method not found: ${request.method}`);
    }
  }

  /** Handles one line of the stdio transport, which may hold a message or a batch. */
  async function handleLine(line: string): Promise<string | null> {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      });
    }
    if (Array.isArray(message)) {
      const responses = (await Promise.all(message.map(handle))).filter((r) => r !== null);
      return responses.length > 0 ? JSON.stringify(responses) : null;
    }
    const response = await handle(message);
    return response ? JSON.stringify(response) : null;
  }

  return { handle, handleLine };
}
