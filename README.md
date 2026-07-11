# cv-tailor

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Tauri** - Build native desktop applications
- **Biome** - Linting and formatting
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:1420](http://localhost:1420) in your browser to see the web application.

### Local Web + Tauri

Run the Tauri app in development mode:

```bash
cd apps/web && pnpm run desktop:dev
```

This starts the Vite web app at [http://localhost:1420](http://localhost:1420) and the Tauri-owned local API bridge at `http://127.0.0.1:3911`. The desktop app talks to Tauri through native commands, while a regular browser tab uses the local HTTP bridge when the Tauri process is running.

### Desktop release (macOS)

One-time setup:

```bash
pnpm run desktop:setup-signing
gh auth login
```

This generates a signing key pair in `~/.tauri/cv-tailor.key` and writes the public key into `apps/web/src-tauri/tauri.conf.json`. Keep the private key secret and backed up — you cannot publish updates without it.

Publish a signed macOS release to GitHub Releases:

```bash
# bump version in apps/web/src-tauri/tauri.conf.json first
pnpm run desktop:release -- --notes "Bug fixes and improvements"
```

The release script builds the app, generates `latest.json`, and uploads the `.dmg`, updater archive, signatures, and manifest. Installed apps check `https://github.com/Doderich/cv-tailor/releases/latest/download/latest.json` for updates.

Dry run without publishing:

```bash
pnpm run desktop:release -- --dry-run
```

For Windows builds later, run the same build flow on your Windows machine and upload the Windows artifacts to the same GitHub release. Merge the Windows platform entry into `latest.json` before uploading.

If you want to run the local web tab and Tauri process separately, use two terminals:

```bash
pnpm run dev:web
```

```bash
cd apps/web && pnpm run desktop:run
```

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@cv-tailor/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Deployment

### Vercel Services

- Target: web
- Config: `vercel.json`
- Link the project first: pnpm run deploy:setup
- Local Vercel dev: pnpm run dev:vercel
- Sync preview env: pnpm run env:preview
- Sync production env: pnpm run env:production
- Dry-run check (no upload): pnpm run deploy:check
- Preview deploy: pnpm run deploy
- Production deploy: pnpm run deploy:prod
  Vercel Services share project environment variables, but deploys do not upload local `.env` files automatically. Link the project with `vercel link`, then run the env sync command before your first deploy (otherwise the deployment starts with no env vars), or pass one-off envs with `vercel deploy -e KEY=value`.
  Pass Vercel CLI flags to the env sync command directly, for example: `pnpm run env:production --scope your-team`.

For more details, see the guide on [Deploying to Vercel](https://www.better-t-stack.dev/docs/guides/vercel).

## Git Hooks and Formatting

- Run checks: `pnpm run check`

## Project Structure

```
cv-tailor/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application at http://localhost:1420
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run check`: Run Biome formatting and linting
- `cd apps/web && pnpm run desktop:dev`: Start Tauri desktop app in development
- `cd apps/web && pnpm run desktop:run`: Run the Tauri binary against an already-running local web server
- `cd apps/web && pnpm run desktop:build`: Build Tauri desktop app
- `pnpm run desktop:setup-signing`: Generate updater signing keys (one-time)
- `pnpm run desktop:release`: Build and publish a signed macOS release
- `pnpm run deploy:setup`: Link this repo to a Vercel project (first-time setup)
- `pnpm run dev:vercel`: Run the Vercel Services dev environment locally
- `pnpm run env:preview`: Sync local env files to the Vercel preview environment
- `pnpm run env:production`: Sync local env files to the Vercel production environment
- `pnpm run deploy`: Create a Vercel preview deployment
- `pnpm run deploy:prod`: Deploy to Vercel production
- `pnpm run deploy:check`: Dry-run a deploy to preview framework detection and included files without uploading
