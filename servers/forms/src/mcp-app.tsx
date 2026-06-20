/**
 * Entry point for the forms App. Connects via `useApp`, receives the form spec
 * as the tool-call arguments (`ontoolinput`), pulls in host theme variables,
 * and renders the generic `FormApp`.
 */
import type { FormSpec } from "@omni/forms-dsl";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { FormApp } from "./FormApp";
import "./global.css";

function Root() {
  const [spec, setSpec] = useState<FormSpec | null>(null);

  const { app, error } = useApp({
    appInfo: { name: "Omni Forms", version: "0.1.0" },
    capabilities: {},
    onAppCreated: (app) => {
      // The host forwards the tool arguments — our form spec — here.
      app.ontoolinput = (params) => {
        const args = (params as { arguments?: unknown })?.arguments;
        if (args && typeof args === "object") setSpec(args as FormSpec);
      };
      app.onerror = console.error;
    },
  });

  useHostStyles(app);

  if (error) return <div className="formapp"><strong>Error:</strong> {error.message}</div>;
  if (!app) return <div className="formapp">Connecting…</div>;
  if (!spec) return <div className="formapp">Waiting for form…</div>;
  return <FormApp app={app} spec={spec} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
