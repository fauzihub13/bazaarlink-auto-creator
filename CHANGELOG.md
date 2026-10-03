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

### Added

- `.env` loading (no extra dependency) for `CAPSOLVER_KEY` and `PROXY_URL`.
- `.env.example` with the required/optional variables.
- `DEFAULT_PASSWORD`: fixed password for created accounts; random when unset.
- `--out-txt` (default `results.txt`): plain `email|apiKey` log, appended per run.

### Fixed

- Verification-code extraction now prefers the provider's structured `otp` field and never scans
  the sender address, which could contain a misleading 6-digit run.

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
