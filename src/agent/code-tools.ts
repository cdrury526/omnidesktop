import { tool, type Tool } from "@openrouter/agent";
import { z } from "zod";
import { fsListDir, fsReadFile, fsWriteFile, runCommand } from "../lib/fs";

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
  {
    name: "write_file",
    title: "Write file",
    description: "Write a UTF-8 text file inside the current Code mode working folder.",
  },
  {
    name: "run_command",
    title: "Run command",
    description: "Run a command with its current directory locked to the Code mode working folder.",
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
    tool({
      name: "write_file",
      description:
        "Write a UTF-8 text file inside the current Code mode working folder. " +
        "Paths are resolved relative to the working folder and cannot escape it. " +
        "In ask mode this tool requires user approval before it writes.",
      inputSchema: z.object({
        path: z.string().describe("File path relative to the working folder."),
        content: z.string().describe("Complete UTF-8 file content to write."),
      }),
      outputSchema: z.object({
        path: z.string(),
        bytes: z.number(),
      }),
      ...(requireApprovalFor("write_file", permissions) === true ? { requireApproval: true as const } : {}),
      execute: ({ path, content }) => fsWriteFile(workingDir, path, content),
    }),
    tool({
      name: "run_command",
      description:
        "Run a command with cwd locked to the current Code mode working folder. " +
        "Pass the executable as command and arguments as a separate args array; " +
        "do not use shell syntax unless the executable itself is a shell. " +
        "In ask mode this tool requires user approval before it runs.",
      inputSchema: z.object({
        command: z.string().describe("Executable to run, for example `pnpm` or `cargo`."),
        args: z.array(z.string()).default([]).describe("Command arguments as separate argv entries."),
        timeoutMs: z.number().int().positive().max(120_000).optional()
          .describe("Optional timeout in milliseconds; defaults to 30000 and maxes at 120000."),
      }),
      outputSchema: z.object({
        command: z.string(),
        args: z.array(z.string()),
        cwd: z.string(),
        exitCode: z.number().nullable(),
        success: z.boolean(),
        timedOut: z.boolean(),
        stdout: z.string(),
        stderr: z.string(),
        stdoutTruncated: z.boolean(),
        stderrTruncated: z.boolean(),
      }),
      ...(requireApprovalFor("run_command", permissions) === true ? { requireApproval: true as const } : {}),
      execute: ({ command, args, timeoutMs }) => runCommand(workingDir, command, args, timeoutMs),
    }),
  ];
  return tools.filter((t) => isEnabled(t.function.name));
}
