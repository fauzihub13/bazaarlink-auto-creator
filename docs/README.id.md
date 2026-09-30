<div align="center">

<img src="../assets/logo.svg" alt="BazaarLink Auto-Creator" width="640">

<br>

**Buat akun BazaarLink beserta API key pertamanya secara otomatis, end to end, dengan satu perintah.**

[![License: MIT](https://img.shields.io/badge/License-MIT-4f8cff.svg?style=flat-square)](../LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-3fb950.svg?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.47%2B-2EAD33.svg?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev)
[![Platform](https://img.shields.io/badge/platform-Ubuntu%20%7C%20Linux%20%7C%20macOS%20%7C%20Windows-8957e5.svg?style=flat-square)](#-kebutuhan)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-a855f7.svg?style=flat-square)](../CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/0xgetz/bazaarlink-auto-creator?style=flat-square&color=e3b341)](https://github.com/0xgetz/bazaarlink-auto-creator/stargazers)

**🌐 Bahasa:**
[English](../README.md) ·
[Bahasa Indonesia](README.id.md) ·
[日本語](README.ja.md) ·
[简体中文](README.zh.md) ·
[Español](README.es.md)

</div>

---

## ✨ Ringkasan

**BazaarLink Auto-Creator** adalah script otomasi end-to-end yang membuat akun
[BazaarLink](https://bazaarlink.ai) beserta API key pertamanya tanpa langkah manual.

Setiap kali dijalankan, script akan:

1. Membuat **inbox sementara baru** di [tempmail.cloud](https://tempmail.cloud) — tanpa registrasi, bisa dipakai ulang.
2. Membuat **identitas acak** (nama realistis + password acak yang kuat).
3. Mendaftar di BazaarLink dan menangani tantangan **Cloudflare Turnstile** di browser asli.
4. Membaca **kode verifikasi 6 digit** dari inbox lalu memverifikasi akun.
5. Membuat **API key dengan nama acak** dan menyimpan semuanya ke file JSON.

Dirancang agar bisa berjalan tanpa pengawasan di VPS: satu perintah, keluar satu key siap pakai.

## 🚀 Mulai cepat

```bash
git clone https://github.com/0xgetz/bazaarlink-auto-creator.git
cd bazaarlink-auto-creator
npm install                 # memasang Playwright + Chromium

node cli.mjs                # buat 1 akun
node cli.mjs --count 5      # buat 5 akun berurutan
node cli.mjs --headful      # tampilkan browser (debug / Turnstile manual)
node cli.mjs --out keys.json
```

Hasil ditulis ke `results.json` (atau `--out <file>`):

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

Pakai key-nya dengan klien apa pun yang kompatibel dengan OpenAI:

```bash
curl https://api.bazaarlink.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-bl-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"halo"}]}'
```

## 🧩 Cara kerja

```
┌──────────────┐   ┌──────────────────┐   ┌─────────────────┐   ┌──────────────┐
│ tempmail.cloud│ → │ Daftar BazaarLink │ → │ Baca kode 6 digit│ → │ Buat API key │
│ inbox baru    │   │ + Turnstile       │   │ dari inbox       │   │ (nama acak)  │
└──────────────┘   └──────────────────┘   └─────────────────┘   └──────────────┘
```

| Tahap | Mekanisme |
| --- | --- |
| Inbox | `POST https://tempmail.cloud/api/mailboxes` → `{ email, token, password }` |
| Daftar | Chromium asli via Playwright, isi form, selesaikan Turnstile |
| Verifikasi | `GET https://tempmail.cloud/api/messages` di-poll sampai kode masuk |
| API key | `POST https://bazaarlink.ai/api/v1/keys` memakai cookie sesi |

## 📁 Struktur proyek

```
bazaarlink-auto-creator/
├── cli.mjs              # entry point CLI (flag, batch, output)
├── package.json
├── src/
│   ├── creator.mjs      # alur lengkap (Playwright + HTTP)
│   ├── tempmail.mjs     # klien inbox sementara + ekstraksi kode
│   └── random.mjs       # nama, password, label key acak
├── assets/
│   ├── logo.svg
│   └── icon.svg
└── docs/
    ├── README.id.md
    ├── README.ja.md
    ├── README.zh.md
    └── README.es.md
```

## ⚙️ Kebutuhan

- **Node.js 18+**
- Ruang disk ~1 GB untuk browser Chromium
- IP keluar jaringan yang diterima Cloudflare Turnstile (lihat catatan di bawah)

### Library sistem Ubuntu / Debian

Chromium membutuhkan sejumlah library. Di VPS minimal, pasang sekali:

```bash
sudo apt-get update
sudo apt-get install -y libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 \
  libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 fonts-liberation
```

> Di Ubuntu 24.04 nama paketnya `libasound2t64`. Jika paket tidak ditemukan, cari dengan
> `apt-cache search <nama>`.

## 🔌 Konfigurasi

| Flag | Default | Deskripsi |
| --- | --- | --- |
| `--count <n>` | `1` | Jumlah akun yang dibuat |
| `--headful` | mati | Tampilkan jendela browser |
| `--out <file>` | `results.json` | Lokasi file hasil |

Pemakaian sebagai modul:

```js
import { createAccount } from "./src/creator.mjs";

const account = await createAccount({ headless: true });
console.log(account.apiKey);
```

`createAccount` juga menerima `executablePath` (pakai Chrome sistem), `timeoutMs`, dan `keepOpen`.

## ⚠️ Penting: Cloudflare Turnstile & reputasi IP

BazaarLink melindungi **proses daftar dan login** dengan Cloudflare Turnstile. Pada IP datacenter /
cloud yang dinilai buruk oleh Cloudflare, widget akan menampilkan *"Verification failed"* dan alur
tidak bisa selesai. Ini **batasan reputasi IP, bukan bug script**.

- ✅ Paling baik di VPS residensial / kantor atau komputer desktop.
- 🖥️ Gunakan `--headful` untuk melihat browser dan menyelesaikan tantangan secara manual bila perlu —
  script menunggu token lalu lanjut otomatis.
- 🔁 Jika Turnstile kadang gagal, jalankan ulang; sifatnya intermiten.

## 🛡️ Keamanan & etika

- **API key hanya ditampilkan sekali** — script menangkap dan menyimpannya di `results.json`. Jaga file itu.
- `results.json`, `.env*` dan file rahasia lain di-ignore git secara default.
- Gunakan hanya untuk akun yang Anda berhak buat, dan sesuai ketentuan layanan BazaarLink.

## 🤝 Kontribusi

Kontribusi sangat diterima! Baca [CONTRIBUTING.md](../CONTRIBUTING.md) lalu buka issue atau PR.

## 📄 Lisensi

Dirilis di bawah [Lisensi MIT](../LICENSE). © 2026 0xgetz.

<div align="center"><sub>Dibuat untuk ekosistem AI gateway yang kompatibel dengan OpenAI.</sub></div>
