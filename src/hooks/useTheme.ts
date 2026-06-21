import { useEffect, useState } from "react";
import { getTheme, onThemeChange, type Theme } from "../mcp/theme";

/** Current light/dark theme, reactive to OS / host changes (via mcp/theme.ts). */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(getTheme);
  useEffect(() => onThemeChange(setTheme), []);
  return theme;
}
