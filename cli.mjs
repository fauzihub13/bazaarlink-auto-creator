// CLI entry point.
//   node cli.mjs                 -> create 1 account
//   node cli.mjs --count 5       -> create 5 accounts sequentially
//   node cli.mjs --headful       -> show the browser (useful for debugging)
//   node cli.mjs --proxy         -> route the browser through PROXY_URL (from .env)
//   node cli.mjs --no-proxy      -> force direct connection (default)
//   node cli.mjs --out results.json
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { createAccount } from "./src/creator.mjs";

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
const useProxy = process.argv.includes("--proxy") && !process.argv.includes("--no-proxy");

async function main() {
  console.log(`BazaarLink auto-creator — ${count} account(s), headless=${headless}, proxy=${useProxy ? "on" : "off"}\n`);
  const existing = readExisting(outFile);
  const created = [];
  for (let i = 1; i <= count; i++) {
    console.log(`=== Account ${i}/${count} ===`);
    try {
      const account = await createAccount({ headless, useProxy });
      created.push({ ok: true, ...account });
      console.log(`✓ Created: ${account.email}\n`);
    } catch (err) {
      console.error(`✗ Failed: ${err.message}\n`);
    }
  }

  // Persist only accounts that fully succeeded, appended to whatever was already
  // there so earlier accounts are never lost.
  const merged = existing.concat(created);
  mkdirSync(dirname(outFile) || ".", { recursive: true });
  writeFileSync(outFile, JSON.stringify(merged, null, 2));

  console.log(`\nDone: ${created.length}/${count} succeeded. ${merged.length} account(s) saved to ${outFile}`);
  for (const r of created) {
    console.log(`\n--- ${r.email} ---\nPassword: ${r.password}\nAPI key:  ${r.apiKey}\nName:     ${r.name}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
