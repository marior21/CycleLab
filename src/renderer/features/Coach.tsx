import { useEffect, useRef, useState } from "react";
import type { AppState, CoachContext, ToolView } from "../../shared/models";
import {
  Badge,
  Button,
  ChatMessage,
  Chip,
  DataTable,
  Icon,
  Skeleton,
  StateBlock,
  ToolResult,
} from "../components/ui";
import { BarChart, LineChart } from "../components/charts";
import { date, effort, number } from "../format";
import { MarkdownMessage } from "../components/MarkdownMessage";
const suggestions = [
  "¿Cómo va mi forma para La Cantabrona?",
  "Compara mis dos últimos intentos en un puerto",
  "Analiza los intervalos del último martes",
  "Analiza mi curva de potencia frente a 2025",
  "Simular un error de herramienta",
];
interface Props {
  state: AppState;
  context: CoachContext;
  onClose?: () => void;
  onSettings: () => void;
  openActivity: (id: string, range?: [number, number]) => void;
  compact?: boolean;
  send: (text: string, context?: CoachContext) => Promise<void>;
}
function ToolVisualization({
  tool: t,
  openActivity,
}: {
  tool: ToolView;
  openActivity: (id: string, range?: [number, number]) => void;
}) {
  return (
    <>
      {t.kind === "table" ? (
        <DataTable
          compact
          rows={t.rows.map((r, i) => ({ ...r, id: r.id ?? i }))}
          columns={(t.columns ?? []).map((c) => ({
            ...c,
            render: (r: Record<string, unknown>) =>
              c.key === "actividad" && typeof r.activityId === "string" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    openActivity(
                      String(r.activityId),
                      typeof r.i0 === "number" && typeof r.i1 === "number"
                        ? [r.i0, r.i1]
                        : undefined,
                    )
                  }
                >
                  {String(r[c.key])}
                </Button>
              ) : r[c.key] == null ? (
                "–"
              ) : typeof r[c.key] === "number" ? (
                number(r[c.key] as number)
              ) : (
                String(r[c.key])
              ),
          }))}
        />
      ) : t.rows.length ? (
        t.kind === "bar" ? (
          <BarChart
            data={t.rows}
            height={150}
            legend
            series={t.series.filter((s) => s.axis !== "right")}
            line={t.series.find((s) => s.axis === "right")}
          />
        ) : (
          <LineChart
            data={t.rows}
            height={170}
            legend
            zeroBased={false}
            series={t.series}
            xType={t.xType}
            xTicks={
              t.xType === "log" ? [5, 60, 300, 1200, 3600, 14400] : undefined
            }
            xFormat={(v) =>
              t.xType === "log"
                ? effort(v)
                : t.tool === "carga_entrenamiento"
                  ? date(v)
                  : number(v)
            }
          />
        )
      ) : (
        <StateBlock title="Sin datos suficientes" />
      )}
      {t.note && <div className="small cl-faint">{t.note}</div>}
    </>
  );
}
export function ChatPanel(p: Props) {
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const busy = p.state.messages.some((m) => m.status === "running");
  const demo = p.state.settings.source === "demo",
    ready =
      demo ||
      (p.state.settings.openrouterConfigured && !!p.state.settings.model);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [p.state.messages]);
  async function send(value: string, context?: CoachContext) {
    if (!value.trim() || busy) return;
    setError("");
    setText("");
    try {
      await p.send(value, context);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo enviar el mensaje.",
      );
      setText(value);
    }
  }
  return (
    <div className="chat">
      <div className="chat-head">
        <div className="cl-msg-avatar">CL</div>
        <div className="grow">
          <div className="cl-panel-title">Entrenador IA</div>
          <div className="small cl-faint ellipsis">
            {demo
              ? "OpenRouter · modelo configurable (simulado)"
              : (p.state.settings.model ?? "OpenRouter · sin configurar")}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon="settings"
          aria-label="Ajustes del entrenador"
          onClick={p.onSettings}
        />
        {p.onClose && (
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            aria-label="Cerrar panel IA"
            onClick={p.onClose}
          />
        )}
      </div>
      <div className="chat-log" ref={log} aria-live="polite">
        {!p.state.messages.length && (
          <ChatMessage role="assistant">
            <p>
              Hola. Puedo consultar tus actividades sincronizadas, tu curva de
              potencia, la carga de entrenamiento y tus puertos, y devolverte el
              análisis con gráficas y tablas. ¿Qué quieres revisar?
            </p>
          </ChatMessage>
        )}
        {p.state.messages.map((m, i) => (
          <ChatMessage key={m.id} role={m.role}>
            {m.tools.map((t, j) => (
              <ToolResult
                key={j}
                tool={t.tool}
                args={t.args}
                title={t.title}
                status="done"
              >
                <ToolVisualization tool={t} openActivity={p.openActivity} />
              </ToolResult>
            ))}
            {m.status === "running" ? (
              <ToolResult
                tool="analizando"
                status="running"
                meta="consultando…"
              >
                <Skeleton height={120} />
              </ToolResult>
            ) : m.status === "error" ? (
              <StateBlock
                kind="error"
                title="La herramienta falló"
                detail={m.text}
                action={
                  <Button
                    size="sm"
                    icon="sync"
                    disabled={busy}
                    onClick={() => {
                      const question = p.state.messages
                        .slice(0, i)
                        .reverse()
                        .find((m) => m.role === "user");
                      if (question)
                        void send(
                          demo && question.text.toLowerCase().includes("error")
                            ? "Analiza mi curva de potencia"
                            : question.text,
                          question.context,
                        );
                    }}
                  >
                    Reintentar
                  </Button>
                }
              />
            ) : (
              <MarkdownMessage text={m.text} />
            )}
          </ChatMessage>
        ))}
      </div>
      <div className="chat-input">
        <div className="small cl-muted" aria-label="Contexto del entrenador">
          Contexto:{" "}
          {p.context.comparison
            ? p.context.comparison
                .map(
                  (id) =>
                    p.state.dataset.activities.find((a) => a.id === id)?.name ??
                    id,
                )
                .join(" / ")
            : p.context.segmentId
              ? (p.state.segments.find((s) => s.id === p.context.segmentId)
                  ?.name ?? "Segmento no disponible")
              : (p.state.dataset.activities.find(
                  (a) => a.id === p.context.activityId,
                )?.name ?? "Histórico")}
          {p.context.ranges &&
            ` · ${p.context.ranges.length} ${p.context.ranges.length === 1 ? "tramo seleccionado" : "tramos seleccionados"}`}
        </div>
        {!ready ? (
          <StateBlock
            title="Configura el entrenador"
            detail="Introduce tu API key de OpenRouter y elige un modelo."
            action={<Button onClick={p.onSettings}>Abrir ajustes</Button>}
          />
        ) : (
          <>
            <div className="suggest">
              {(demo
                ? suggestions
                : [
                    "Resume mi entrenamiento reciente",
                    "Compara mis dos últimos intentos en un puerto",
                    "Analiza mis intervalos",
                    "Analiza mi curva de potencia",
                    "¿Cómo va mi carga?",
                  ]
              )
                .slice(0, p.compact ? 3 : 5)
                .map((s) => (
                  <Chip key={s} onClick={() => void send(s)}>
                    {s}
                  </Chip>
                ))}
            </div>
            <div className="chat-box">
              <textarea
                value={text}
                rows={1}
                aria-label="Mensaje para el entrenador"
                placeholder="Pregunta por tus entrenamientos…"
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
              />
              <Button
                variant="primary"
                size="sm"
                icon="send"
                aria-label="Enviar"
                disabled={busy || !text.trim()}
                onClick={() => void send(text)}
              />
            </div>
          </>
        )}
        {error && <div role="alert">{error}</div>}
        <div className="small cl-faint">
          {demo
            ? "Respuestas simuladas: no hay conexión real con OpenRouter ni con Garmin."
            : "Al enviar, se comparte con OpenRouter el contexto necesario para responder. No se envían coordenadas GPS."}
        </div>
      </div>
    </div>
  );
}
export function CoachPage(p: Props) {
  const d = p.state.dataset;
  return (
    <div className="coach-page grow">
      <div className="coach-side">
        <div>
          <div className="label section-label">Herramientas de análisis</div>
          <div className="tool-list">
            {[
              ["buscar_actividades", "Filtra el histórico"],
              ["analizar_intervalos", "Series de una sesión"],
              ["comparar_ascensiones", "Intentos en un puerto"],
              ["curva_potencia", "MMP por temporada"],
              ["carga_entrenamiento", "CTL · ATL · TSB"],
            ].map(([name, description]) => (
              <div key={name}>
                <Icon name="check" size={12} />
                <span className="column">
                  <span>{name}</span>
                  <span className="small cl-faint">{description}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="label section-label">Contexto del atleta</div>
          <div className="small cl-muted column">
            <span>
              FTP {number(d.athlete.ftp)} W ·{" "}
              {d.athlete.weight && d.athlete.ftp !== null
                ? number(d.athlete.ftp / d.athlete.weight, 2)
                : "–"}{" "}
              W/kg
            </span>
            <span>
              Umbral FC {number(d.athlete.lthr)} ppm ·{" "}
              {number(d.athlete.weight)} kg
            </span>
            <span>
              {d.activities.length} actividades · {p.state.ascents.count}{" "}
              ascensiones identificadas
              {p.state.ascents.incomplete ? " · búsqueda incompleta" : ""}
            </span>
            {d.goals.length > 0 && (
              <span>Objetivos: {d.goals.map((g) => g.name).join(", ")}</span>
            )}
          </div>
        </div>
        <div>
          <div className="label section-label">Modelo</div>
          <Badge variant="outline">
            {p.state.settings.source === "demo"
              ? "OpenRouter · sin configurar"
              : (p.state.settings.model ?? "OpenRouter · sin configurar")}
          </Badge>
        </div>
      </div>
      <div className="coach-main">
        <ChatPanel {...p} />
      </div>
    </div>
  );
}
