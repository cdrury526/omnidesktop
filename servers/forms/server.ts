/**
 * The interactive-forms MCP App server.
 *
 * It exposes ONE generic tool, `request_user_input`, whose argument is a form
 * spec in the shared DSL (`@omni/forms-dsl`). The tool's `inputSchema` is
 * derived from that DSL, so the agent learns the whole form language from the
 * tool schema — no bespoke tool per form.
 *
 * The server is deliberately dumb: it ships the generic renderer (the `ui://`
 * resource) and acknowledges the call. The host passes the spec to the app
 * (via `sendToolInput`), the app renders it, and the user's answers come back
 * to the host out-of-band (the app calls `updateModelContext`). All the
 * pause/resume + result handling lives in the Omni Desktop host.
 */
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import {
  REQUEST_INPUT_TOOL,
  REQUEST_INPUT_DESCRIPTION,
  requestInputSchema,
  INTERACTIVE_TOOL_META,
} from "@omni/forms-dsl";
import fs from "node:fs/promises";
import path from "node:path";

// Works from source (server.ts) and, if ever compiled, from dist/server.js.
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

const resourceUri = "ui://request-user-input/mcp-app.html";

// Dev-only: let the form reach the local debug bridge so an agent can drive its
// fields headlessly. Widens only the form's connect-src; off unless OMNI_DEBUG=1.
const DEBUG = process.env.OMNI_DEBUG === "1";
const DEBUG_META = DEBUG
  ? { _meta: { ui: { csp: { connectDomains: ["http://127.0.0.1:1456"] } } } }
  : {};

export function createServer(): McpServer {
  const server = new McpServer({ name: "Omni Forms (Interactive Input)", version: "0.1.0" });

  registerAppTool(
    server,
    REQUEST_INPUT_TOOL,
    {
      title: "Request user input",
      description: REQUEST_INPUT_DESCRIPTION,
      // The DSL is the tool's parameter schema — this is how the agent learns it.
      inputSchema: requestInputSchema(),
      // `ui` → render the form app; the interactive marker → the host runs this
      // as a HITL tool (pause on call, resume when the user submits).
      _meta: { ui: { resourceUri }, [INTERACTIVE_TOOL_META]: true },
    },
    async (): Promise<CallToolResult> => {
      // The real result is the user's submission, delivered to the host later.
      // This immediate result is just an acknowledgement that the form opened.
      return {
        content: [{ type: "text", text: "Form displayed; awaiting the user's input." }],
        _meta: { "omni.form/pending": true },
      };
    },
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return { contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html, ...DEBUG_META }] };
    },
  );

  return server;
}
