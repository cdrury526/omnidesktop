import { tool, type Tool } from "@openrouter/agent";
import { z } from "zod";
import { fsListDir, fsReadFile } from "../lib/fs";

export interface CodeToolPermissions {
  mode: "ask" | "yolo";
}

export interface BuildCodeToolsArgs {
  workingDir: string;
  permissions?: CodeToolPermissions;
}

export function buildCodeTools({ workingDir }: BuildCodeToolsArgs): Tool[] {
  return [
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
      execute: ({ path }) => fsReadFile(workingDir, path),
    }),
  ];
}

