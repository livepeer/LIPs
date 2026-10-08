#!/usr/bin/env node
// Reconciles each LIP's documented status against the outcome of its on-chain
// LIP-16 governance poll, and applies the suggested status edits to the LIP
// files + README so a workflow can open a ready-to-merge PR.
//
// Data sources:
//   - The Graph subgraph "Livepeer" (Arbitrum One). The `Poll` entity carries
//     the proposal IPFS hash, endBlock (an L1/Ethereum block number), the
//     6-decimal-percentage quorum/quota, and the stake-weighted tally.
//   - The proposal IPFS object ({ gitCommitHash, text }); its `text` frontmatter
//     `lip:` field links a poll to a LIP (same path the Livepeer Explorer uses).
//   - An Ethereum L1 RPC for the current block number (poll.endBlock is L1).
//
// Pass rule (LIP-16, "LIP Statuses" / tally algorithm):
//   totalVoteStake = tally.yes + tally.no
//   quorum met  <=> totalVoteStake >= totalStake * quorum / 1e6
//   result yes  <=> quorum met AND tally.yes > totalVoteStake * quota / 1e6
// We use the protocol's current totalActiveStake as `totalStake`. The exact
// LIP-16 value is the stake snapshot at poll.endBlock; the small drift does not
// change the outcome except in a knife-edge quorum case, and every result is
// surfaced in the PR for an editor to confirm before merging.
//
// Env:
//   SUBGRAPH_URL  (required)  full GraphQL endpoint for the Livepeer subgraph
//   ETH_RPC_URL   (optional)  L1 RPC, default https://ethereum-rpc.publicnode.com
//   IPFS_GATEWAY  (optional)  default https://ipfs.livepeer.com/ipfs/
//   PR_BODY_PATH  (optional)  where to write the PR body markdown
//
// Exit code is always 0 (a clean run with no divergences is normal); it throws
// only on hard failures (no SUBGRAPH_URL, network/parse errors).

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lipsDir = join(root, "LIPs");
const readmePath = join(root, "README.md");

const SUBGRAPH_URL = process.env.SUBGRAPH_URL;
const ETH_RPC_URL = process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com";
const IPFS_GATEWAY = (process.env.IPFS_GATEWAY || "https://ipfs.livepeer.com/ipfs/").replace(/\/?$/, "/");
const PR_BODY_PATH = process.env.PR_BODY_PATH;

if (!SUBGRAPH_URL) {
  throw new Error("SUBGRAPH_URL env var is required (the Livepeer subgraph GraphQL endpoint).");
}

const QUORUM_DIVISOR = 1_000_000; // quorum/quota are 6-decimal fixed point

async function gql(query) {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`subgraph HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`subgraph GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function currentL1Block() {
  const res = await fetch(ETH_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
  });
  const json = await res.json();
  return BigInt(json.result);
}

// proposal IPFS object -> LIP number (or null). Memoized per hash.
const lipCache = new Map();
async function lipForProposal(hash) {
  if (lipCache.has(hash)) return lipCache.get(hash);
  let lip = null;
  try {
    const res = await fetch(IPFS_GATEWAY + hash, { signal: AbortSignal.timeout(30_000) });
    const obj = await res.json();
    const text = typeof obj?.text === "string" ? obj.text : "";
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const block = fm ? fm[1] : text;
    const m = block.match(/^lip:\s*(\d+)\s*$/m);
    if (m) lip = m[1];
  } catch (e) {
    console.error(`  ! could not resolve proposal ${hash}: ${e.message}`);
  }
  lipCache.set(hash, lip);
  return lip;
}

function readFrontmatterStatus(num) {
  const text = readFileSync(join(lipsDir, `LIP-${num}.md`), "utf8");
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line = fm && fm[1].split(/\r?\n/).find((l) => /^status:/.test(l));
  return line ? line.replace(/^status:/, "").trim() : null;
}

function setFrontmatterStatus(num, status) {
  const path = join(lipsDir, `LIP-${num}.md`);
  const text = readFileSync(path, "utf8");
  writeFileSync(path, text.replace(/^status:.*$/m, `status: ${status}`));
}

function setReadmeStatus(num, status) {
  const text = readFileSync(readmePath, "utf8");
  const re = new RegExp(`^(\\|\\s*\\[${num}\\]\\(LIPs/LIP-${num}\\.md\\)\\s*\\|[^|]*\\|)([^|]*)\\|`, "m");
  const out = text.replace(re, (_, head, cell) => `${head} ${status.padEnd(cell.trim().length > 9 ? cell.trim().length : 9)} |`);
  writeFileSync(readmePath, out);
}

