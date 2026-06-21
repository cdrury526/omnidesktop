/**
 * Entry point for the forms App. Connects via `useApp`, receives the form spec
 * as the tool-call arguments (`ontoolinput`), pulls in host theme variables,
 * and renders the generic `FormApp`.
 */
import type { FormSpec } from "@omni/forms-dsl";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, theme as antdTheme } from "antd";
import { FormApp } from "./FormApp";
import "./global.css";

/** Resolve a CSS custom property to a concrete color (the var holds an
 *  unresolved light-dark() expression; a probe element forces resolution). */
function resolvedColor(name: string): string {
  const probe = document.createElement("span");
  probe.style.cssText = `color:var(${name});position:absolute;visibility:hidden`;
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
}

function isDark(rgb: string): boolean {
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m) return false;
  const [r, g, b] = m.map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

/** antd theme derived from the host's (useHostStyles-injected) CSS variables,
 *  so the form chrome matches the app's light/dark scheme. */
function useHostAntdTheme() {
  const read = () => ({
    algorithm: isDark(resolvedColor("--color-background-primary"))
      ? antdTheme.darkAlgorithm
      : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: resolvedColor("--color-accent"),
      colorError: resolvedColor("--color-error"),
      borderRadius: 6,
    },
  });
  const [config, setConfig] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setConfig(read());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return config;
}

function Root() {
  const [spec, setSpec] = useState<FormSpec | null>(null);

  const { app, error } = useApp({
    appInfo: { name: "Omni Forms", version: "0.1.0" },
    capabilities: {},
    // The form fills the fixed-height side panel with a scrollable field area
    // and a pinned footer, so we manage layout ourselves rather than letting
    // the app auto-resize the iframe to content (which clips long forms).
    autoResize: false,
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
  const themeConfig = useHostAntdTheme();

  return (
    <ConfigProvider theme={themeConfig}>
      {error ? (
        <div className="formapp"><strong>Error:</strong> {error.message}</div>
      ) : !app ? (
        <div className="formapp">Connecting…</div>
      ) : !spec ? (
        <div className="formapp">Waiting for form…</div>
      ) : (
        <FormApp app={app} spec={spec} />
      )}
    </ConfigProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
