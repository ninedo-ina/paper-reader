# PaperHelper

PaperHelper is an academic paper reading workspace. It combines a Next.js client, a Kotlin/Spring Boot API, PDF storage, GROBID metadata extraction, annotations, notes, AI-assisted reading, research discussions, and private messaging.

The repository contains the C-side product and its API. The administration console is maintained separately in the companion project at `/root/paperread-admin`; it uses the same PostgreSQL instance but keeps administrator data in the `paperread_admin` schema.

> **Maintainer start here:** read the [documentation index](docs/README.md), then the [new maintainer guide](docs/NEW_MAINTAINER_GUIDE.md) and [complete project status](docs/PROJECT_STATUS.md). They record the real production topology, configuration rules, known risks, and release workflow without requiring previous chat context.

## Current Iteration: v0.1.51

- Branch: `feature/v0.1.51`
- Requirement: `REQ-202609-0126` as a **scope correction, not a new requirement** — v0.1.50 restyled *both* left panels, but only the second one was ever in scope.
- Scope: the client has two different left panels and they must not be styled alike. The **menu bar** (`src/components/layout/Sidebar.tsx`, the global `w-[220px]` aside holding the 书架 / 发现 / 交流 sections) is a single column of full-width 211px rows, and its count was — and is again — an **inline pill at the tail of the row**: a `flex-1 text-start` label and a `ms-auto` `rounded-[10px]` pill as flex siblings (`Sidebar.tsx:96-102`). The **sidebar** is the `w-72` (288px) aside that opens *after* a menu item is clicked; its `TabBar` (所有 / 创建 / 导入 / 收藏) holds four equal-width buttons of ~71.75px each, and **only** there is the corner badge correct — that half of v0.1.50 was right and is untouched here. The distinguishing factor is the container shape, not "consistent styling": a narrow container with equal-width items needs the badge out of flow, a roomy single-column list does not.
- Reverting `Sidebar.tsx` restores the exact pre-v0.1.50 markup. The only delta from the original is two logical-direction class names (`text-left` → `text-start`, `ml-auto` → `ms-auto`), which are **kept** because the client ships fourteen locales including the RTL Arabic, Persian and Uyghur.
- Tests: no new test for the menu bar this round. `frontend/src/test/tabbar-badge.test.tsx` (5 tests) still locks the sidebar's corner badge shape and must not be touched. The client stays at 22 test files and 129 tests, all green; `pnpm exec tsc --noEmit`, `next lint` (only the pre-existing warnings) and `pnpm run build` all exit 0.
- **Frontend-only change**: no database migration, no API change, no new dependency, and **zero Kotlin changes**. `backend/VERSION` and `backend/build.gradle.kts` were bumped to `0.1.51` per the release convention, but the backend jar was deliberately **not** rebuilt and `paper-reader-backend` was **not** restarted — the live backend still runs `paper-reader-backend-0.1.49.jar`, so `/api/health` keeps reporting `0.1.49`. That is intentional, not a missed deployment; use the favicon `?v=` and the build-asset hashes to determine the deployed frontend version.
- Status: released. Commits `8331e47` (the revert plus the `docs/ATTENTION.md` correction) and `f3ff2be` (version bump) on `feature/v0.1.51`, merged into `main` on 2026-09-17 UTC as the explicit `--no-ff` merge commit `cd46367` (parents `f2f708e` + `f3ff2be`), with `dev` fast-forwarded `f2f708e` → `cd46367`, then a docs-only follow-up on the same branch brought into `main` by a second explicit `--no-ff` merge commit, which `dev` was fast-forwarded to as well — no force-push, no history rewrite, and `main` and `dev` end up on the same commit. Deployed (`pnpm run build` then `pm2 restart paper-reader-frontend`, restart count 12 → 13) and verified in production: the served stylesheets and the `[locale]/page-*.js` chunk are byte-identical to the local build, the served CSS carries both shapes at once — `ms-auto` / `px-[7px]` / `py-[2px]` / `rounded-[10px]` (the menu bar's restored inline pill) *and* `min-w-[16px]` / `.-end-2{…}` (the sidebar's corner badge) — with `ml-auto` at zero occurrences, the favicon reads `?v=0.1.51`, and on the live page all eight menu rows measure an inline pill (`position: static`, inside the button, vertically centred) while all four 71.75px tabs still measure `position: absolute` / `inset-inline-end: -8px`, in both `zh` (LTR) and `ar` (RTL, mirrored) — with an in-page negative control injecting the v0.1.50 markup that still reads `absolute`, proving the metric catches the original over-reach; deployment detail is recorded in `docs/MAINTENANCE.md`.

## Previous Iteration: v0.1.50

