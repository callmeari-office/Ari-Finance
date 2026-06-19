# ARI Finance Project Audit - 2026-06-19

## Scope

Full overview audit for `web-app/`: project context, codebase structure, tests/build/db drift, finance correctness, security/permissions, UX/UI on mobile and desktop, performance, and maintainability.

## Method

- Audit first; no application code changes unless explicitly approved.
- Record evidence from commands and source references.
- Prioritize findings as Critical, High, Medium, or Low.
- Keep Claude/Codex compatibility intact.

## Executive Summary

Status: completed first-pass audit and implementation pass.

The app is broadly runnable: dev server starts on `localhost:3000`, DB schema drift check passes, and production build passes. The main risks found are not build stability; they are workflow integrity and data correctness. The highest priority is locking down proposal status transitions so clients cannot mark proposals as paid outside the approval flow.

Top priorities:

1. Fix proposal workflow authorization/status transitions.
2. Fix the failing Excel date parser test before relying on historical imports.
3. Fix responsive horizontal overflow on key owner pages.
4. Normalize financial-report date-source invariants.
5. Reduce security/maintenance debt incrementally after the critical fixes.

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Started audit | `Get-Date -Format o` | `2026-06-19T14:07:50.6308267+07:00` | Asia/Saigon |
| Git HEAD | `git rev-parse --short HEAD` | `e8a69cc` | Run inside `web-app/` |
| Git status | `git status --short` | `M AGENTS.md`, `?? docs/audits/` | Expected documentation changes from Codex setup and this audit |
| Package scripts | `Get-Content -Raw package.json` | Available | `dev`, `build`, `test`, `db:check`; `lint` exists but should not be used due known ESLint 10 issue |
| Unit tests | `npm test` | FAIL | 69 passed, 1 failed. `src/app/de-xuat/helpers.test.js` expects `parseDateCell('26-06-08')` to return `2026-06-08`, actual `2008-06-26`. |
| Schema drift | `npm run db:check` | PASS | `schema.prisma` matches DB. |
| Production build | `npm run build` | PASS | Next.js 16.2.6 build compiled successfully; 70 static pages generated. |
| Dev server | `npm run dev` via background `Start-Process` | PASS | `http://localhost:3000` returned HTTP 200, content length 15810. Listener owner process: `node` on port 3000. |
| Browser login | Playwright, owner / `Ari@123456789` | PASS | `/api/auth/login` returned 200 and session cookie was set. |
| Responsive audit | Playwright, authenticated owner session | PASS with findings | 22 checks: 11 routes on mobile `375x812`, 11 routes on desktop `1366x768`. Horizontal overflow found on `/de-xuat/duyet`, `/thu-chi`, `/nhan-su`. |
| Targeted regression tests | `npm test -- src/lib/proposalWorkflow.test.js src/app/de-xuat/helpers.test.js` | PASS | 14 tests passed. |
| Full unit tests after fixes | `npm test` | PASS | 10 files passed, 80 tests passed. |
| Production build after fixes | `npm run build` | PASS | Next.js 16.2.6 build compiled successfully; 70 static pages generated. |
| Schema drift after fixes | `npm run db:check` | PASS | `schema.prisma` matches DB. |
| Responsive re-audit after fixes | Playwright, authenticated owner session | PASS | `/de-xuat/duyet`, `/thu-chi`, `/nhan-su` report `overflowX: 0` and `smallControls: 0` at mobile `375x812` and desktop `1366x768` under the audit heuristic. Wide tables remain inside local scroll containers. |

## Baseline Notes

- Main app code is under `web-app/`.
- Current audit intentionally avoids code/schema changes.
- `next.config.mjs` defines security headers and CSP globally. CSP currently allows `script-src 'unsafe-inline' 'unsafe-eval'` and `style-src 'unsafe-inline'`; this needs security review in context because the comments indicate inline theme script and inline styles are current dependencies.

## Findings

## Implementation Pass - 2026-06-19

Fixed in this pass:

