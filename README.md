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
- **Back up & restore** — local snapshots, JSON export/import, and optional S3/MinIO cloud backup from Settings → Data
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

### Headless AI gateway (+ optional web UI)

Shared AI logic lives in `crates/cv-tailor-native`. The desktop app and a headless binary both use it. Devices keep local SQLite; the gateway runs AI tools / LM Studio and can also serve the built web app.

```bash
# Builds apps/web/dist with same-origin API, then serves UI + API
pnpm run gateway:serve
```

Open **`http://127.0.0.1:3911/`** in the browser (not `http://0.0.0.0:3911/`).  
API check: `curl http://127.0.0.1:3911/api/status`

Env (also loaded from `apps/web/.env`):

| Variable | Purpose |
| --- | --- |
| `CV_TAILOR_GATEWAY_ADDR` | Bind address (default `0.0.0.0:3911`) |
| `CV_TAILOR_GATEWAY_TOKEN` | Bearer/cookie auth for `/api/*` (HttpOnly cookie for same-origin UI; never put in `VITE_*`) |
| `CV_TAILOR_GATEWAY_UI_DIR` | Static UI dir (default `apps/web/dist`; set `none` for API-only) |

From another device on VPN, use the machine’s real IP or Tailscale name, e.g. `http://100.x.x.x:3911/`.

Desktop Tauri still uses local `invoke` when available; gateway HTTP is the fallback when not in Tauri.

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

### Install from GitHub Releases

> **Use at your own risk.** CV Tailor is distributed as unsigned desktop builds. They are not notarized by Apple and are not code-signed with a paid Developer ID. You are responsible for deciding whether to download, install, and run them on your machine.

