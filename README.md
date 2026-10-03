<div align="center">

<img src="assets/logo.svg" alt="BazaarLink Auto-Creator" width="640">

<br>

**Provision a BazaarLink account and its first API key, end to end, in one command.**

[![License: MIT](https://img.shields.io/badge/License-MIT-4f8cff.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-3fb950.svg?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.47%2B-2EAD33.svg?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev)
[![Platform](https://img.shields.io/badge/platform-Ubuntu%20%7C%20Linux%20%7C%20macOS%20%7C%20Windows-8957e5.svg?style=flat-square)](#-requirements)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-a855f7.svg?style=flat-square)](CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/0xgetz/bazaarlink-auto-creator?style=flat-square&color=e3b341)](https://github.com/0xgetz/bazaarlink-auto-creator/stargazers)

**🌐 Languages:**
[English](README.md) ·
[Bahasa Indonesia](docs/README.id.md) ·
[日本語](docs/README.ja.md) ·
[简体中文](docs/README.zh.md) ·
[Español](docs/README.es.md)

</div>

---

## ✨ Overview

**BazaarLink Auto-Creator** is an end-to-end automation script that provisions a
[BazaarLink](https://bazaarlink.ai) account and its first API key without any manual steps.

For every run it:

1. Creates a **fresh disposable inbox** on [tempmail.cloud](https://tempmail.cloud) — no signup required, reusable.
2. Generates a **random identity** (realistic name + strong random password).
3. Signs up on BazaarLink and handles the **Cloudflare Turnstile** challenge in a real browser.
4. Reads the **6-digit verification code** from the inbox and verifies the account.
5. Creates an **API key with a random name** and saves everything to a JSON file.

It is designed to be run unattended on a VPS: one command in, a working key out.

## 🚀 Quick start

```bash
git clone https://github.com/0xgetz/bazaarlink-auto-creator.git
cd bazaarlink-auto-creator
npm install                 # installs Playwright + Chromium

cp .env.example .env        # then set CAPSOLVER_KEY (and optionally PROXY_URL)

node cli.mjs                # create 1 account (direct connection)
node cli.mjs --count 5      # create 5 accounts, sequentially
node cli.mjs --proxy        # route the browser through PROXY_URL from .env
node cli.mjs --no-proxy     # force a direct connection (default)
node cli.mjs --headful      # show the browser (debugging)
node cli.mjs --out keys.json
```

Only accounts that complete the whole flow are saved to `results.json` (or `--out <file>`). New
accounts are **appended** to the existing file, so earlier runs are never overwritten. A plain
`email|apiKey` log is also appended to `results.txt` (or `--out-txt <file>`):

```json
[
  {
    "ok": true,
    "name": "Chloe Harper",
    "email": "clear.b6cb1a@inbox.rtxsty.online",
    "password": "Panther-Cobalt-4821",
    "mailboxPassword": "T!BpXX20A8U_Aa9",
    "apiKey": "sk-bl-IT3JVJzWNHe2l40ppF1GMPhx4Gui7du8xlpWcxKs3dT06_xG",
    "keyName": "Production Key",
    "baseUrl": "https://api.bazaarlink.ai/v1",
    "createdAt": "2026-09-28T03:39:20.569Z"
  }
]
```

Use the key with any OpenAI-compatible client:

```bash
curl https://api.bazaarlink.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-bl-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"hello"}]}'
```

## 🧩 How it works

```
┌──────────────┐   ┌──────────────────┐   ┌─────────────────┐   ┌──────────────┐
│ tempmail.cloud│ → │ BazaarLink signup │ → │ Read 6-digit code│ → │ Create API key│
│ fresh inbox   │   │ + Turnstile       │   │ from inbox       │   │ (random name) │
└──────────────┘   └──────────────────┘   └─────────────────┘   └──────────────┘
```

| Step | Mechanism |
| --- | --- |
| Inbox | `POST https://tempmail.cloud/api/mailboxes` → `{ email, token, password }` |
| Sign-up | Real Chromium via Playwright, fills the form, solves Turnstile with CapSolver |
| Verification | `GET https://tempmail.cloud/api/messages` polled until the code arrives |
| API key | `POST https://bazaarlink.ai/api/v1/keys` with the session cookies |

### Turnstile via CapSolver

The Cloudflare Turnstile challenge is solved with **CapSolver** (`AntiTurnstileTaskProxyLess`).
Playwright intercepts the page's `turnstile.render()` call to capture the site key and the token
callback, requests a token from CapSolver, and feeds that token straight to the sign-up component.
The flow needs two tokens — one for sign-up and one for the automatic sign-in after email
verification — and both are obtained the same way. No manual clicking is involved.

Set `CAPSOLVER_KEY` in `.env` (see `.env.example`).

## 📁 Project layout

```
bazaarlink-auto-creator/
├── cli.mjs              # CLI entry point (flags, batching, output)
├── package.json
├── src/
│   ├── creator.mjs      # orchestrates the full flow (Playwright + HTTP)
│   ├── tempmail.mjs     # disposable-inbox client + verification-code extraction
│   ├── random.mjs       # random names, passwords, key labels
│   └── logger.mjs       # colored, structured terminal output
├── assets/
│   ├── logo.svg
│   └── icon.svg
└── docs/
    ├── README.id.md     # Bahasa Indonesia
    ├── README.ja.md     # 日本語
    ├── README.zh.md     # 简体中文
    └── README.es.md     # Español
```

## ⚙️ Requirements

- **Node.js 18+**
- ~1 GB free disk for the Chromium browser
- A network egress IP that Cloudflare Turnstile accepts (see the note below)

### Ubuntu / Debian system libraries

Chromium needs a set of shared libraries. On a minimal VPS install them once:

```bash
sudo apt-get update
sudo apt-get install -y libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 \
  libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 fonts-liberation
```

> On Ubuntu 24.04 the package is `libasound2t64`. If a package name is not found, search with
> `apt-cache search <name>`.

## 🔌 Configuration

| Flag | Default | Description |
| --- | --- | --- |
| `--count <n>` | `1` | Number of accounts to create |
| `--headful` | off | Show the browser window |
| `--proxy` | off | Route the browser through `PROXY_URL` (from `.env`) |
| `--no-proxy` | on | Force a direct connection (overrides `--proxy`) |
| `--out <file>` | `results.json` | Where to write the results (JSON, appended) |
| `--out-txt <file>` | `results.txt` | Plain `email|apiKey` log, appended |

Environment (`.env`):

| Variable | Required | Description |
| --- | --- | --- |
| `CAPSOLVER_KEY` | yes | CapSolver API key used to solve Turnstile |
| `PROXY_URL` | no | Proxy for the browser, e.g. `http://user:pass@host:port`. Used only with `--proxy` |
| `DEFAULT_PASSWORD` | no | Fixed password for every created account. If empty, a random password is generated |

Programmatic use:

```js
import { createAccount } from "./src/creator.mjs";

const account = await createAccount({ headless: true });            // direct
const proxied = await createAccount({ headless: true, useProxy: true }); // via PROXY_URL
console.log(account.apiKey);
```

`createAccount` also accepts `executablePath` (use a system Chrome instead of bundled Chromium),
`timeoutMs`, `keepOpen`, `proxyUrl` (defaults to `process.env.PROXY_URL`), `capsolverKey`
(defaults to `process.env.CAPSOLVER_KEY`), and `defaultPassword` (defaults to
`process.env.DEFAULT_PASSWORD`).

## ⚠️ Important: Cloudflare Turnstile & IP reputation

BazaarLink protects **both sign-up and login** with Cloudflare Turnstile. The challenge is solved
with CapSolver, so the browser's egress IP does not need to pass the widget's own verification — but
a clean IP still helps the rest of the flow. If a run fails intermittently, just re-run.

## 🛡️ Security & ethics

- **The API key is shown only once** — it is captured and stored in `results.json` / `results.txt`. Keep those files safe.
- `results.json`, `results.txt`, `.env*` and other secret files are git-ignored by default.
- Use this only for accounts you are authorised to create, and in line with BazaarLink's terms of service.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and open an issue or PR.

## 📄 License

Released under the [MIT License](LICENSE). © 2026 0xgetz.

<div align="center"><sub>Built for the OpenAI-compatible AI gateway ecosystem.</sub></div>
