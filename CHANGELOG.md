# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Turnstile is now solved with **CapSolver** (`AntiTurnstileTaskProxyLess`) instead of real-mouse
  clicking: Playwright intercepts `turnstile.render()` to capture the site key and token callback,
  then feeds CapSolver tokens to the sign-up and post-verification sign-in requests.
- CLI gained `--proxy` / `--no-proxy`; the browser can optionally route through `PROXY_URL`.
- `results.json` now contains **only successful accounts** and is **appended** to on each run
  (previously every run overwrote the file and recorded failures too).
- Each account is written to `results.json` / `results.txt` **immediately after it succeeds**,
  so an interrupted run still keeps the accounts created so far. The JSON write is atomic
  (temp file + rename) to avoid a truncated file on a crash.

### Added

- **Camoufox solver**: `CAPSOLVER_ENABLED=false` (or `--solver camoufox`) solves Turnstile with the
  Camoufox stealth Firefox build — no captcha API key required. CapSolver stays the default when
  `CAPSOLVER_ENABLED` is true.
- `--solver capsolver|camoufox` CLI flag to override the solver per run.
- `ensureCamoufoxSchema`: reconciles `camoufox-js`'s BrowserForge mapping against the installed
  browser's `properties.json` (via `src/camoufox-compat.json`) so newer Camoufox builds launch.
- `.env` loading (no extra dependency) for `CAPSOLVER_KEY` and `PROXY_URL`.
- `.env.example` with the required/optional variables.
- `DEFAULT_PASSWORD`: fixed password for created accounts; random when unset.
- `EMAIL_PREFIX` / `--email-prefix`: custom inbox name prefix. The address becomes
  `<prefix><random-digits>@<domain>`, keeping each inbox unique.
- `--out-txt` (default `results.txt`): plain `email|apiKey` log, appended per run.
- `src/logger.mjs`: zero-dependency colored output (banners, step lines, fields); honors `NO_COLOR`
  and falls back to plain text when stdout is not a TTY.

### Fixed

- Verification-code extraction now prefers the provider's structured `otp` field and never scans
  the sender address, which could contain a misleading 6-digit run.
- `createInbox` now bootstraps a tempmail.cloud browser session (`POST /api/browser-session`) and
  sends its `tm_browser` cookie; without it the mailbox-creation endpoint answered HTTP 428.
- Sign-up submit no longer hangs on shared IPs: it reads the API/console throttle message
  (e.g. "Too many signup attempts. Please try again later."), logs it, refreshes the Turnstile
  token and retries with backoff instead of stalling on "Submitting sign-up".

## [1.0.0] - 2026-09-28

### Added

- End-to-end account creation: fresh tempmail.cloud inbox → random identity → signup →
  email verification → API key creation.
- Turnstile handling for the Cloudflare checkbox widget.
- CLI with `--count`, `--headful`, and `--out` flags.
- Random name, password, and API-key-label generators.
- Reusable `src/` modules (`creator.mjs`, `tempmail.mjs`, `random.mjs`).
- Documentation in five languages (English, Indonesian, Japanese, Chinese, Spanish).
- MIT license, contributing guide, code of conduct, and security policy.
