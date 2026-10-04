// CLI entry point.
//   node cli.mjs                 -> create 1 account
//   node cli.mjs --count 5       -> create 5 accounts sequentially
//   node cli.mjs --headful       -> show the browser (useful for debugging)
//   node cli.mjs --proxy         -> route the browser through PROXY_URL (from .env)
//   node cli.mjs --no-proxy      -> force direct connection (default)
//   node cli.mjs --solver capsolver|camoufox  -> override the Turnstile solver
//   node cli.mjs --out results.json
//   node cli.mjs --out-txt results.txt
import { writeFileSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { createAccount } from "./src/creator.mjs";
import { c, banner, section, success, error, field, sym } from "./src/logger.mjs";

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// Load an existing results file (must be a JSON array of objects). A missing,
// empty, or unreadable file is treated as an empty list so a fresh run never
// destroys previously saved accounts.
function readExisting(file) {
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const count = parseInt(argValue("--count", "1"), 10) || 1;
const headless = !process.argv.includes("--headful");
const outFile = argValue("--out", "results.json");
const outTxtFile = argValue("--out-txt", "results.txt");
const useProxy = process.argv.includes("--proxy") && !process.argv.includes("--no-proxy");
const solver = argValue("--solver", undefined);

async function main() {
  const enabledRaw = String(process.env.CAPSOLVER_ENABLED ?? "true").trim().toLowerCase();
  const capsolverEnabled = !["false", "0", "no", "off"].includes(enabledRaw);
  const activeSolver = solver || (capsolverEnabled ? "capsolver" : "camoufox");
  banner(
    `${sym.star} BazaarLink auto-creator`,
    `${count} account(s)  ${sym.dot}  headless=${headless ? c.green("on") : c.yellow("off")}  ${sym.dot}  proxy=${useProxy ? c.green("on") : c.gray("off")}  ${sym.dot}  solver=${activeSolver}`
  );

  const existing = readExisting(outFile);
  const created = [];
  for (let i = 1; i <= count; i++) {
    section(i, count, `Account`);
    try {
      const account = await createAccount({ headless, useProxy, solver });
      created.push({ ok: true, ...account });
      success(`Created ${c.bold(account.email)}`);
    } catch (err) {
      error(err.message);
    }
  }

  // Persist only accounts that fully succeeded, appended to whatever was already
  // there so earlier accounts are never lost.
  const merged = existing.concat(created);
  mkdirSync(dirname(outFile) || ".", { recursive: true });
  writeFileSync(outFile, JSON.stringify(merged, null, 2));

  // Simple "email|apiKey" log, appended line by line.
  if (created.length) {
    mkdirSync(dirname(outTxtFile) || ".", { recursive: true });
    const lines = created.map((r) => `${r.email}|${r.apiKey}`).join("\n") + "\n";
    appendFileSync(outTxtFile, lines);
  }

  const okCount = created.length;
  const summaryColor = okCount === count ? c.brightGreen : okCount > 0 ? c.brightYellow : c.red;
  console.log();
  banner(summaryColor(`${sym.ok} Done: ${okCount}/${count} succeeded`));
  field("Saved", `${merged.length} account(s) → ${c.brightCyan(outFile)}  ${c.gray("+")} ${c.brightCyan(outTxtFile)}`);

  for (const r of created) {
    console.log(`\n${c.magenta(sym.box)} ${c.bold(c.brightCyan(r.email))}`);
    field("Name", r.name, c.white);
    field("Password", r.password, c.brightYellow);
    field("API key", r.apiKey, c.brightGreen);
    field("Base URL", r.baseUrl, c.gray);
  }
}

main().catch((err) => {
  error(`Fatal: ${err.message}`);
  process.exit(1);
});
