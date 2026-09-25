# @arclight/react

React components for embedding [Arclight](https://github.com/yordanchusein1/arclight) in any admin panel: the daily briefing with send buttons, the lead list, a lead's page and the pipeline. MIT-licensed.

```sh
npm install @arclight/react
```

The components run in the browser and reach Arclight through a handler on your server, which checks your own sign-in and adds the API key. The key never reaches the browser.

```ts
// app/api/arclight/[...path]/route.ts (Next.js)
import { createArclightHandler } from '@arclight/react/server';

const handler = createArclightHandler({
  apiUrl: process.env.ARCLIGHT_API_URL,
  apiKey: process.env.ARCLIGHT_API_KEY,
  authorize: async () => isAdmin(), // your own check
});
export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
```

```tsx
import '@arclight/react/styles.css';
import { ArclightProvider, Briefing, LeadList, Pipeline } from '@arclight/react';

export default function Admin() {
  return (
    <ArclightProvider leadUrl="/admin/leads/:id">
      <Briefing />
      <LeadList />
      <Pipeline />
    </ArclightProvider>
  );
}
```

Full guide: [Embedding Arclight](https://github.com/yordanchusein1/arclight/blob/main/docs/embedding.md#react-components).
