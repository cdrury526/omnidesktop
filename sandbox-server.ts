#!/usr/bin/env tsx
/**
 * Cross-origin sandbox proxy server.
 *
 * Per the MCP Apps spec, the sandbox proxy MUST be served from a DIFFERENT
 * ORIGIN than the host. The host (Tauri webview / Vite) runs on :1420; this
 * server runs on :1430, giving us the required origin isolation.
 *
 * It does two things:
 *   1. Bundles src/mcp/sandbox.ts (the outer-iframe relay) with esbuild.
 *   2. Serves it as sandbox.html with a per-request Content-Security-Policy
 *      HTTP header built from the ?csp= query param. CSP via header is
 *      tamper-proof, unlike a <meta> tag.
 *
 * In production (bundled Tauri app) run this same logic as a Tauri sidecar
 * binary bound to a localhost port — see README "Production cross-origin".
 */

import express from "express";
import cors from "cors";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { McpUiResourceCsp } from "@modelcontextprotocol/ext-apps/app-bridge";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SANDBOX_PORT = parseInt(process.env.SANDBOX_PORT || "1430", 10);

// ---- Bundle the relay once at startup (cache the result) ----
async function bundleSandbox(): Promise<string> {
  const result = await build({
    entryPoints: [join(__dirname, "src/mcp/sandbox.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    write: false,
    minify: false,
  });
  return result.outputFiles[0].text;
}

const sandboxScriptPromise = bundleSandbox();

function htmlShell(script: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>MCP App Sandbox</title></head><body><script type="module">${script}</script></body></html>`;
}

// ---- CSP header builder (mirrors the ext-apps basic-host reference) ----
function sanitizeCspDomains(domains?: string[]): string[] {
  if (!domains) return [];
  return domains.filter((d) => typeof d === "string" && !/[;\r\n'" ]/.test(d));
}

function buildCspHeader(csp?: McpUiResourceCsp): string {
  const resourceDomains = sanitizeCspDomains(csp?.resourceDomains).join(" ");
  const connectDomains = sanitizeCspDomains(csp?.connectDomains).join(" ");
  const frameDomains = sanitizeCspDomains(csp?.frameDomains).join(" ") || null;
  const baseUriDomains = sanitizeCspDomains(csp?.baseUriDomains).join(" ") || null;

  return [
    "default-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: ${resourceDomains}`.trim(),
    `style-src 'self' 'unsafe-inline' blob: data: ${resourceDomains}`.trim(),
    `img-src 'self' data: blob: ${resourceDomains}`.trim(),
    `font-src 'self' data: blob: ${resourceDomains}`.trim(),
    `media-src 'self' data: blob: ${resourceDomains}`.trim(),
    `connect-src 'self' ${connectDomains}`.trim(),
    `worker-src 'self' blob: ${resourceDomains}`.trim(),
    frameDomains ? `frame-src ${frameDomains}` : "frame-src 'none'",
    "object-src 'none'",
    baseUriDomains ? `base-uri ${baseUriDomains}` : "base-uri 'none'",
  ].join("; ");
}

const app = express();
app.use(cors());

app.get(["/", "/sandbox.html"], async (req, res) => {
  let cspConfig: McpUiResourceCsp | undefined;
  if (typeof req.query.csp === "string") {
    try {
      cspConfig = JSON.parse(req.query.csp);
    } catch (e) {
      console.warn("[Sandbox] Invalid CSP query param:", e);
    }
  }

  res.setHeader("Content-Security-Policy", buildCspHeader(cspConfig));
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const script = await sandboxScriptPromise;
  res.send(htmlShell(script));
});

app.use((_req, res) => res.status(404).send("Only sandbox.html is served here"));

app.listen(SANDBOX_PORT, () => {
  console.log(`[Sandbox] Cross-origin proxy: http://localhost:${SANDBOX_PORT}/sandbox.html`);
});
