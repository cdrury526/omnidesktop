/**
 * Settings panel (rail's Settings icon). Holds the app-global configuration that
 * used to crowd the header: the OpenRouter API key (OS keyring) and the MCP
 * server connection. The model picker now lives in the composer; this is for the
 * things you set once.
 */
import { Alert, AutoComplete, Badge, Button, Flex, Form, Input } from "antd";
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
              <Badge
                status="success"
                text={
                  <>
                    <strong>{serverName}</strong> · {toolCount} tool
                    {toolCount === 1 ? "" : "s"}
                  </>
                }
              />
            ) : undefined
          }
        >
          <Flex vertical gap="small" style={{ width: "100%" }}>
            <Alert
              type="info"
              showIcon
              title="Optional tools"
              description="Omni does not include an MCP server. Start or choose a compatible server, then enter its URL here. You can chat without one."
            />
            <AutoComplete
              value={serverUrl}
              onChange={onServerUrlChange}
              options={serverOptions}
              popupMatchSelectWidth={false}
              placeholder="https://your-mcp-server.example/mcp"
              onKeyDown={(e) => {
                if (e.key === "Enter") onConnect();
              }}
              style={{ width: "100%" }}
            />
            <Button onClick={onConnect} loading={connecting} type="primary" ghost block>
              {serverName ? "Reconnect" : "Connect"}
            </Button>
            {connectError && (
              <Alert
                type="error"
                showIcon
                title="Couldn't connect to the MCP server"
                description={
                  <>
                    Check that the URL is correct and the server is running, then try again.
                    <br />
                    Details: {connectError}
                  </>
                }
              />
            )}
          </Flex>
        </Form.Item>
      </Form>
    </div>
  );
}
