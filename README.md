# CV Tailor

A desktop-first app for tailoring CVs to job applications. Import your profile, paste or fetch a job posting, review the match, and generate a role-specific CV with optional AI assistance — all stored locally in SQLite.

Built as a TypeScript monorepo with **React**, **TanStack Router**, **TanStack DB**, and **Tauri 2**.

Licensed under the [MIT License](LICENSE). See [SECURITY.md](SECURITY.md) for the security model.

## What you can do

- **Manage profiles** — import from files or URLs, edit experience, skills, and projects
- **Track applications** — one workspace per job, with a guided 3-step flow
- **Analyze job postings** — extract keywords, requirements, and a role summary
- **Match scoring** — compare your profile against the posting (draft or AI-powered)
- **Generate tailored CVs** — produce language-specific CV versions per application
- **Export to PDF** — from the desktop app (`Cmd+Shift+E` or File menu)
- **Back up & restore** — export/import your local database from Settings → Data
- **Auto-update** — production desktop builds check GitHub Releases for new versions
- **Localized UI** — English and German interface (Settings → Appearance)

## Prerequisites

| Tool | Required for | Notes |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) 20+ | everything | LTS recommended |
| [pnpm](https://pnpm.io/) 10+ | everything | `corepack enable` then use the version in `package.json` |
| [Rust](https://rustup.rs/) | desktop app | stable toolchain; needed for `tauri dev` / `tauri build` |
| [Xcode CLT](https://developer.apple.com/xcode/) | macOS desktop | `xcode-select --install` |
| AI CLI (optional) | AI features | see [AI tools](#ai-tools-optional) below |

No API keys are stored in the repo. AI features call **local CLI tools** on your machine.

## Quick start

```bash
git clone https://github.com/Doderich/cv-tailor.git
cd cv-tailor
pnpm install
```

### Desktop app (recommended)

```bash
cd apps/web && pnpm run desktop:dev
```

This starts the Vite UI at [http://localhost:1420](http://localhost:1420) and opens the native Tauri shell. Data is persisted to a local SQLite database via Tauri.

### Web-only dev (browser)

```bash
pnpm run dev:web
```

Open [http://localhost:1420](http://localhost:1420). For native features (PDF export, file import, AI tool execution), run the Tauri process separately:

```bash
cd apps/web && pnpm run desktop:run
```

The browser talks to the Tauri backend over a small local HTTP bridge at `http://127.0.0.1:3911`.

---

## Using the app

### Application workflow

Each job application follows three steps:

1. **Job details** — title, company, posting text (paste, import URL, or upload)
2. **Review** — AI or draft analysis of the posting + profile match insights
3. **Generate CV** — tailored CV for the selected language (e.g. English / German)

Create applications from the sidebar (`Cmd+N`) or the command palette (`Cmd+K`).

### Settings

Open **Settings** (`Cmd+,`) or use the gear icon:

| Section | Purpose |
| --- | --- |
| **Appearance** | Theme, palette, font, text size |
| **AI** | Preferred tool (Auto / Claude / Codex / Cursor) and model per provider |
| **Data** | Backup, restore, and desktop update check |
| **Profile** | Default profile editor and importer |

### Keyboard shortcuts (desktop)

| Shortcut | Action |
| --- | --- |
| `Cmd+N` | New application |
| `Cmd+K` | Command palette |
| `Cmd+,` | Settings |
| `Cmd+Shift+E` | Export PDF |
| `Cmd+1` | Workspace |

---

## AI tools (optional)

CV Tailor can invoke local AI CLIs for job review, match analysis, and CV generation. Configure your preferred tool under **Settings → AI**.

| Tool | CLI | Setup |
| --- | --- | --- |
| **Claude Code** | `claude` | Install and run `claude login` |
| **Codex CLI** | `codex` | Install OpenAI Codex CLI and authenticate |
| **Cursor Agent** | `agent` | Install Cursor CLI / agent binary |

Use **Settings → AI → Refresh tools** to verify availability. If no AI tool is installed, draft-based analysis still works without AI.

---

## Desktop app

### Build from source (macOS)

```bash
cd apps/web && pnpm run desktop:build
```

Installers and bundles are written to `apps/web/src-tauri/target/release/bundle/`.

### Auto-updates

Production desktop builds include the Tauri updater. The app checks:

`https://github.com/Doderich/cv-tailor/releases/latest/download/latest.json`

Updates can be triggered from **CV Tailor → Check for Updates…**, **Settings → Data**, or automatically on launch.

### Publish a macOS release

One-time setup:

```bash
pnpm run desktop:setup-signing   # creates ~/.tauri/cv-tailor.key
gh auth login
```

The setup script writes the updater public key into `apps/web/src-tauri/tauri.conf.json`. **Back up the private key** — you cannot ship updates without it.

Publish a release:

```bash
pnpm run desktop:release -- --notes "Release notes here"
```

The script bumps the patch version automatically from the latest GitHub release
(for example `0.1.0` → `0.1.1`), updates `tauri.conf.json` and `Cargo.toml`, then
builds and publishes.

Optional flags:

```bash
pnpm run desktop:release -- --bump minor --notes "New features"
pnpm run desktop:release -- --version 1.0.0 --notes "Major release"
pnpm run desktop:release -- --no-bump   # re-upload current version
pnpm run desktop:release -- --dry-run   # build only, no GitHub publish
```

> **Public repo required for auto-update.** The updater fetches release assets without authentication. Private repos need a public CDN or bucket for update files instead.

### Windows builds

Build on a Windows machine with Rust and the Tauri prerequisites installed:

```bash
cd apps/web && pnpm run desktop:build
```

Upload the Windows artifacts to the same GitHub release and merge the Windows entry into `latest.json`.

---

## Data & privacy

- All profile, application, and CV data lives in a **local SQLite database** (`cv-tailor.db`).
- Nothing is sent to a backend server by default.
- AI calls go to whichever **local CLI** you configure; those tools may contact their own APIs using your credentials.
- Use **Settings → Data** to export a backup JSON file or restore from one.

---

## Environment variables

The web app has minimal env requirements. Optional overrides:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_LOCAL_API_URL` | `http://127.0.0.1:3911` | Local Tauri HTTP bridge URL (browser dev mode) |
| `CV_TAILOR_LOCAL_API_ADDR` | `127.0.0.1:3911` | Address the Rust bridge binds to |
| `SKIP_ENV_VALIDATION` | — | Skip env schema validation in tooling |

For Vercel web deploys, sync env vars with:

```bash
pnpm run deploy:setup          # first time: vercel link
pnpm run env:preview           # sync apps/web/.env → preview
pnpm run env:production        # sync apps/web/.env → production
```

---

## Project structure

```
cv-tailor/
├── apps/
│   └── web/                 # React UI + TanStack Router + Tauri shell
│       ├── src/             # Frontend routes, components, hooks
│       └── src-tauri/       # Rust backend (AI, PDF, file import, updater)
├── packages/
│   ├── ai/                  # AI prompt builders and CLI output parsers
│   ├── core/                # Domain types, schemas, scoring logic
│   ├── db/                  # TanStack DB collections + SQLite persistence
│   ├── env/                 # Shared env validation
│   └── ui/                  # Shared shadcn/ui components + styles
└── scripts/
    ├── setup-desktop-signing.ts
    ├── release-desktop-macos.ts
    └── sync-vercel-env.ts
```

---

## Scripts

### Everyday development

| Command | Description |
| --- | --- |
| `pnpm install` | Install all workspace dependencies |
| `pnpm run dev` | Start all apps via Turborepo |
| `pnpm run dev:web` | Web app only → http://localhost:1420 |
| `pnpm run build` | Production build (all packages) |
| `pnpm run check` | Biome lint + format |
| `pnpm run check-types` | Typecheck all packages |
| `pnpm run test` | Run Vitest unit tests |

### Desktop

| Command | Description |
| --- | --- |
| `cd apps/web && pnpm run desktop:dev` | Tauri dev (UI + native shell) |
| `cd apps/web && pnpm run desktop:run` | Rust binary only (needs running web dev server) |
| `cd apps/web && pnpm run desktop:build` | Build macOS `.dmg` + app bundle |
| `pnpm run desktop:setup-signing` | Generate updater signing keys (one-time) |
| `pnpm run desktop:release` | Build + publish signed macOS release |

### Web deployment (optional)

| Command | Description |
| --- | --- |
| `pnpm run deploy:setup` | Link repo to a Vercel project |
| `pnpm run dev:vercel` | Local Vercel dev environment |
| `pnpm run deploy` | Preview deployment |
| `pnpm run deploy:prod` | Production deployment |
| `pnpm run deploy:check` | Dry-run deploy |

---

## UI customization

Shared UI primitives live in `packages/ui` (shadcn/ui).

- **Design tokens** — `packages/ui/src/styles/globals.css`
- **Components** — `packages/ui/src/components/*`
- **Add components** — `npx shadcn@latest add <component> -c packages/ui`

Import in the app:

```tsx
import { Button } from "@cv-tailor/ui/components/button";
```

---

## Tech stack

- **Frontend** — React 19, Vite, TanStack Router, Tailwind CSS 4
- **State / data** — TanStack DB with SQLite persistence (Tauri plugin or browser WASM)
- **Desktop** — Tauri 2, Rust (Axum local API, PDF export, updater)
- **Validation** — Zod
- **Tooling** — Turborepo, pnpm workspaces, Biome, Vitest

---

## Troubleshooting

**AI tools show as unavailable**
Install the CLI, authenticate (`claude login`, etc.), then refresh in Settings → AI.

**Browser mode missing native features**
Run `cd apps/web && pnpm run desktop:run` alongside `pnpm run dev:web`.

**Desktop build fails on macOS**
Ensure Xcode Command Line Tools are installed and Rust is up to date (`rustup update`).

**Updater does not find releases**
The repo must be public (or host `latest.json` on a public URL). Installed app version must be lower than the release version in `tauri.conf.json`.

---

## Contributing

1. Fork the repo and create a feature branch
2. Run `pnpm run check` and `pnpm run test` before opening a PR
3. Keep changes focused — this is a monorepo; avoid unrelated package churn

Questions and issues: [GitHub Issues](https://github.com/Doderich/cv-tailor/issues)
