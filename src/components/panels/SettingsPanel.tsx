/**
 * Settings panel (rail's Settings icon). Holds the app-global configuration that
 * used to crowd the header: the OpenRouter API key (OS keyring) and the MCP
 * server connection. The model picker now lives in the composer; this is for the
 * things you set once.
 */
import { Alert, AutoComplete, Button, Form, Input, Space } from "antd";
import type { FormItemProps } from "antd";
import { keyringAvailable } from "../../lib/secrets";

interface Props {
  apiKey: string;
  keyStatus: "loading" | "stored" | "unsaved" | "empty";
  onApiKeyChange: (key: string) => void;
  onApiKeyBlur: () => void;

  serverUrl: string;
  serverOptions: { value: string }[];
  onServerUrlChange: (url: string) => void;
  onConnect: () => void;
  connecting: boolean;
  serverName: string | null;
  toolCount: number;
  connectError: string | null;
}

function apiKeyFieldState(
  keyStatus: Props["keyStatus"],
): Pick<FormItemProps, "validateStatus" | "help"> {
  switch (keyStatus) {
    case "loading":
      return { validateStatus: "validating" };
    case "stored":
      return { validateStatus: "success", help: "🔒 saved to keyring" };
    case "unsaved":
      return { validateStatus: "warning", help: "● unsaved" };
    case "empty":
      return { help: "no key set" };
  }
}

export function SettingsPanel({
  apiKey,
  keyStatus,
  onApiKeyChange,
  onApiKeyBlur,
  serverUrl,
  serverOptions,
  onServerUrlChange,
  onConnect,
  connecting,
  serverName,
  toolCount,
  connectError,
}: Props) {
  const keyField = apiKeyFieldState(keyStatus);

  return (
    <div className="panel-body">
      <Form layout="vertical" className="settings-form" requiredMark={false}>
        <Form.Item
          label="OpenRouter API key"
          validateStatus={keyField.validateStatus}
          help={keyField.help}
          extra={
            keyringAvailable
              ? undefined
              : "Not running in Tauri — key won't persist"
          }
        >
          <Input.Password
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            onBlur={onApiKeyBlur}
            placeholder="sk-or-…"
          />
        </Form.Item>

        <Form.Item
          label="MCP server"
          validateStatus={connectError ? "error" : serverName ? "success" : undefined}
          help={
            !connectError && serverName ? (
              <>
                Connected to <strong>{serverName}</strong> · {toolCount} tool
                {toolCount === 1 ? "" : "s"}
              </>
            ) : undefined
          }
        >
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <AutoComplete
              value={serverUrl}
              onChange={onServerUrlChange}
              options={serverOptions}
              popupMatchSelectWidth={false}
              filterOption={(input, option) =>
                (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
              }
              placeholder="http://localhost:3001/mcp"
              onKeyDown={(e) => {
                if (e.key === "Enter") onConnect();
              }}
              style={{ width: "100%" }}
            />
            <Button onClick={onConnect} loading={connecting} type="primary" ghost block>
              {serverName ? "Reconnect" : "Connect"}
            </Button>
            {connectError && (
              <Alert type="error" message={connectError} showIcon />
            )}
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
