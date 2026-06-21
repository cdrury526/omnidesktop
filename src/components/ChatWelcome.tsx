import { Welcome, Prompts } from "@ant-design/x";
import {
  BulbOutlined,
  ProfileOutlined,
  FormOutlined,
  CompassOutlined,
} from "@ant-design/icons";

/**
 * The empty-chat onboarding. Leads with what sets this app apart — the model
 * can pull up an interactive panel for structured input — and offers starter
 * prompts that exercise it. Clicking a prompt sends it as a real turn.
 */
export function ChatWelcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="chat-welcome">
      <Welcome
        variant="borderless"
        icon="🪟"
        title="Omni Desktop"
        description="Chat with any model. When it needs structured input, an interactive panel slides out — fill it in and the answers go straight back to the model."
      />
      <Prompts
        title="Try one of these"
        wrap
        items={[
          { key: "subscribe", icon: <FormOutlined />, label: "Set up a subscription", description: "Opens a form to fill in" },
          { key: "shipping", icon: <ProfileOutlined />, label: "Collect my shipping address", description: "Structured input, sent back to the model" },
          { key: "capabilities", icon: <BulbOutlined />, label: "What can you do?", description: "A quick tour" },
          { key: "trip", icon: <CompassOutlined />, label: "Plan a weekend in Kyoto", description: "Just a normal chat" },
        ]}
        onItemClick={(info) => {
          const label = info.data.label;
          if (typeof label === "string") onPick(label);
        }}
      />
    </div>
  );
}
