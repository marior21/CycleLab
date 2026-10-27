import { useRef, type ReactNode, type CSSProperties } from "react";
import type * as P from "./types";
import { ICONS } from "./icons";
export const tone = (t?: string) =>
  t
    ? `var(--${({ muted: "ink-muted", faint: "ink-faint", neutral: "ink-faint" } as Record<string, string>)[t] ?? t})`
    : "var(--ink-faint)";
export function Icon({
  name,
  size = 16,
  title,
  className,
  style,
}: P.IconProps & { style?: CSSProperties }) {
  return (
    <svg
      style={style}
      className={`cl-icon ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path d={ICONS[name] ?? ""} />
    </svg>
  );
}
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  children,
  className = "",
  ...rest
}: P.ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`cl-btn cl-btn-${variant} cl-btn-${size} ${icon && !children ? "cl-btn-icon" : ""} ${className}`}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={14} />}
    </button>
  );
}
export function Segmented({
  options,
  value,
  onChange,
  label,
}: P.SegmentedProps) {
  return (
    <div className="cl-seg" role="group" aria-label={label}>
      {options
        .map((o) => (typeof o === "string" ? { value: o, label: o } : o))
        .map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange?.(o.value)}
          >
            {o.label}
          </button>
        ))}
    </div>
  );
}
export function Chip({ active, onClick, color, count, children }: P.ChipProps) {
  return (
    <button
      className="cl-chip"
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
    >
      {color && (
        <i className="cl-chip-dot" style={{ background: tone(color) }} />
      )}
      {children}
      {count != null && <span className="cl-chip-count">{count}</span>}
    </button>
  );
}
export function Badge({ tone: t, variant, title, children }: P.BadgeProps) {
  return (
    <span
      className={`cl-badge ${variant === "outline" ? "cl-badge-outline" : ""}`}
      title={title}
    >
      {t && <i className="cl-badge-dot" style={{ background: tone(t) }} />}
      {children}
    </span>
  );
}
export function Metric({
  label,
  value,
  unit,
  size = "m",
  accent,
  delta,
  deltaUnit = "",
  deltaFormat,
  lowerIsBetter,
  sub,
}: P.MetricProps) {
  const good =
    delta == null || delta === 0 ? null : lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <div className={`cl-metric cl-metric-${size}`}>
      <div className="cl-metric-label">
        {accent && (
          <i
            className="cl-metric-swatch"
            style={{ background: tone(accent) }}
          />
        )}
        {label}
      </div>
      <div className="cl-metric-value">
        {value ?? "–"}
        {unit && <span className="cl-metric-unit">{unit}</span>}
      </div>
      {(delta != null || sub) && (
        <div className="cl-metric-sub">
          {delta != null && (
            <span className={good == null ? "" : good ? "cl-good" : "cl-bad"}>
              {delta > 0 ? "▲ " : delta < 0 ? "▼ " : ""}
              {deltaFormat
                ? deltaFormat(Math.abs(delta))
                : Math.abs(delta).toLocaleString("es-ES")}
              {deltaUnit}{" "}
            </span>
          )}
          {sub}
        </div>
      )}
    </div>
  );
}
export function Progress({
  label,
  valueLabel,
  value,
  max,
  tone: t,
}: P.ProgressProps) {
  const percent = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className="cl-progress">
      <div className="cl-progress-head">
        <span>{label}</span>
        <b>{valueLabel}</b>
      </div>
      <div
        className="cl-progress-track"
        role="progressbar"
        aria-label={typeof label === "string" ? label : undefined}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="cl-progress-fill"
          style={{ width: `${percent}%`, background: tone(t ?? "brand") }}
        />
      </div>
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  actions,
  flush,
  className = "",
  style,
  children,
}: P.PanelProps) {
  return (
    <section
      className={`cl-panel ${flush ? "cl-panel-flush" : ""} ${className}`}
      style={style}
    >
      {(title || actions) && (
        <header className="cl-panel-head">
          <div className="min-zero">
            <div className="cl-panel-title">{title}</div>
            {subtitle && <div className="cl-panel-sub">{subtitle}</div>}
          </div>
          {actions && <div className="cl-panel-actions">{actions}</div>}
        </header>
      )}
      <div className="cl-panel-body">{children}</div>
    </section>
  );
}
export function Sidebar({
  items,
  active,
  onSelect,
  header,
  footer,
  children,
}: P.SidebarProps) {
  return (
    <aside className="cl-sidebar">
      <div className="cl-sidebar-head">{header}</div>
      <nav className="cl-nav" aria-label="Principal">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className="cl-nav-item"
            aria-current={active === it.id ? "page" : undefined}
            onClick={() => onSelect?.(it.id)}
          >
            <Icon name={it.icon} />
            <span>{it.label}</span>
            <span className="cl-nav-kbd">{it.shortcut}</span>
          </button>
        ))}
      </nav>
      {children}
      <div className="cl-sidebar-foot">{footer}</div>
    </aside>
  );
}
export function SyncStatus({
  state,
  detail,
  title,
  onClick,
}: P.SyncStatusProps) {
  const titles = {
    synced: "Sincronizado con Garmin",
    syncing: "Sincronizando…",
    error: "Error de sincronización",
    offline: "Sin conexión",
  };
  return (
    <button
      className="cl-sync"
      disabled={state === "syncing"}
      onClick={onClick}
      aria-live="polite"
      title="Sincronizar ahora"
    >
      {state === "syncing" ? (
        <Icon name="sync" className="cl-spin" style={{ color: tone("info") }} />
      ) : (
        <i
          className="cl-sync-dot"
          style={{
            background: tone(
              { synced: "success", error: "danger", offline: "faint" }[state],
            ),
          }}
        />
      )}
      <span className="min-zero grow">
        <span className="cl-sync-title block">{title ?? titles[state]}</span>
        <span className="cl-sync-detail block">{detail}</span>
      </span>
      {state !== "syncing" && (
        <Icon name="sync" size={14} style={{ color: tone("faint") }} />
      )}
    </button>
  );
}
export function StateBlock({
  kind = "empty",
  title,
  detail,
  action,
}: P.StateBlockProps) {
  return (
    <div className="cl-state" role={kind === "error" ? "alert" : "status"}>
      <Icon
        name={
          kind === "loading" ? "sync" : kind === "error" ? "alert" : "search"
        }
        size={20}
        className={kind === "loading" ? "cl-spin" : ""}
      />
      <div className="cl-state-title">{title}</div>
      <div>{detail}</div>
      {action}
    </div>
  );
}
export function Skeleton({
  height = 12,
  width = "100%",
  radius,
}: P.SkeletonProps) {
  return (
    <div
      className="cl-skel"
      aria-hidden
      style={{ height, width, borderRadius: radius }}
    />
  );
}
export function Legend({ series }: { series: P.Series[] }) {
  return (
    <div className="cl-legend">
      {series.map((s) => (
        <span key={s.key}>
          <i
            style={{
              borderTopColor: tone(s.color),
              borderTopStyle: s.dash ? "dashed" : "solid",
            }}
          />
          {s.label ?? s.key}
        </span>
      ))}
    </div>
  );
}
export function ZoneBar({
  zones,
  format = String,
  compact,
  ariaLabel,
}: P.ZoneBarProps) {
  const total = zones.reduce((s, z) => s + z.value, 0) || 1,
    max = Math.max(...zones.map((z) => z.value), 1);
  return (
    <div className="cl-zonebar">
      <div
        className="cl-zonebar-track"
        role="img"
        aria-label={ariaLabel ?? "Distribución por zonas"}
      >
        {zones
          .filter((z) => z.value > 0)
          .map((z) => (
            <i
              key={z.label}
              style={{ flex: z.value, background: tone(z.color) }}
              title={`${z.label} · ${Math.round((z.value / total) * 100)} %`}
            />
          ))}
      </div>
      {!compact && (
        <div className="cl-zonebar-list">
          {zones.map((z) => (
            <ZoneRow
              key={z.label}
              zone={z}
              total={total}
              max={max}
              format={format}
            />
          ))}
        </div>
      )}
    </div>
  );
}
function ZoneRow({
  zone: z,
  total,
  max,
  format,
}: {
  zone: P.ZoneBarProps["zones"][number];
  total: number;
  max: number;
  format: (v: number) => string;
}) {
  return (
    <>
      <span className="cl-zone-tag">
        <i className="cl-swatch" style={{ background: tone(z.color) }} />
        {z.label}
      </span>
      <span className="zone-name">
        <span className="cl-muted">{z.name}</span>
        <i
          className="cl-zone-bar"
          style={{
            width: `${(z.value / max) * 100}%`,
            background: tone(z.color),
          }}
        />
      </span>
      <span className="cl-num cl-muted right">{format(z.value)}</span>
      <span className="cl-num right">
        {Math.round((z.value / total) * 100)}%
      </span>
    </>
  );
}
export function DataTable<R extends object>({
  sort,
  onSort,
  columns,
  rows,
  rowKey = "id",
  selected,
  onSelect,
  checked,
  onCheck,
  checkLabel,
  compact,
  maxHeight,
  empty,
  selectOnFocus,
  onEscape,
}: P.DataTableProps<R>) {
  const table = useRef<HTMLTableElement>(null);
  const key = (r: R) =>
    (r as Record<string, unknown>)[rowKey] as string | number;
  const focus = rows.some((r) => key(r) === selected)
    ? selected
    : rows[0] && key(rows[0]);
  return (
    <div className="cl-table-wrap" style={{ maxHeight }}>
      <table
        ref={table}
        className={`cl-table ${compact ? "cl-table-compact" : ""}`}
      >
        <thead>
          <tr>
            {checked && <th />}
            {columns.map((c) => (
              <th
                key={c.key}
                data-align={c.align}
                style={{ width: c.width }}
                aria-sort={
                  onSort
                    ? sort?.key === c.key
                      ? sort.direction
                      : "none"
                    : undefined
                }
              >
                {onSort ? (
                  <button
                    className="cl-table-sort"
                    onClick={() => onSort(c.key)}
                  >
                    {c.label}
                    <span aria-hidden="true">
                      {sort?.key === c.key
                        ? sort.direction === "ascending"
                          ? " ↑"
                          : " ↓"
                        : " ↕"}
                    </span>
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={key(r)}
              aria-selected={selected === key(r)}
              tabIndex={onSelect ? (focus === key(r) ? 0 : -1) : undefined}
              onClick={() => onSelect?.(key(r), r)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Escape") onEscape?.();
                if (["Enter", " "].includes(e.key)) {
                  e.preventDefault();
                  onSelect?.(key(r), r);
                }
                const next =
                  e.key === "ArrowDown"
                    ? i + 1
                    : e.key === "ArrowUp"
                      ? i - 1
                      : e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? rows.length - 1
                          : -1;
                if (next >= 0 && next < rows.length) {
                  e.preventDefault();
                  table.current?.tBodies[0].rows[next].focus();
                  if (selectOnFocus) onSelect?.(key(rows[next]), rows[next]);
                }
              }}
            >
              {checked && (
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    className="cl-check"
                    type="checkbox"
                    aria-label={checkLabel ?? "Seleccionar para comparar"}
                    checked={checked.includes(key(r))}
                    onChange={() => onCheck?.(key(r))}
                  />
                </td>
              )}
              {columns.map((c) => (
                <td key={c.key} data-align={c.align}>
                  {c.render
                    ? c.render(r)
                    : (r as Record<string, ReactNode>)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && empty}
    </div>
  );
}
export function ChatMessage({ role, children }: P.ChatMessageProps) {
  return (
    <div className={`cl-msg cl-msg-${role}`}>
      {role === "assistant" && (
        <div className="cl-msg-avatar" aria-hidden>
          CL
        </div>
      )}
      <div className="cl-msg-body">{children}</div>
    </div>
  );
}
export function ToolResult({
  tool,
  args,
  status = "done",
  meta,
  title,
  children,
}: P.ToolResultProps) {
  return (
    <div className="cl-tool">
      <div className="cl-tool-head">
        <Icon
          name={
            status === "running"
              ? "sync"
              : status === "error"
                ? "alert"
                : "check"
          }
          className={status === "running" ? "cl-spin" : ""}
        />
        <span className="cl-tool-name">{tool}</span>
        <span className="cl-tool-args">{args && `(${args})`}</span>
        <span className="push">{meta}</span>
      </div>
      <div className="cl-tool-body">
        {title && <div className="cl-tool-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}
