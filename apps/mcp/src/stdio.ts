#!/usr/bin/env -S npx tsx
// Runs the Arclight MCP server over stdio, for Claude Desktop, Claude Code and other MCP clients.
// Messages go through stdout; logs go to stderr so they never corrupt the protocol stream.
import { createInterface } from 'node:readline';
import { createArclightClient } from '@arclight/sdk';
import { createMcpServer } from './server.ts';

const baseUrl = process.env.ARCLIGHT_API_URL;
const apiKey = process.env.ARCLIGHT_API_KEY;
if (!baseUrl || !apiKey) {
  console.error(
    'Set ARCLIGHT_API_URL (e.g. http://localhost:8787) and ARCLIGHT_API_KEY (create one with create-api-key).',
  );
  process.exit(1);
}

const server = createMcpServer({ arclight: createArclightClient({ baseUrl, apiKey }) });
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

const pending = new Set<Promise<void>>();

lines.on('line', (line) => {
  if (!line.trim()) return;
  const work = server
    .handleLine(line)
    .then((response) => {
      if (response) process.stdout.write(`${response}\n`);
    })
    .catch((error: unknown) => console.error('Arclight MCP error:', error))
    .finally(() => pending.delete(work));
  pending.add(work);
});
// When the client closes stdin, finish the requests in flight, then exit.
lines.on('close', async () => {
  await Promise.all(pending);
  process.exit(0);
});
console.error(`Arclight MCP server connected to ${baseUrl}`);
