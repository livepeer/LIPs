#!/usr/bin/env node
// Verifies that each LIP's status is consistent between its file frontmatter
// (LIPs/LIP-N.md) and the README index table. Exits non-zero on any mismatch,
// unknown status, orphan row/file, or trailing whitespace in a status value.
//
// Run: node scripts/check-lip-status.mjs

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lipsDir = join(root, "LIPs");
const readmePath = join(root, "README.md");

// Allowed statuses, defined by LIP-1 ("LIP Statuses"). LIP-1 is the source of
// truth; this list is intentionally hardcoded rather than parsed from LIP-1's
// prose. The set is governance-level and changes essentially never — if LIP-1
// ever adds/removes a status, update this set in the same PR.
const VALID = new Set([
  "Draft",
  "Last Call",
  "Proposed",
  "Abandoned",
  "Accepted",
  "Rejected",
  "Final",
]);

const errors = [];

// --- Frontmatter status, per LIP file -------------------------------------
const fileStatus = new Map(); // lip number (string) -> { raw, value }
for (const name of readdirSync(lipsDir)) {
  const m = name.match(/^LIP-(\d+)\.md$/);
  if (!m) continue;
  const num = m[1];
  const text = readFileSync(join(lipsDir, name), "utf8");
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) {
    errors.push(`LIP-${num}: missing YAML frontmatter block`);
    continue;
  }
  const line = fm[1].split(/\r?\n/).find((l) => /^status:/.test(l));
  if (!line) {
    errors.push(`LIP-${num}: frontmatter has no "status:" field`);
    continue;
  }
  const raw = line.replace(/^status:/, "").replace(/\r$/, "");
  const value = raw.trim();
  if (raw !== ` ${value}`) {
    errors.push(`LIP-${num}: status has stray/trailing whitespace: "status:${raw}"`);
  }
  if (!VALID.has(value)) {
    errors.push(`LIP-${num}: unknown status "${value}" (frontmatter)`);
  }
  fileStatus.set(num, value);
}

// --- README index table ----------------------------------------------------
const readme = readFileSync(readmePath, "utf8");
const rowRe = /^\|\s*\[(\d+)\]\(LIPs\/LIP-\d+\.md\)\s*\|[^|]*\|\s*([^|]+?)\s*\|\s*$/gm;
const readmeStatus = new Map();
for (const m of readme.matchAll(rowRe)) {
  const num = m[1];
  const value = m[2].trim();
  if (!VALID.has(value)) {
    errors.push(`LIP-${num}: unknown status "${value}" (README)`);
  }
  readmeStatus.set(num, value);
}

// --- Cross-check -----------------------------------------------------------
const all = new Set([...fileStatus.keys(), ...readmeStatus.keys()]);
const rows = [];
for (const num of [...all].sort((a, b) => Number(a) - Number(b))) {
  const f = fileStatus.get(num);
  const r = readmeStatus.get(num);
  if (f === undefined) errors.push(`LIP-${num}: in README index but no LIPs/LIP-${num}.md file`);
  else if (r === undefined) errors.push(`LIP-${num}: file exists but missing from README index`);
  else if (f !== r) {
    errors.push(`LIP-${num}: status mismatch — frontmatter "${f}" vs README "${r}"`);
    rows.push([num, f, r]);
  }
}

if (errors.length) {
  console.error("LIP status check FAILED:\n");
  for (const e of errors) console.error("  - " + e);
  if (rows.length) {
    console.error("\nMismatched LIPs:");
    console.error("  LIP   frontmatter        README");
    for (const [n, f, r] of rows) {
      console.error(`  ${n.padEnd(5)} ${f.padEnd(18)} ${r}`);
    }
  }
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}

console.log(`LIP status check passed: ${all.size} LIPs consistent.`);
