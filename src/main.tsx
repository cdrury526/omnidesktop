// The v5 patch is required for antd + Ant Design X to work under React 19; it
// must be imported before any antd component renders.
import "@ant-design/v5-patch-for-react-19";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { XProvider } from "@ant-design/x";
import { theme as antdTheme } from "antd";
import enUS from "antd/locale/en_US";
import App from "./App";
import { getTheme, onThemeChange, type Theme } from "./mcp/theme";

/**
 * Single theme source for antd + Ant Design X. Follows the OS scheme via the
 * existing `theme.ts` manager; tokens mirror the CSS variables in App.css so
 * antd chrome matches the hand-rolled surfaces during the migration.
 */
function ThemedApp() {
  const [theme, setThemeState] = useState<Theme>(getTheme);
  useEffect(() => onThemeChange(setThemeState), []);

  const dark = theme === "dark";
  return (
    <XProvider
      locale={enUS}
      theme={{
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: dark ? "#818cf8" : "#4f46e5",
        },
      }}
    >
      <App />
    </XProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemedApp />
  </React.StrictMode>,
);
