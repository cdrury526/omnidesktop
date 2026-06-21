/**
 * Code mode header control: a Chat/Code switch plus, when on, the bound working
 * folder as a chip (folder name, full path on hover) with change/clear. Toggling
 * on with no folder yet immediately opens the native picker. State + persistence
 * live in `useAgentChat`; this is presentation + the picker call.
 */
import { Button, Switch, Tag, Tooltip } from "antd";
import { FolderOpenOutlined } from "@ant-design/icons";
import { pickDirectory } from "../lib/dialog";

interface Props {
  codeMode: boolean;
  workingDir: string | null;
  folderMissing?: boolean;
  onCodeModeChange: (on: boolean) => void;
  onWorkingDirChange: (dir: string | null) => void;
}

/** Last path segment (the folder's own name), for the chip label. */
function folderName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function CodeModeToggle({
  codeMode,
  workingDir,
  folderMissing,
  onCodeModeChange,
  onWorkingDirChange,
}: Props) {
  const pick = async () => {
    const dir = await pickDirectory();
    if (dir) onWorkingDirChange(dir);
  };

  const onToggle = async (on: boolean) => {
    onCodeModeChange(on);
    // Turning code mode on with no folder yet → prompt for one immediately.
    if (on && !workingDir) await pick();
  };

  return (
    <div className="code-mode">
      <Switch
        checked={codeMode}
        onChange={onToggle}
        checkedChildren="Code"
        unCheckedChildren="Chat"
        title="Bind this chat to a project folder"
      />
      {codeMode &&
        (workingDir ? (
          <Tooltip title={workingDir}>
            <Tag
              className={`folder-chip${folderMissing ? " missing" : ""}`}
              color={folderMissing ? "warning" : undefined}
              icon={<FolderOpenOutlined />}
              closable
              onClose={() => onWorkingDirChange(null)}
              onClick={pick}
            >
              {folderName(workingDir)}
            </Tag>
          </Tooltip>
        ) : (
          <Button
            type="dashed"
            size="small"
            className="folder-chip empty"
            icon={<FolderOpenOutlined />}
            onClick={pick}
          >
            Choose folder
          </Button>
        ))}
    </div>
  );
}
