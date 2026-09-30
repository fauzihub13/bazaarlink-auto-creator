// Auto-create a BazaarLink (bazaarlink.ai) account and its first API key.
//
// End-to-end, unattended. Drives a real Chromium via Playwright because sign-up is
// protected by a Cloudflare Turnstile challenge; the rest is plain HTTP against the
// site's own JSON API using the session cookies the browser obtained.
import { createInbox, waitForCode } from "./tempmail.mjs";
import { randomName, randomPassword, randomKeyName } from "./random.mjs";

const ORIGIN = "https://bazaarlink.ai";

function log(msg) { console.log(msg); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastStep = "init";

// The Turnstile checkbox lives inside a cross-origin iframe with a closed shadow root,
// so it cannot be selected with normal locators. It renders as a fixed-size widget;
// we click its checkbox area by real mouse coordinates instead.
async function solveTurnstile(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const auto = async () => {
    try {
      return await page.evaluate(() => {
        const el = document.querySelector('input[name="cf-turnstile-response"]');
        return el && el.value && el.value.length > 20 ? el.value : "";
      });
    } catch { return ""; }
  };
  let token = await auto();
  if (token) return token;

  // Locate the widget's bounding box via the iframe element.
  const widget = page.locator('iframe[src*="challenges.cloudflare.com"]').first();
  const hasWidget = (await widget.count()) > 0;
  let clicks = 0;
  while (Date.now() < deadline) {
    token = await auto();
    if (token) return token;
    if (hasWidget && clicks < 4) {
      try {
        const box = await widget.boundingBox();
        if (box) {
          // The checkbox sits ~28px from the left, vertically centred.
          const x = box.x + 28;
          const y = box.y + box.height / 2;
          await page.mouse.move(x - 40, y - 20, { steps: 6 });
          await sleep(150);
          await page.mouse.move(x, y, { steps: 8 });
          await page.mouse.down();
          await sleep(90);
          await page.mouse.up();
          clicks++;
          log(`  clicked Turnstile checkbox (attempt ${clicks})`);
        }
      } catch { /* widget not ready yet */ }
    }
    await sleep(2500);
  }
  throw new Error(
    "Turnstile challenge did not return a token. On some datacenter IPs Cloudflare blocks the widget " +
      "outright ('Verification failed'); try a residential IP/VPS, or run with --headful on a desktop."
  );
}

/**
 * Create one account + API key.
 * @returns {Promise<object>} { name, email, password, apiKey, baseUrl, createdAt, mailboxPassword }
 */
export async function createAccount({ headless = true, timeoutMs = 180000, keepOpen = false, executablePath } = {}) {
  const { chromium } = await import("playwright");

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

    // 4. Solve Cloudflare Turnstile.
    lastStep = "turnstile";
    log("→ Solving Turnstile challenge...");
    await solveTurnstile(page, timeoutMs);
    log("  challenge solved.");

    // 5. Submit and confirm the verification step appeared.
    lastStep = "submit-signup";
    log("→ Submitting sign-up...");
    await page.getByRole("button", { name: "Create account" }).click();
    await page
      .waitForFunction(() => /Verify your email/i.test(document.body.innerText), { timeout: 60000 })
      .catch(() => {});
    if (!/Verify your email/i.test(await page.evaluate(() => document.body.innerText))) {
      throw new Error("Sign-up did not reach the email-verification step (Turnstile rejected or email already used).");
    }

    // 6. Read the 6-digit code from the inbox.
    lastStep = "read-code";
    log("→ Waiting for the verification email...");
    const code = await waitForCode(inbox.token, { fromContains: "bazaarlink", timeoutMs: 150000, log });
    log(`  code: ${code}`);

    // 7. Enter the code.
    lastStep = "verify-code";
    log("→ Verifying code...");
    const codeInput = page.locator('input[type="text"], input[type="tel"], input:not([type])').first();
    await codeInput.fill(code);
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForFunction(() => /Dashboard|API Keys/i.test(document.body.innerText), { timeout: 60000 });
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
