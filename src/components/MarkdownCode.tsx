import type { ReactNode } from "react";
import { CodeHighlighter } from "@ant-design/x";

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
 * Inline code stays inline.
 */
function Code({ block, lang, className, children }: CodeProps) {
  if (!block) return <code className={className}>{children}</code>;
  return (
    <CodeHighlighter lang={lang} className="md-code-card">
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