function pollResult(poll, totalStake) {
  const yes = Number(poll.tally?.yes ?? 0);
  const no = Number(poll.tally?.no ?? 0);
  const tv = yes + no;
  const quorumNeeded = (totalStake * Number(poll.quorum)) / QUORUM_DIVISOR;
  if (tv < quorumNeeded) return { result: "invalid", yes, no, tv, quorumNeeded };
  const yesNeeded = (tv * Number(poll.quota)) / QUORUM_DIVISOR;
  return { result: yes > yesNeeded ? "yes" : "no", yes, no, tv, quorumNeeded, yesNeeded };
}

const main = async () => {
  console.log("Querying subgraph + L1 block...");
  const data = await gql(`{
    polls(first: 1000, orderBy: endBlock, orderDirection: desc) {
      id proposal endBlock quorum quota tally { yes no }
    }
    protocol(id: "0") { totalActiveStake }
  }`);
  const l1 = await currentL1Block();
  const totalStake = Number(data.protocol.totalActiveStake);
  console.log(`  L1 block ${l1}, totalActiveStake ${totalStake.toFixed(0)}, ${data.polls.length} polls`);

  // Latest poll per LIP.
  const latestByLip = new Map();
  for (const poll of data.polls) {
    const lip = await lipForProposal(poll.proposal);
    if (!lip) continue;
    if (!latestByLip.has(lip)) latestByLip.set(lip, poll); // polls already sorted desc by endBlock
  }

  const findings = [];
  for (const [lip, poll] of latestByLip) {
    let documented;
    try {
      documented = readFrontmatterStatus(lip);
    } catch {
      continue; // poll references a LIP not in this repo
    }
    const concluded = l1 > BigInt(poll.endBlock);
    const TERMINAL = new Set(["Final", "Abandoned", "Accepted", "Rejected"]);

    let suggested = null;
    let rationale = "";
    if (!concluded) {
      if (documented === "Draft" || documented === "Last Call") {
        suggested = "Proposed";
        rationale = `active poll \`${poll.id}\` (ends L1 block ${poll.endBlock})`;
      }
    } else if (!TERMINAL.has(documented)) {
      const r = pollResult(poll, totalStake);
      if (r.result === "yes") {
        suggested = "Accepted";
        rationale = `poll \`${poll.id}\` passed (yes ${r.yes.toFixed(0)} > ${r.yesNeeded.toFixed(0)} needed, quorum met). May already be Final if executed — confirm.`;
      } else if (r.result === "no") {
        suggested = "Rejected";
        rationale = `poll \`${poll.id}\` failed (yes ${r.yes.toFixed(0)} ≤ ${r.yesNeeded.toFixed(0)} needed; quorum met)`;
      } else {
        rationale = `poll \`${poll.id}\` concluded without quorum (voted ${r.tv.toFixed(0)} < ${r.quorumNeeded.toFixed(0)})`;
      }
    }

    if (suggested && suggested !== documented) {
      findings.push({ lip, documented, suggested, rationale, poll: poll.id });
    }
  }

  findings.sort((a, b) => Number(a.lip) - Number(b.lip));

  if (!findings.length) {
    console.log("No status divergences found.");
    return; // no PR_BODY_PATH written -> workflow skips the open-PR step
  }

  console.log(`\n${findings.length} divergence(s):`);
  for (const f of findings) {
    console.log(`  LIP-${f.lip}: documented ${f.documented} -> suggested ${f.suggested} (${f.rationale})`);
    setFrontmatterStatus(f.lip, f.suggested);
    setReadmeStatus(f.lip, f.suggested);
  }

  const body = [
    "Automated weekly reconciliation of LIP status against on-chain LIP-16 poll outcomes.",
    "",
    "Each row was derived from the latest governance poll linked to the LIP (via its proposal IPFS hash). Please confirm before merging — for a passed poll the terminal status may be `Final` (if already executed) rather than `Accepted`.",
    "",
    "| LIP | documented | suggested | basis |",
    "| --- | --- | --- | --- |",
    ...findings.map((f) => `| ${f.lip} | ${f.documented} | **${f.suggested}** | ${f.rationale} |`),
    "",
    "Refs #112.",
  ].join("\n");
  if (PR_BODY_PATH) writeFileSync(PR_BODY_PATH, body);
  console.log("\nApplied edits + wrote PR body.");
};

await main();
