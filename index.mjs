#!/usr/bin/env node
// Phaser Game Agent CLI — connect your local coding agent (Claude Code, Codex, Cursor,
// Gemini CLI, Windsurf, …) to build Phaser games on your own subscription.
//
//   phaser-game-agent                 one-shot: detect your CLIs → pick → sign in → configure
//   phaser-game-agent login           browser sign-in (or --token <t>) → store your token
//   phaser-game-agent setup           write MCP config (--tool <id>|all, else detect+pick)
//   phaser-game-agent status          who you are, access, and which CLIs are configured
//   phaser-game-agent logout          remove the token + the MCP config entries
//
// Zero dependencies — Node built-ins only. The per-CLI registry + writers live in
// targets.mjs. User-facing name is "Phaser Game Agent".
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { TARGETS, byId, detectInstalled, writeTarget, removeTarget, isConfigured, SERVER_KEY } from "./targets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = (() => { try { return JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")).version || ""; } catch { return ""; } })();
const HOME = homedir();
const CFG_DIR = join(HOME, ".config", "phaser-game-agent");
const CFG_PATH = join(CFG_DIR, "config.json");
const DEFAULT_SITE = process.env.PHASER_SITE_URL || "https://phaser.io";
const DEFAULT_MCP = process.env.PHASER_AGENT_MCP_URL || "https://mcp.phaser.io/agent/mcp";

// ── banner (colorized: truecolor → 256-color → plain, honoring NO_COLOR / non-TTY) ──
const RAW_BANNER = [
  "██████╗ ██╗  ██╗ █████╗ ███████╗███████╗██████╗",
  "██╔══██╗██║  ██║██╔══██╗██╔════╝██╔════╝██╔══██╗",
  "██████╔╝███████║███████║███████╗█████╗  ██████╔╝",
  "██╔═══╝ ██╔══██║██╔══██║╚════██║██╔══╝  ██╔══██╗",
  "██║     ██║  ██║██║  ██║███████║███████╗██║  ██║",
  "╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝",
];
const BANNER_W = Math.max(...RAW_BANNER.map((l) => l.length));
const center = (s, w) => " ".repeat(Math.max(0, Math.round((w - [...s].length) / 2))) + s;
// ▸ … ◂ — a reverse-facing arrow closes the line; version sits between, whole line centered.
const SUBTITLE = center(`▸  G A M E   A G E N T  v${VERSION}  ◂`, BANNER_W);
const COLOR =
  "NO_COLOR" in process.env || process.env.TERM === "dumb" || !process.stdout.isTTY ? "none"
  : /truecolor|24bit/i.test(process.env.COLORTERM || "") ? "true"
  : "256";
const RESET = "\x1b[0m";
// HSL→RGB (s,l in 0..1) — small, dependency-free.
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h * 12) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}
function fg([r, g, b]) {
  if (COLOR === "true") return `\x1b[38;2;${r};${g};${b}m`;
  const q = (v) => Math.round((v / 255) * 5); // 256-color 6×6×6 cube
  return `\x1b[38;5;${16 + 36 * q(r) + 6 * q(g) + q(b)}m`;
}
function renderBanner() {
  if (COLOR === "none") return "\n" + RAW_BANNER.join("\n") + "\n" + SUBTITLE;
  const width = Math.max(...RAW_BANNER.map((l) => l.length));
  const H0 = 150, H1 = 285; // spring-green → violet sweep, left → right
  const lines = RAW_BANNER.map((line) => {
    let out = "";
    [...line].forEach((ch, i) => { out += ch === " " ? " " : fg(hsl2rgb(H0 + (H1 - H0) * (i / width), 0.85, 0.62)) + ch; });
    return out + RESET;
  });
  return "\n" + lines.join("\n") + "\n" + fg(hsl2rgb(140, 0.9, 0.62)) + SUBTITLE + RESET;
}
const BANNER = renderBanner();
const SUPPORT = "Need help with your account? Contact support at https://phaser.io/contact";