- Branch: `feature/v0.1.50`
- Requirement: `REQ-202609-0126` — the bookshelf sidebar's four tabs broke as soon as they carried a count badge. (Scope note added in v0.1.51: only the `TabBar` half of this iteration stands; the `Sidebar.tsx` change described below was out of scope and has been reverted — see the current iteration above.)
- Scope: the tab bar's equal-width buttons are only ~72px wide inside the 288px bookshelf aside, and the count badge used to be an **in-flow** `inline-flex` flex sibling of the label, with the button carrying `gap-1.5` and `px-3`. Subtract the 24px of horizontal padding, the ~24px `99+` badge and the 6px gap and the label was left about 18px — less than the 28px a two-character Chinese title needs, so the title wrapped **one glyph per line** into a vertical column (two lines, 40px block, 60px-tall button). The badge is now an out-of-flow corner superscript (`absolute -top-2 -end-2`, `h-[16px] min-w-[16px]`, `whitespace-nowrap`, a hairline border) marked `aria-hidden` and `pointer-events-none` because it is decoration, clamped to `99+` above 99 and not rendered at 0; the label sits in a `relative inline-flex min-w-0 max-w-full` wrapper with an inner `min-w-0 truncate`, and the button no longer has `gap-1.5`. The sidebar's expanded items used the same in-flow badge plus `ml-auto` and now use the same corner badge, with `min-w-0 truncate text-start` in place of `flex-1 text-left`. Everything is positioned with logical properties (`-end-2`, `-top-2`, `text-start`), so it lands top-right in LTR and mirrors to top-left under `dir="rtl"`. Because the badge is `aria-hidden`, both places gained an `aria-label="{label} ({badge})"` so screen readers still get the count.
- Tests: `frontend/src/test/tabbar-badge.test.tsx` locks the *shape* rather than a style string — the badge must be `absolute` / `-top-2` / `-end-2` / `pointer-events-none` / `aria-hidden="true"`, the label must be `truncate`, the button's className must **not** contain `gap-1.5` (its presence would mean the badge is back in flow), `128` clamps to `99+`, `0` renders nothing and the accessible name is `全部 (99+)`. The client is now at 22 test files and 129 tests, all green; `pnpm exec tsc --noEmit`, `pnpm lint` (only the pre-existing warnings: `no-img-element` in five components, the unused `ChevronRight`/`ArrowLeft` in `ForumPage.tsx`, and `exhaustive-deps` at `PDFReader.tsx:260`) and `pnpm run build` all exit 0.
- **Frontend-only change**: no database migration, no API change, no new dependency, and **zero Kotlin changes**. `backend/VERSION` and `backend/build.gradle.kts` were bumped to `0.1.50` per the release convention, but the backend jar was deliberately **not** rebuilt and `paper-reader-backend` was **not** restarted — the live backend still runs `paper-reader-backend-0.1.49.jar`, so `/api/health` keeps reporting `0.1.49`. That is intentional (restarting the backend for a jar with no changes would only cause a pointless interruption), not a missed deployment; use the favicon `?v=` and the build-asset hashes to determine the deployed frontend version.
- Status: released. Commits `8f47696` (the corner badge in `TabBar` and `Sidebar`), `fac6c9e` (the regression test) and `a616068` (version bump) on `feature/v0.1.50`, merged into `main` on 2026-09-17 UTC as the explicit `--no-ff` merge commit `658c3ba` (this round went `feature/v0.1.50 -> main` without passing through `dev`, which stays at `b0409ef`, an ancestor of `main`), deployed (`pnpm run build` then `pm2 restart paper-reader-frontend`, restart count 11 → 12) and verified in production: the served stylesheet `4693b861081067fc.css` and all twelve first-load JS chunks are byte-identical to the local build, the served CSS carries `.-end-2{inset-inline-end:calc(var(--spacing) * -2)}` and `.text-start{text-align:start}` while the old `min-w-[18px]`/`ml-auto` are gone, the favicon reads `?v=0.1.50`, and on the live page each of the four tab titles measures a single 20px line (288px aside, 287px tab bar, 287px of buttons, badges inside the aside and mirrored to the left under `dir="rtl"`) — with an in-page negative control injecting the old markup that still measures two lines / 40px, proving the metric catches the original bug; deployment detail is recorded in `docs/MAINTENANCE.md`.

## Previous Iteration: v0.1.49

- Branch: `feature/v0.1.49`
- Requirement: `REQ-202609-0111` follow-up — the language panel's scrollbar was ugly.
- Scope: the sign-in page's language dropdown holds fourteen entries under `max-h-80`, so it scrolls — and with `globals.css` setting a global `::-webkit-scrollbar` of 6px in `--text-tertiary`, a grey strip was cutting into the panel's rounded right edge (the settings → 偏好设置 language grid, `max-h-72`, had the same problem). Both panels now carry a new `.scrollbar-hidden` utility: `scrollbar-width: none` for Firefox and Chrome 121+, `-ms-overflow-style: none` for legacy Edge, and `.scrollbar-hidden::-webkit-scrollbar { width: 0; height: 0; display: none }` for Chromium and Safari — **all three are required, dropping any one leaves a browser showing the bar**. Scrolling itself is untouched: `overflow-y-auto` stays, so wheel, touch and keyboard still move the list, and the `pe-1` the picker used to reserve for the bar is gone so the grid is no longer off-centre.
- Tests: `frontend/src/test/language-panel-scrollbar.test.tsx` asserts both panels are `scrollbar-hidden` *and* still `overflow-y-auto`, and reads `globals.css` directly to lock the three declarations (jsdom loads no stylesheets, so a class-name assertion alone would not prove the class is defined). The client had 21 test files and 124 tests at this release (the baseline has since moved to 22 files and 129 tests with v0.1.50); `tsc --noEmit`, `next lint` and `next build` exit 0.
- No database migration, no API change, no new dependency: the version moves to `0.1.49`.
- Status: released. Commits `dc6b9c6` (the hidden-scrollbar utility and the two panels) and `6df5bd5` (version bump) on `feature/v0.1.49`, merged to `dev` and `main` on 2026-09-16 UTC, deployed and verified in production (`/api/health` reports `0.1.49`, the served stylesheet is byte-identical to the local build and carries the utility, and on the live sign-in page the open panel computes `scrollbar-width: none` with a 0px `::-webkit-scrollbar` while still scrolling 0 → 418px); deployment detail is recorded in `docs/MAINTENANCE.md`.