- Added `src/lib/proposalWorkflow.js` and `src/lib/proposalWorkflow.test.js`.
- Proposal create and bulk create now derive status server-side instead of trusting client-supplied `trangThai`.
- Proposal edit no longer lets staff/leader push a proposal into paid status through the normal edit path.
- Single and bulk approve now use centralized approvable-state validation and reject historical, canceled, already-linked, and wrong-state proposals.
- Approval fund validation now requires an active fund.
- Excel date parsing now checks `yyyy-mm-dd` / `yy-mm-dd` before ambiguous day-first formats.
- Historical bù trừ Thu/Chi pair creation now runs inside `prisma.$transaction`.
- Dashboard and email historical expense reporting now use `DeXuatChiPhi.ngayPhatSinh`.
- Password reset/change client validation now matches the server minimum of 10 characters.
- Responsive overflow fixes were applied for `/de-xuat/duyet`, `/thu-chi`, and `/nhan-su`.
- Small touch target fixes were applied to PushToggle, Onboarding skip, DateInput calendar, nhan-su action buttons, and mobile Sidebar controls.
- Added `src/lib/generateIdCore.js` / `src/lib/generateId.test.js` and retry helpers for Prisma unique constraint `P2002`.
- Normal proposal create, bulk proposal create, direct Thu/Chi create, historical balancing Thu/Chi pair, and approval-created Thu/Chi records now retry voucher generation on unique collisions.
- Historical balancing mode now allocates two sequential `TC` codes in one block instead of calling `generateMaThuChi()` twice before insert.
- Production CSP no longer includes `unsafe-eval`; development keeps it for Next dev runtime compatibility.
- Targeted theme-token sweep: PushToggle status colors, nhan-su hover/spinner colors, and thu-chi mobile card colors now use semantic/theme variables.

## Implementation Pass 2 - 2026-06-19 (Claude)

Fixed in this pass:

- **`/api/de-xuat/import` refactored**: removed local `getCpPrefix`/`getTcPrefix` duplicates; now imports `getDeXuatPrefix`, `getThuChiPrefix`, `allocateSequentialCodes`, `withUniqueCodeRetry` from `src/lib/generateId.js`. The no-quy `createMany` batch and each with-quy per-row transaction are both wrapped in `withUniqueCodeRetry` with allocation inside the retry callback, so a `P2002` conflict re-reads fresh DB state before retrying. Behavior is fully preserved: no-quy → `DeXuatChiPhi` only; with-quy → `$transaction` creating `ThuChi` then `DeXuatChiPhi`.
- **Counter-table assessment**: reviewed concurrency exposure. App has ~10 concurrent users (1 owner, 2 managers, ~7 staff); historical import is owner-only. The 5-attempt retry wrapper is sufficient for this scale. A DB counter table would eliminate the read-then-write race but adds schema complexity. **Recommendation**: implement only if concurrent user count exceeds ~50 or if production logs show repeated P2002 retries.
- **Color sweep — semantic RGB tokens added**: added `--success-rgb`, `--danger-rgb`, `--warning-rgb`, `--info-rgb` to all three theme blocks (`:root`, `[data-theme="dark"]`, `[data-theme="pink"]`) in `globals.css`. These follow the same pattern as `--brand-brown-rgb` and `--primary-rgb`.
- **Color sweep — `thu-chi.module.css`**: replaced Tailwind hardcoded color values with theme-aware tokens in `.thuBadge`, `.chiBadge`, `.originMergeBadge` borders; `.errorAlert` and `.successAlert` borders; `.viewDetailBtn:hover` background and border; `.cancelTxBtn:hover` border.
- **Color sweep — `ke-hoach.module.css`**: replaced Tailwind hardcoded backgrounds in `.badgeGreen`, `.badgeYellow`, `.badgeRed`; replaced backgrounds, borders, and text colors in `.errorAlert` and `.successAlert` with `var(--danger-bg)` / `var(--success-bg)` / `rgba(var(--*-rgb), 0.3)` / `var(--alert-error-text)` / `var(--alert-success-text)`.
- **Playwright smoke tests**: created `playwright.config.js` and `e2e/smoke.spec.js` with 5 tests (login as owner, dashboard, `/de-xuat`, `/thu-chi`, `/de-xuat/duyet`). Added `test:e2e` script to `package.json`. Requires dev server; runs `npm run dev` automatically if none is listening. Run: `npm run test:e2e`.

| Check | Command | Result |
|---|---|---|
| Unit tests after Pass 2 | `npm test` | PASS — 80/80 |
| Production build after Pass 2 | `npm run build` | PASS |
| Schema drift after Pass 2 | `npm run db:check` | PASS |

Residual risks after both passes:

- The long-term voucher-code strategy should move to a DB counter table per prefix if very high concurrency (50+ users) becomes common. Current retry is sufficient for the actual user base.
- Theme hardcoded color debt in `ke-hoach.module.css` indigo column highlights (`rgba(99,102,241,x)`, `#a5b4fc`, `#c7d2fe`) was intentionally left: it appears to be a specific column-accent design choice and there is no matching semantic token. Future cleanup should confirm intent before replacing.
- Wide data tables intentionally scroll inside local containers; page-level overflow and small touch targets are resolved on the audited routes.
- E2e smoke tests are written but have not been executed in this session (requires a running Chromium browser). Verify with `npm run test:e2e` before relying on them in CI.

### High: Excel date parsing regression or test/implementation mismatch

