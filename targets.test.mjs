#!/usr/bin/env node
// Fixtures test for the MCP-config writers — the correctness-critical surface. Builds
// synthetic targets pointed at temp files (never touches real ~/.claude.json etc.) and
// proves: our server is added, ALL unrelated user content is preserved, writes are
// idempotent, and remove drops only ours. Run: node targets.test.mjs
import { writeTarget, removeTarget, isConfigured, SERVER_KEY } from "./targets.mjs";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log("  ok    " + n); } else { fail++; console.error("  FAIL  " + n + (x ? "  — " + x : "")); } };

const dir = mkdtempSync(join(tmpdir(), "pga-targets-"));
const VALS = { token: "pga_TESTTOKEN", mcpUrl: "https://mcp.phaser.io/agent/mcp" };
const reTable = new RegExp(`\\[mcp_servers\\.${SERVER_KEY}\\]`);

// ── JSON (Claude-style native HTTP) ──
const jsonFile = join(dir, "claude.json");
const jsonT = {
  format: "json", serversKey: "mcpServers", file: () => jsonFile,
  entry: ({ token, mcpUrl }) => ({ type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${token}` } }),
};
writeFileSync(jsonFile, JSON.stringify({ projects: { "/a": { x: 1 } }, mcpServers: { existing: { command: "foo" } } }, null, 2));
writeTarget(jsonT, VALS);
let c = JSON.parse(readFileSync(jsonFile, "utf8"));
ok("json: preserves unrelated top-level keys", c.projects?.["/a"]?.x === 1);
ok("json: preserves other servers", c.mcpServers.existing?.command === "foo");
ok("json: adds our server (http)", c.mcpServers[SERVER_KEY]?.type === "http");
ok("json: carries the token in the header", c.mcpServers[SERVER_KEY]?.headers?.Authorization === "Bearer pga_TESTTOKEN");
ok("json: isConfigured() true", isConfigured(jsonT));
ok("json: backup written", existsSync(jsonFile + ".bak-pga"));
writeTarget(jsonT, VALS); // idempotent
c = JSON.parse(readFileSync(jsonFile, "utf8"));
ok("json: idempotent (no duplicate servers)", Object.keys(c.mcpServers).length === 2);
removeTarget(jsonT);
c = JSON.parse(readFileSync(jsonFile, "utf8"));
ok("json: remove drops only ours", !c.mcpServers[SERVER_KEY] && c.mcpServers.existing?.command === "foo");
ok("json: remove keeps unrelated keys", c.projects?.["/a"]?.x === 1);
ok("json: isConfigured() false after remove", !isConfigured(jsonT));

// ── JSON: empty / whitespace-only placeholder file (e.g. Antigravity ships an empty
//    mcp_config.json) must be treated as a fresh {}, not rejected as "invalid JSON". ──
const emptyFile = join(dir, "mcp_config.json");
const emptyT = { ...jsonT, file: () => emptyFile };
writeFileSync(emptyFile, ""); // 0 bytes, exactly what Antigravity ships
let threw = false;
try { writeTarget(emptyT, VALS); } catch { threw = true; }
ok("json: empty placeholder file does not throw", !threw);
ok("json: empty file gets our server added", isConfigured(emptyT));
writeFileSync(emptyFile, "  \n\t "); // whitespace-only
threw = false;
try { writeTarget(emptyT, VALS); } catch { threw = true; }
ok("json: whitespace-only file does not throw", !threw && isConfigured(emptyT));

// ── TOML (Codex-style stdio bridge) ──
const tomlFile = join(dir, "config.toml");
const tomlT = {
  format: "toml", serversKey: "mcp_servers", file: () => tomlFile, tomlExtra: { startup_timeout_sec: 120 },
  entry: ({ token, mcpUrl }) => ({ command: "/usr/bin/node", args: ["/b.mjs"], env: { PHASER_AGENT_MCP_URL: mcpUrl, PHASER_GAME_AGENT_TOKEN: token } }),
};
writeFileSync(tomlFile, `model = "gpt-5"\n\n[mcp_servers.other]\ncommand = "bar"\n`);
writeTarget(tomlT, VALS);
let txt = readFileSync(tomlFile, "utf8");
ok("toml: preserves scalar key", /model = "gpt-5"/.test(txt));
ok("toml: preserves other server table", /\[mcp_servers\.other\]/.test(txt) && /command = "bar"/.test(txt));
ok("toml: adds our table", reTable.test(txt));
ok("toml: carries the token in env subtable", txt.includes('PHASER_GAME_AGENT_TOKEN = "pga_TESTTOKEN"'));
ok("toml: isConfigured() true", isConfigured(tomlT));
writeTarget(tomlT, VALS); // idempotent
txt = readFileSync(tomlFile, "utf8");
const n = (txt.match(new RegExp(reTable.source, "g")) || []).length;
ok("toml: idempotent (exactly one of our tables)", n === 1, `count=${n}`);
ok("toml: other table survives rewrite", /\[mcp_servers\.other\]/.test(txt) && /command = "bar"/.test(txt));
removeTarget(tomlT);
txt = readFileSync(tomlFile, "utf8");
ok("toml: remove drops ours", !reTable.test(txt));
ok("toml: remove keeps other table + scalar", /\[mcp_servers\.other\]/.test(txt) && /model = "gpt-5"/.test(txt));
ok("toml: isConfigured() false after remove", !isConfigured(tomlT));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
