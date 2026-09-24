// Writes the OpenAPI document to packages/sdk so the SDK types can be generated from it.
import { writeFileSync } from 'node:fs';
import type { AuditQueue, Database } from '@arclight/core';
import { createApp, openApiInfo } from '../src/app.ts';

// Building the document never touches the database or the queue.
const { v1 } = createApp({
  db: undefined as unknown as Database,
  auditQueue: undefined as unknown as AuditQueue,
});
const document = v1.getOpenAPI31Document({ ...openApiInfo, servers: [{ url: '/v1' }] });

const target = new URL('../../../packages/sdk/openapi.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${target.pathname}`);
