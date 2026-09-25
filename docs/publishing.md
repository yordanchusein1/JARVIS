# Publishing the npm packages

This guide is for maintainers. Three packages are published to npm under the `@arclight` scope, all MIT-licensed:

| Package           | Source           | What it is                                  |
| ----------------- | ---------------- | ------------------------------------------- |
| `@arclight/sdk`   | `packages/sdk`   | Typed API client                            |
| `@arclight/react` | `packages/react` | React components and the server handler     |
| `@arclight/mcp`   | `apps/mcp`       | MCP server, run with `npx -y @arclight/mcp` |

The engine, API and dashboard are not published to npm; they run from Docker.

## How the packages are built

In the repository, packages point at their TypeScript sources, so development needs no build step. On publish, `pnpm publish` runs each package's `build` script (TypeScript to `dist/` with type declarations) and uses the `publishConfig` in `package.json`, which points `exports` and `bin` at `dist/` and replaces `workspace:*` dependencies with real version numbers.

Always publish with **pnpm**, not `npm publish`: npm would ignore `publishConfig.exports` and leave `workspace:*` in the published package.

## One-time setup

1. Create an account on [npmjs.com](https://www.npmjs.com/signup) and turn on two-factor authentication.
2. Create the **`arclight`** organization (**Add organization**, free for public packages). The scope `@arclight` belongs to whoever owns it.
3. On your computer: `npm login`.

## Releasing

1. Update `version` in the three `package.json` files. Keep them equal; the SDK must match the API of the same release. Note the release in [CHANGELOG.md](../CHANGELOG.md).
2. From a clean checkout of `main`:

   ```sh
   pnpm install
   pnpm lint && pnpm typecheck && pnpm test
   pnpm --filter @arclight/sdk publish --dry-run
   ```

   Check the file list: only `dist/`, `README.md`, `LICENSE` and `package.json`.

3. Publish, the SDK first because the others depend on it:

   ```sh
   pnpm --filter @arclight/sdk publish
   pnpm --filter @arclight/react publish
   pnpm --filter @arclight/mcp publish
   ```

   npm asks for your two-factor code for each package. pnpm refuses to publish with uncommitted changes or from a branch other than `main`.

4. Tag the release: `git tag v0.1.0 && git push origin v0.1.0`.

## Checking a release

```sh
npm view @arclight/sdk
ARCLIGHT_API_URL=http://localhost:8787 ARCLIGHT_API_KEY=arc_... npx -y @arclight/mcp
```

The second command should print `Arclight MCP server connected to …` and wait for input (stop it with Ctrl+C).