## Previous Iteration: v0.1.48

- Branch: `feature/v0.1.48`
- Requirement: `REQ-202609-0111` — internationalization, and the language switcher on the sign-in page that had stopped responding.
- Scope: the client now speaks fourteen languages — Simplified Chinese (default), Traditional Chinese, English, Tibetan, Uyghur, German, Arabic, Korean, Japanese, French, Vietnamese, Spanish, Italian and Persian. `src/i18n/locales.ts` is the single source of truth (code, native name, English name, writing direction); every user-visible string lives in `src/i18n/locales/<locale>/common.json` and is looked up through `next-intl`, so hardcoded Chinese is gone from the pages, dialogs, toasts, empty states and `title`/`placeholder`/`aria-label` attributes. The sign-in page's globe button used to do nothing: the old toggle flipped a client-side state that the root layout — which sits *above* `[locale]` and therefore never re-renders on a soft navigation — could not see, so `<html lang>`/`<html dir>`, the server-rendered copy and the message bundle all stayed on the old language. It is now a dropdown listing every language under its native name plus its English name, and picking one writes the `NEXT_LOCALE` cookie and does a **full page navigation** to the same route in the new language, which is what actually re-renders the whole tree. The choice follows the user into the app: 个人设置 → 偏好设置 → 语言 shows the current language and saves it to `UserSettings.language` through the existing `PUT /api/settings`, and on the next sign-in from a fresh device the account preference is adopted (`src/i18n/locale-preference.ts`) — unless the user has explicitly picked a language on that device, which wins. Arabic, Persian and Uyghur are right-to-left: the root layout sets `dir`, and the layouts were converted to Tailwind's logical utilities (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`/`border-e`) so nothing stays pinned left. Strings that live outside React — the API client, the AI provider and its response parser, the Zustand stores, device utilities — go through a small runtime translator (`src/i18n/runtime.ts`) that the root layout keeps in sync with the active locale.
- The dropdown itself had a second, separate defect: `z-index` only competes inside its own stacking context, and the drop-down hangs out of the header while the sign-in row is a *later* sibling at the same `z-10`, so the card painted over the menu and its lower options could not be clicked (the served HTML now carries `relative z-30` on the header). A regression test in `frontend/src/test/auth-layout.test.tsx` locks the header strictly above the sign-in row.
- Tests: the client has 20 test files and 121 tests, all green; `tsc --noEmit`, `next lint` (only the pre-existing `no-img-element` warning) and `next build` all exit 0; the backend keeps its 73 tests green, unchanged. All fourteen locale files carry the same 833 translatable entries (691 leaf keys) with nothing missing and nothing extra.
- No database migration of its own and no API change: it lands on top of v0.1.47's `V15__widen_user_avatar.sql`, already applied in production. The version moves to `0.1.48`.
- Status: released. Commits `ed845f1` (the fourteen-language client), `a73ba3d` (version bump and iteration docs) and `af63e4d` (the dropdown stacking fix) on `feature/v0.1.48`, merged to `dev` and `main` on 2026-09-16 UTC, deployed and verified in production (`/api/health` reports `0.1.48`, the sign-in page's language button opens a fourteen-entry list, and clicking an entry — including options that overlap the sign-in card — navigates to that language with the right `<html dir>`); deployment detail is recorded in `docs/MAINTENANCE.md`.

## Previous Iteration: v0.1.47

- Branch: `feature/v0.1.47`
- Requirement: `REQ-202609-0110` — a freshly logged-in account showed no username, no email and a "?" avatar; give it a default avatar and a system-generated name, show the email in the personal center, and close the avatar menu when blank space is clicked.
- Scope: the empty profile was not a personal-center bug but a login-path bug — the session loader only runs on a full page load, so the client-side route change after signing in left the user store empty until the next refresh. `applyTokens` now loads the profile the moment the tokens land, and `loadProfile` de-duplicates concurrent calls so that load and the session loader's share a single `/auth/me` request. A new `frontend/src/lib/user-display.ts` derives the identity: `defaultAvatar` takes the first character of the email address (ASCII letters upper-cased, digits and CJK used as they are), picks a background from a fixed palette by hashing the address, and chooses a white or dark-ink foreground by WCAG relative luminance — the contrast ratio is at least 4.5, so the character never blends into its plate. `defaultDisplayName` prefers the name the user set, then `用户{id}`, then the local part of the email; the personal center, the top-bar menu and the chat bubbles all use it, and the personal center now shows both that name and the email instead of an empty field. The avatar menu (upload image / network image) closes on a click outside it and on Escape, with the menu itself and the trigger button exempted so that opening it does not immediately close it again. GitHub sign-in requested `scope=user:email` but never read `/user/emails`, so an account whose address is private was stored under an unreachable `@github.user` placeholder; the login flow now falls back to the primary address and backfills an existing placeholder account on its next sign-in, keeping the placeholder and logging a WARN when the real address already belongs to someone else.
- Migration `V15__widen_user_avatar.sql`: `pr_users.avatar_url` was `VARCHAR(500)` while "upload from this device" stores a base64 data URL — an image of a few dozen kilobytes is tens of thousands of characters, so uploads could never succeed. The column is widened to `VARCHAR(1000000)` (the varchar type is kept on purpose, `ddl-auto=validate` would refuse to start otherwise), and the client caps a data URL at 900,000 characters with a readable error.
- Tests: `user-display.test.ts` (8) covers the initial, the contrast rule and the name fallback chain; `profile-dialog.test.tsx` (6) covers the email field, the default name and the close-on-blank-click; `AuthServiceTest` gains 4 GitHub-email cases.
- Status: released. Commit `257872c` on `feature/v0.1.47`, merged to `dev` and `main` on 2026-09-15 UTC, deployed and verified in production (`/api/health` reports `0.1.47`, `pr_users.avatar_url` is now 1000000 characters wide and Flyway is at v15, the served `[locale]` chunk matches the local build byte for byte); deployment detail is recorded in `docs/MAINTENANCE.md`.

## Previous Iteration: v0.1.45

- Branch: `feature/v0.1.45`
- Requirement: `REQ-202609-0106` — centre the sign-in page vertically on large monitors.
- Scope: the login layout is a three-row `min-h-screen` column: header, the showcase-plus-form row, and the footer. The middle row was sized to its content and the footer's `mt-auto` swallowed every spare pixel, so the card sat directly under the header and the slack piled up above the footer. On a laptop this is invisible; on a tall monitor the taller the viewport, the further the content drifted up. The middle row now takes the leftover height (`flex-1`) and centres the grid inside it (`items-center`), so the block sits halfway down whatever space the header and footer leave. The grid keeps `items-stretch` on purpose — the left column's tagline is bottom-aligned against the taller sign-in card, and centring the grid itself would shorten that column and drag the tagline up. Horizontal centring (`mx-auto max-w-7xl`) is unchanged, `py-6` keeps a minimum gap on short viewports, and flex's default `min-height: auto` keeps the page scrollable instead of clipping when the content outgrows the viewport.
- No database migration, no API change, no new dependency; a single layout file plus one regression test, and the version moves to `0.1.45`.
- Status: released. Commit `f1fa061` on `feature/v0.1.45`, merged to `dev` and `main` on 2026-09-15 UTC, deployed and verified in production (`/api/health` reports `0.1.45`, the sign-in block measures centred at 1440×820, 2560×1440 and 1920×1600); deployment detail is recorded in `docs/MAINTENANCE.md`.

## Earlier Iteration: v0.1.44

- Branch: `feature/v0.1.44`
- Requirement: `REQ-202609-0107` — connect PaperHelper to the Bendywork notification center so it can actually deliver mail.
- Scope: this product has no sign-up, only email-code login, but it had no way to send mail of its own — verification codes only reached the backend log. A new `NotifyCenterClient` exchanges an AKSK for a bearer token and calls the notification center's `POST /api/notify` for four events: login verification codes, private messages, group (research circle) messages, and comments on your post. Every send happens on a dedicated `notifyExecutor` thread pool with its own 5-second-timeout `RestTemplate`, so a notification-center outage is a WARN log line and never a failed login or a lost message. A 60-second per-email Redis cooldown guards code requests and a per-(group, member) 10-minute window guards group mail. The email HTML itself is owned by the notification center; this repository sends `template` and `template_data` per the contract in [docs/NOTIFICATION_TEMPLATES.md](docs/NOTIFICATION_TEMPLATES.md), and the verification code also rides along in `body` so the plain-text fallback stays usable before the templates ship.
- No database migration, no new dependency, no client-side behaviour change; the client only moves to version `0.1.44`.
- Status: released. Commit `6327bfe` on `feature/v0.1.44`, merged to `dev` and `main` on 2026-09-15 UTC, deployed and verified in production (`/api/health` reports `0.1.44`); deployment detail and the end-to-end mail check are recorded in `docs/MAINTENANCE.md`.

## Previous Iteration: v0.1.43

- Branch: `feature/v0.1.43`
- Requirement: `REQ-202609-0104` — the QR code shown while enabling two-factor authentication looked harsh.
- Scope: the bind wizard's QR no longer inverts to a dark plate in the dark theme. It is always drawn dark-on-white (what authenticator apps scan best), and it now sits inside a rounded white card with a hairline border, a soft shadow and a little padding, so it reads as a deliberate card rather than a bare black square. `ThemeAwareQrCode.tsx` became `QrCodeCard.tsx` because it is no longer theme-aware.
- No behaviour change: same requests, same payloads, no database migration, no new dependency.

## Earlier Iteration: v0.1.42

- Branch: `feature/v0.1.42`
- Requirement: `REQ-202609-0104` — polish the two-factor authentication form in the personal center.
- Scope: a UI-only pass over the personal-center two-factor tab. The six-digit code field is now a row of six separate cells (auto-advance, paste and one-time-code autofill spread across cells, backspace steps back, arrow keys move) instead of one narrow monospace box. The manually typed secret key gets a copy button of its own. The 「当前密码」 and 「6 位动态码」 labels sit to the left of their inputs with a real gap in between, and the same left/right arrangement is applied to the regenerate-recovery-codes and disable-two-factor forms.
- No behaviour change: the same requests go out with the same payloads, no database migration, no new dependency.

## Current Release

- Default branch: `main`
- Integration branch: `dev`
- Released version branch: `feature/v0.1.51`
- Client version: `0.1.51`
- Production frontend: `0.1.51` (verified 2026-09-17 UTC)
- Production backend: `0.1.49` — deliberately not restarted for v0.1.50 / v0.1.51, both frontend-only releases with no Kotlin changes (`/api/health` therefore still reports `0.1.49`)
- Default locale: Simplified Chinese (`zh`)
- Supported locales: Simplified Chinese (`zh`), Traditional Chinese (`zh-Hant`), English (`en`), Tibetan (`bo`), Uyghur (`ug`), German (`de`), Arabic (`ar`), Korean (`ko`), Japanese (`ja`), French (`fr`), Vietnamese (`vi`), Spanish (`es`), Italian (`it`) and Persian (`fa`) — Arabic, Persian and Uyghur render right-to-left
- Production client: `https://paper.pilo.eu.cc`

## Product Preview

The current client layout keeps the brand centered in the left navigation header, places the collapse control on the sidebar boundary, and centers the original English footer copy. The single-letter `H` mark and browser favicon use high-contrast light/dark variants.

![Expanded PaperHelper sidebar in light mode](docs/screenshots/paperhelper-expanded-light.png)

![Collapsed PaperHelper sidebar in light mode](docs/screenshots/paperhelper-collapsed-light.png)

![Expanded PaperHelper sidebar in dark mode](docs/screenshots/paperhelper-expanded-dark.png)

The browser icon assets are [paperhelper-favicon-light.svg](frontend/public/paperhelper-favicon-light.svg) and [paperhelper-favicon-dark.svg](frontend/public/paperhelper-favicon-dark.svg). The client updates the active favicon when the selected theme changes.

AI Provider requests use the OpenAI-compatible `/models` and
`/chat/completions` endpoints. The client first tries the configured Provider
directly and, when browser CORS or another network policy prevents access,
retries through the authenticated PaperHelper relay. The relay only accepts
HTTPS public targets, supports the standard `/v1` path correction, does not
persist API keys, and is available only to authenticated users.

## Architecture

```text
Browser
  |
  | HTTPS / WebSocket
  v
Cloudflare proxy
  |
  v
Apache virtual host: paper.pilo.eu.cc
  |-- /api  ->  Spring Boot API :8080
  |-- /ws   ->  Spring WebSocket :8080/ws
  `-- /     ->  Next.js client :3001

Spring Boot API :8080
  |-- PostgreSQL 16 :5432
  |-- Redis 7 :6379
  |-- Local filesystem or Dufs storage
  `-- GROBID :8070
```

The production domain is not a Cloudflare Pages deployment. Cloudflare provides DNS/proxy and TLS at the edge; Apache on the server routes requests to the local PM2-managed processes. This distinction matters when deploying: rebuilding the client and restarting PM2 is required for a source change to reach the domain.

## Repository Layout

```text
paper-reader/
|-- frontend/                 Next.js C-side client
|   |-- public/               favicon and static assets
|   |-- src/app/              routes, locale layouts, middleware
|   |-- src/components/       reader, papers, notes, chat, forum, layout
|   |-- src/i18n/             locale registry and per-language message catalogues
|   |-- src/lib/api/           typed API clients and DTOs
|   |-- src/stores/            Zustand application stores
|   `-- package.json
|-- backend/                  Kotlin/Spring Boot API
|   |-- src/main/kotlin/       controllers, services, models, security
|   |-- src/main/resources/    application config and Flyway migrations
|   |-- docker-compose.yml     isolated/new-environment infrastructure template
|   `-- build.gradle.kts
|-- docs/                     deployment and technical documents
`-- ui-demo.html               standalone early UI exploration
```

## Main Capabilities

### Paper workspace

- Upload PDF files, import papers from a URL, or create paper metadata manually.
- Browse papers by library, source type, reading history, tags, and favorites.
- View paper metadata, abstract, authors, DOI, publication details, extra fields, and GROBID output.
- From the Reader metadata panel, resolve exact arXiv IDs and DOIs through arXiv, DataCite, and Crossref, preview field-level candidates, and apply only selected values.
- Metadata enrichment records source URLs, confidence, conflicts, short-lived previews, and applied-field provenance. The v0.1.23 implementation is deployed to production and supports the documented single-paper flow.
- Edit paper metadata, favorite papers, add/remove tags, generate share text, download PDFs, and delete papers.
- Create and browse paper version records. External GitHub/Gitee/OSS/S3 artifact pushing is still a placeholder and must not be presented as complete.

### Reading and research

- PDF rendering with page navigation, zoom, text search, and reading progress.
- Highlight, underline, strikethrough, and note annotations with page/text anchors.
- Annotation comments and editable notes with Markdown and image support.
- AI chat for paper questions, summaries, explanations, and translation when a model is configured.
- The reader AI panel supports direct OpenAI-compatible Providers, a Provider warning/configuration path, browser-persisted conversation history, an icon-only new-chat action, and in-composer Provider/model selectors.
- Each local conversation stores its own Provider and model. A new conversation inherits the previous conversation's selection, while returning to an existing conversation restores its original selection.
- User messages use the signed-in user's avatar, assistant messages are labeled `PR助手`, and the first conversation title is generated from the user/assistant exchange rather than copied from the question.
- History entries show both creation time and the time of the latest conversation. A response waiting in one conversation does not block sending in another conversation.
- Direct Provider chat validates displayable response text. It supports common OpenAI, Responses API, Gemini, DashScope, Spark, AI SDK data-stream, NDJSON, wrapped and semantically named response fields. If a successful streaming response contains no readable text, the client makes one `stream: false` compatibility retry before showing a value-free response-structure diagnostic.
- Research forum, topics, posts, comments, likes, favorites, follows, private messages, and groups.
- Notification center, release feature popup, language switching, and light/dark themes.

### Authentication

- Email/password login.
- Email verification-code login; codes are delivered through the Bendywork notification center (see `docs/NOTIFICATION_TEMPLATES.md`).
- GitHub OAuth callback flow.
- Short-lived access token plus refresh token stored by the client session store.
- Middleware route guard based on the `pr_session` cookie.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Client | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Client state | Zustand with persisted session/preferences stores |
| Client UI | Radix primitives, Lucide icons, custom CSS variables |
| PDF and editor | `react-pdf`, `pdfjs-dist`, TipTap, React Markdown, remark-gfm |
| API | Kotlin 2.1, Spring Boot 3.4, Spring Security, Spring Data JPA |
| Database | PostgreSQL 16 with Flyway migrations |
| Cache/session support | Redis 7 |
| File storage | Dufs or local filesystem |
| Metadata and full-text parsing | GROBID 0.8.1 |
| Realtime | Spring WebSocket/STOMP |
| Runtime | PM2, Apache, Cloudflare proxy |

## Requirements

For an isolated full-stack development environment:

- Node.js 22 or a compatible current LTS release.
- pnpm 11 for the checked-in client lockfile.
- JDK 17 for the Spring Boot API.
- Docker and Docker Compose for PostgreSQL, Redis, Dufs, and GROBID.
- At least one AI provider key if AI chat is required.
- A future mail-service integration if real email-code delivery is required; SMTP delivery is not implemented yet.

## Configuration

Copy the examples and fill in environment-specific values. Do not put production secrets in source control.

### Client: `frontend/.env.local`

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_GITHUB_CLIENT_ID=
NEXT_PUBLIC_GITHUB_REDIRECT_URI=http://localhost:3001/callback
NEXT_PUBLIC_ENABLE_AI_CHAT=true
```

For the production domain, use:

```dotenv
NEXT_PUBLIC_API_URL=https://paper.pilo.eu.cc/api
NEXT_PUBLIC_WS_URL=wss://paper.pilo.eu.cc/ws
NEXT_PUBLIC_GITHUB_REDIRECT_URI=https://paper.pilo.eu.cc/callback
```

### API: `backend/.env`

The complete template is in [backend/.env.example](backend/.env.example). The important groups are:

| Group | Variables | Purpose |
| --- | --- | --- |
| Application | `SPRING_PROFILES_ACTIVE`, `SERVER_ADDRESS`, `SERVER_PORT`, `LOG_LEVEL` | Runtime profile, bind address, and port |
| PostgreSQL | `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` | Main relational database |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Cache and session support |
| JWT | `JWT_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` | Token signing and TTL |
| Storage | `STORAGE_TYPE`, `STORAGE_LOCAL_PATH`, `DUFS_URL` | PDF and artifact storage |
| Parsing | `GROBID_BASE_URL`, `GROBID_TIMEOUT` | GROBID integration |
| Login | `MAIL_FROM`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Email and GitHub auth |
| AI | `OPENAI_*`, `CLAUDE_*`, `DEEPSEEK_*`, `QWEN_*` | Optional model providers |

`JWT_SECRET` must be a strong production secret. Redis is configured with password protection in the Compose file; keep the same `REDIS_PASSWORD` in the backend environment and Docker environment.

## Local Development

### 1. Start infrastructure (isolated development hosts only)

Do **not** run this on the current production host. Production already uses external/shared containers that are not managed by this Compose project; starting the repository stack there can create port and data-volume conflicts. See [docs/DEPLOY.md](docs/DEPLOY.md).

```bash
cd backend
export REDIS_PASSWORD='replace-with-a-local-random-password'
docker compose up -d
docker compose ps
```

The development template's default host ports are PostgreSQL `5432`, Redis `6379`, Dufs `8400`, and GROBID `8070`. GROBID may need a short warm-up period before PDF parsing is ready. Current production instead uses local storage at `/root/paper-reader/backend/uploads` and has no Dufs container.

### 2. Start the API

```bash
cd backend
set -a
. ./.env
set +a
./gradlew bootRun
```

The API listens on `http://localhost:8080`. Health check:

```bash
curl http://localhost:8080/api/health
```

### 3. Start the client

```bash
cd frontend
pnpm install
pnpm dev
```

Next.js development mode listens on `http://localhost:3000` by default. To use the production port locally, run `pnpm dev -- --hostname 127.0.0.1 --port 3001`. Open `/zh/login` or `/en/login` for the public login routes.

## Build and Test

### Client

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test
pnpm run build
```

`pnpm run build` compiles the Next.js production bundle, checks TypeScript, runs the configured lint checks, and generates `.next/`. Existing lint warnings do not fail the current build; new warnings should still be reviewed.

### API

```bash
cd backend
./gradlew test
./gradlew bootJar -x test
```

The API artifact is written to `backend/build/libs/`.

## Production Deployment

The current server uses PM2. Build before restarting so the process loads the new `.next` output.

### Client-only change

```bash
cd /root/paper-reader/frontend
pnpm install --frozen-lockfile
pnpm run build
pm2 restart paper-reader-frontend --update-env
pm2 save
```

### API change

```bash
cd /root/paper-reader/backend
./gradlew clean test bootJar
BACKEND_VERSION="$(tr -d '\r\n' < VERSION)"
test -f "build/libs/paper-reader-backend-${BACKEND_VERSION}.jar"
set -a
. ./.env
set +a
# `sudo` is not used here: PM2 must receive the exported application variables.
pm2 delete paper-reader-backend
pm2 start --name paper-reader-backend \
  --cwd /root/paper-reader/backend \
  java -- -jar "/root/paper-reader/backend/build/libs/paper-reader-backend-${BACKEND_VERSION}.jar"
curl --fail --retry 10 --retry-connrefused --retry-delay 2 \
  http://127.0.0.1:8080/api/health
pm2 save
```

The backend artifact filename is versioned. A plain `pm2 restart paper-reader-backend` preserves the old JAR argument, so recreate that one PM2 entry whenever the backend version changes and verify the new `script args` afterward. Load `backend/.env` in the same shell immediately before `pm2 start`; a recreated PM2 entry does not inherit application variables from the deleted entry. If startup loops, inspect `pm2 logs paper-reader-backend --lines 100 --nostream` before saving the process list.

### Verify the running deployment

```bash
pm2 status
ss -ltnp | grep -E '3001|8080'
curl -I https://paper.pilo.eu.cc/zh/login
curl https://paper.pilo.eu.cc/api/health
```

Expected services are `paper-reader-frontend` on port `3001` and `paper-reader-backend` on port `8080`. The Apache SSL virtual host is stored outside this repository at `/etc/apache2/sites-available/paper.pilo.eu.cc-ssl.conf`; its `/api` and `/ws` routes go to the API and its remaining routes go to Next.js.

Do not use a Cloudflare Pages deployment command for this server. The production request path is Cloudflare proxy -> Apache -> PM2 -> Next.js/Spring Boot.

## Database Migrations

API migrations are applied by Flyway at startup. They are located in [backend/src/main/resources/db/migration](backend/src/main/resources/db/migration) and currently include:

```text
V1__init.sql
V2__oauth_email_login.sql
V3__create_paper.sql
V4__paper_category_version_storage.sql
V5__paper_favorite_tags.sql
V6__audit_log.sql
V7__forum.sql
V8__im.sql
V9__annotation_note_enhance.sql
V10__note_position.sql
V11__paper_content_context.sql
V12__clean_known_paper_title_boilerplate.sql
```

Add a new numbered migration for schema or controlled data changes. Do not edit an already-applied migration in a shared environment. V12 narrowly repairs stored titles beginning with one explicitly recognized Google permission statement; future imports use the same conservative cleanup in the TEI parser.

## API Surface

All business API routes are under `/api` and require the client token unless explicitly documented as public.

| Area | Base path |
| --- | --- |
| Health | `/api/health` |
| Authentication | `/api/auth` |
| Papers and PDFs | `/api/papers` |
| Paper question context | `/api/papers/{paperId}/context` |
| GROBID | `/api/papers/{paperId}/grobid` |
| Versions | `/api/papers/{paperId}/versions` |
| Reading history | `/api/reading-logs` |
| Notes | `/api/notes` |
| Annotations and comments | `/api/annotations` |
| AI chats | `/api/ai-chats` |
| Forum | `/api/forum` |
| Messages and groups | `/api/chat` |
| Storage configurations | `/api/storage-configs` |
| User settings | `/api/settings` |
| Audit log | `/api/audit-logs` |
| WebSocket/STOMP | `/ws` |

The frontend API wrapper is in [frontend/src/lib/api](frontend/src/lib/api), and DTO contracts are centralized in [frontend/src/lib/api/types.ts](frontend/src/lib/api/types.ts).

## UI Conventions

- The product brand is `PaperHelper`; the compact mark is a single uppercase `H`.
- The left sidebar uses a centered brand header and centered footer copy: `PaperHelper` and `More Interest Less Interests`.
- The collapse button is positioned on the sidebar boundary so it does not push the brand when the sidebar is expanded.
- Favicon and logo colors remain grayscale and follow the selected light/dark theme.
- Preferences are available from the avatar menu between Profile and Log Out.
- In the AI chat panel, an unconfigured Provider is shown as a warning. The warning and the composer’s Provider action open Preferences directly on the AI configuration tab. The model selector stays unavailable until a Provider is active.
- Direct Provider conversations are stored in the browser under the `pr-ai-direct-chats` Zustand store. They are separate from the backend `/api/ai-chats` records because they use the user-selected Provider; the Provider API key is sent to PaperHelper only when the authenticated relay is needed after a browser network/CORS failure.
- Provider relay endpoints are `/api/provider-relay/models` and `/api/provider-relay/chat/completions`; they forward only the current operation and never log the supplied Provider key.
- AI replies separate `<think>`/reasoning content into a default-collapsed disclosure. PDF selection can open the AI panel with the selected quote, paper metadata, and relevant GROBID-extracted passages as hidden context.
- Uploaded PDFs are parsed asynchronously through GROBID `/api/processFulltextDocument`; parsing status and failures are visible without blocking PDF reading.
- GROBID metadata titles pass through a conservative PaperHelper-side cleanup for explicitly recognized publisher permission boilerplate; ordinary long titles are never truncated by length heuristics.
- `/api/health` reads the backend version from Spring Boot build metadata, so the reported release always follows the JAR being executed instead of a controller constant.
- Paper cards reserve a dedicated action area beside the category badge. Their delete action uses a confirmation dialog and lets users choose whether the server should also remove the stored original file.
- The current-paper card uses a short inset capsule, a low-contrast border, and theme-specific layered highlights/shadows instead of a heavy full-height black edge.
- Source UI copy lives under `frontend/src/i18n/locales/<locale>/common.json`, one directory per supported language. `frontend/src/i18n/locales.ts` is the registry (code, native name, English name, direction) and the only place that needs editing when a language is added; `zh` is the source of truth, and every other locale must keep the same key set.
- Layout code uses logical direction utilities (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`/`border-e`) instead of left/right, so the right-to-left languages (`ar`, `fa`, `ug`) mirror correctly.
- Switching language always goes through `applyLocale()` in `frontend/src/i18n/switch-locale.ts`: it writes the `NEXT_LOCALE` cookie and performs a full page navigation. A client-side `router.push` would leave the root layout (which sits above `[locale]`) on the previous language.