// ── config ───────────────────────────────────────────────────────────────────
function loadCfg() { try { return JSON.parse(readFileSync(CFG_PATH, "utf8")); } catch { return {}; } }
function saveCfg(cfg) { mkdirSync(CFG_DIR, { recursive: true }); writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 }); }
function flag(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] || "") : ""; }
function has(name) { return process.argv.includes(`--${name}`); }
const mask = (t) => (t ? t.slice(0, 6) + "…" + t.slice(-4) : "(none)");

function openBrowser(url) {
  // No shell: a shell would split the URL on `&` (cmd) or globs (sh). Each platform's
  // opener takes the URL as one verbatim argv element. On Windows, `start` is a cmd
  // builtin that needs a shell (and then mangles `&`/`%`), so use rundll32 instead.
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
    : ["xdg-open", [url]];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch { /* ignore */ }
}

async function fetchMe(site, token) {
  try {
    const r = await fetch(`${site.replace(/\/+$/, "")}/api/gameblocks/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, ...(await r.json().catch(() => ({}))) };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Balance + recent activity + the authoritative Buy-credits link.
async function fetchCredits(site, token) {
  try {
    const r = await fetch(`${site.replace(/\/+$/, "")}/api/gameblocks/transactions`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return {};
    return await r.json().catch(() => ({})); // { balance, transactions:[{when,description,credits}], buyUrl }
  } catch { return {}; }
}
// /me returns username/publicId (not email yet) — prefer email if the site ever adds it.
const identityOf = (me) => me.email || me.username || me.publicId || "you";
const buyLink = (site, cr) => cr.buyUrl || `${site.replace(/\/+$/, "")}/account`;

// ── a tiny zero-dep picker (numbered; robust across terminals) ──────────────────
// ONE shared readline for the whole session. A fresh createInterface() per prompt loses
// buffered input after the first line on a piped (non-TTY) stdin — so multi-step menus broke
// under pipes and couldn't be tested. A single interface reads every line reliably. It keeps
// the event loop alive, so closeRl() must run before exit (see the dispatcher's finally).
let _rl = null;
const rl = () => _rl || (_rl = createInterface({ input: process.stdin, output: process.stdout }));
function ask(q) { return new Promise((res) => rl().question(q, (a) => res(a.trim()))); }
function closeRl() { if (_rl) { try { _rl.close(); } catch { /* ignore */ } _rl = null; } }
// allowBack adds a "0) Return to menu" choice → returns null when picked (caller goes back).
// allowManual adds a "Configure a CLI not on this list" choice → returns the string "manual".
async function pickTargets(list, { preselectAll = false, allowBack = false, allowManual = false } = {}) {
  if (!process.stdin.isTTY) return preselectAll ? list : [list[0]]; // non-interactive → sensible default
  list.forEach((t, i) => console.log(`  ${i + 1}) ${t.name}${t.verified ? "" : "  (experimental)"}`));
  const manualNum = list.length + 1;
  if (allowManual) console.log(`  ${manualNum}) Configure a CLI not on this list`);
  if (allowBack) console.log("  0) Return to menu");
  const a = await ask(`\nWhich would you like to configure? [e.g. 1,3 · 'all'${allowManual ? ` · ${manualNum} = other` : ""}${allowBack ? " · 0 = back" : ""} · Enter = ${preselectAll ? "all detected" : "1"}]: `);
  if (allowBack && /^(0|b|back)$/i.test(a)) return null;
  if (allowManual && a === String(manualNum)) return "manual";
  if (!a) return preselectAll ? list : [list[0]];
  if (/^all$/i.test(a)) return list;
  return a.split(/[ ,]+/).map((s) => parseInt(s, 10) - 1).filter((i) => i >= 0 && i < list.length).map((i) => list[i]);
}

// Re-push the CURRENT token into every CLI that's already configured. Called right after a
// fresh login so a new token never leaves old configs pointing at a stale token (logging in
// again mints a new token; without this, configured CLIs silently keep the previous one, and
// a later logout would orphan it server-side). Idempotent; only rewrites what's already there.
function reconfigureExisting(vals) {
  const names = [];
  for (const t of TARGETS) {
    let on = false; try { on = isConfigured(t); } catch { /* ignore */ }
    if (!on) continue;
    try { writeTarget(t, vals); names.push(t.name); } catch { /* leave as-is on error */ }
  }
  return names;
}

// ── login ───────────────────────────────────────────────────────────────────
// Returns true on success. Does NOT exit the process, so the one-shot can chain
// login → setup; the `login` command path exits explicitly in the dispatcher.
async function cmdLogin() {
  const site = flag("site") || DEFAULT_SITE;
  const mcpUrl = flag("mcp-url") || DEFAULT_MCP;
  const manual = flag("token");
  if (manual) {
    saveCfg({ ...loadCfg(), token: manual, site, mcpUrl });
    const me = await fetchMe(site, manual);
    console.log(me.ok ? `✓ token saved — signed in as ${identityOf(me)}${me.access ? "" : "  (⚠ no agent access yet — add credits or a subscription)"}` : `✓ token saved (could not verify against ${site} — ${me.error || me.status || "offline"})`);
    const refreshed = reconfigureExisting({ token: manual, mcpUrl });
    if (refreshed.length) console.log(`  ↻ updated token in: ${refreshed.join(", ")}`);
    return true;
  }
  const state = randomBytes(12).toString("hex");
  const page = (title, body) =>
    '<!doctype html><html><head><meta charset="utf-8"><title>Phaser Game Agent</title></head>' +
    '<body style="font:16px/1.5 system-ui,-apple-system,sans-serif;max-width:30rem;margin:4rem auto;padding:0 1rem;text-align:center;color:#111">' +
    `<h2 style="margin:0 0 .4rem">${title}</h2><p style="color:#666;margin:0">${body}</p></body></html>`;
  return await new Promise((done) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      if (u.pathname !== "/cb") { res.writeHead(404); return res.end(); }
      const token = u.searchParams.get("token") || "";
      if (u.searchParams.get("state") !== state || !token) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8", Connection: "close" });
        res.end(page("Sign-in failed", "Close this tab and run <code>phaser-game-agent login</code> again."));
        console.error("✗ sign-in failed (state mismatch) — please retry.");
        server.close(() => done(false));
        setTimeout(() => done(false), 1500).unref();
        return;
      }
      saveCfg({ ...loadCfg(), token, site, mcpUrl });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", Connection: "close" });
      res.end(page("You're connected", "Phaser Game Agent is signed in. You can close this tab and return to your terminal."));
      console.log("✓ signed in — token saved.");
      const refreshed = reconfigureExisting({ token, mcpUrl });
      if (refreshed.length) console.log(`  ↻ updated token in: ${refreshed.join(", ")}`);
      server.close(() => done(true));
      setTimeout(() => done(true), 1500).unref();
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const url = `${site.replace(/\/+$/, "")}/account/agent/connect?cli=1&state=${state}&redirect=${encodeURIComponent(`http://127.0.0.1:${port}/cb`)}`;
      console.log(`Opening your browser to sign in…\n  ${url}\n(If it doesn't open, paste that URL, or run: phaser-game-agent login --token <token>)`);
      openBrowser(url);
    });
    setTimeout(() => { try { server.close(); } catch { /* ignore */ } console.error("Timed out waiting for sign-in."); done(false); }, 180_000);
  });
}

