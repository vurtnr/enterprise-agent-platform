# Repository Guidelines

## Project Structure & Module Organization
- `client/`: Vue 3 + Vite frontend. Source lives in `client/src/` with assets in `client/src/assets/` and public files in `client/public/`.
- `server/`: Bun + Elysia backend. Entry point is `server/src/index.ts` with agent logic under `server/src/agents/`.
- `native/`: Rust + N-API module (`napi-rs`). Rust source is `native/src/lib.rs`; JS bindings are in `native/index.js` and types in `native/index.d.ts`.

## Build, Test, and Development Commands
Run commands from each package directory.
- Install deps: `bun install`
- Client dev server: `bun run dev` (Vite dev server)
- Client build/preview: `bun run build`, `bun run preview`
- Server run: `bun run src/index.ts` (starts Elysia on port 3000)
- Native build/test: `bun run build`, `bun run test` (requires Rust toolchain)

## Coding Style & Naming Conventions
- Follow existing file patterns; keep code in the package’s `src/` folder.
- `native/` enforces 2‑space indentation, LF, and trimmed whitespace via `.editorconfig`.
- Vue components in `client/` use PascalCase filenames (e.g., `App.vue`).
- TypeScript and Rust formatting should follow existing config (`tsconfig.json`, `rustfmt.toml`).

## Testing Guidelines
- Native tests use Ava and live in `native/__test__/` with `*.spec.ts` naming.
- Run native tests with `bun run test` in `native/`.
- Client/server tests are not yet defined; if you add tests, wire them into `package.json` scripts.

## Commit & Pull Request Guidelines
- Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:` (e.g., `feat: first commit`).
- Keep commits scoped and explain intent in the subject line.
- PRs should include: a short summary, commands run, and screenshots for UI changes. Link issues when applicable.

## Configuration & Secrets
- Keep secrets in local `.env` files and do not commit them. Document any required variables in a README update.
