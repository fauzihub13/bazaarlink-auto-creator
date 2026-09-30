<div align="center">

<img src="../assets/logo.svg" alt="BazaarLink Auto-Creator" width="640">

<br>

**コマンド1つで、BazaarLink アカウントと最初の API キーをエンドツーエンドで自動生成。**

[![License: MIT](https://img.shields.io/badge/License-MIT-4f8cff.svg?style=flat-square)](../LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-3fb950.svg?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.47%2B-2EAD33.svg?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev)
[![Platform](https://img.shields.io/badge/platform-Ubuntu%20%7C%20Linux%20%7C%20macOS%20%7C%20Windows-8957e5.svg?style=flat-square)](#-動作環境)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-a855f7.svg?style=flat-square)](../CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/0xgetz/bazaarlink-auto-creator?style=flat-square&color=e3b341)](https://github.com/0xgetz/bazaarlink-auto-creator/stargazers)

**🌐 言語:**
[English](../README.md) ·
[Bahasa Indonesia](README.id.md) ·
[日本語](README.ja.md) ·
[简体中文](README.zh.md) ·
[Español](README.es.md)

</div>

---

## ✨ 概要

**BazaarLink Auto-Creator** は、手作業なしで [BazaarLink](https://bazaarlink.ai) のアカウントと
最初の API キーを発行するエンドツーエンドの自動化スクリプトです。

実行するたびに以下を自動で行います:

1. [tempmail.cloud](https://tempmail.cloud) で**使い捨て受信トレイを新規作成**(登録不要・再利用可能)。
2. **ランダムな身元**(自然な名前 + 強力なランダムパスワード)を生成。
3. BazaarLink に登録し、実ブラウザで **Cloudflare Turnstile** を処理。
4. 受信トレイから**6桁の認証コード**を読み取り、アカウントを認証。
5. **ランダム名の API キー**を作成し、すべてを JSON に保存。

VPS での無人実行を想定しています。コマンド1つで、すぐ使えるキーが手に入ります。

## 🚀 クイックスタート

```bash
git clone https://github.com/0xgetz/bazaarlink-auto-creator.git
cd bazaarlink-auto-creator
npm install                 # Playwright + Chromium を導入

node cli.mjs                # アカウントを1つ作成
node cli.mjs --count 5      # 5つを順番に作成
node cli.mjs --headful      # ブラウザを表示(デバッグ / 手動 Turnstile)
node cli.mjs --out keys.json
```

結果は `results.json`(または `--out <file>`)に書き出されます:

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

OpenAI 互換の任意のクライアントで利用できます:

```bash
curl https://api.bazaarlink.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-bl-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"こんにちは"}]}'
```

## 🧩 仕組み

```
┌──────────────┐   ┌──────────────────┐   ┌─────────────────┐   ┌──────────────┐
│ tempmail.cloud│ → │ BazaarLink 登録   │ → │ 6桁コードを読取  │ → │ API キー作成  │
│ 新規受信箱     │   │ + Turnstile       │   │ 受信箱から       │   │ (ランダム名)  │
└──────────────┘   └──────────────────┘   └─────────────────┘   └──────────────┘
```

| 段階 | 仕組み |
| --- | --- |
| 受信箱 | `POST https://tempmail.cloud/api/mailboxes` → `{ email, token, password }` |
| 登録 | Playwright の実 Chromium でフォーム入力し Turnstile を解決 |
| 認証 | `GET https://tempmail.cloud/api/messages` をコード到着までポーリング |
| API キー | セッション Cookie を使って `POST https://bazaarlink.ai/api/v1/keys` |

## 📁 プロジェクト構成

```
bazaarlink-auto-creator/
├── cli.mjs              # CLI エントリポイント(フラグ・バッチ・出力)
├── package.json
├── src/
│   ├── creator.mjs      # 全体フロー(Playwright + HTTP)
│   ├── tempmail.mjs     # 使い捨て受信箱クライアント + コード抽出
│   └── random.mjs       # ランダムな名前・パスワード・キー名
├── assets/
│   ├── logo.svg
│   └── icon.svg
└── docs/
    ├── README.id.md
    ├── README.ja.md
    ├── README.zh.md
    └── README.es.md
```

## ⚙️ 動作環境

- **Node.js 18+**
- Chromium 用に約 1 GB の空きディスク
- Cloudflare Turnstile が受け入れる外向き IP(下記の注意を参照)

### Ubuntu / Debian のシステムライブラリ

Chromium は多数の共有ライブラリを必要とします。最小構成の VPS では一度だけ導入してください:

```bash
sudo apt-get update
sudo apt-get install -y libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 \
  libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 fonts-liberation
```

> Ubuntu 24.04 ではパッケージ名が `libasound2t64` です。見つからない場合は
> `apt-cache search <名前>` で検索してください。

## 🔌 設定

| フラグ | 既定値 | 説明 |
| --- | --- | --- |
| `--count <n>` | `1` | 作成するアカウント数 |
| `--headful` | オフ | ブラウザ画面を表示 |
| `--out <file>` | `results.json` | 結果の出力先 |

モジュールとしての利用:

```js
import { createAccount } from "./src/creator.mjs";

const account = await createAccount({ headless: true });
console.log(account.apiKey);
```

`createAccount` は `executablePath`(システム Chrome を使用)、`timeoutMs`、`keepOpen` も受け付けます。

## ⚠️ 重要: Cloudflare Turnstile と IP レピュテーション

BazaarLink は**登録とログインの両方**を Cloudflare Turnstile で保護しています。Cloudflare の評価が
低いデータセンター / クラウド IP では、ウィジェットが *"Verification failed"* を返し、処理を完了
できません。これは **IP レピュテーションの制限であり、スクリプトの不具合ではありません**。

- ✅ 住宅用 / オフィスの VPS やデスクトップ PC で最も安定します。
- 🖥️ `--headful` を使えばブラウザを確認でき、必要なら手動で認証を完了できます。トークンを待って
  自動的に続行します。
- 🔁 Turnstile が時々失敗する場合は再実行してください(断続的です)。

## 🛡️ セキュリティと倫理

- **API キーは一度しか表示されません** — スクリプトが取得し `results.json` に保存します。大切に保管してください。
- `results.json`、`.env*` などの機密ファイルは既定で git 管理外です。
- 作成権限のあるアカウントにのみ使用し、BazaarLink の利用規約に従ってください。

## 🤝 コントリビュート

コントリビュート歓迎です! [CONTRIBUTING.md](../CONTRIBUTING.md) を読んで、issue や PR をお送りください。

## 📄 ライセンス

[MIT ライセンス](../LICENSE) の下で公開されています。© 2026 0xgetz。

<div align="center"><sub>OpenAI 互換 AI ゲートウェイのエコシステムのために。</sub></div>
