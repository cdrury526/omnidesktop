/**
 * Shown above the composer when a chat's bound project folder no longer exists
 * on disk. The association stays in the DB; sending is blocked until the user
 * picks a valid folder via the header chip.
 */
import { Alert, Button } from "antd";
import { FolderOpenOutlined } from "@ant-design/icons";
import { pickDirectory } from "../lib/dialog";

interface Props {
  path: string;
  onPickFolder: (dir: string) => void;
}

export function FolderMissingNotice({ path, onPickFolder }: Props) {
  const pick = async () => {
    const dir = await pickDirectory();
    if (dir) onPickFolder(dir);
  };

  return (
    <Alert
      className="folder-missing-notice"
      type="warning"
      showIcon
      icon={<FolderOpenOutlined />}
      message="Project folder not found"
      description={
        <>
          This chat is bound to{" "}
          <code className="folder-missing-path">{path}</code>, but that folder no longer exists on
          your machine. Choose a new folder to send messages again — or turn off code mode.
        </>
      }
      action={
        <Button size="small" type="primary" ghost onClick={() => void pick()}>
          Choose folder
        </Button>
      }
    />
  );
}
