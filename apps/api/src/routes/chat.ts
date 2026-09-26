import { createRoute, z } from '@hono/zod-openapi';
import { runChat, type ChatDependencies, type ChatModel } from '@arclight/core';
import { streamSSE } from 'hono/streaming';
import { createRouter } from '../router.ts';
import { ErrorSchema } from '../schemas.ts';

const chatRoute = createRoute({
  method: 'post',
  path: '/chat',
  operationId: 'chat',
  summary: 'Talk to Arclight in natural language',
  description: `Claude answers using Arclight's own data and actions (briefing, leads, Google Maps search, drafts, pipeline, hunts). It never sends messages to prospects.

The response is a stream of server-sent events:

- \`text\`: \`{"delta": "…"}\`, a piece of the answer
- \`tool\`: \`{"name": "list_leads", "status": "start" | "done" | "error"}\`, work in progress
- \`done\`: \`{"text": "…"}\`, the full answer; add it to \`messages\` as an \`assistant\` message for the next turn
- \`error\`: \`{"message": "…"}\`

Send the whole conversation each time; Arclight doesn't store it.`,
  tags: ['Chat'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: z.object({
            messages: z
              .array(
                z.object({
                  role: z.enum(['user', 'assistant']),
                  content: z.string().min(1).max(20_000),
                }),
              )
              .min(1)
              .max(50)
              .refine((m) => m.at(-1)?.role === 'user', 'The last message must be from the user')
              .openapi({ example: [{ role: 'user', content: 'What should I do today?' }] }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'A stream of server-sent events',
      content: { 'text/event-stream': { schema: z.string() } },
    },
    401: {
      description: 'Missing or invalid API key',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    503: {
      description: 'No language model is configured',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

export function chatRoutes(deps: ChatDependencies, model: ChatModel | undefined) {
  return createRouter().openapi(chatRoute, async (c) => {
    if (!model) {
      return c.json(
        {
          error: {
            code: 'not_configured',
            message:
              'Set ANTHROPIC_API_KEY or GEMINI_API_KEY on the API server to chat with Arclight.',
          },
        },
        503,
      );
    }
    const { messages } = c.req.valid('json');
    return streamSSE(c, async (stream) => {
      // Events are written one after another, in the order they happen.
      let written = Promise.resolve();
      const send = (event: string, data: object) => {
        written = written.then(() => stream.writeSSE({ event, data: JSON.stringify(data) }));
      };
      try {
        await runChat({ ...deps, model }, messages, ({ type, ...data }) => send(type, data));
        await written;
      } catch (error) {
        console.error('Chat failed:', error);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: 'The language model could not answer.' }),
        });
      }
    }) as never;
  });
}
