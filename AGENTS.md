# Repository Guidelines

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Overview

Jev Interface Hub is a Next.js App Router application for building, validating, publishing, and running TypeSafe/Jev Interfaces. Guests can edit and run locally; PostgreSQL-backed accounts provide saved drafts, immutable published versions, a public Hub, and administration.

## Architecture & Data Flow

- `src/app/**/page.tsx` renders server pages; `src/app/api/**/route.ts` handles HTTP. Pages/routes authenticate, parse input, and call feature services; interactive `src/components/` client components manage editor state and call APIs.
- `src/lib/manifest/` defines the Manifest contract, validates inputs, and resolves state templates. `src/lib/runtime/` orchestrates execution through `src/lib/typesafe/`, which calls the external TypeSafe endpoint, parses responses, and maps typed errors. Keep user TypeSafe keys transient; do not persist keys, input state, or raw answers.
- Cloud routes use `src/lib/auth/` for NextAuth JWT/OAuth identity, then database-injected `src/lib/interfaces/`, `hub/`, `admin/`, `stats/`, and `ai-builder/` services. `src/db/database.ts` lazily obtains the Drizzle/PostgreSQL database; `src/db/schema.ts` and SQL migrations define storage. Published version snapshots are immutable.
- `src/proxy.ts` attaches a nonce-based CSP to matching requests. Maintain security headers in `next.config.ts`.

## Key Directories

- `src/app/`: App Router pages and route handlers; `src/components/`: interactive builder, credentials, Hub, and results UI.
- `src/lib/`: domain validation, runtime, authentication, HTTP helpers, and feature services; `src/db/`: schema, connection, and versioned SQL migrations.
- `scripts/`: migration and catalog seed commands; `seeds/`: example Manifests; `tests/unit`, `tests/integration`, `tests/e2e`: Vitest and Playwright checks.

## Development Commands

```sh
npm ci
npm run dev
npm run db:migrate  # requires DATABASE_URL; run before cloud features
npm run db:seed     # optional, after migration
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

`npm test` runs both Vitest suites. No `start` script is defined; do not assume `npm run start` works. See `README.md` for deployment/environment prerequisites.

## Code Conventions & Common Patterns

- Use strict TypeScript and ES modules. Follow nearby feature-focused files rather than introducing parallel abstractions; `*.tsx` for React, `route.ts` for HTTP verbs, `*.test.ts` for Vitest and `*.spec.ts` for Playwright.
- Keep server-side authorization and visibility checks in feature services (e.g. `createInterfaceService(db)`), not only in UI. Use injected database/fetch/clock dependencies where existing APIs support them for deterministic tests.
- Validate Manifest and request inputs at boundaries (`src/lib/manifest/`, Zod route helpers); represent runtime failures with typed `RuntimeError` codes/status instead of leaking upstream bodies or keys. Await App Router route params and asynchronous identity/database work.
- Browser editor state uses client React state; draft persistence uses browser storage. Do not confuse browser-local drafts with PostgreSQL cloud drafts. Preserve published version immutability and migration history; add a new SQL migration rather than editing one already applied.

## Important Files

- `package.json`, `package-lock.json`: scripts and npm dependency versions; `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`: TypeScript, lint, and Next settings.
- `.env.example`: variable names without secrets; `README.md`: setup and cloud requirements; `jev-interface-manifest.schema.json`: portable Manifest schema.
- `src/app/layout.tsx`, `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/interfaces/service.ts`, `src/lib/runtime/run.ts`, `src/db/database.ts`, `scripts/migrate.mjs`: main execution and persistence touchpoints.

## Runtime/Tooling Preferences

- Use Node.js 20.9+ and npm (lockfile v3); install dependencies before consulting the installed Next.js guides referenced above. Next.js 16 APIs may differ from familiar releases; read relevant `node_modules/next/dist/docs/` guidance before modifying Next code.
- Cloud features require PostgreSQL `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, and GitHub or Google OAuth credentials; guest editing can run without PostgreSQL. AI Builder additionally requires `AI_BUILDER_API_KEY` when enabled. Use `.env.example` for available optional settings; never commit secrets.
- Runtime rate limiting uses in-process counters; multi-instance deployments need shared rate-limit state. Client-provided TypeSafe keys are not a server environment prerequisite.

## Testing & QA

- Vitest (`vitest.config.ts`) runs Node unit and integration suites; integration tests use embedded PGlite and apply real migrations. Cover validation, authorization, persistence and runtime error behavior, not implementation details.
- Playwright (`playwright.config.ts`) exercises desktop/mobile Chromium against a dev server on port 3217. Most cases mock external TypeSafe traffic; `tests/e2e/live-cloud.spec.ts` requires a separate, disposable, migrated PostgreSQL database via `E2E_DATABASE_URL` and does not clean its created records. Real OAuth callbacks remain outside that signed-test-session flow.
- For a change, run its targeted suite plus `npm run typecheck`, `npm run lint`, and `npm run build` as applicable; exercise affected UI/API behavior. See `README.md` for the complete verification sequence.
