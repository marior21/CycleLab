import { useEffect, useRef, useState } from "react";
import type {
  AppState,
  ChatMessage as Message,
  CoachContext,
  ToolView,
  Usage,
} from "../../shared/models";
import { messageReferences, type Reference } from "../../domain/references";
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
  openPeriod: (from: string, to: string) => void;
  compact?: boolean;
  conversation: string;
  setConversation: (id: string | null) => void;
  send: (text: string, context?: CoachContext) => Promise<Message["status"]>;
}
const day = (iso: string) => `${date(Date.parse(iso))} ${iso.slice(0, 4)}`;
function referenceLabel(r: Reference) {
  if (r.kind === "period")
    return r.from && r.to
      ? `Periodo ${day(r.from)} – ${day(r.to)}`
      : r.from
        ? `Desde ${day(r.from)}`
        : `Hasta ${day(r.to)}`;
  const when = r.date ? ` · ${day(r.date)}` : "";
  return r.kind === "attempt"
    ? `Intento · ${r.name}${when}`
    : r.kind === "range"
      ? `${r.name} · ${r.label ?? "Tramo"}`
      : r.name + when;
}
function References(p: {
  tools: ToolView[];
  openActivity: Props["openActivity"];
  openPeriod: Props["openPeriod"];
}) {
  const refs = messageReferences(p.tools);
  if (!refs.length) return null;
  return (
    <div className="chat-refs" role="group" aria-label="Datos utilizados">
      <span className="small cl-faint">Datos utilizados</span>
      {refs.slice(0, 12).map((r) => (
        <Button
          key={r.key}
          variant="ghost"
          size="sm"
          onClick={() =>
            r.kind === "period"
              ? p.openPeriod(r.from, r.to)
              : p.openActivity(r.activityId, r.range)
          }
        >
          {referenceLabel(r)}
        </Button>
      ))}
      {refs.length > 12 && (
        <span className="small cl-faint">y {refs.length - 12} más</span>
      )}
    </div>
  );
}
function UsageLine({ usage: u }: { usage: Usage }) {
  return (
    <div className="small cl-faint">
      {number(u.promptTokens + u.completionTokens)} tokens ·{" "}
      {u.cost === null
        ? "coste no informado por el proveedor"
        : u.estimated
          ? `≈ ${number(u.cost, 4)} US$ estimado con precios publicados`
          : `${number(u.cost, 4)} US$ según OpenRouter`}
    </div>
  );
}
export function Conversations(
  p: Pick<Props, "state" | "conversation" | "setConversation">,
) {
  const [query, setQuery] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [title, setTitle] = useState(""),
    [confirming, setConfirming] = useState<string | null>(null),
    [error, setError] = useState("");
  const busy = p.state.messages.some((m) => m.status === "running");
  const q = query.trim().toLocaleLowerCase("es");
  const list = p.state.conversations.filter(
    (c) =>
      !q ||
      c.title.toLocaleLowerCase("es").includes(q) ||
      p.state.messages.some(
        (m) =>
          m.conversationId === c.id &&
          m.text.toLocaleLowerCase("es").includes(q),
      ),
  );
  const run = (action: Promise<void>) => {
    setError("");
    return action.catch((e) =>
      setError(e instanceof Error ? e.message : "No se pudo completar."),
    );
  };
  return (
    <div className="conversations">
      <div className="toolbar compact">
        <input
          type="search"
          aria-label="Buscar conversaciones"
          placeholder="Buscar conversaciones"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          size="sm"
          icon="plus"
          onClick={() => p.setConversation(crypto.randomUUID())}
        >
          Nueva
        </Button>
      </div>
      <div className="conversation-list">
        {list.map((c) => (
          <div
            key={c.id}
            className="conversation"
            aria-current={c.id === p.conversation || undefined}
          >
            {editing === c.id ? (
              <input
                aria-label="Título de la conversación"
                autoFocus
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setEditing(null)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(null);
                  if (e.key === "Enter" && title.trim())
                    void run(
                      window.cyclelab.renameConversation(c.id, title),
                    ).then(() => setEditing(null));
                }}
              />
            ) : (
              <button
                type="button"
                className="conversation-open"
                onClick={() => {
                  setConfirming(null);
                  p.setConversation(c.id);
                }}
              >
                <span className="ellipsis">{c.title}</span>
                <span className="small cl-faint">{date(c.createdAt)}</span>
              </button>
            )}
            {c.id === p.conversation &&
              editing !== c.id &&
              (confirming === c.id ? (
                <div className="toolbar compact">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(window.cyclelab.deleteConversation(c.id)).then(
                        () => p.setConversation(null),
                      )
                    }
                  >
                    Confirmar borrado
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="toolbar compact">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTitle(c.title);
                      setEditing(c.id);
                    }}
                  >
                    Renombrar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirming(c.id)}
                  >
                    Borrar
                  </Button>
                </div>
              ))}
          </div>
        ))}
        {!list.length && (
          <div className="small cl-faint">
            {q ? "Sin coincidencias." : "Todavía no hay conversaciones."}
          </div>
        )}
      </div>
      {error && (
        <div className="small" role="alert">
          {error}
        </div>
      )}
    </div>
  );
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
    [error, setError] = useState(""),
    [list, setList] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const busy = p.state.messages.some((m) => m.status === "running");
  const messages = p.state.messages.filter(
    (m) => m.conversationId === p.conversation,
  );
  const demo = p.state.settings.source === "demo",
    ready =
      demo ||
      (p.state.settings.openrouterConfigured && !!p.state.settings.model);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [p.state.messages, p.conversation]);
  async function send(value: string, context?: CoachContext) {
    if (!value.trim() || busy) return;
    setError("");
    setText("");
    try {
      // Keep the question at hand when the answer fails or is stopped.
      if ((await p.send(value, context)) !== "done") setText((t) => t || value);
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
        {p.compact && (
          <Button
            variant={list ? "secondary" : "ghost"}
            size="sm"
            aria-expanded={list}
            onClick={() => setList(!list)}
          >
            Conversaciones
          </Button>
        )}
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
      {p.compact && list && (
        <Conversations
          state={p.state}
          conversation={p.conversation}
          setConversation={(id) => {
            p.setConversation(id);
            setList(false);
          }}
        />
      )}
      <div className="chat-log" ref={log} aria-live="polite">
        {!messages.length && (
          <ChatMessage role="assistant">
            <p>
              Hola. Puedo consultar tus actividades sincronizadas, tu curva de
              potencia, la carga de entrenamiento y tus puertos, y devolverte el
              análisis con gráficas y tablas. ¿Qué quieres revisar?
            </p>
          </ChatMessage>
        )}
        {messages.map((m, i) => {
          const retry = (
            <Button
              size="sm"
              icon="sync"
              disabled={busy}
              onClick={() => {
                const question = messages
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
          );
          return (
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
              {m.status === "running" && !m.text ? (
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
                  action={retry}
                />
              ) : (
                <MarkdownMessage text={m.text} />
              )}
              {m.status === "running" && m.text && (
                <div className="small cl-faint">Escribiendo…</div>
              )}
              {m.status === "cancelled" && (
                <StateBlock
                  title="Respuesta cancelada"
                  detail="Se conserva lo recibido. Cancelar no anula el coste que el proveedor ya haya generado."
                  action={retry}
                />
              )}
              {m.role === "assistant" && m.status !== "running" && (
                <References
                  tools={m.tools}
                  openActivity={p.openActivity}
                  openPeriod={p.openPeriod}
                />
              )}
              {m.usage && <UsageLine usage={m.usage} />}
            </ChatMessage>
          );
        })}
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
              {busy ? (
                <Button
                  size="sm"
                  icon="close"
                  onClick={() =>
                    void window.cyclelab
                      .cancelMessage()
                      .catch((e) => setError(e.message))
                  }
                >
                  Detener
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon="send"
                  aria-label="Enviar"
                  disabled={!text.trim()}
                  onClick={() => void send(text)}
                />
              )}
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
          <div className="label section-label">Conversaciones</div>
          <Conversations {...p} />
        </div>
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
            {d.goals.some((g) => !g.archived) && (
              <span>
                Objetivos:{" "}
                {d.goals
                  .filter((g) => !g.archived)
                  .map((g) => g.name)
                  .join(", ")}
              </span>
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
