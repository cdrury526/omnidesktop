/**
 * Projects panel (rail's Projects icon). Code-mode conversations grouped by
 * their working folder: one collapsible group per project, sessions newest-first
 * inside, and a `+` per project to start a new chat already bound to that
 * folder. Chats with no working folder (plain chat mode) don't appear here —
 * they live in History.
 */
import { useMemo } from "react";
import { Conversations, type ConversationItemType } from "@ant-design/x";
import { Badge, Empty, Tooltip } from "antd";
import { CodeOutlined, FolderOutlined, PlusOutlined } from "@ant-design/icons";
import type { ConversationRow } from "../../lib/db";
import { ConversationLabel } from "./ConversationLabel";
import { deleteConversationMenu } from "./conversationMenu";

interface Props {
  conversations: ConversationRow[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  /** Start a new chat already bound to `workingDir` (code mode on). */
  onNewInProject: (workingDir: string) => void;
}

/** Last path segment — the folder's own name. */
function folderName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function toItem(c: ConversationRow): ConversationItemType {
  const title = c.title || `Chat ${c.id}`;
  return {
    key: String(c.id),
    label: <ConversationLabel title={title} updatedAt={c.updated_at} />,
    group: c.working_dir ?? undefined,
    icon: <CodeOutlined />,
    "aria-label": title,
    "data-conversation-id": c.id,
  };
}

export function ProjectsPanel({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNewInProject,
}: Props) {
  const projectDirs = useMemo(() => {
    const dirs: string[] = [];
    const seen = new Set<string>();
    for (const c of conversations) {
      if (!c.working_dir || seen.has(c.working_dir)) continue;
      seen.add(c.working_dir);
      dirs.push(c.working_dir);
    }
    return dirs;
  }, [conversations]);

  const items = useMemo(
    () => conversations.filter((c) => c.working_dir).map(toItem),
    [conversations],
  );

  if (projectDirs.length === 0) {
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
      <Conversations
        className="panel-conversations"
        items={items}
        activeKey={activeId != null ? String(activeId) : undefined}
        onActiveChange={(key) => onSelect(Number(key))}
        menu={deleteConversationMenu(onDelete)}
        groupable={{
          collapsible: true,
          defaultExpandedKeys: projectDirs,
          label: (group, { groupInfo }) => (
            <Tooltip title={group} placement="right">
              <span className="project-label">
                <FolderOutlined />
                <span className="project-name">{folderName(group)}</span>
                <Badge
                  count={groupInfo.data.length}
                  size="small"
                  color="default"
                  className="project-count"
                />
                <Tooltip title="New chat in this project">
                  <PlusOutlined
                    className="project-add"
                    aria-label="New chat in this project"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewInProject(group);
                    }}
                  />
                </Tooltip>
              </span>
            </Tooltip>
          ),
        }}
      />
    </div>
  );
}