Download the latest release from [GitHub Releases](https://github.com/Doderich/cv-tailor/releases/latest).

#### macOS

1. Download the `.dmg` for your Mac (`aarch64` for Apple Silicon, or build from source on Intel).
2. Open the DMG and drag **CV Tailor** to **Applications**.
3. On first launch, macOS may block the app with a message like *"CV Tailor is damaged and can't be opened"* or *"can't be opened because the developer cannot be verified"*. The app is not corrupted — macOS Gatekeeper blocks unsigned downloads.

**Workaround (pick one):**

```bash
xattr -cr "/Applications/CV Tailor.app"
```

Or right-click the app → **Open** → **Open** again in the dialog.

After the app is installed once, **in-app auto-updates** work normally. You only need the workaround for the initial manual install.

#### Windows

1. Download `CV.Tailor_*_x64-setup.exe` from the same release page.
2. Run the installer. Windows SmartScreen may warn about an unrecognized publisher — that is expected for unsigned builds.
3. Click **More info** → **Run anyway** if SmartScreen blocks the installer.

#### Verify what you downloaded

- Install from the **`.dmg`** (macOS) or **`.exe`** (Windows) on the release page.
- Do **not** use the `.tar.gz` files for manual install — those are for the built-in updater.

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

### Windows release

#### On the Windows machine (recommended)

From the repo root:

```bash
pnpm run desktop:setup-signing   # one-time
gh auth login                  # one-time, for publishing
pnpm run desktop:windows:build
pnpm run desktop:windows:release -- --notes "Windows release notes"
```

You can also run the same commands from `apps/web` — they forward to the workspace root.

#### From macOS/Linux over SSH

Use this if you want to trigger builds on a remote Windows PC from your Mac.

One-time setup on the **Windows machine**:

1. Enable [OpenSSH Server](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)
2. Install Git, Node.js 20+, pnpm 10+, Rust stable, and [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows)
3. Clone the repo (example: `C:\Users\you\cv-tailor`)
4. Generate signing keys: `pnpm run desktop:setup-signing`

One-time setup on your **Mac/Linux machine**:

```bash
gh auth login
pnpm run desktop:windows:setup
```

Then edit `scripts/windows-build.local/config.sh` with your Windows SSH host, user, and repo path. That folder is gitignored.

| Command | Description |
| --- | --- |
| `pnpm run desktop:windows:connect` | SSH into the Windows repo folder |
| `pnpm run desktop:windows:build` | Remote build only (no GitHub publish) |
| `pnpm run desktop:windows:release` | Remote build + publish to GitHub Releases |

If macOS was already released for the same version, reuse that version:

```bash
pnpm run desktop:windows:release -- --no-bump --notes "Adds Windows build"
```

Flags match the macOS release script (`--version`, `--bump`, `--dry-run`, etc.). For explicit SSH control from macOS, use `pnpm run desktop:windows:remote:release` with `--host` / `--user` / `--remote-path`.

### Windows code signing (optional)

Windows SmartScreen warnings are separate from Tauri's updater signing (`desktop:setup-signing`). To show a trusted publisher on the installer, you need an **Authenticode code signing certificate**.

| Certificate | Typical cost | SmartScreen |
| --- | --- | --- |
| **EV (Extended Validation)** | ~$300–500/year | Reputation builds quickly; best UX |
| **OV (Organization Validated)** | ~$200–400/year | Warnings until enough installs build reputation |

Popular issuers: [SSL.com](https://www.ssl.com/), [DigiCert](https://www.digicert.com/), [Sectigo](https://sectigo.com/).

**Setup (on your Windows build machine):**

1. Buy a certificate and export it as `.pfx` (include private key).
2. Import it into the Windows certificate store:
   ```powershell
   Import-PfxCertificate -FilePath C:\path\to\cert.pfx -CertStoreLocation Cert:\CurrentUser\My
   ```
3. Copy the certificate thumbprint:
   ```powershell
   Get-ChildItem Cert:\CurrentUser\My | Format-Table Thumbprint, Subject, NotAfter
   ```
4. Create `apps/web/src-tauri/tauri.windows.conf.json` from the example:
   ```powershell
   Copy-Item apps\web\src-tauri\tauri.windows.conf.json.example apps\web\src-tauri\tauri.windows.conf.json
   ```
5. Paste your thumbprint into `certificateThumbprint` (Tauri merges this file automatically on Windows builds).
6. Rebuild and release:
   ```powershell
   pnpm run desktop:windows:release -- --no-bump --notes "Signed Windows build"
   ```

See [Tauri Windows code signing](https://v2.tauri.app/distribute/sign/windows/) for Azure Key Vault, `signCommand`, and other advanced setups.

> **Note:** The certificate must be installed on the machine that runs `desktop:build`. A self-signed test cert only works on your own PC — it will not remove SmartScreen warnings for other users.

### macOS code signing (optional)

macOS Gatekeeper requires an [Apple Developer Program](https://developer.apple.com/programs/) membership (~$99/year), a **Developer ID Application** certificate, and notarization. See [Tauri macOS code signing](https://v2.tauri.app/distribute/sign/macos/).

---

## Data & privacy

- All profile, application, and CV data lives in a **local SQLite database** (`cv-tailor.db`).
- Nothing is sent to a backend server by default.
- AI calls go to whichever **local CLI** you configure; those tools may contact their own APIs using your credentials.
- Use **Settings → Data** to export a backup JSON file or restore from one.
- Optional **S3 / MinIO cloud backup** (desktop app or gateway): the MinIO client runs in `cv-tailor-native`. **Desktop** can configure endpoint/bucket/keys under **Settings → Data**. **Gateway-hosted web** only uploads/syncs — MinIO is configured via server env (`CV_TAILOR_CLOUD_BACKUP_*` or `VITE_CLOUD_BACKUP_*` in `apps/web/.env`). Credentials are **never committed to git** or written into backup JSON.

---

## Environment variables

The web app has minimal env requirements. Optional overrides:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_LOCAL_API_URL` | `http://127.0.0.1:3911` | Local Tauri HTTP bridge URL (browser dev mode) |
| `CV_TAILOR_LOCAL_API_ADDR` | `127.0.0.1:3911` | Address the Rust bridge binds to |
| `CV_TAILOR_CLOUD_BACKUP_*` | — | MinIO settings for gateway + desktop process env (never baked into the web JS bundle) |
| `VITE_CLOUD_BACKUP_*` | — | Optional process-env aliases for the above (also not shipped to the browser) |
| `VITE_AI_GATEWAY_URL` | — | Gateway base URL for clients (use `http://127.0.0.1:3911`, never `0.0.0.0`) |
| `VITE_AI_GATEWAY_SAME_ORIGIN` | — | `true` when UI is hosted by the gateway (`gateway:ui:build`) |
| `CV_TAILOR_GATEWAY_TOKEN` | — | Gateway auth secret (process env only; same-origin UI gets HttpOnly cookie) |
| `CV_TAILOR_GATEWAY_ADDR` | `0.0.0.0:3911` | Bind address for `cv-tailor-gateway` |
| `CV_TAILOR_GATEWAY_TOKEN` | — | Protects `/api/ai/*` |
| `CV_TAILOR_GATEWAY_UI_DIR` | `apps/web/dist` | Web UI static files (`none` = API only) |
| `CV_TAILOR_GATEWAY_DATA_DIR` | OS data dir | Working directory for schema temp files |
| `SKIP_ENV_VALIDATION` | — | Skip env schema validation in tooling |

Copy [`apps/web/.env.example`](apps/web/.env.example) to `apps/web/.env` for local values. `.env` is gitignored — never commit real MinIO keys.

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
    ├── release-desktop-windows.ts
    ├── windows-remote-build.ps1
    ├── windows-build.local.example/   # template for local SSH config
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
| `pnpm run desktop:windows:setup` | Create gitignored SSH config (macOS/Linux only) |
| `pnpm run desktop:windows:connect` | SSH into the Windows repo folder (macOS/Linux only) |
| `pnpm run desktop:windows:build` | Build Windows installer (local on Windows, or remote via SSH) |
| `pnpm run desktop:windows:release` | Build + publish Windows release |
| `pnpm run desktop:windows:remote:release` | Explicit SSH release orchestrator from macOS/Linux |
| `pnpm run desktop:release:windows` | Alias for remote SSH release orchestrator |

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

**Windows SmartScreen blocks the installer**
See [Install from GitHub Releases](#install-from-github-releases): click **More info** → **Run anyway**. To remove warnings for all users, set up [Windows code signing](#windows-code-signing-optional).

**macOS says the app is "damaged" or won't open**
See [Install from GitHub Releases](#install-from-github-releases). Run `xattr -cr "/Applications/CV Tailor.app"` or use Right-click → **Open**. This is expected without Apple notarization.

**Updater does not find releases**
The repo must be public (or host `latest.json` on a public URL). Installed app version must be lower than the release version in `tauri.conf.json`.

---

## Contributing

1. Fork the repo and create a feature branch
2. Run `pnpm run check` and `pnpm run test` before opening a PR
3. Keep changes focused — this is a monorepo; avoid unrelated package churn

Questions and issues: [GitHub Issues](https://github.com/Doderich/cv-tailor/issues)