## Versioned Development

The project uses a release-style branch and client version for every code iteration:

- `main` is the repository default and production branch; `dev` is the integration branch.
- Start every iteration from the latest remote release baseline: new requirements use the next `feature/vX.Y.Z` branch; bugs from a released version use that version's `feature/vX.Y.Z-fix` branch. Do not stack work on a stale iteration branch.
- After type checks, tests, and production builds pass on the iteration branch, commit and push immediately; merge to `dev`, validate, then merge to `main`. Do not bypass `dev` or develop directly on `main`.
- After merging `main`, perform a real production deployment through PM2/Apache, verify locally and through the public domain, and only then run `pm2 save`; development servers are not production deployment.
- Ordinary maintenance or feature work increments the patch number: `0.1.10` → `0.1.11` → `0.1.12`.
- Bug-fix iterations append `-fix` to the repaired version, for example `0.1.12-fix`, with a matching branch such as `feature/v0.1.12-fix`.
- A minor release (`0.1.x` → `0.2.0`) or major release (`0.x.y` → `1.0.0`) is created only when the product owner explicitly requests it.
- Keep every version branch after merging; it is part of the release and rollback history.
- Keep the current release branch (see the release line above), `frontend/package.json`, `frontend/VERSION`, `backend/VERSION`, README release line, favicon cache-busting value, and visible UI version aligned. Future work starts from the latest `dev`.
- Every code iteration must be built, tested, deployed to the PM2 process, verified through the public domain, committed, and pushed to the matching remote branch.

