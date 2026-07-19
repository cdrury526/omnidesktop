import { Welcome, Prompts } from "@ant-design/x";
import {
  BulbOutlined,
  ProfileOutlined,
  FormOutlined,
  CompassOutlined,
} from "@ant-design/icons";

/**
 * The empty-chat onboarding. MCP-specific form examples appear only when a
 * server is connected; ordinary chat remains fully usable without one.
 */
export function ChatWelcome({
  onPick,
  hasMcpServer,
}: {
  onPick: (text: string) => void;
  hasMcpServer: boolean;
}) {
  const prompts = [
    ...(hasMcpServer
      ? [
          { key: "subscribe", icon: <FormOutlined />, label: "Set up a subscription", description: "Opens a form to fill in" },
          { key: "shipping", icon: <ProfileOutlined />, label: "Collect my shipping address", description: "Structured input, sent back to the model" },
        ]
      : []),
    { key: "capabilities", icon: <BulbOutlined />, label: "What can you do?", description: "A quick tour" },
    { key: "trip", icon: <CompassOutlined />, label: "Plan a weekend in Kyoto", description: "Just a normal chat" },
  ];

  return (
    <div className="chat-welcome">
      <Welcome
        variant="borderless"
        icon="🪟"
        title="Omni Desktop"
        description={
          hasMcpServer
            ? "Chat with any model. When it needs structured input, an interactive panel opens — fill it in and the answers go straight back to the model."
            : "Chat with any model. Connect an MCP server in Settings later if you want optional tools and interactive forms."
        }
      />
      <Prompts
        title="Try one of these"
        wrap
        items={prompts}
        onItemClick={(info) => {
          const label = info.data.label;
          if (typeof label === "string") onPick(label);
        }}
      />
    </div>
  );
}
