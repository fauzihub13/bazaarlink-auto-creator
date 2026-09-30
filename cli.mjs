// CLI entry point.
//   node cli.mjs                 -> create 1 account
//   node cli.mjs --count 5       -> create 5 accounts sequentially
//   node cli.mjs --headful       -> show the browser (useful for debugging)
//   node cli.mjs --out results.json
import { writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { createAccount } from "./creator.mjs";

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const count = parseInt(argValue("--count", "1"), 10) || 1;
const headless = !process.argv.includes("--headful");
const outFile = argValue("--out", "results.json");

async function main() {
  console.log(`BazaarLink auto-creator — ${count} account(s), headless=${headless}\n`);
  const results = [];
  for (let i = 1; i <= count; i++) {
    console.log(`=== Account ${i}/${count} ===`);
    try {
      const account = await createAccount({ headless });
      results.push({ ok: true, ...account });
      console.log(`✓ Created: ${account.email}\n`);
    } catch (err) {
      results.push({ ok: false, error: err.message });
      console.error(`✗ Failed: ${err.message}\n`);
    }
  }

  mkdirSync(dirname(outFile) || ".", { recursive: true });
  writeFileSync(outFile, JSON.stringify(results, null, 2));

  const ok = results.filter((r) => r.ok).length;
  console.log(`\nDone: ${ok}/${count} succeeded. Results written to ${outFile}`);
  for (const r of results) {
    if (r.ok) {
      console.log(`\n--- ${r.email} ---\nPassword: ${r.password}\nAPI key:  ${r.apiKey}\nName:     ${r.name}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
