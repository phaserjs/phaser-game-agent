#!/usr/bin/env node
// stdio ↔ HTTP bridge for the Phaser Game Agent MCP.
//
// The Codex desktop app reliably surfaces only STDIO MCP servers, but our server is
// hosted over HTTP (mcp.phaser.io). So `phaser-game-agent setup` points Codex at this
// bridge: it reads newline-delimited JSON-RPC from stdin and forwards each message to
// the remote HTTP MCP, writing responses back to stdout. The remote is a STATELESS
// JSON server, so each JSON-RPC message maps cleanly to one HTTP POST.
//
// Env (set by the CLI in the agent config):
//   PHASER_AGENT_MCP_URL      the remote MCP endpoint (e.g. https://mcp.phaser.io/agent/mcp)
//   PHASER_GAME_AGENT_TOKEN   the user's token (sent as Authorization: Bearer)
import http from "node:http";
import https from "node:https";

const URL_ = process.env.PHASER_AGENT_MCP_URL;
const TOKEN = process.env.PHASER_GAME_AGENT_TOKEN || "";
if (!URL_) { process.stderr.write("phaser-game-agent bridge: PHASER_AGENT_MCP_URL not set\n"); process.exit(1); }

// Use node:http(s) with agent:false rather than fetch(): Node's fetch keeps the socket
// warm in an undici keep-alive pool, and tearing that down on process.exit aborts libuv
// on Windows. agent:false closes the socket after each response, so on stdin EOF there's
// no lingering handle and the bridge exits cleanly.
function forward(msg) {
  return new Promise((resolve, reject) => {
    const u = new URL(URL_);
    const lib = u.protocol === "http:" ? http : https;
    const body = JSON.stringify(msg);
    const req = lib.request(u, {
      method: "POST",
      agent: false,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Content-Length": Buffer.byteLength(body),
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
    }, (res) => {
      const ct = res.headers["content-type"] || "";
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { text += c; });
      res.on("end", () => {
        try {
          if (!text) return resolve(null);
          if (ct.includes("text/event-stream")) {
            const data = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean);
            return resolve(data.length ? JSON.parse(data[data.length - 1]) : null);
          }
          resolve(JSON.parse(text));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

let pending = 0, ended = false;
// Defer the exit one turn: forcing process.exit(0) while undici's keep-alive socket
// from fetch() is still closing aborts libuv on Windows ("UV_HANDLE_CLOSING" assertion).
// setImmediate lets those close callbacks run, so we exit cleanly instead of crashing.
const maybeExit = () => { if (ended && pending === 0) setImmediate(() => process.exit(0)); };

async function handle(line) {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const isRequest = msg && msg.id !== undefined && msg.id !== null && !!msg.method;
  pending++;
  try {
    const out = await forward(msg);
    if (isRequest && out) process.stdout.write(JSON.stringify(out) + "\n");
  } catch (e) {
    if (isRequest) process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: `bridge: ${e.message}` } }) + "\n");
    else process.stderr.write(`phaser-game-agent bridge notify error: ${e.message}\n`);
  } finally { pending--; maybeExit(); }
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (line) handle(line);
  }
});
// Don't exit until stdin closed AND all forwarded requests have resolved.
process.stdin.on("end", () => { ended = true; maybeExit(); });
