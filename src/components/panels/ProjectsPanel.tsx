/**
 * Projects panel (rail's Projects icon). Code-mode conversations grouped by
 * their working folder: one collapsible group per project, sessions newest-first
 * inside, and a `+` per project to start a new chat already bound to that
 * folder. Chats with no working folder (plain chat mode) don't appear here —
 * they live in History.
 */
import { useMemo } from "react";
import { Collapse, Empty, Popconfirm, Tooltip } from "antd";
import { DeleteOutlined, FolderOutlined, PlusOutlined } from "@ant-design/icons";
import type { ConversationRow } from "../../lib/db";

interface Props {
  conversations: ConversationRow[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  /** Start a new chat already bound to `workingDir` (code mode on). */
  onNewInProject: (workingDir: string) => void;
}

interface Project {
  dir: string;
  name: string;
  sessions: ConversationRow[];
}

/** Last path segment — the folder's own name. */
function folderName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function ProjectsPanel({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNewInProject,
}: Props) {
  // Group by working_dir, preserving recency: conversations arrive newest-first,
  // so a Map keyed by dir keeps both group order and in-group order by recency.
  const projects = useMemo<Project[]>(() => {
    const byDir = new Map<string, Project>();
    for (const c of conversations) {
      if (!c.working_dir) continue;
      let p = byDir.get(c.working_dir);
      if (!p) {
        p = { dir: c.working_dir, name: folderName(c.working_dir), sessions: [] };
        byDir.set(c.working_dir, p);
      }
      p.sessions.push(c);
    }
    return [...byDir.values()];
  }, [conversations]);

  if (projects.length === 0) {
    return (
      <div className="panel-body">
        <Empty
          description="No projects yet — turn on Code mode and pick a folder"
          style={{ marginTop: 32 }}
        />
      </div>
    );
  }

  return (
    <div className="panel-body">
      <Collapse
        className="projects-collapse"
        defaultActiveKey={projects.map((p) => p.dir)}
        items={projects.map((p) => ({
          key: p.dir,
          label: (
            <Tooltip title={p.dir} placement="right">
              <span className="project-label">
                <FolderOutlined />
                <span className="project-name">{p.name}</span>
                <span className="project-count">{p.sessions.length}</span>
              </span>
            </Tooltip>
          ),
          extra: (
            <Tooltip title="New chat in this project">
              <PlusOutlined
                className="project-add"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewInProject(p.dir);
                }}
              />
            </Tooltip>
          ),
          children: (
            <ul className="project-sessions">
              {p.sessions.map((c) => (
                <li
                  key={c.id}
                  className={`project-session ${c.id === activeId ? "active" : ""}`}
                  onClick={() => onSelect(c.id)}
                >
                  <span className="session-title">{c.title || `Chat ${c.id}`}</span>
                  <Popconfirm
                    title="Delete this conversation?"
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      onDelete(c.id);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <DeleteOutlined
                      className="session-del"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </li>
              ))}
            </ul>
          ),
        }))}
      />
    </div>
  );
}