The documentation map is in [docs/README.md](docs/README.md). New maintainers should start with [docs/NEW_MAINTAINER_GUIDE.md](docs/NEW_MAINTAINER_GUIDE.md) and [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md). Detailed operating rules are in [docs/MAINTENANCE.md](docs/MAINTENANCE.md), the roadmap is in [docs/PLAN.md](docs/PLAN.md), cautions are in [docs/ATTENTION.md](docs/ATTENTION.md), and AI design is in [docs/AI_CHAT_TECHNICAL_SOLUTION.md](docs/AI_CHAT_TECHNICAL_SOLUTION.md).

## Troubleshooting

### The domain shows an old interface

Confirm the source was built and the production process restarted:

```bash
cd /root/paper-reader/frontend
pnpm run build
pm2 restart paper-reader-frontend --update-env
pm2 save
curl -I https://paper.pilo.eu.cc/zh/login
```

Also check `cf-cache-status`. HTML is configured as dynamic/no-cache by Next.js; static assets may be revalidated by Cloudflare. The versioned favicon query string helps avoid stale browser icon entries.

### Port 3001 is unavailable

```bash
pm2 show paper-reader-frontend
ss -ltnp | grep 3001
pm2 logs paper-reader-frontend --lines 100 --nostream
```

Do not kill a broad process set. Resolve the exact process using PM2 and the port owner before changing anything.

