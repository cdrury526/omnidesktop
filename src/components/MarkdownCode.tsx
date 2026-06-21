import type { ReactNode } from "react";
import { CodeHighlighter } from "@ant-design/x";
import { XMarkdown } from "@ant-design/x-markdown";
// Base component styles (consume the theme vars: text/heading/border/table/
// code colors), then the class-scoped themes — order matters so the active
// theme class wins. We toggle .x-markdown-light / .x-markdown-dark per theme.
import "@ant-design/x-markdown/dist/x-markdown.css";
import "@ant-design/x-markdown/themes/light.css";
import "@ant-design/x-markdown/themes/dark.css";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "../hooks/useTheme";

/** Flatten a React node tree to its text (a fenced block's content is text). */
function textOf(node: ReactNode): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) {
    return textOf((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

interface CodeProps {
  block?: boolean;
  lang?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * XMarkdown renders code as `<code data-block>` (fenced) or `<code>` (inline).
 * Fenced blocks become an Ant Design X `CodeHighlighter` card — a language
 * header with a built-in copy-to-clipboard button and Prism syntax highlighting.
 * Inline code stays inline. CodeHighlighter hardcodes a light Prism theme, so we
 * pass a dark one through `highlightProps` when the app is in dark mode.
 */
function Code({ block, lang, className, children }: CodeProps) {
  const theme = useTheme();
  if (!block) return <code className={className}>{children}</code>;
  return (
    <CodeHighlighter
      lang={lang}
      className="md-code-card"
      highlightProps={{
        style: theme === "dark" ? oneDark : oneLight,
        // The Prism theme's inline padding is tight against the card edges;
        // give the code body more horizontal breathing room.
        customStyle: { margin: 0, padding: "14px 18px" },
      }}
    >
      {textOf(children)}
    </CodeHighlighter>
  );
}

/** Markdown emits `<pre><code data-block>`; render the `<pre>` as a pass-through
 *  so the CodeHighlighter card isn't nested inside a `<pre>`. */
function Pre({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/** Stable XMarkdown component map (the skill warns against inline maps). */
export const markdownComponents = { pre: Pre, code: Code };

/**
 * Assistant reply markdown: themed (the `.x-markdown-*` class drives heading /
 * table / border / code colors), streaming-animated, with code cards. Owns the
 * theme class so the `roles` map can stay a stable reference.
 */
export function AssistantMarkdown({ content, live }: { content: string; live: boolean }) {
  const theme = useTheme();
  return (
    <XMarkdown
      className={theme === "dark" ? "x-markdown-dark" : "x-markdown-light"}
      content={content}
      components={markdownComponents}
      streaming={{ hasNextChunk: live, enableAnimation: true, tail: live }}
    />
  );
}
