// Auto-create a BazaarLink (bazaarlink.ai) account and its first API key.
//
// End-to-end, unattended. Drives a real Chromium via Playwright because sign-up is
// protected by a Cloudflare Turnstile challenge; the rest is plain HTTP against the
// site's own JSON API using the session cookies the browser obtained.
//
// The Turnstile challenge is solved with CapSolver (AntiTurnstileTaskProxyLess). The
// page's turnstile.render() call is intercepted so the solver's token can be handed
// straight to the component that consumes it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createInbox, waitForCode } from "./tempmail.mjs";
import { randomName, randomPassword, randomKeyName } from "./random.mjs";

// Load .env (CAPSOLVER_KEY, PROXY_URL, ...) without pulling in an extra dependency.
function loadEnv() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const text = readFileSync(resolve(here, "..", ".env"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch { /* .env is optional */ }
}
loadEnv();

const ORIGIN = "https://bazaarlink.ai";
const CAPSOLVER_BASE = "https://api.capsolver.com";

function log(msg) { console.log(msg); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastStep = "init";

// Parse a proxy URL like http://user:pass@host:port into Playwright's proxy shape.
function parseProxy(url) {
  const u = new URL(url);
  return {
    server: `${u.protocol}//${u.host}`,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
  };
}

// Ask CapSolver to solve the Turnstile. Returns the response token.
async function capsolverSolveTurnstile(clientKey, websiteURL, websiteKey, timeoutMs) {
  const post = async (path, body) => {
    const res = await fetch(`${CAPSOLVER_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const created = await post("createTask", {
    clientKey,
    task: { type: "AntiTurnstileTaskProxyLess", websiteURL, websiteKey },
  });
  if (created.errorId) {
    throw new Error(`CapSolver createTask failed: ${created.errorCode || ""} ${created.errorDescription || ""}`.trim());
  }
  const taskId = created.taskId;
  if (!taskId) throw new Error(`CapSolver createTask returned no taskId: ${JSON.stringify(created).slice(0, 200)}`);
  log(`  capsolver task: ${taskId}`);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(2000);
    const data = await post("getTaskResult", { clientKey, taskId });
    if (data.errorId) {
      throw new Error(`CapSolver getTaskResult failed: ${data.errorCode || ""} ${data.errorDescription || ""}`.trim());
    }
    if (data.status === "ready") {
      const token = data.solution && data.solution.token;
      if (!token) throw new Error("CapSolver returned ready but no token.");
      return token;
    }
    if (data.status === "failed") throw new Error(`CapSolver task failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  throw new Error(`CapSolver timed out after ${Math.round(timeoutMs / 1000)}s`);
}

// Solve Turnstile via CapSolver and return the token (does not touch the page).
async function solveTurnstileToken(page, capsolverKey, timeoutMs) {
  if (!capsolverKey) throw new Error("CAPSOLVER_KEY is not set (add it to .env or the environment).");

  // The init script stubs window.turnstile and records the render() params, so the
  // site key + token callback are captured without locating the cross-origin iframe.
  const deadline = Date.now() + timeoutMs;
  let sitekey = "";
  while (Date.now() < deadline && !sitekey) {
    sitekey = await page.evaluate(() => {
      const c = window.__blTurnstileCapture;
      return (c && c.params && c.params.sitekey) || "";
    }).catch(() => "");
    if (!sitekey) await sleep(250);
  }
  if (!sitekey) throw new Error("Turnstile widget never rendered; could not capture its site key.");
  log(`  sitekey: ${sitekey}`);

  return capsolverSolveTurnstile(capsolverKey, `${ORIGIN}/login`, sitekey, timeoutMs);
}

// Hand a token to the exact callback the sign-up component stored, so its state
// (et.current) is updated just like a real widget callback would.
async function deliverTurnstileToken(page, token) {
  const delivered = await page.evaluate((t) => {
    const c = window.__blTurnstileCapture;
    if (c && c.params && typeof c.params.callback === "function") {
      c.params.callback(t);
      return true;
    }
    const el = document.querySelector('input[name="cf-turnstile-response"]');
    if (el) { el.value = t; return true; }
    return false;
  }, token);
  if (!delivered) throw new Error("Could not deliver the Turnstile token to the page.");
}

/**
 * Create one account + API key.
 * @returns {Promise<object>} { name, email, password, apiKey, baseUrl, createdAt, mailboxPassword }
 */
export async function createAccount({
  headless = true,
  timeoutMs = 180000,
  keepOpen = false,
  executablePath,
  useProxy = false,
  proxyUrl = process.env.PROXY_URL,
  capsolverKey = process.env.CAPSOLVER_KEY,
} = {}) {
  const { chromium } = await import("playwright");

  if (useProxy && !proxyUrl) {
    throw new Error("Proxy requested but PROXY_URL is not set (add it to .env or the environment).");
  }

  // 1. Fresh disposable inbox.
  lastStep = "create-inbox";
  log("→ Creating a fresh temporary inbox (tempmail.cloud)...");
  const inbox = await createInbox();
  log(`  inbox: ${inbox.email}`);

  const name = randomName();
  const password = randomPassword();

  const launchArgs = ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"];
  const browser = await chromium.launch({ headless, executablePath, args: launchArgs });
  let context;
  try {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "America/New_York",
      viewport: { width: 1280, height: 900 },
      ...(useProxy && proxyUrl ? { proxy: parseProxy(proxyUrl) } : {}),
    });
    log(useProxy && proxyUrl ? `  proxy: enabled` : `  proxy: disabled`);

    // Capture the site's turnstile.render() params so CapSolver's token can be handed
    // to the exact callback the sign-up component waits on.
    await context.addInitScript(() => {
      const w = window;
      w.__blTurnstileCapture = { params: null };
      Object.defineProperty(w, "turnstile", {
        configurable: true,
        get() {
          return {
            render(_el, params) {
              w.__blTurnstileCapture.params = params || {};
              return "bl-placeholder";
            },
            remove() {},
            reset() {},
            getResponse() { return ""; },
          };
        },
        set() {},
      });
    });

    const page = await context.newPage();

    // 2. Open the sign-up form.
    lastStep = "open-signup";
    log("→ Opening sign-up form...");
    await page.goto(`${ORIGIN}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.getByRole("button", { name: "Accept" }).click({ timeout: 3000 }).catch(() => {});
    const signupTab = page.getByRole("button", { name: "Sign up" });
    if (await signupTab.count()) await signupTab.first().click().catch(() => {});
    await sleep(800);

    // 3. Fill the form.
    lastStep = "fill-form";
    log(`→ Filling form (name="${name}")...`);
    await page.fill('input[placeholder="Your name"]', name);
    await page.fill('input[placeholder="you@company.com"]', inbox.email);
    await page.fill('input[placeholder="Enter your password"]', password);
    await page.fill('input[placeholder="Re-enter your password"]', password);

    // 4. Solve Cloudflare Turnstile via CapSolver (token for the sign-up request).
    lastStep = "turnstile";
    log("→ Solving Turnstile challenge (CapSolver)...");
    const signupToken = await solveTurnstileToken(page, capsolverKey, timeoutMs);
    await deliverTurnstileToken(page, signupToken);
    log("  challenge solved.");

    // 5. Submit and confirm the verification step appeared.
    lastStep = "submit-signup";
    log("→ Submitting sign-up...");
    await page.getByRole("button", { name: "Create account" }).click();
    await page
      .waitForFunction(() => /Verify your email/i.test(document.body.innerText), null, { timeout: 60000 })
      .catch(() => {});
    if (!/Verify your email/i.test(await page.evaluate(() => document.body.innerText))) {
      throw new Error("Sign-up did not reach the email-verification step (Turnstile rejected or email already used).");
    }

    // 6. Read the 6-digit code from the inbox.
    lastStep = "read-code";
    log("→ Waiting for the verification email...");
    const code = await waitForCode(inbox.token, { fromContains: "bazaarlink", timeoutMs: 150000, log });
    log(`  code: ${code}`);

    // 7. Enter the code. Verifying triggers an automatic sign-in, which consumes a
    //    fresh Turnstile token, so solve a second one before clicking Verify.
    lastStep = "verify-code";
    log("→ Verifying code...");
    const codeInput = page.locator('input[type="text"], input[type="tel"], input:not([type])').first();
    await codeInput.fill(code);
    log("→ Solving Turnstile challenge for sign-in (CapSolver)...");
    const loginToken = await solveTurnstileToken(page, capsolverKey, timeoutMs);
    await deliverTurnstileToken(page, loginToken);
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForFunction(() => /Dashboard|API Keys/i.test(document.body.innerText), null, { timeout: 60000 });
    log("  email verified, logged in.");

    // 8. Create an API key via the site's own API (uses the session cookies).
    lastStep = "create-key";
    const keyName = randomKeyName();
    log(`→ Creating API key ("${keyName}")...`);
    const res = await context.request.post(`${ORIGIN}/api/v1/keys`, {
      headers: { "Content-Type": "application/json" },
      data: { name: keyName },
    });
    if (!res.ok()) {
      throw new Error(`Key creation failed: HTTP ${res.status()} ${(await res.text()).slice(0, 300)}`);
    }
    const body = await res.json();
    const apiKey = body.key || body.apiKey || body.plaintextKey || body.value;
    if (!apiKey) throw new Error(`Key created but no key value in response: ${JSON.stringify(body).slice(0, 300)}`);
    log(`  API key: ${apiKey}`);

    return {
      name,
      email: inbox.email,
      password,
      mailboxPassword: inbox.password,
      apiKey,
      keyName,
      baseUrl: "https://api.bazaarlink.ai/v1",
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    err.message = `[step: ${lastStep}] ${err.message}`;
    throw err;
  } finally {
    if (!keepOpen) await browser.close().catch(() => {});
  }
}