// ── setup (write MCP config into one/many CLIs) ─────────────────────────────────
async function chooseTargets() {
  const want = flag("tool");
  if (want && want !== "all") {
    const t = byId(want) || TARGETS.find((x) => x.id.startsWith(want)); // 'claude' → 'claude-code'
    if (!t) { console.error(`Unknown CLI "${want}". Known: ${TARGETS.map((x) => x.id).join(", ")}`); process.exit(1); }
    return [t];
  }
  if (want === "all" || has("all")) return TARGETS;
  const installed = detectInstalled();
  if (installed.length === 1) { console.log(`Detected ${installed[0].name}.`); return installed; }
  if (installed.length > 1) { console.log("Detected these CLIs:"); return pickTargets(installed, { preselectAll: true }); }
  console.log("No supported CLIs auto-detected. Choose which to configure:");
  return pickTargets(TARGETS);
}

function writeChosen(chosen, vals) {
  for (const t of chosen) {
    try {
      const file = writeTarget(t, vals);
      console.log(`✓ ${t.name} → ${file}${t.remoteMcp ? "" : "  (via bridge)"}`);
      if (!t.verified) console.log(`    ⚠ experimental — restart ${t.name} and confirm the Phaser Game Agent tools appear.`);
    } catch (e) { console.error(`✗ ${t.name}: ${e.message}`); }
  }
}

