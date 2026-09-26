# Publishing the npm packages

This guide is for maintainers. Three packages are published to npm under the `@arclighthq` scope (the `arclight` organization on npm belongs to someone else), all MIT-licensed:

| Package             | Source           | What it is                                    |
| ------------------- | ---------------- | --------------------------------------------- |
| `@arclighthq/sdk`   | `packages/sdk`   | Typed API client                              |
| `@arclighthq/react` | `packages/react` | React components and the server handler       |
| `@arclighthq/mcp`   | `apps/mcp`       | MCP server, run with `npx -y @arclighthq/mcp` |

The engine, API and dashboard are not published to npm; they run from Docker.

## How the packages are built

In the repository, packages point at their TypeScript sources, so development needs no build step. On publish, `pnpm publish` runs each package's `build` script (TypeScript to `dist/` with type declarations) and uses the `publishConfig` in `package.json`, which points `exports` and `bin` at `dist/` and replaces `workspace:*` dependencies with real version numbers.

Always publish with **pnpm**, not `npm publish`: npm would ignore `publishConfig.exports` and leave `workspace:*` in the published package.

## One-time setup

Releases are published by the [Release workflow](../.github/workflows/release.yml) with npm **Trusted Publishing**: npm trusts that workflow in this repository, so no npm token exists anywhere.

For each of the three packages on npmjs.com, open the package → **Settings** → **Trusted Publisher** → **GitHub Actions** and enter:

| Field                | Value            |
| -------------------- | ---------------- |
| Organization or user | `yordanchusein1` |
| Repository           | `arclight`       |
| Workflow filename    | `release.yml`    |
| Environment name     | _(empty)_        |
| Allow `npm publish`  | ticked           |

A new package has to be published once by hand (`pnpm --filter <package> publish` after `npm login`) before its Trusted Publisher can be set.

## Releasing

1. Update `version` in the three `package.json` files to the same number, and note the release in [CHANGELOG.md](../CHANGELOG.md). Merge that into `main`.
2. Tag the release on `main`: `git tag v0.2.0 && git push origin v0.2.0`, or create a release with that tag on GitHub (**Releases → Draft a new release**).
3. The Release workflow checks the code, checks that the tag matches the versions, and publishes the SDK, the React components and the MCP server in that order. Versions already on npm are skipped, so a failed run can be re-run.

## Checking a release

```sh
npm view @arclighthq/sdk
ARCLIGHT_API_URL=http://localhost:8787 ARCLIGHT_API_KEY=arc_... npx -y @arclighthq/mcp
```

The second command should print `Arclight MCP server connected to …` and wait for input (stop it with Ctrl+C).
