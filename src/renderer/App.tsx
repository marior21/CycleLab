import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppState,
  Activity,
  ActivityDetail,
  Screen,
  Settings as SettingsValue,
} from "../shared/models";
import {
  Badge,
  Button,
  Icon,
  Sidebar,
  StateBlock,
  SyncStatus,
} from "./components/ui";
import { Activities } from "./features/Activities";
import { Dashboard } from "./features/Dashboard";
import { Performance } from "./features/Performance";
import { SegmentCreator } from "./features/SegmentCreator";
import { Segments } from "./features/Segments";
import { ChatPanel, CoachPage } from "./features/Coach";
import { Settings } from "./features/Settings";
import { number } from "./format";
const nav = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", shortcut: "⌘1" },
  { id: "activities", label: "Actividades", icon: "activity", shortcut: "⌘2" },
  {
    id: "performance",
    label: "Rendimiento",
    icon: "performance",
    shortcut: "⌘3",
  },
  { id: "segments", label: "Segmentos", icon: "route", shortcut: "⌘4" },
  { id: "climbs", label: "Puertos", icon: "mountain", shortcut: "⌘5" },
  { id: "coach", label: "Entrenador IA", icon: "coach", shortcut: "⌘6" },
];
export default function App() {
  const [state, setState] = useState<AppState | null>(null),
    [screen, updateScreen] = useState<Screen>("activities"),
    [draft, setDraft] = useState<{
      activity: Activity;
      detail: ActivityDetail;
      range: [number, number];
    } | null>(null),
    [actId, setActId] = useState<string | null>(null),
    [drawer, setDrawer] = useState(false),
    [error, setError] = useState("");
  const setScreen = (next: Screen) => {
    setDraft(null);
    updateScreen(next);
  };
  const request = useRef(0),
    lastSource = useRef("");
  const refresh = useCallback(async () => {
    const n = ++request.current;
    const s = await window.cyclelab.getState();
    if (n !== request.current) return;
    document.documentElement.dataset.theme = s.settings.theme;
    setState(s);
    if (lastSource.current !== s.settings.source) {
      lastSource.current = s.settings.source;
      setActId(s.dataset.activities[0]?.id ?? null);
      setDrawer(false);
      setDraft(null);
    }
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    return window.cyclelab.onChange(() => {
      void refresh().catch((e) => setError(e.message));
    });
  }, [refresh]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (/^[1-6]$/.test(e.key)) {
          e.preventDefault();
          setScreen(nav[Number(e.key) - 1].id as Screen);
        }
        if (e.key.toLowerCase() === "j") {
          e.preventDefault();
          setDrawer((v) => !v);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  async function save(patch: Partial<SettingsValue>) {
    if (!state) return;
    const s = { ...state.settings, ...patch };
    await window.cyclelab.saveSettings({
      theme: s.theme,
      source: s.source,
      model: s.model,
      athlete: s.athlete,
    });
    await refresh();
  }
  const context = { screen, activityId: actId ?? undefined };
  const send = async (text: string) => {
    await window.cyclelab.sendMessage(text, context);
  };
  const ask = (text: string) => {
    if (screen !== "coach") setDrawer(true);
    void send(text).catch((e) => setError(e.message));
  };
  const openActivity = (id: string) => {
    setActId(id);
    setScreen("activities");
  };
  const settings = () => {
    setScreen("settings");
    setDrawer(false);
  };
  if (!state)
    return (
      <div className="app">
        <StateBlock
          kind={error ? "error" : "loading"}
          title={error ? "No se pudo iniciar CycleLab" : "Abriendo CycleLab"}
          detail={error || "Preparando los datos locales…"}
          action={
            error ? (
              <Button
                onClick={() => void refresh().catch((e) => setError(e.message))}
              >
                Reintentar
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  const demo = state.settings.source === "demo",
    pageProps = {
      createSegment: (
        activity: Activity,
        detail: ActivityDetail,
        range: [number, number],
      ) => {
        setDraft({ activity, detail, range });
        setDrawer(false);
      },
      segments: state.segments,
      maptilerConfigured: state.settings.maptilerConfigured,
      theme: state.settings.theme,
      data: state.dataset,
      demo,
      openActivity,
      go: setScreen,
      ask,
    };
  const title = draft
    ? "Crear segmento"
    : screen === "settings"
      ? "Ajustes"
      : nav.find((n) => n.id === screen)!.label;
  const header = (
    <>
      <div className="native-titlebar" />
      <div className="wordmark">CycleLab</div>
    </>
  );
  const footer = (
    <>
      <SyncStatus
        state={state.sync.state}
        title={
          demo
            ? undefined
            : !state.settings.garminConfigured
              ? "Garmin · sin configurar"
              : undefined
        }
        detail={
          state.sync.phase +
          (state.sync.total !== null
            ? ` · ${state.sync.completed}/${state.sync.total}`
            : "")
        }
        onClick={() => {
          if (!demo && !state.settings.garminConfigured) settings();
          else void window.cyclelab.sync().catch((e) => setError(e.message));
        }}
      />
      <button
        className="cl-nav-item"
        aria-current={screen === "settings" ? "page" : undefined}
        onClick={settings}
      >
        <Icon name="settings" />
        Ajustes
      </button>
      <div className="athlete">
        <div className="athlete-av">{demo ? "AD" : "CL"}</div>
        <div className="grow">
          <div className="small athlete-name">
            {demo ? "Atleta demo" : "Mi perfil"}
          </div>
          <div className="small cl-faint">
            FTP {number(state.dataset.athlete.ftp)} W ·{" "}
            {number(state.dataset.athlete.weight)} kg · LTHR{" "}
            {number(state.dataset.athlete.lthr)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={state.settings.theme === "dark" ? "sun" : "moon"}
          aria-label="Cambiar tema"
          onClick={() =>
            void save({
              theme: state.settings.theme === "dark" ? "light" : "dark",
            }).catch((e) => setError(e.message))
          }
        />
      </div>
    </>
  );
  let body;
  switch (screen) {
    case "dashboard":
      body = <Dashboard {...pageProps} />;
      break;
    case "activities":
      body = (
        <Activities
          key={state.settings.source}
          {...pageProps}
          actId={actId}
          setActId={setActId}
        />
      );
      break;
    case "performance":
      body = (
        <Performance
          key={state.settings.source + state.dataset.curve.length}
          {...pageProps}
        />
      );
      break;
    case "segments":
    case "climbs":
      body = (
        <Segments
          key={state.settings.source + screen}
          {...pageProps}
          climbsOnly={screen === "climbs"}
        />
      );
      break;
    case "coach":
      body = (
        <CoachPage
          state={state}
          context={context}
          onSettings={settings}
          send={send}
        />
      );
      break;
    case "settings":
      body = <Settings state={state} refresh={refresh} save={save} />;
  }
  if (draft)
    body = (
      <SegmentCreator
        {...pageProps}
        {...draft}
        onCancel={() => setDraft(null)}
        onSaved={() => setScreen("segments")}
      />
    );
  return (
    <div className="app">
      <Sidebar
        items={nav}
        active={screen}
        onSelect={(id) => setScreen(id as Screen)}
        header={header}
        footer={footer}
      />
      <main className="main">
        <div className="topbar">
          <h1>{title}</h1>
          <div className="spacer" />
          {demo ? (
            <Badge variant="outline" title="Todos los datos son ficticios">
              Datos de demostración
            </Badge>
          ) : (
            <Badge tone="success">Mis datos · Garmin</Badge>
          )}
          {screen !== "coach" && (
            <Button
              variant={drawer ? "secondary" : "primary"}
              icon="coach"
              onClick={() => setDrawer(!drawer)}
            >
              Entrenador IA <span className="kbd on-brand">⌘J</span>
            </Button>
          )}
        </div>
        {(error || state.sync.error) && (
          <div className="banner" role="alert">
            <Icon name="alert" />
            <span>{error || state.sync.error}</span>
            <div className="push" />
            <Button
              size="sm"
              onClick={() => {
                setError("");
                void window.cyclelab.sync().catch((e) => setError(e.message));
              }}
            >
              Reintentar
            </Button>
            {error && (
              <Button size="sm" variant="ghost" onClick={() => setError("")}>
                Descartar
              </Button>
            )}
          </div>
        )}
        <div
          className={`scroll ${!draft && ["activities", "segments", "climbs", "coach"].includes(screen) ? "split-view" : ""}`}
        >
          {body}
        </div>
        {screen !== "coach" && (
          <aside
            className="ai-drawer"
            data-open={drawer}
            aria-hidden={!drawer}
            aria-label="Entrenador IA"
          >
            {drawer && (
              <ChatPanel
                state={state}
                context={context}
                compact
                onClose={() => setDrawer(false)}
                onSettings={settings}
                send={send}
              />
            )}
          </aside>
        )}
      </main>
    </div>
  );
}
