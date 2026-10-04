// Auto-create a BazaarLink (bazaarlink.ai) account and its first API key.
//
// End-to-end, unattended. Drives a real Chromium via Playwright because sign-up is
// protected by a Cloudflare Turnstile challenge; the rest is plain HTTP against the
// site's own JSON API using the session cookies the browser obtained.
//
// The Turnstile challenge is solved with CapSolver (AntiTurnstileTaskProxyLess). The
// page's turnstile.render() call is intercepted so the solver's token can be handed
// straight to the component that consumes it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createInbox, waitForCode } from "./tempmail.mjs";
import { randomName, randomPassword, randomKeyName, randomEmailLocalPart } from "./random.mjs";
import { c, step, info, warn } from "./logger.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

// Load .env (CAPSOLVER_KEY, PROXY_URL, ...) without pulling in an extra dependency.
function loadEnv() {
  try {
    const text = readFileSync(resolve(ROOT, ".env"), "utf8");
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

// Formatting callback consumed by tempmail's poller.
function pollLog(msg) { info(msg.trim()); }
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

// Solver selection: CapSolver when CAPSOLVER_ENABLED is true, otherwise the
// built-in Camoufox stealth browser (no captcha API key required).
function resolveSolver(explicit) {
  if (explicit === "capsolver" || explicit === "camoufox") return explicit;
  const raw = String(process.env.CAPSOLVER_ENABLED ?? "true").trim().toLowerCase();
  const enabled = raw === "1" || raw === "true" || raw === "yes" || raw === "on";
  return enabled ? "capsolver" : "camoufox";
}

// camoufox-js ships a BrowserForge->config mapping that can reference properties a
// given Camoufox build has dropped (or not yet added). Launch fails hard with
// "Unknown property ... in config", so reconcile the browser's properties.json
// against our bundled compatibility schema before the first launch.
function ensureCamoufoxSchema(pkgman) {
  const propsPath = String(pkgman.getPath("properties.json"));
  const compatPath = resolve(HERE, "camoufox-compat.json");
  if (!existsSync(propsPath) || !existsSync(compatPath)) return;
  const installed = JSON.parse(readFileSync(propsPath, "utf8"));
  const have = new Set(installed.map((entry) => entry.property));
  const compat = JSON.parse(readFileSync(compatPath, "utf8"));
  const missing = compat.filter((entry) => !have.has(entry.property));
  if (missing.length) writeFileSync(propsPath, JSON.stringify(installed.concat(missing), null, 1));
}

// Launch the Camoufox (stealth Firefox) browser. Turnstile is cleared passively by
// the fingerprint spoofing, so no token is injected anywhere.
async function launchCamoufox({ headless, useProxy, proxyUrl }) {
  const { Camoufox } = await import("camoufox-js");
  const pkgman = await import("camoufox-js/dist/pkgman.js");
  ensureCamoufoxSchema(pkgman);

  const options = {
    headless,
    humanize: true,
    geoip: true,
    locale: "en-US",
  };
  if (useProxy && proxyUrl) options.proxy = proxyUrl;

  const browser = await Camoufox(options);
  return browser;
}

// Read the current Turnstile response token from the page's hidden input.
async function readTurnstileToken(page) {
  return page.evaluate(() => {
    const el = document.querySelector('input[name="cf-turnstile-response"]');
    return el && el.value && el.value.length > 20 ? el.value : "";
  }).catch(() => "");
}

// Read the site key the page passed to turnstile.render() (captured by the stub).
async function waitSitekey(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sitekey = await page.evaluate(() => {
      const c = window.__blTurnstileCapture;
      return (c && c.params && c.params.sitekey) || "";
    }).catch(() => "");
    if (sitekey) return sitekey;
    await sleep(250);
  }
  throw new Error("Turnstile widget never rendered; could not capture its site key.");
}

// Camoufox path: let the real widget solve; poll the hidden response input.
async function camoufoxTurnstile(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const token = await readTurnstileToken(page);
    if (token) return token;
    await sleep(1000);
  }
  throw new Error("Turnstile was not solved by the stealth browser within the timeout.");
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
  info("capsolver task", taskId);

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
  const sitekey = await waitSitekey(page, timeoutMs);
  info("sitekey", sitekey);
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

// Signals that the sign-up request was throttled, e.g. "Too many signup
// attempts. Please try again later.", HTTP 429, or "slow down". Common on
// shared IPs without a proxy.
const RATE_LIMIT_RE = /too many|rate[\s-]?limit|try again later|slow down|\b429\b/i;

// Reset the real Turnstile widget so the next submit gets a fresh token.
async function resetTurnstile(page) {
  await page.evaluate(() => {
    try {
      if (window.turnstile && typeof window.turnstile.reset === "function") window.turnstile.reset();
    } catch { /* widget may not expose turnstile */ }
    const el = document.querySelector('input[name="cf-turnstile-response"]');
    if (el) el.value = "";
  }).catch(() => {});
}

// Collect the text blobs that could carry a throttle/error message: the visible
// page, captured console lines and any 4xx/5xx JSON body from the site's API.
function signupSignalText(signals, pageText) {
  const blobs = [pageText, ...signals.console];
  for (const e of signals.errors) blobs.push(`${e.status} ${e.body}`);
  return blobs.map((b) => String(b || "").trim()).filter(Boolean);
}

// Pull a human-readable message out of a response/console blob. The site's
// error payloads look like `{ "error": "Too many signup attempts. ..." }`.
function readableMessage(blob) {
  const text = String(blob || "");
  const m = text.match(/"error"\s*:\s*"([^"]+)"/i) || text.match(/"message"\s*:\s*"([^"]+)"/i);
  return (m ? m[1] : text).replace(/\s+/g, " ").trim();
}

function rateLimitSignal(signals, pageText) {
  for (const blob of signupSignalText(signals, pageText)) {
    if (RATE_LIMIT_RE.test(blob)) return readableMessage(blob).slice(0, 200);
  }
  return "";
}

function signupErrorHint(signals) {
  const err = signals.errors.find((e) => e.body);
  if (err) return `HTTP ${err.status} ${readableMessage(err.body)}`.slice(0, 200);
  const line = signals.console.find((l) => /error|fail|invalid|denied/i.test(l));
  return line ? readableMessage(line).slice(0, 200) : "";
}

function resetSignupState(signals) {
  signals.console.length = 0;
  signals.errors.length = 0;
}

// Wait for one sign-up outcome: success, a throttle signal, or a timeout.
async function waitSignupOutcome(page, signals, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await page.evaluate(() => document.body.innerText).catch(() => "");
    if (/Verify your email/i.test(text)) return { status: "success" };
    const throttle = rateLimitSignal(signals, text);
    if (throttle) return { status: "rate-limit", message: throttle };
    await sleep(500);
  }
  return { status: "timeout", message: "timed out waiting for the email-verification step" };
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
  defaultPassword = process.env.DEFAULT_PASSWORD,
  emailPrefix = process.env.EMAIL_PREFIX,
  solver,
} = {}) {
  const solverKind = resolveSolver(solver);

  if (useProxy && !proxyUrl) {
    throw new Error("Proxy requested but PROXY_URL is not set (add it to .env or the environment).");
  }
  if (solverKind === "capsolver" && !capsolverKey) {
    throw new Error("CAPSOLVER_KEY is not set (add it to .env, or run with --solver camoufox).");
  }

  // 1. Fresh disposable inbox.
  lastStep = "create-inbox";
  step("Creating a fresh temporary inbox", "(tempmail.cloud)");
  const inbox = await createInbox({ localPart: randomEmailLocalPart(emailPrefix) });
  info("inbox", c.brightCyan(inbox.email));

  const name = randomName();
  const password = defaultPassword && defaultPassword.trim() ? defaultPassword.trim() : randomPassword();

  step("Solver", solverKind === "capsolver" ? c.brightBlue("CapSolver") : c.brightMagenta("Camoufox (stealth)"));

  let browser;
  let context;
  try {
    if (solverKind === "capsolver") {
      const { chromium } = await import("playwright");
      const launchArgs = ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"];
      browser = await chromium.launch({ headless, executablePath, args: launchArgs });
      context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
        locale: "en-US",
        timezoneId: "America/New_York",
        viewport: { width: 1280, height: 900 },
        ...(useProxy && proxyUrl ? { proxy: parseProxy(proxyUrl) } : {}),
      });
    } else {
      browser = await launchCamoufox({ headless, useProxy, proxyUrl });
      context = await browser.newContext({ viewport: null });
    }
    info("proxy", useProxy && proxyUrl ? c.brightGreen("enabled") : c.gray("disabled"));

    // For CapSolver only: stub window.turnstile so we can capture the site key and
    // feed the solver token to the component that waits on it. The Camoufox path
    // uses the real widget and needs no stub.
    if (solverKind === "capsolver") {
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
    }

    const page = await context.newPage();

    // Collect console output and failed API responses so the submit step can
    // detect a throttle (e.g. "Too many signup attempts") instead of hanging.
    const signals = { console: [], errors: [] };
    page.on("console", (msg) => {
      signals.console.push(msg.text());
      if (signals.console.length > 50) signals.console.shift();
    });
    page.on("response", async (res) => {
      if (!/bazaarlink\.ai/i.test(res.url())) return;
      const ctype = String(res.headers()["content-type"] || "");
      // Only JSON API payloads matter; skip JS/CSS/HTML bundles that merely
      // contain the word "error" and would trigger a false throttle.
      if (!ctype.includes("application/json")) return;
      let body = "";
      try { body = (await res.text()).slice(0, 500); } catch { /* body unavailable */ }
      if (res.status() >= 400 || /"error"\s*:/i.test(body)) {
        signals.errors.push({ status: res.status(), url: res.url(), body });
        if (signals.errors.length > 20) signals.errors.shift();
      }
    });

    // 2. Open the sign-up form.
    lastStep = "open-signup";
    step("Opening sign-up form");
    await page.goto(`${ORIGIN}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.getByRole("button", { name: "Accept" }).click({ timeout: 3000 }).catch(() => {});
    const signupTab = page.getByRole("button", { name: "Sign up" });
    if (await signupTab.count()) await signupTab.first().click().catch(() => {});
    await sleep(800);

    // 3. Fill the form.
    lastStep = "fill-form";
    step("Filling form", `name="${c.bold(name)}"`);
    await page.fill('input[placeholder="Your name"]', name);
    await page.fill('input[placeholder="you@company.com"]', inbox.email);
    await page.fill('input[placeholder="Enter your password"]', password);
    await page.fill('input[placeholder="Re-enter your password"]', password);

    // 4. Solve Cloudflare Turnstile (token for the sign-up request).
    lastStep = "turnstile";
    step("Solving Turnstile challenge");
    if (solverKind === "capsolver") {
      const token = await solveTurnstileToken(page, capsolverKey, timeoutMs);
      await deliverTurnstileToken(page, token);
    } else {
      await camoufoxTurnstile(page, timeoutMs);
    }
    info("challenge", c.green("solved"));

    // 5. Submit and confirm the verification step appeared. On shared IPs the
    //    backend can answer "Too many signup attempts. Please try again later.";
    //    surface that message and retry with a longer backoff instead of hanging
    //    on "Submitting sign-up".
    lastStep = "submit-signup";
    step("Submitting sign-up");
    const maxAttempts = 4;
    let submitted = false;
    for (let attempt = 1; attempt <= maxAttempts && !submitted; attempt++) {
      resetSignupState(signals);
      await page.getByRole("button", { name: "Create account" }).click({ timeout: 15000 }).catch(() => {});
      const outcome = await waitSignupOutcome(page, signals, 60000);
      if (outcome.status === "success") {
        submitted = true;
        break;
      }
      if (outcome.status === "rate-limit" && attempt < maxAttempts) {
        const waitS = 20 * attempt;
        warn(
          `Sign-up throttled: "${outcome.message}" - ${outcome.status} — retrying in ${waitS}s (attempt ${attempt}/${maxAttempts})`,
        );
        await sleep(waitS * 1000);
        // Give the next submit a fresh challenge token.
        await resetTurnstile(page);
        if (solverKind === "capsolver") {
          const token = await solveTurnstileToken(page, capsolverKey, timeoutMs);
          await deliverTurnstileToken(page, token);
        } else {
          await camoufoxTurnstile(page, timeoutMs);
        }
        continue;
      }
      if (outcome.status === "rate-limit") {
        throw new Error(`Sign-up still throttled after ${maxAttempts} attempts: ${outcome.message}`);
      }
      const hint = signupErrorHint(signals);
      throw new Error(`Sign-up did not reach the email-verification step (Turnstile rejected or email already used)${hint ? ` — ${hint}` : ""}.`);
    }

    // 6. Read the 6-digit code from the inbox.
    lastStep = "read-code";
    step("Waiting for the verification email");
    const code = await waitForCode(inbox.token, { fromContains: "bazaarlink", timeoutMs: 150000, log: pollLog });
    info("code", c.brightYellow(c.bold(code)));

    // 7. Enter the code. Verifying triggers an automatic sign-in that consumes a
    //    Turnstile token, so make sure a valid one is present before clicking Verify.
    lastStep = "verify-code";
    step("Verifying code");
    const codeInput = page.locator('input[type="text"], input[type="tel"], input:not([type])').first();
    await codeInput.fill(code);
    if (solverKind === "capsolver") {
      const token = await solveTurnstileToken(page, capsolverKey, timeoutMs);
      await deliverTurnstileToken(page, token);
    } else {
      await camoufoxTurnstile(page, timeoutMs);
    }
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForFunction(() => /Dashboard|API Keys/i.test(document.body.innerText), null, { timeout: 60000 });
    info("email", `${c.green("verified")}, logged in`);

    // 8. Create an API key via the site's own API (uses the session cookies).
    lastStep = "create-key";
    const keyName = randomKeyName();
    step("Creating API key", `"${c.bold(keyName)}"`);
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
    info("API key", c.brightGreen(apiKey));

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
    if (!keepOpen && browser) await browser.close().catch(() => {});
  }
}
