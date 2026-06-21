import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const INPUT = process.env.INPUT;
if (!INPUT) throw new Error("INPUT environment variable is not set");

const isDevelopment = process.env.NODE_ENV === "development";

// Single-file bundle: the whole form app (JS + CSS) inlines into one HTML doc,
// which the MCP server serves as the `ui://` resource.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // Dev-only flag: when built with OMNI_DEBUG=1, the form opens a command
  // channel to the local debug bridge so an agent can drive its fields.
  define: { __OMNI_DEBUG__: JSON.stringify(process.env.OMNI_DEBUG === "1") },
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: { input: INPUT },
    outDir: "dist",
    emptyOutDir: false,
  },
});