### API calls fail from the browser

Check the client `NEXT_PUBLIC_API_URL`, API health, Apache `/api` proxying, and browser Network errors in that order. A successful Next.js page response does not prove the Spring Boot API is healthy.

### PDF metadata is missing

Check GROBID independently:

```bash
curl http://localhost:8070/api/isalive
docker ps --filter name=paper-reader-grobid
```

GROBID is only required for parsing/import enrichment; already stored PDFs can still be served when parsing is unavailable.

### Redis fails at startup

Make sure the Compose environment provides `REDIS_PASSWORD` and the backend `.env` uses the same value. The current Compose file intentionally refuses to start Redis without an explicit password.

## Further Documentation

- [Documentation index](docs/README.md)
- [New maintainer guide](docs/NEW_MAINTAINER_GUIDE.md)
- [Complete project status](docs/PROJECT_STATUS.md)
- [Deployment guide](docs/DEPLOY.md)
- [PDF rendering pipeline](docs/PDF_RENDERING_PIPELINE.md)
- [Create paper feature](docs/CREATE_PAPER_FEATURE.md)
- [Share dialog and tab bug fix](docs/BUGFIX_TAB_SHARE_TOAST.md)
- [Companion administration console](../paperread-admin/README.md) when both projects are checked out under `/root`

## License and Project Status

This repository is an active private project. Confirm deployment credentials, storage policy, and user-data handling before exposing a new environment publicly.
