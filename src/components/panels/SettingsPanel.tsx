/**
 * Settings panel (rail's Settings icon). Holds the app-global configuration that
 * used to crowd the header: the OpenRouter API key (OS keyring) and the MCP
 * server connection. The model picker now lives in the composer; this is for the
 * things you set once.
 */
import { AutoComplete, Button, Input } from "antd";
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
}: Props) {
  return (
    <div className="panel-body settings-panel">
      <label className="settings-field">
        <span className="settings-label">OpenRouter API key</span>
        <Input.Password
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          onBlur={onApiKeyBlur}
          placeholder="sk-or-…"
          title={
            keyringAvailable
              ? "Stored in your OS keyring"
              : "Not running in Tauri — key won't persist"
          }
        />
        <span className={`key-status ${keyStatus}`}>
          {keyStatus === "stored" && "🔒 saved to keyring"}
          {keyStatus === "unsaved" && "● unsaved"}
          {keyStatus === "empty" && "no key set"}
        </span>
      </label>

      <label className="settings-field">
        <span className="settings-label">MCP server</span>
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
        />
        <Button onClick={onConnect} loading={connecting} type="primary" ghost block>
          {serverName ? "Reconnect" : "Connect"}
        </Button>
        {serverName && (
          <span className="settings-status">
            Connected to <strong>{serverName}</strong> · {toolCount} tool
            {toolCount === 1 ? "" : "s"}
          </span>
        )}
      </label>
    </div>
  );
}
