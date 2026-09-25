# @arclight/sdk

Typed client for the [Arclight](https://github.com/yordanchusein1/arclight) HTTP API, generated from its OpenAPI document. MIT-licensed.

```sh
npm install @arclight/sdk
```

```ts
import { createArclightClient } from '@arclight/sdk';

const arclight = createArclightClient({
  baseUrl: process.env.ARCLIGHT_API_URL!, // e.g. http://localhost:8787
  apiKey: process.env.ARCLIGHT_API_KEY!, // server-side only
});

const { data, error } = await arclight.GET('/businesses', { params: { query: { limit: 20 } } });
```

Use the API key only on a server, never in a browser. For browser components, see [`@arclight/react`](https://www.npmjs.com/package/@arclight/react).

`sendLinks(draft, contacts)` builds the WhatsApp (`wa.me`) and email (`mailto:`) links that open a draft for a person to send. Arclight never sends messages itself.

Documentation: [API reference](https://github.com/yordanchusein1/arclight/blob/main/docs/api.md).
