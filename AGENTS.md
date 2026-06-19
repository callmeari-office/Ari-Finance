# AGENTS.md - ARI Finance Web App

Internal finance app for Call Me Ari: expense proposals, approvals, thu-chi, funds, budgets, revenue, profit, reports, staff, permissions, notifications, PWA, email, and web push.

## Working Directory

Run app commands from `web-app/`.

## Commands

- Dev server: `npm run dev` -> http://localhost:3000
- Production build: `npm run build`
- Production start: `npm start`
- Unit tests: `npm test`
- Watch tests: `npm run test:watch`
- Schema drift check: `npm run db:check`
- Prisma generate: `npx prisma generate`
- Seed: `npx prisma db seed`
- Do not use `npm run lint`; ESLint 10 has a known environment bug.

## Test Accounts

- `owner` / `Ari@123456789`
- `test_manager` / `Ari@123456`
- `test_staff` / `Ari@123456`
- `test_leader` / `Ari@123456`

## Stack

- JavaScript only. Do not convert to TypeScript.
- Next.js 16 App Router + React 19.
- CSS Modules + Tailwind CSS v4 + global classes such as `glass-card` and `custom-table`.
- Icons: `lucide-react`.
- Database: Supabase PostgreSQL through Prisma 7, `@prisma/adapter-pg`, and `pg` Pool.
- Auth: custom session cookie `session_token`, HTTP-only, 30-day sliding TTL, `bcryptjs`.

## Important Paths

- `src/app/`: pages and API route handlers.
- `src/components/`: shared UI components.
- `src/lib/`: Prisma, auth, finance logic, roles, email, web push, dashboard queries.
- `prisma/schema.prisma`: Prisma schema.
- `prisma/MIGRATIONS.md`: migration notes.
- `scripts/check-schema-drift.mjs`: read-only schema/DB drift checker.
- `../CONTEXT.md`: workspace-level status, changelog, open work. Update this after completing major features or important fixes.

## Documentation Update Rules

Update documentation when a change is durable, important, or affects future work.

- Update `../CONTEXT.md` after major features, important bug fixes, workflow/security changes, DB/schema changes, deployment changes, or UX/UI redesign passes.
- Update `prisma/MIGRATIONS.md` when schema or SQL migration files change.
- Update this `AGENTS.md` when project rules, commands, invariants, folder responsibilities, or verification expectations change.
- If `CLAUDE.md` changes durable project rules, mirror the relevant rule here so Claude and Codex stay aligned.
- Keep long changelogs out of `AGENTS.md`; put history, decisions, and "what changed" notes in `../CONTEXT.md`.

## Next.js 16 Rule

This is Next.js 16. Before using unfamiliar Next APIs or changing framework-level behavior, read the relevant docs under `node_modules/next/dist/docs/`.

## Database Rules

- Keep `src/lib/prisma.js` using `ssl: { rejectUnauthorized: false }`. Supabase requires this setup.
- Prisma client must stay singleton-backed on `global`/`globalThis` for dev hot reload.
- Prisma 7 `db push` is unreliable on Windows. For schema changes, prefer SQL files plus `npx prisma db execute --file ./prisma/<file>.sql`.
- Do not pass `--schema` to Prisma 7 `db execute`; config is read from `prisma.config.ts`.
- After `npx prisma generate`, restart the dev server because Turbopack can keep an old Prisma client in memory.
- For DB-related changes, update `prisma/MIGRATIONS.md` and run `npm run db:check` when possible.

## Finance Data Invariants

Actual expense reporting must include both sources:

- `ThuChi` where `loaiGiaoDich = "CHI"` using `ngayGiaoDich`.
- `DeXuatChiPhi` where `laLichSu = true` using `ngayPhatSinh`.

Do not calculate actual expense from only one source.

Revenue actuals come from `KeHoachDoanhThu.thucTe`, synced from `DoanhThuHangNgay`.

## Routing And Naming

- Use Vietnamese route/folder names without accents and with hyphens: `de-xuat`, `thu-chi`, `ke-hoach`, `doanh-thu`, `nhan-su`, `cau-hinh`.
- Generated IDs follow `CP-/TC-/NCC-YYMMDD-xxxx`; see `src/lib/generateId.js`.
- Permissions are two-layered: default role rules plus `permissions` overrides from `/quyen`.

## UI And Theme Rules

- Mobile-first. Keep the app lightweight; warn before adding heavy queries, charting libraries, or large client dependencies.
- Do not hardcode theme colors in CSS or inline styles.
- Use CSS variables and semantic status tokens: `--success`, `--danger`, `--warning`, `--info`, plus `--*-bg`.
- For muted backgrounds/borders, use `rgba(var(--brand-brown-rgb), x)` or `var(--border)`.
- Use existing design tokens: `--shadow-sm`, `--shadow`, `--shadow-md`, `--shadow-lg`, `--ease-out`, `--ease-smooth`.
- Preserve intentional exceptions: traffic-light hex colors in JS, high-contrast chips, chart palettes, SVG `stroke`/`fill` attributes, and modal scrims.

## Verification Expectations

Before claiming work is complete:

- Run focused unit tests for changed pure logic.
- Run `npm test` for shared logic changes when reasonable.
- Run `npm run build` for app-level changes.
- Run `npm run db:check` for schema/database-related changes.
- If verification cannot run, state the exact reason.

## Claude And Codex Sync

- `CLAUDE.md` remains the Claude Code guidance file.
- This `AGENTS.md` is the Codex guidance file for `web-app/`.
- If durable project rules change in `CLAUDE.md`, update this file too.
- Do not copy long changelogs into this file; keep history in `../CONTEXT.md`.
