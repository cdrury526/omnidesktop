/**
 * Code mode header control: a Chat/Code switch plus, when on, the bound working
 * folder as a chip (folder name, full path on hover) with change/clear. Toggling
 * on with no folder yet immediately opens the native picker. State + persistence
 * live in `useAgentChat`; this is presentation + the picker call.
 */
import { Switch, Tooltip } from "antd";
import { FolderOpenOutlined, CloseOutlined } from "@ant-design/icons";
import { pickDirectory } from "../lib/dialog";

interface Props {
  codeMode: boolean;
  workingDir: string | null;
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
          <span className="code-folder">
            <Tooltip title={workingDir}>
              <button className="folder-chip" onClick={pick}>
                <FolderOpenOutlined /> {folderName(workingDir)}
              </button>
            </Tooltip>
            <button
              className="folder-clear"
              title="Clear working folder"
              onClick={() => onWorkingDirChange(null)}
            >
              <CloseOutlined />
            </button>
          </span>
        ) : (
          <button className="folder-chip empty" onClick={pick}>
            <FolderOpenOutlined /> Choose folder
          </button>
        ))}
    </div>
  );
}