- Evidence: `npm test` fails in `src/app/de-xuat/helpers.test.js`.
- Expected: `parseDateCell('26-06-08')` -> `2026-06-08`.
- Actual: `2008-06-26`.
- Risk: Historical expense import can assign the wrong transaction date if 2-digit year formats are parsed ambiguously. This can distort monthly actual expenses, budget comparisons, reports, and profit dashboards.
- Recommended next step: inspect `src/app/de-xuat/helpers.js` and confirm accepted Excel date formats. Add explicit parsing for `yy-mm-dd` versus `dd-mm-yy` or reject ambiguous strings with row-level import errors.

### Critical: Proposal status can be client-controlled outside approval workflow

- Evidence: `src/app/api/de-xuat/route.js` accepts `trangThai` from request body and allows `CHO_THANH_TOAN`, `CHO_HOAN_UNG`, and `DA_THANH_TOAN` for any authenticated user who can create a proposal.
- Evidence: `src/app/api/de-xuat/[id]/route.js` later applies `if (trangThai) updateData.trangThai = trangThai` in the normal edit path after only owner/self proposal checks.
- Risk: A staff/leader user can create or edit their own proposal into `DA_THANH_TOAN` without the approval action, `quyThanhToanId`, `thuChiId`, or `nguoiDuyetId`. That bypasses the approval workflow and can create records that look paid but are not reflected in funds.
- Recommended fix: derive `trangThai` server-side from `nguonTien` and role/workflow. Remove `trangThai` from normal create/edit input for non-owner import/admin flows. Only approval endpoints should transition to `DA_THANH_TOAN`, and only with transaction-created `ThuChi` or explicit approved "paid outside fund" flow.

### High: Approval endpoints do not strictly validate allowed source status/type

- Evidence: `src/app/api/de-xuat/[id]/route.js` approval action only blocks if `thuChiId !== null`; it does not require `trangThai` to be `CHO_THANH_TOAN` or a valid unpaid `DA_THANH_TOAN && laLichSu=false` case.
- Evidence: `src/app/api/de-xuat/duyet-nhieu/route.js` allows `DA_THANH_TOAN && thuChiId === null` without checking `laLichSu === false`.
- Risk: Direct API calls can approve canceled, already-marked-paid, or historical proposals and create `ThuChi` records that double-count or revive invalid workflow states.
- Recommended fix: centralize an `assertApprovableProposal()` helper and require:
  - `laLichSu === false`
  - `thuChiId === null`
  - status is exactly `CHO_THANH_TOAN`, or the explicit pre-paid pending-fund state if the product still needs it
  - not `HUY`
  - valid active fund

### High: Bulk proposal creation also trusts client-supplied status

- Evidence: `src/app/api/de-xuat/bulk/route.js:10` allows `DA_THANH_TOAN`; `src/app/api/de-xuat/bulk/route.js:120` writes `trangThai: r.trangThai`.
- Risk: A bulk import can create paid-looking proposals that are not connected to a `ThuChi` record or an approval audit trail.
- Recommended fix: use the same server-side status derivation as normal proposal create. If an admin historical import needs `DA_THANH_TOAN`, keep it in the dedicated import/history route with explicit `laLichSu` semantics.

### High: Bù trừ lịch sử creates paired Thu/Chi outside a DB transaction

- Evidence: `src/app/api/thu-chi/route.js:448` generates two IDs concurrently and `src/app/api/thu-chi/route.js:451` creates the CHI and THU pair via `Promise.all`.
- Risk: if one insert succeeds and the other fails, the "bù trừ" pair no longer nets to zero and can distort fund balance/history.
- Recommended fix: generate/create the pair inside `prisma.$transaction`. Also consider creating deterministic paired IDs sequentially to avoid same-prefix race.

### Medium: Generated voucher codes are race-prone under concurrent requests

- Evidence: `src/lib/generateId.js:11-13` reads the current last code by prefix and increments in application code.
- Evidence: bulk proposal route has its own similar last-code logic at `src/app/api/de-xuat/bulk/route.js:100-113`.
- Risk: two requests in the same day can generate the same `CP-/TC-/NCC-YYMMDD-xxxx` code. If the DB has unique constraints this becomes intermittent 500s; if not, duplicate voucher IDs become possible.
- Recommended fix: add unique DB constraints for voucher codes if missing, and wrap generation in a retry-on-unique-conflict helper. Longer term, use a DB counter table per prefix/day.

### Medium: Historical expense date invariant is inconsistent in some reports

