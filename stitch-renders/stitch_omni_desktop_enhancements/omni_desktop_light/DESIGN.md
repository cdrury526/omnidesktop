# Omni Desktop Design System

Desktop chat application for AI coding assistants with MCP server integration.

## Visual Identity
- Clean, minimal light theme
- Primary accent: indigo/purple #4f46e5
- Background: white #ffffff, soft gray #f5f5f7 for panels
- Text: dark #1f2230, muted #6b7280
- Borders: light gray #e3e3e8
- Rounded corners (8px), generous whitespace

## Layout
- Left collapsible icon rail (~56px collapsed) with vertical icons: History, MCP Servers, Agents, Settings
- Expandable sidebar panel (~280px) slides out when an icon is selected
- Main chat area fills remaining width
- Bottom composer: message input + send button, model picker dropdown directly below input

## Components
- Icon rail: vertical stack of icon buttons, active state with purple tint background
- Sidebar cards: white cards with subtle border, rounded, title + metadata
- Toggle switches: purple when on
- Active agent indicator: green dot or purple highlight border
- Settings tabs: horizontal tab bar at top of settings panel
- Chat bubbles: user right-aligned gray, assistant left-aligned with code blocks