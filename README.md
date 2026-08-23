# PaperReader

PaperReader is an academic paper reading workspace. It combines a Next.js client, a Kotlin/Spring Boot API, PDF storage, GROBID metadata extraction, annotations, notes, AI-assisted reading, research discussions, and private messaging.

The repository contains the C-side product and its API. The administration console is maintained separately in the companion project at `/root/paperread-admin`; it uses the same PostgreSQL instance but keeps administrator data in the `paperread_admin` schema.

## Current Release

- Default branch: `main`
- Integration branch: `dev`
- Active version branch: `feature/v0.1.16-fix`
- Client version: `0.1.16-fix`
- Default locale: Chinese (`zh`)
- Supported locales: Chinese (`zh`) and English (`en`)
- Production client: `https://paper.pilo.eu.cc`

## Product Preview

The current client layout keeps the brand centered in the left navigation header, places the collapse control on the sidebar boundary, and centers the original English footer copy. The single-letter `R` mark and browser favicon use high-contrast light/dark variants.

![Expanded PaperReader sidebar in light mode](docs/screenshots/paperreader-expanded-light.png)

![Collapsed PaperReader sidebar in light mode](docs/screenshots/paperreader-collapsed-light.png)

![Expanded PaperReader sidebar in dark mode](docs/screenshots/paperreader-expanded-dark.png)

The browser icon assets are [paperread-favicon-light.svg](frontend/public/paperread-favicon-light.svg) and [paperread-favicon-dark.svg](frontend/public/paperread-favicon-dark.svg). The client updates the active favicon when the selected theme changes.

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
  |-- Dufs file storage :8400
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
|   |-- src/lib/api/           typed API clients and DTOs
|   |-- src/stores/            Zustand application stores
|   `-- package.json
|-- backend/                  Kotlin/Spring Boot API
|   |-- src/main/kotlin/       controllers, services, models, security
|   |-- src/main/resources/    application config and Flyway migrations
|   |-- docker-compose.yml     PostgreSQL, Redis, Dufs, GROBID
|   `-- build.gradle.kts
|-- docs/                     deployment and technical documents
`-- ui-demo.html               standalone early UI exploration
```

## Main Capabilities

### Paper workspace

- Upload PDF files, import papers from a URL, or create paper metadata manually.
- Browse papers by library, source type, reading history, tags, and favorites.
- View paper metadata, abstract, authors, DOI, publication details, extra fields, and GROBID output.
- Edit paper metadata, favorite papers, add/remove tags, generate share text, download PDFs, and delete papers.
- Publish paper versions and optionally push version artifacts to a configured storage target.

### Reading and research

- PDF rendering with page navigation, zoom, text search, and reading progress.
- Highlight, underline, strikethrough, and note annotations with page/text anchors.
- Annotation comments and editable notes with Markdown and image support.
- AI chat for paper questions, summaries, explanations, and translation when a model is configured.
- The reader AI panel supports direct OpenAI-compatible Providers, a Provider warning/configuration path, browser-persisted conversation history, an icon-only new-chat action, and an in-composer model selector.
- Direct Provider chat validates displayable response text. It supports common OpenAI, Responses API, Gemini, DashScope, Spark, AI SDK data-stream, NDJSON, wrapped and semantically named response fields. If a successful streaming response contains no readable text, the client makes one `stream: false` compatibility retry before showing a value-free response-structure diagnostic.
- Research forum, topics, posts, comments, likes, favorites, follows, private messages, and groups.
- Notification center, release feature popup, language switching, and light/dark themes.

### Authentication

- Email/password login.
- Email verification-code login when mail delivery is configured.
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
| Metadata parsing | GROBID 0.8.1 |
| Realtime | Spring WebSocket/STOMP |
| Runtime | PM2, Apache, Cloudflare proxy |

## Requirements

For the full stack:

- Node.js 22 or a compatible current LTS release.
- pnpm 11 for the checked-in client lockfile.
- JDK 17 for the Spring Boot API.
- Docker and Docker Compose for PostgreSQL, Redis, Dufs, and GROBID.
- At least one AI provider key if AI chat is required.
- A configured SMTP provider if email-code login is required.

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
| Application | `SPRING_PROFILES_ACTIVE`, `SERVER_PORT`, `LOG_LEVEL` | Runtime profile and port |
| PostgreSQL | `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` | Main relational database |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Cache and session support |
| JWT | `JWT_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` | Token signing and TTL |
| Storage | `STORAGE_TYPE`, `STORAGE_LOCAL_PATH`, `DUFS_URL` | PDF and artifact storage |
| Parsing | `GROBID_BASE_URL`, `GROBID_TIMEOUT` | GROBID integration |
| Login | `MAIL_FROM`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Email and GitHub auth |
| AI | `OPENAI_*`, `CLAUDE_*`, `DEEPSEEK_*`, `QWEN_*` | Optional model providers |