async function cmdSetup() {
  const cfg = loadCfg();
  if (!cfg.token) { console.error("Not signed in. Run: phaser-game-agent login"); process.exit(1); }
  const vals = { token: cfg.token, mcpUrl: cfg.mcpUrl || DEFAULT_MCP };
  const chosen = await chooseTargets();
  if (!chosen || !chosen.length) { console.error("Nothing selected."); return; }
  writeChosen(chosen, vals);
  console.log(`\nDone. Restart the CLI(s), then check it's working — tell your agent:`);
  console.log(`    "Check my Phaser Game Agent account"`);
  console.log(`Then build a game: "use the Phaser Game Agent — open a project and build a Breakout clone".`);
  console.log(`\n${SUPPORT}`);
}

// ── manual: print copy-paste config for ANY MCP client we don't have a row for ──
// Every MCP client takes one of two shapes; we already build both for our listed CLIs, so
// here we just render them pre-filled (token + bridge path) and explain the key-name variants.
function cmdManual() {
  const cfg = loadCfg();
  if (!cfg.token) { console.error("Sign in first:  phaser-game-agent login"); process.exit(1); }
  const vals = { token: cfg.token, mcpUrl: cfg.mcpUrl || DEFAULT_MCP };
  const httpEntry = byId("claude-code").entry(vals);  // { type:'http', url, headers }
  const bridgeEntry = byId("cursor").entry(vals);     // { command, args, env }
  const indent = (o) => JSON.stringify({ [SERVER_KEY]: o }, null, 2).replace(/\n/g, "\n  ");

  console.log(`Configure any MCP-compatible client by hand
────────────────────────────────────────────
Add ONE MCP server (named "${SERVER_KEY}") to your client's config, using whichever shape it
supports. Then restart the client and check it: "Check my Phaser Game Agent account".

Your client's container key is one of:
  • "mcpServers"   — Cursor, Windsurf, most VS Code AI forks, Claude        (JSON)
  • "servers"      — native VS Code                                          (JSON)
  • "mcp_servers"  — Codex                                                   (TOML, see below)

A)  NATIVE REMOTE — for clients that speak Streamable-HTTP MCP with an auth header
    (e.g. Claude Code, VS Code). No bridge:

  ${indent(httpEntry)}

B)  STDIO BRIDGE — works with EVERY MCP client. Runs the bundled bridge; token via env:

  ${indent(bridgeEntry)}

    Codex / TOML form of (B):

    [mcp_servers.${SERVER_KEY}]
    command = ${JSON.stringify(bridgeEntry.command)}
    args = ${JSON.stringify(bridgeEntry.args)}

    [mcp_servers.${SERVER_KEY}.env]
    PHASER_AGENT_MCP_URL = ${JSON.stringify(vals.mcpUrl)}
    PHASER_GAME_AGENT_TOKEN = ${JSON.stringify(vals.token)}

Tips
  • Prefer (A) if your client offers a "remote / HTTP MCP server" option; otherwise use (B).
  • (B)'s command/args point at your GLOBAL install — keep it installed: npm i -g @phaser/game-agent
  • Our endpoint needs the token even to list tools, so a URL-only add with no header won't work.
  • If your client connected, "Check my Phaser Game Agent account" greets you by name.

${SUPPORT}`);
}

