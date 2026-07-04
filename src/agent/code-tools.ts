import { tool, type Tool } from "@openrouter/agent";
import { z } from "zod";
import { fsListDir, fsReadFile, fsWriteFile, runCommand } from "../lib/fs";
import { executeCodeTool, type CodeToolResult } from "./code-tool-telemetry";

export interface CodeToolPermissions {
  mode: "ask" | "yolo";
}

export interface BuildCodeToolsArgs {
  workingDir: string;
  permissions?: CodeToolPermissions;
  isEnabled?: (name: string) => boolean;
}

export interface CodeToolContext {
  workingDir: string;
  permissions: CodeToolPermissions;
  isEnabled: (name: string) => boolean;
  execute: <T>(
    name: string,
    summary: Record<string, unknown>,
    run: () => Promise<T>,
    resultSummary?: (result: T) => Record<string, unknown>,
  ) => Promise<CodeToolResult<T>>;
}

/** Tools that mutate disk or run processes — gated by SDK requireApproval in ask mode. */
export const CODE_TOOL_CAPABILITIES = [
  {
    name: "list_dir",
    sensitive: false,
    title: "List directory",
    description: "List files and directories inside the current Code mode working folder.",
  },
  {
    name: "read_file",
    sensitive: false,
    title: "Read file",
    description: "Read a UTF-8 text file inside the current Code mode working folder.",
  },
  {
    name: "write_file",
    sensitive: true,
    title: "Write file",
    description: "Write a UTF-8 text file inside the current Code mode working folder.",
  },
  {
    name: "run_command",
    sensitive: true,
    title: "Run command",
    description: "Run a command with its current directory locked to the Code mode working folder.",
  },
] as const;

const SENSITIVE_CODE_TOOLS = new Set<string>(
  CODE_TOOL_CAPABILITIES.filter((t) => t.sensitive).map((t) => t.name),
);

function requireApprovalFor(
  name: string,
  permissions?: CodeToolPermissions,
): boolean | undefined {
  if (!SENSITIVE_CODE_TOOLS.has(name)) return undefined;
  return permissions?.mode !== "yolo";
}

export const CODE_TOOL_DEFINITIONS = CODE_TOOL_CAPABILITIES.map(
  ({ name, title, description }) => ({ name, title, description }),
);

function codeToolOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data: dataSchema }),
    z.object({
      ok: z.literal(false),
      error: z.string(),
      code: z.string(),
    }),
  ]);
}

export function buildCodeTools({
  workingDir,
  permissions = { mode: "ask" },
  isEnabled = () => true,
}: BuildCodeToolsArgs): Tool[] {
  const context: CodeToolContext = {
    workingDir,
    permissions,
    isEnabled,
    execute: executeCodeTool,
  };

  const tools = [
    tool({
      name: "list_dir",
      description:
        "List files and directories inside the current Code mode working folder. " +
        "Paths are resolved relative to the working folder and cannot escape it.",
      inputSchema: z.object({
        path: z.string().default(".").describe("Directory path relative to the working folder."),
      }),
      outputSchema: codeToolOutputSchema(z.object({
        path: z.string(),
        entries: z.array(z.object({
          name: z.string(),
          path: z.string(),
          kind: z.enum(["file", "directory", "symlink", "other"]),
          size: z.number().optional(),
        })),
      })),
      ...(requireApprovalFor("list_dir", context.permissions) === true ? { requireApproval: true as const } : {}),
      execute: ({ path }) =>
        context.execute(
          "list_dir",
          { path },
          () => fsListDir(context.workingDir, path),
          (result) => ({ resolvedPath: result.path, entries: result.entries.length }),
        ),
    }),
    tool({
      name: "read_file",
      description:
        "Read a UTF-8 text file inside the current Code mode working folder. " +
        "Paths are resolved relative to the working folder and cannot escape it.",
      inputSchema: z.object({
        path: z.string().describe("File path relative to the working folder."),
      }),
      outputSchema: codeToolOutputSchema(z.object({
        path: z.string(),
        content: z.string(),
        bytes: z.number(),
      })),
      ...(requireApprovalFor("read_file", context.permissions) === true ? { requireApproval: true as const } : {}),
      execute: ({ path }) =>
        context.execute(
          "read_file",
          { path },
          () => fsReadFile(context.workingDir, path),
          (result) => ({ resolvedPath: result.path, bytes: result.bytes }),
        ),
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
      outputSchema: codeToolOutputSchema(z.object({
        path: z.string(),
        bytes: z.number(),
      })),
      ...(requireApprovalFor("write_file", context.permissions) === true ? { requireApproval: true as const } : {}),
      execute: ({ path, content }) =>
        context.execute(
          "write_file",
          { path, bytes: new TextEncoder().encode(content).length },
          () => fsWriteFile(context.workingDir, path, content),
          (result) => ({ resolvedPath: result.path, writtenBytes: result.bytes }),
        ),
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
      outputSchema: codeToolOutputSchema(z.object({
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
      })),
      ...(requireApprovalFor("run_command", context.permissions) === true ? { requireApproval: true as const } : {}),
      execute: ({ command, args, timeoutMs }) =>
        context.execute(
          "run_command",
          { command, args, timeoutMs },
          () => runCommand(context.workingDir, command, args, timeoutMs),
          (result) => ({
            cwd: result.cwd,
            exitCode: result.exitCode,
            success: result.success,
            timedOut: result.timedOut,
            stdoutTruncated: result.stdoutTruncated,
            stderrTruncated: result.stderrTruncated,
          }),
        ),
    }),
  ];
  return tools.filter((t) => context.isEnabled(t.function.name));
}
