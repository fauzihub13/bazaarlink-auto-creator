<div align="center">

<img src="../assets/logo.svg" alt="BazaarLink Auto-Creator" width="640">

<br>

**一条命令，端到端自动创建 BazaarLink 账户及其首个 API 密钥。**

[![License: MIT](https://img.shields.io/badge/License-MIT-4f8cff.svg?style=flat-square)](../LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-3fb950.svg?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.47%2B-2EAD33.svg?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev)
[![Platform](https://img.shields.io/badge/platform-Ubuntu%20%7C%20Linux%20%7C%20macOS%20%7C%20Windows-8957e5.svg?style=flat-square)](#-环境要求)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-a855f7.svg?style=flat-square)](../CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/fauzihub13/bazaarlink-auto-creator?style=flat-square&color=e3b341)](https://github.com/fauzihub13/bazaarlink-auto-creator/stargazers)

**🌐 语言:**
[English](../README.md) ·
[Bahasa Indonesia](README.id.md) ·
[日本語](README.ja.md) ·
[简体中文](README.zh.md) ·
[Español](README.es.md)

</div>

---

## ✨ 概述

**BazaarLink Auto-Creator** 是一个端到端自动化脚本，无需任何手动步骤即可创建
[BazaarLink](https://bazaarlink.ai) 账户及其首个 API 密钥。

每次运行都会：

1. 在 [tempmail.cloud](https://tempmail.cloud) 创建**全新的临时收件箱** —— 无需注册，可重复使用。
2. 生成**随机身份**（真实感姓名 + 强随机密码）。
3. 在 BazaarLink 注册，并在真实浏览器中处理 **Cloudflare Turnstile** 验证。
4. 从收件箱读取**6 位验证码**并完成账户验证。
5. 创建**随机命名的 API 密钥**，并将所有信息保存到 JSON 文件。

专为在 VPS 上无人值守运行而设计：一条命令，即可获得可用的密钥。

## 🚀 快速开始

```bash
git clone https://github.com/fauzihub13/bazaarlink-auto-creator.git
cd bazaarlink-auto-creator
npm install                 # 安装 Playwright + Chromium

node cli.mjs                # 创建 1 个账户
node cli.mjs --count 5      # 依次创建 5 个账户
node cli.mjs --headful      # 显示浏览器（调试 / 手动 Turnstile）
node cli.mjs --out keys.json
```

结果写入 `results.json`（或 `--out <file>`）：

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

可用于任何兼容 OpenAI 的客户端：

```bash
curl https://api.bazaarlink.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-bl-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"你好"}]}'
```

## 🧩 工作原理

```
┌──────────────┐   ┌──────────────────┐   ┌─────────────────┐   ┌──────────────┐
│ tempmail.cloud│ → │ BazaarLink 注册   │ → │ 读取 6 位验证码  │ → │ 创建 API 密钥 │
│ 新收件箱      │   │ + Turnstile       │   │ 从收件箱         │   │ (随机命名)    │
└──────────────┘   └──────────────────┘   └─────────────────┘   └──────────────┘
```

| 步骤 | 机制 |
| --- | --- |
| 收件箱 | `POST https://tempmail.cloud/api/mailboxes` → `{ email, token, password }` |
| 注册 | 通过 Playwright 驱动真实 Chromium，填写表单并解决 Turnstile |
| 验证 | 轮询 `GET https://tempmail.cloud/api/messages` 直到收到验证码 |
| API 密钥 | 使用会话 Cookie 调用 `POST https://bazaarlink.ai/api/v1/keys` |

## 📁 项目结构

```
bazaarlink-auto-creator/
├── cli.mjs              # CLI 入口（参数、批量、输出）
├── package.json
├── src/
│   ├── creator.mjs      # 完整流程（Playwright + HTTP）
│   ├── tempmail.mjs     # 临时收件箱客户端 + 验证码提取
│   └── random.mjs       # 随机姓名、密码、密钥名
├── assets/
│   ├── logo.svg
│   └── icon.svg
└── docs/
    ├── README.id.md
    ├── README.ja.md
    ├── README.zh.md
    └── README.es.md
```

## ⚙️ 环境要求

- **Node.js 18+**
- 约 1 GB 可用磁盘空间（用于 Chromium 浏览器）
- Cloudflare Turnstile 可接受的出口 IP（见下方说明）

### Ubuntu / Debian 系统依赖

Chromium 需要一组共享库。在最小化 VPS 上安装一次：

```bash
sudo apt-get update
sudo apt-get install -y libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 \
  libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 fonts-liberation
```

> 在 Ubuntu 24.04 上包名为 `libasound2t64`。若找不到某个包，请用
> `apt-cache search <名称>` 搜索。

## 🔌 配置

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--count <n>` | `1` | 要创建的账户数量 |
| `--headful` | 关闭 | 显示浏览器窗口 |
| `--out <file>` | `results.json` | 结果输出位置 |

作为模块使用：

```js
import { createAccount } from "./src/creator.mjs";

const account = await createAccount({ headless: true });
console.log(account.apiKey);
```

`createAccount` 还接受 `executablePath`（使用系统 Chrome）、`timeoutMs` 和 `keepOpen`。

## ⚠️ 重要提示：Cloudflare Turnstile 与 IP 信誉

BazaarLink 对**注册和登录**都启用了 Cloudflare Turnstile 保护。在 Cloudflare 评分较低的
数据中心 / 云 IP 上，验证组件会返回 *"Verification failed"*，流程无法完成。这是
**IP 信誉限制，而非脚本缺陷**。

- ✅ 在住宅 / 办公 VPS 或桌面电脑上效果最佳。
- 🖥️ 使用 `--headful` 可查看浏览器，必要时手动完成验证 —— 脚本会等待令牌后自动继续。
- 🔁 若 Turnstile 偶尔失败，重新运行即可（属间歇性问题）。

## 🛡️ 安全与伦理

- **API 密钥仅显示一次** —— 脚本会捕获并保存到 `results.json`，请妥善保管该文件。
- `results.json`、`.env*` 等敏感文件默认已被 git 忽略。
- 仅用于你有权创建的账户，并遵守 BazaarLink 的服务条款。

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](../CONTRIBUTING.md) 并提交 issue 或 PR。

## 📄 许可证

基于 [MIT 许可证](../LICENSE) 发布。原始版权 © 2026 0xgetz (XHI);本 fork 由 [fauzihub13](https://github.com/fauzihub13) 维护。

<div align="center"><sub>为兼容 OpenAI 的 AI 网关生态而构建。</sub></div>