// ── status ──────────────────────────────────────────────────────────────────
async function cmdStatus() {
  const cfg = loadCfg();
  const site = cfg.site || DEFAULT_SITE;
  console.log(`token:   ${mask(cfg.token)}`);
  console.log(`site:    ${site}`);
  console.log(`mcp url: ${cfg.mcpUrl || DEFAULT_MCP}`);
  if (cfg.token) {
    const me = await fetchMe(site, cfg.token);
    if (me.ok) {
      const cr = await fetchCredits(site, cfg.token);
      const bal = typeof cr.balance === "number" ? cr.balance : me.balance;
      console.log(`signed in as: ${identityOf(me)}   access: ${me.access ? "YES" : "NO — add credits or a subscription"}${bal != null ? `   credits: ${bal}` : ""}`);
      if (bal != null) console.log(`buy credits:  ${buyLink(site, cr)}`);
    } else console.log(`could not verify (${me.error || me.status || "offline"})`);
  }
  console.log("\nCLIs:");
  for (const t of TARGETS) {
    let present = false; try { present = t.detect(); } catch { /* ignore */ }
    const tag = isConfigured(t) ? "✓ configured" : present ? "• detected  " : "  –         ";
    console.log(`  ${tag}  ${t.name}${t.verified ? "" : "  (experimental)"}`);
  }
  console.log(`\n${SUPPORT}`);
}

// ── logout ──────────────────────────────────────────────────────────────────
function cmdLogout() {
  const cfg = loadCfg();
  delete cfg.token;
  saveCfg(cfg);
  const removed = TARGETS.filter((t) => { try { return removeTarget(t); } catch { return false; } }).map((t) => t.name);
  console.log(`✓ logged out — token cleared${removed.length ? `; removed config from ${removed.join(", ")}` : ""}.`);
  console.log("(To fully revoke this device, do it from your Phaser account settings.)");
}

// ── one-shot: the Vercel-style `npx phaser-game-agent` ──────────────────────────
async function cmdConnect() {
  console.log(BANNER + "\n");
  const cfg = loadCfg();
  // First run / signed out → keep the smooth one-shot: sign in, then configure.
  if (!cfg.token) {
    if (!(await cmdLogin())) process.exit(1);
    await cmdSetup();
    return;
  }
  // Returning, signed-in user → greet, then a small management menu (credits live under option 3).
  const site = cfg.site || DEFAULT_SITE;
  const me = await fetchMe(site, cfg.token);
  if (me.ok) {
    console.log(`Logged in as: ${identityOf(me)}`);
    if (!me.access) console.log("⚠ No agent access yet — add credits or a subscription to build.");
  } else {
    console.log(`Signed in, but couldn't reach ${site} (${me.error || me.status || "offline"}).`);
  }
  console.log("");
  await accountMenu();
}

// Interactive management for a signed-in user. Non-TTY (piped) falls back to configuring,
// preserving the old npx one-shot behaviour for scripted installs.
async function accountMenu() {
  if (!process.stdin.isTTY) { await cmdSetup(); return; }
  for (;;) {
    console.log("What would you like to do?");
    console.log("  1) Configure / update your coding agents");
    console.log("  2) Refresh your token across configured agents");
    console.log("  3) Show Credits Balance and Transactions");
    console.log("  4) Log out");
    console.log("  5) Quit");
    const a = (await ask("\n[1-5]: ")).toLowerCase();
    if (a === "4" || a === "logout") { console.log(""); cmdLogout(); break; }
    if (a === "" || a === "5" || a === "q" || a === "quit") break;
    if (a === "1") { console.log(""); await menuConfigure(); console.log(""); }
    else if (a === "2") {
      const cfg = loadCfg();
      const names = reconfigureExisting({ token: cfg.token, mcpUrl: cfg.mcpUrl || DEFAULT_MCP });
      console.log(names.length ? `↻ refreshed token in: ${names.join(", ")}\n` : "No configured agents yet — choose 1 first.\n");
    } else if (a === "3") { await showCreditsCli(); console.log(""); }
    else console.log("Please pick 1-5.\n");
  }
  console.log(`\n${SUPPORT}`);
}

