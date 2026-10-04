// Fresh disposable inbox from tempmail.cloud (receive-only, reusable, no signup needed).
const BASE = "https://tempmail.cloud";

async function j(res) {
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(`tempmail ${res.status}: ${text.slice(0, 300)}`);
  return body;
}

// POST /api/browser-session returns a `tm_browser` cookie the mailbox-creation
// endpoint requires (otherwise it answers 428 "browser session required").
async function getBrowserSession() {
  const res = await fetch(`${BASE}/api/browser-session`, {
    method: "POST",
    headers: {
      "Origin": BASE,
      "Referer": `${BASE}/`,
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
    },
  });
  if (!res.ok) throw new Error(`tempmail browser-session ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
  const cookie = raw.map((line) => line.split(";")[0]).join("; ");
  if (!cookie) throw new Error("tempmail browser-session returned no cookie");
  return cookie;
}

// Create a brand-new inbox. Returns { email, token, password }.
// `localPart` lets you request a custom address name; the provider lowercases it
// and strips unsupported characters. `domain` is optional (auto-picked when unset).
export async function createInbox({ localPart, domain } = {}) {
  const payload = {};
  if (localPart) payload.localPart = String(localPart).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (domain) payload.domain = domain;
  const cookie = await getBrowserSession();
  const res = await fetch(`${BASE}/api/mailboxes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": BASE,
      "Referer": `${BASE}/`,
      "Cookie": cookie,
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
    },
    body: JSON.stringify(payload),
  });
  const data = await j(res);
  return { email: data.mailbox.email, token: data.token, password: data.password };
}

// List messages currently in the inbox.
export async function listMessages(token) {
  const res = await fetch(`${BASE}/api/messages`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Origin": BASE,
      "Referer": `${BASE}/`,
      "Accept": "application/json, text/plain, */*",
    },
  });
  const data = await j(res);
  return data.messages || [];
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function collectText(msg) {
  const parts = [];
  if (msg.subject) parts.push(msg.subject);
  if (msg.text) parts.push(msg.text);
  if (msg.body) parts.push(msg.body);
  if (msg.html) parts.push(stripHtml(msg.html));
  if (msg.preview) parts.push(msg.preview);
  // Last resort: walk the object for any string fields.
  if (!parts.length) parts.push(JSON.stringify(msg));
  return parts.join("\n");
}

// Poll the inbox until an email from `fromContains` arrives, then return the first
// 6-digit code found. Retries every `intervalMs` up to `timeoutMs`.
export async function waitForCode(token, { fromContains = "bazaarlink", timeoutMs = 120000, intervalMs = 4000, log = console.log } = {}) {
  const deadline = Date.now() + timeoutMs;
  let seen = 0;
  while (Date.now() < deadline) {
    let messages = [];
    try {
      messages = await listMessages(token);
    } catch (e) {
      log(`  inbox poll error: ${e.message}`);
    }
    seen = Math.max(seen, messages.length);
    for (const msg of messages) {
      const from = String(msg.from || msg.fromAddress || msg.sender || "");
      const text = collectText(msg);
      const haystack = `${from}\n${text}`.toLowerCase();
      if (!haystack.includes(fromContains.toLowerCase())) continue;
      // Prefer the provider's structured OTP field when present.
      const direct = String(msg.otp || msg.code || "").trim();
      if (/^\d{6}$/.test(direct)) return direct;
      // Otherwise scan subject/body only (never the sender address, which can
      // contain digit runs that are not the code).
      const m = text.match(/(?:^|\D)(\d{6})(?:\D|$)/);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`No verification code received within ${timeoutMs / 1000}s (inbox had ${seen} message(s))`);
}
