import {
  createElement,
  Activity,
  AlertTriangle,
  Cable,
  ExternalLink,
  FileJson,
  Info,
  LayoutDashboard,
  Puzzle,
  RefreshCw,
  Settings,
  Unplug
} from "lucide";

export type IconName =
  | "overview"
  | "extension"
  | "settings"
  | "diagnostics"
  | "about"
  | "open"
  | "refresh"
  | "export"
  | "offline"
  | "warn"
  | "activity"
  | "cable";

const MAP: Record<IconName, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  extension: Puzzle,
  settings: Settings,
  diagnostics: Activity,
  about: Info,
  open: ExternalLink,
  refresh: RefreshCw,
  export: FileJson,
  offline: Unplug,
  warn: AlertTriangle,
  activity: Activity,
  cable: Cable
};

export function iconNode(name: IconName, className = "icon"): SVGElement {
  const svg = createElement(MAP[name]);
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  return svg;
}
