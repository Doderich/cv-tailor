# Security

CV Tailor is a local-first desktop app. Your profiles, applications, and generated CVs stay in a SQLite database on your machine. This document summarizes the security model and hardening applied in the codebase.

## Threat model

| Surface | Risk | Mitigation |
| --- | --- | --- |
| WebView (UI) | XSS loading untrusted scripts | Content Security Policy in `tauri.conf.json` |
| Tauri IPC | Over-privileged commands | Capability-based permissions (`capabilities/*.json`) |
| URL fetch (Rust) | SSRF against local network | Host/IP blocklist in `web_fetch.rs` |
| Local HTTP bridge | LAN access during browser dev | Binds to `127.0.0.1` only; CORS limited to local dev origins |
| Headless AI gateway | Unauthorized remote AI execution | Bind on VPN only; set `CV_TAILOR_GATEWAY_TOKEN`; clients send bearer token |
| Auto-updater | Tampered updates | Tauri updater signatures + pinned GitHub release endpoint |
| AI CLI integration | Arbitrary command execution | User-configured local tools only; no remote code execution |
| Cloud backup (S3/MinIO) | Credential leakage in exports/repo | Keys stored only in local settings; secrets redacted from backup JSON; no secrets in the public repository |

## Content Security Policy

Production builds use a restrictive CSP:

- Scripts and styles load from the app bundle only (Tauri injects nonces/hashes at compile time).
- `wasm-unsafe-eval` is allowed because SQLite persistence uses WebAssembly in browser mode.
- Google Fonts are allowlisted for `fonts.googleapis.com` / `fonts.gstatic.com`.
- Updater checks are allowlisted for `github.com` and `githubusercontent.com`.

Development builds use a separate `devCsp` that additionally allows the Vite dev server and local API bridge.

Response headers include `X-Content-Type-Options: nosniff`.

## Capabilities

Permissions are split by platform:

- **default** — core window, SQL database
- **desktop** — updater and process restart (macOS, Windows, Linux only)

No filesystem or shell permissions are granted globally. File import and PDF export go through explicit Rust commands.

## URL fetching

The `fetch_url_text` command only accepts `http` and `https` URLs. The following are rejected before any network request:

- `localhost` and `.localhost` hostnames
- Loopback, link-local, and private IP addresses
- `.local` and `.internal` hostnames

This reduces SSRF risk when importing job postings or profile URLs. It does not replace full DNS-rebinding protection; job posting URLs should still be treated as untrusted content.

## Distribution without Apple notarization

Unsigned macOS builds may show Gatekeeper warnings on first launch. Users can open the app via **Right click → Open**. Auto-updates still use Tauri’s update signing key (`desktop:setup-signing`), which is separate from Apple code signing.

## Reporting issues

Please report security issues privately via [GitHub Security Advisories](https://github.com/Doderich/cv-tailor/security/advisories/new) rather than public issues.