// Configure flow reachable from the menu — same writer as `setup`, but the picker offers a
// "Return to menu" choice and we loop back instead of ending the session.
async function menuConfigure() {
  const cfg = loadCfg();
  const vals = { token: cfg.token, mcpUrl: cfg.mcpUrl || DEFAULT_MCP };
  const installed = detectInstalled();
  const list = installed.length ? installed : TARGETS;
  console.log(installed.length ? "Detected these CLIs:" : "No CLIs auto-detected — choose which to configure:");
  const chosen = await pickTargets(list, { preselectAll: installed.length > 1, allowBack: true, allowManual: true });
  if (chosen === null) return; // back to menu
  if (chosen === "manual") { console.log(""); cmdManual(); return; } // copy-paste config for any client
  if (!chosen.length) { console.log("Nothing selected."); return; }
  writeChosen(chosen, vals);
  console.log(`\nRestart the CLI(s), then verify: "Check my Phaser Game Agent account".`);
}

async function showCreditsCli() {
  const cfg = loadCfg();
  const site = cfg.site || DEFAULT_SITE;
  const cr = await fetchCredits(site, cfg.token);
  if (typeof cr.balance === "number") console.log(`Credits balance: ${cr.balance}`);
  if (Array.isArray(cr.transactions) && cr.transactions.length) {
    console.log("Recent transactions:");
    for (const t of cr.transactions.slice(0, 8)) console.log(`  ${t.when || ""}  ${t.description || ""}  ${t.credits > 0 ? "+" : ""}${t.credits}`);
  }
  const url = buyLink(site, cr);
  if (!process.stdin.isTTY) { console.log(`Buy more credits: ${url}`); return; }
  console.log("\n  1) Buy more credits (opens your browser)");
  console.log("  2) Return to menu");
  const a = (await ask("\n[1-2]: ")).toLowerCase();
  if (a === "1") { openBrowser(url); console.log(`Opening ${url} …`); }
}

function help() {
  console.log(`${BANNER}

  phaser-game-agent                 connect: detect your CLIs → pick → sign in → configure
  phaser-game-agent login           browser sign-in (or --token <t>)
  phaser-game-agent setup           write MCP config  (--tool <id>|all, else detect+pick)
  phaser-game-agent manual          print copy-paste MCP config for any non-listed client
  phaser-game-agent status          token, access, and which CLIs are configured
  phaser-game-agent logout          remove the token + MCP config entries

  Supported CLIs: ${TARGETS.map((t) => t.id + (t.verified ? "" : "*")).join(", ")}   (* = experimental)

  ${SUPPORT}
`);
}

const cmd = process.argv[2];
(async () => {
  switch (cmd) {
    case "login": { const ok = await cmdLogin(); process.exitCode = ok ? 0 : 1; break; }
    case "setup": console.log(BANNER + "\n"); await cmdSetup(); break;
    case "manual": case "config": console.log(BANNER + "\n"); cmdManual(); break;
    case "status": await cmdStatus(); break;
    case "logout": cmdLogout(); break;
    case "help": case "-h": case "--help": help(); break;
    default:
      if (cmd) { console.error(`Unknown command "${cmd}".`); help(); process.exitCode = 1; break; }
      await cmdConnect();
  }
})().catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => { closeRl(); process.exit(process.exitCode || 0); }); // closeRl frees the event loop
