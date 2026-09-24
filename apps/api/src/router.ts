import { OpenAPIHono } from '@hono/zod-openapi';
import type { ApiKey } from '@jarvis/core';

export interface AppEnv {
  Variables: { apiKey: ApiKey };
}

/** A router whose request validation errors use the API's standard error shape. */
export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: 'invalid_request',
              message: 'Request validation failed',
              details: result.error.issues,
            },
          },
          400,
        );
      }
    },
  });
}