`JWT_SECRET` must be a strong production secret. Redis is configured with password protection in the Compose file; keep the same `REDIS_PASSWORD` in the backend environment and Docker environment.

## Local Development

### 1. Start infrastructure

```bash
cd backend
docker compose up -d
docker compose ps
```

The default host ports are PostgreSQL `5432`, Redis `6379`, Dufs `8400`, and GROBID `8070`. GROBID may need a short warm-up period before PDF parsing is ready.

### 2. Start the API

```bash
cd backend
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
pnpm run build
pnpm test
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
./gradlew bootJar -x test
pm2 restart paper-reader-backend --update-env
pm2 save
```

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
```

Add a new numbered migration for schema changes. Do not edit an already-applied migration in a shared environment.

## API Surface

All business API routes are under `/api` and require the client token unless explicitly documented as public.

| Area | Base path |
| --- | --- |
| Health | `/api/health` |
| Authentication | `/api/auth` |
| Papers and PDFs | `/api/papers` |
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

- The product brand is `PaperReader`; the compact mark is a single uppercase `R`.
- The left sidebar uses a centered brand header and centered footer copy: `PaperReader` and `More Interest Less Interests`.
- The collapse button is positioned on the sidebar boundary so it does not push the brand when the sidebar is expanded.
- Favicon and logo colors remain grayscale and follow the selected light/dark theme.
- Preferences are available from the avatar menu between Profile and Log Out.
- In the AI chat panel, an unconfigured Provider is shown as a warning. The warning and the composer’s Provider action open Preferences directly on the AI configuration tab. The model selector stays unavailable until a Provider is active.
- Direct Provider conversations are stored in the browser under the `pr-ai-direct-chats` Zustand store. They are separate from the backend `/api/ai-chats` records because they use the user-selected Provider and do not send the user’s Provider API key to the PaperReader API.
- Source UI copy is localized under `frontend/src/i18n/locales/{zh,en}/common.json`.

## Versioned Development

The project uses a release-style branch and client version for every code iteration:

- `main` is the repository default and production branch; `dev` is the integration branch.
- Create each version branch from the latest `dev`, complete development and validation there, merge it into `dev`, then merge the verified `dev` into `main`.
- Ordinary maintenance or feature work increments the patch number: `0.1.10` → `0.1.11` → `0.1.12`.
- Bug-fix iterations append `-fix` to the repaired version, for example `0.1.12-fix`, with a matching branch such as `feature/v0.1.12-fix`.
- A minor release (`0.1.x` → `0.2.0`) or major release (`0.x.y` → `1.0.0`) is created only when the product owner explicitly requests it.
- Keep every version branch after merging; it is part of the release and rollback history.
- Keep the active version branch (`feature/v0.1.16-fix`), `frontend/package.json`, `frontend/VERSION`, `backend/VERSION`, README release line, favicon cache-busting value, and visible UI version aligned.
- Every code iteration must be built, tested, deployed to the PM2 process, verified through the public domain, committed, and pushed to the matching remote branch.

The detailed operating rules and handoff checklist are in [docs/MAINTENANCE.md](docs/MAINTENANCE.md). The current roadmap is in [docs/PLAN.md](docs/PLAN.md), project cautions are in [docs/ATTENTION.md](docs/ATTENTION.md), and the AI interaction design is in [docs/AI_CHAT_TECHNICAL_SOLUTION.md](docs/AI_CHAT_TECHNICAL_SOLUTION.md).

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
docker compose -f backend/docker-compose.yml ps grobid
```

GROBID is only required for parsing/import enrichment; already stored PDFs can still be served when parsing is unavailable.

### Redis fails at startup

Make sure the Compose environment provides `REDIS_PASSWORD` and the backend `.env` uses the same value. The current Compose file intentionally refuses to start Redis without an explicit password.

## Further Documentation

- [Deployment guide](docs/DEPLOY.md)
- [PDF rendering pipeline](docs/PDF_RENDERING_PIPELINE.md)
- [Create paper feature](docs/CREATE_PAPER_FEATURE.md)
- [Share dialog and tab bug fix](docs/BUGFIX_TAB_SHARE_TOAST.md)
- [Companion administration console](../paperread-admin/README.md) when both projects are checked out under `/root`

## License and Project Status

This repository is an active private project. Confirm deployment credentials, storage policy, and user-data handling before exposing a new environment publicly.
