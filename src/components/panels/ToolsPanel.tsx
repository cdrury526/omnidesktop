import { Empty, Flex, List, Space, Switch, Tag, Typography } from "antd";
import type { ToolRegistryRow } from "../../lib/db";

interface Props {
  tools: ToolRegistryRow[];
  onToggle: (tool: ToolRegistryRow, enabled: boolean) => void;
}

function sourceLabel(tool: ToolRegistryRow): string {
  if (tool.source === "builtin:code") return "Code";
  return tool.source_id ? "MCP" : tool.source;
}

function sourceColor(tool: ToolRegistryRow): string {
  return tool.source === "builtin:code" ? "geekblue" : "cyan";
}

export function ToolsPanel({ tools, onToggle }: Props) {
  if (tools.length === 0) {
    return (
      <div className="panel-body">
        <Empty description="No tools discovered yet" style={{ marginTop: 32 }} />
      </div>
    );
  }

  return (
    <div className="panel-body">
      <List
        className="tool-registry-list"
        dataSource={tools}
        rowKey={(tool) => `${tool.source}:${tool.source_id}:${tool.name}`}
        renderItem={(tool) => (
          <List.Item
            actions={[
              <Switch
                key="enabled"
                size="small"
                checked={!!tool.enabled}
                onChange={(checked) => onToggle(tool, checked)}
                aria-label={`${tool.enabled ? "Disable" : "Enable"} ${tool.name}`}
              />,
            ]}
          >
            <List.Item.Meta
              title={
                <Space size={6} wrap>
                  <Typography.Text strong>{tool.title || tool.name}</Typography.Text>
                  <Tag color={sourceColor(tool)}>{sourceLabel(tool)}</Tag>
                </Space>
              }
              description={
                <Flex vertical gap={2}>
                  <Typography.Text type="secondary" className="tool-registry-name">
                    {tool.name}
                  </Typography.Text>
                  {tool.description && (
                    <Typography.Text type="secondary" className="tool-registry-description">
                      {tool.description}
                    </Typography.Text>
                  )}
                </Flex>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
}
