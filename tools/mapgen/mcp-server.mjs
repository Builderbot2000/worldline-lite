// Worldline Lite — geography generation MCP server. Zero dependencies.
//
// Speaks MCP over stdio: LSP-style framed JSON-RPC 2.0 (Content-Length header,
// then the JSON body). We implement just what a client needs: initialize,
// notifications/initialized, tools/list, tools/call. The agent team invokes
// these as mcp__worldline-mapgen__* to turn a genesis.json seed lever into the
// run's generated geometry.json — geography written as DATA into the data store.
//
// HARD RULE: stdout carries the JSON-RPC stream ONLY. All logging goes to stderr.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, validateGenesis } from "./generate.mjs";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const log = (...a) => process.stderr.write("[mapgen] " + a.join(" ") + "\n");

// ---- tool definitions -------------------------------------------------------

const TOOLS = [
  {
    name: "generate_geography",
    description:
      "Generate beautiful geography for a run from its genesis.json seed lever " +
      "(regions + adjacency/relations + sea band + river/feature intents). Region " +
      "seeds/weights are OPTIONAL — omit them and the layout solver places regions " +
      "from the adjacency graph (author meaning, not coordinates). Grows region " +
      "polygons (weighted Voronoi), refines coasts/borders, derives rivers, and " +
      "places features, then writes runs/<run>/geometry.json (and a catalog " +
      "map.json). Deterministic: same input → byte-identical output.",
    inputSchema: {
      type: "object",
      required: ["run"],
      properties: {
        run: { type: "string", description: "run folder under runs/ (e.g. \"genesis\")" },
        genesis_path: { type: "string", description: "override path to the seed lever" },
        out_path: { type: "string", description: "override geometry.json output path" },
        write_map: { type: "boolean", description: "also emit catalog map.json (default true)" },
        dry_run: { type: "boolean", description: "compute and report but write nothing" },
      },
    },
  },
  {
    name: "validate_genesis",
    description:
      "Lint a run's genesis.json seed lever WITHOUT writing anything: checks unique " +
      "region ids, in-bounds seeds (when provided — seeds are optional), and symmetric " +
      "adjacency. Returns { ok, errors, warnings }.",
    inputSchema: {
      type: "object",
      required: ["run"],
      properties: {
        run: { type: "string" },
        genesis_path: { type: "string" },
      },
    },
  },
];

function callTool(name, args) {
  args = args || {};
  if (name === "generate_geography") {
    const res = generate({
      run: args.run, root: PROJECT_ROOT,
      genesis_path: args.genesis_path, out_path: args.out_path,
      write_map: args.write_map, dry_run: args.dry_run,
    });
    return res;
  }
  if (name === "validate_genesis") {
    const path = args.genesis_path || join(PROJECT_ROOT, "runs", args.run, "genesis.json");
    if (!existsSync(path)) return { ok: false, errors: [`no genesis file at ${path}`], warnings: [] };
    return validateGenesis(JSON.parse(readFileSync(path, "utf8")));
  }
  throw rpcError(-32601, `unknown tool: ${name}`);
}

// ---- JSON-RPC dispatch ------------------------------------------------------

function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return reply(id, {
      protocolVersion: (params && params.protocolVersion) || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "worldline-mapgen", version: "1.0.0" },
    });
  }
  if (method === "notifications/initialized" || method === "initialized") return null; // no response
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") return reply(id, { tools: TOOLS });
  if (method === "tools/call") {
    const tname = params && params.name;
    try {
      const result = callTool(tname, params && params.arguments);
      return reply(id, {
        content: [{ type: "text", text: summarize(tname, result) }],
        structuredContent: result,
        isError: result && result.ok === false,
      });
    } catch (e) {
      if (e && e.__rpc) return replyError(id, e.code, e.message);
      log("tool error:", e && e.stack || e);
      return reply(id, { content: [{ type: "text", text: "Error: " + (e && e.message || e) }], isError: true });
    }
  }
  if (id === undefined) return null;          // unknown notification
  return replyError(id, -32601, `method not found: ${method}`);
}

function summarize(name, r) {
  if (!r) return "no result";
  if (r.ok === false) return "FAILED:\n- " + (r.errors || ["unknown error"]).join("\n- ");
  if (name === "validate_genesis")
    return `genesis ok. ${(r.warnings || []).length} warning(s).` +
      (r.warnings && r.warnings.length ? "\n- " + r.warnings.join("\n- ") : "");
  const a = r.adjacency || {};
  return [
    `Wrote: ${(r.written || []).join(", ") || "(dry run, nothing written)"}`,
    `Regions: ${r.regions}  Edges: coast ${r.edges.coast}, border ${r.edges.border}, frame ${r.edges.frame}`,
    `Rivers: ${r.rivers}  Features: ${r.features}`,
    `Adjacency: ${a.realized}/${a.declared} declared realized` +
      (a.missing && a.missing.length ? `; MISSING ${a.missing.join(", ")}` : ""),
    `Input hash: ${r.input_hash} (deterministic)`,
    (r.warnings && r.warnings.length ? "Warnings:\n- " + r.warnings.join("\n- ") : ""),
  ].filter(Boolean).join("\n");
}

const reply = (id, result) => ({ jsonrpc: "2.0", id, result });
const replyError = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
const rpcError = (code, message) => { const e = new Error(message); e.__rpc = true; e.code = code; return e; };

// ---- stdio framing ----------------------------------------------------------

function send(obj) {
  if (!obj) return;
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

let buf = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const sep = buf.indexOf("\r\n\r\n");
    if (sep === -1) return;
    const header = buf.slice(0, sep).toString("utf8");
    const m = /Content-Length:\s*(\d+)/i.exec(header);
    if (!m) { buf = buf.slice(sep + 4); continue; }
    const len = parseInt(m[1], 10);
    const start = sep + 4;
    if (buf.length < start + len) return;            // wait for the full body
    const body = buf.slice(start, start + len).toString("utf8");
    buf = buf.slice(start + len);
    let msg;
    try { msg = JSON.parse(body); } catch (e) { log("bad JSON:", e.message); continue; }
    try { send(handle(msg)); } catch (e) { log("dispatch error:", e && e.stack || e); }
  }
});
process.stdin.on("end", () => process.exit(0));
log("worldline-mapgen MCP server ready");
