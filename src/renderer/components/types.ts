import type { Sample } from "../../shared/models";
/* eslint-disable @typescript-eslint/no-explicit-any -- Public component contract supplied by the design. */
import type { ReactNode, ButtonHTMLAttributes } from "react";

/** A token name ('power', 'heart', 'cadence', 'z1'…'z7', 'success', 'brand', 'muted'…) or any CSS color. */
export type Tone = string;

export interface IconProps {
  name: string;
  size?: number;
  title?: string;
  className?: string;
}
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  icon?: string;
  iconRight?: string;
}
export interface SegmentedProps {
  options: Array<string | { value: string; label: ReactNode }>;
  value: string;
  onChange?: (value: string) => void;
  label?: string;
}
export interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  color?: Tone;
  count?: number;
  children?: ReactNode;
}
export interface BadgeProps {
  tone?: Tone;
  variant?: "solid" | "outline";
  title?: string;
  children?: ReactNode;
}
export interface MetricProps {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  size?: "l" | "m" | "s";
  accent?: Tone;
  delta?: number;
  deltaUnit?: string;
  deltaFormat?: (abs: number) => string;
  lowerIsBetter?: boolean;
  sub?: ReactNode;
}
export interface ProgressProps {
  label?: ReactNode;
  valueLabel?: ReactNode;
  value: number;
  max: number;
  tone?: Tone;
}
export interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  style?: object;
  children?: ReactNode;
}
export interface SidebarProps {
  items: Array<{ id: string; label: string; icon: string; shortcut?: string }>;
  active: string;
  onSelect?: (id: string) => void;
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}
export interface SyncStatusProps {
  state: "synced" | "syncing" | "error" | "offline";
  detail?: ReactNode;
  title?: ReactNode;
  onClick?: () => void;
}

export interface Series {
  key: string;
  label?: string;
  color: Tone;
  unit?: string;
  axis?: "left" | "right";
  area?: boolean;
  areaOpacity?: number;
  dash?: boolean;
  width?: number;
  line?: boolean;
  format?: (v: number) => string;
  hideInTooltip?: boolean;
}
export interface LineChartProps {
  data: object[];
  x?: string;
  series: Series[];
  height?: number;
  xType?: "linear" | "log";
  xTicks?: number[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  yDomainRight?: [number, number];
  yTicks?: number;
  zeroBased?: boolean;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  yFormatRight?: (v: number) => string;
  tooltipTitle?: (x: number, row: any) => ReactNode;
  tooltipExtra?: (row: any) => ReactNode;
  bands?: Array<{ from: number; to: number; color: Tone; opacity?: number }>;
  refLines?: Array<{ value: number; label?: string; color?: Tone }>;
  legend?: boolean;
  hideXAxis?: boolean;
  hideYAxis?: boolean;
  ariaLabel?: string;
  /** Controlled cursor, for synchronizing several charts. */ hoverIndex?:
    number | null;
  onHover?: (index: number | null, row: any) => void;
  /** Enables drag selection on the X axis. */ selection?:
    [number, number] | null;
  onSelect?: (range: [number, number] | null) => void;
}
export interface BarChartProps {
  data: object[];
  x?: string;
  series: Series[];
  line?: Series & { zeroBased?: boolean };
  height?: number;
  yDomain?: [number, number];
  xFormat?: (v: any, row: any) => string;
  yFormat?: (v: number) => string;
  tooltipTitle?: (x: any, row: any) => ReactNode;
  legend?: boolean;
  hideYAxis?: boolean;
  onBarClick?: (row: any, index: number) => void;
  ariaLabel?: string;
}
export interface ZoneBarProps {
  zones: Array<{ label: string; name?: string; value: number; color: Tone }>;
  format?: (v: number) => string;
  compact?: boolean;
  ariaLabel?: string;
}
export interface MapFeature {
  type:
    | "sea"
    | "coast"
    | "water"
    | "road"
    | "track"
    | "contour"
    | "contour-major"
    | "label"
    | "peak";
  points?: Array<[number, number]>;
  closed?: boolean;
  at?: [number, number];
  label?: string;
  major?: boolean;
  anchor?: "start" | "end";
}
export interface RouteMapProps {
  geographic?: {
    rows: Sample[];
    configured: boolean;
    theme: "dark" | "light";
    onSettings: () => void;
    onHover?: (index: number | null) => void;
    onSelect?: (range: [number, number]) => void;
  };
  points: Array<[number, number]>;
  height?: number;
  highlight?: [number, number] | null;
  zoomToHighlight?: boolean;
  cursor?: number | null;
  markers?: Array<{ index: number; label: string }>;
  scale?: boolean;
  features?: MapFeature[];
  caption?: ReactNode;
  ariaLabel?: string;
}
export interface Column<R> {
  key: string;
  label: ReactNode;
  align?: "left" | "right";
  width?: number | string;
  render?: (row: R) => ReactNode;
}
export interface DataTableProps<R = any> {
  sort?: { key: string; direction: "ascending" | "descending" };
  onSort?: (key: string) => void;
  columns: Column<R>[];
  rows: R[];
  rowKey?: string;
  selected?: any;
  onSelect?: (key: any, row: R) => void;
  checked?: any[];
  onCheck?: (key: any) => void;
  checkLabel?: string;
  compact?: boolean;
  maxHeight?: number;
  empty?: ReactNode;
  /** Arrow keys also select the focused row. */ selectOnFocus?: boolean;
  onEscape?: () => void;
}
export interface ChatMessageProps {
  role: "user" | "assistant";
  children?: ReactNode;
}
export interface ToolResultProps {
  tool: string;
  args?: string;
  status?: "running" | "done" | "error";
  meta?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}
export interface StateBlockProps {
  kind?: "loading" | "empty" | "error";
  title?: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}
export interface SkeletonProps {
  height?: number;
  width?: number | string;
  radius?: number | string;
}