- Evidence: project rule says historical expenses use `DeXuatChiPhi.ngayPhatSinh`.
- Evidence: `src/app/api/dashboard/route.js:125-129` groups historical expense actuals by `COALESCE("ngayThanhToan", "ngayPhatSinh")`.
- Evidence: `src/lib/email.js:508-509` also filters historical expenses by `COALESCE("ngayThanhToan", "ngayPhatSinh")`.
- Risk: if `ngayThanhToan` exists and differs from `ngayPhatSinh`, monthly/yearly dashboard/email numbers can drift from the canonical cost logic.
- Recommended fix: replace these historical-cost filters/groupings with `ngayPhatSinh`, unless a specific report explicitly documents a cash-date view.

### Medium: Mobile/desktop horizontal overflow on key operational pages

- Evidence: authenticated Playwright audit at mobile `375x812` found horizontal overflow:
  - `/de-xuat/duyet`: `overflowX` about `289px`; `main` measured around `1520px` wide.
  - `/thu-chi`: `overflowX` about `229px`; filter/header area measured around `1396px` wide.
  - `/nhan-su`: `overflowX` about `260px`; header/filter area measured around `1427px` wide.
- Evidence: the same pages still showed overflow at desktop `1366x768`, so this is not only a narrow-phone issue.
- Risk: owner workflows need horizontal panning, buttons can be off-screen, and mobile usability degrades on high-frequency pages.
- Recommended fix: inspect the page-level CSS modules for fixed/min widths and desktop-only header layouts. Add responsive wrappers for wide tables, allow header action groups to wrap, and ensure main content uses `min-width: 0` and `max-width: 100%`.

### Medium: Several interactive controls are below comfortable touch size

- Evidence: Playwright found controls below `32px` high/wide across pages, including notification badge button `28x28`, push toggle `45x21`, onboarding skip `56x24`, date picker icon `21x21`, and nhân sự action buttons `26x29`.
- Risk: mobile tap accuracy and accessibility suffer, especially on owner/admin pages with dense controls.
- Recommended fix: target at least `36px`, ideally `40px`, for icon/toggle buttons on touch layouts. Keep visual density by increasing hit-area padding rather than only icon size.

### Medium: Password length validation mismatch between client and server

- Evidence: `src/app/dat-lai-mat-khau/page.js:48` and `src/app/doi-mat-khau/page.js:50` validate minimum length `6`.
- Evidence: server routes require minimum length `10`: `src/app/api/auth/dat-lai-mat-khau/xac-nhan/route.js:68`, `src/app/api/auth/doi-mat-khau/route.js:35`.
- Risk: user passes client validation but receives a server error after submit.
- Recommended fix: set client validation and helper copy to `>= 10` everywhere.

### Medium: CSP still allows `unsafe-eval`

- Evidence: `next.config.mjs:9` sets `script-src 'self' 'unsafe-inline' 'unsafe-eval'`.
- Risk: `unsafe-eval` weakens XSS defense in production. `unsafe-inline` may currently be needed by the theme/bootstrap style approach, but `unsafe-eval` should be rechecked.
- Recommended fix: make CSP environment-aware. Keep looser settings in dev if needed; remove `unsafe-eval` from production after testing Next 16 build/runtime.

### Low: Next.js scroll-behavior warning in console

- Evidence: browser console warning after login: Next detected `scroll-behavior: smooth` on `<html>` and recommends adding `data-scroll-behavior="smooth"`.
- Risk: route transition scroll behavior can be inconsistent.
- Recommended fix: add `data-scroll-behavior="smooth"` to the root `<html>` if smooth scrolling is intentional.

### Low: Theme hardcoded color debt remains in UI code

- Evidence: broad scan still finds many hardcoded hex colors and inline styles in `src/app/*` and `src/components/*`.
- Risk: not all of these are bugs because some exceptions are intentional for charts/chips. But the volume makes future theme changes more fragile.
- Recommended fix: after functional fixes, run a focused theme sweep and classify each instance as semantic-token, intentional chart/chip exception, or removable hardcode.

## Roadmap

### Phase 1: Safety fixes

1. Patch proposal create/edit/bulk status handling.
2. Add centralized approvable-state validation for single and bulk approve.
3. Add/adjust tests for forbidden status escalation and approval invalid states.
4. Fix `parseDateCell` behavior and tests.

### Phase 2: Finance consistency

1. Fix bù trừ lịch sử transaction atomicity.
2. Align historical expense date fields in dashboard/email reporting.
3. Add regression tests around historical expenses and dashboard totals.
4. Review voucher code uniqueness and add retry/constraint strategy.

### Phase 3: UX/UI responsive pass

1. Fix horizontal overflow on `/de-xuat/duyet`, `/thu-chi`, `/nhan-su`.
2. Increase mobile hit areas for small controls.
3. Re-run Playwright responsive audit and capture screenshots if needed.

### Phase 4: Hardening/maintenance

1. Review production CSP and remove `unsafe-eval` if possible.
2. Clean up hardcoded color debt by category.
3. Add lightweight smoke tests for login and key authenticated routes.
