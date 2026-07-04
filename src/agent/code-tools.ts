import { tool, type Tool } from "@openrouter/agent";
import { z } from "zod";
import { fsListDir, fsReadFile } from "../lib/fs";

export interface CodeToolPermissions {
  mode: "ask" | "yolo";
}

export interface BuildCodeToolsArgs {
  workingDir: string;
  permissions?: CodeToolPermissions;
  isEnabled?: (name: string) => boolean;
}

/** Tools that mutate disk or run processes — gated by SDK requireApproval in ask mode. */
const SENSITIVE_CODE_TOOLS = new Set(["write_file", "run_command"]);

function requireApprovalFor(
  name: string,
  permissions?: CodeToolPermissions,
): boolean | undefined {
  if (!SENSITIVE_CODE_TOOLS.has(name)) return undefined;
  return permissions?.mode !== "yolo";
}

export const CODE_TOOL_DEFINITIONS = [
  {
    name: "list_dir",
    title: "List directory",
    description: "List files and directories inside the current Code mode working folder.",
  },
  {
    name: "read_file",
    title: "Read file",
    description: "Read a UTF-8 text file inside the current Code mode working folder.",
  },
];

export function buildCodeTools({
  workingDir,
  permissions,
  isEnabled = () => true,
}: BuildCodeToolsArgs): Tool[] {
  const tools = [
    tool({
      name: "list_dir",
      description:
        "List files and directories inside the current Code mode working folder. " +
        "Paths are resolved relative to the working folder and cannot escape it.",
      inputSchema: z.object({
        path: z.string().default(".").describe("Directory path relative to the working folder."),
      }),
      outputSchema: z.object({
        path: z.string(),
        entries: z.array(z.object({
          name: z.string(),
          path: z.string(),
          kind: z.enum(["file", "directory", "symlink", "other"]),
          size: z.number().optional(),
        })),
      }),
      ...(requireApprovalFor("list_dir", permissions) === true ? { requireApproval: true as const } : {}),
      execute: ({ path }) => fsListDir(workingDir, path),
    }),
    tool({
      name: "read_file",
      description:
        "Read a UTF-8 text file inside the current Code mode working folder. " +
        "Paths are resolved relative to the working folder and cannot escape it.",
      inputSchema: z.object({
        path: z.string().describe("File path relative to the working folder."),
      }),
      outputSchema: z.object({
        path: z.string(),
        content: z.string(),
        bytes: z.number(),
      }),
      ...(requireApprovalFor("read_file", permissions) === true ? { requireApproval: true as const } : {}),
      execute: ({ path }) => fsReadFile(workingDir, path),
    }),
  ];
  return tools.filter((t) => isEnabled(t.function.name));
}
