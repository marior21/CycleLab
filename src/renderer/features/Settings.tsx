import { useEffect, useState } from "react";
import type {
  AppState,
  Model,
  Settings as SettingsValue,
} from "../../shared/models";
import { Badge, Button, Panel, Segmented, StateBlock } from "../components/ui";
import { number } from "../format";
interface Props {
  state: AppState;
  refresh: () => Promise<void>;
  save: (patch: Partial<SettingsValue>) => Promise<void>;
}
export function Settings(p: Props) {
  const { settings: s, sync } = p.state;
  const [models, setModels] = useState<Model[]>([]),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(false),
    [reclassifying, setReclassifying] = useState(false),
    [tagMessage, setTagMessage] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [profile, setProfile] = useState(s.athlete);
  useEffect(
    () => setProfile(s.athlete),
    [s.athlete.ftp, s.athlete.lthr, s.athlete.weight],
  );
  async function load() {
    setLoading(true);
    setError("");
    try {
      setModels(await window.cyclelab.listModels());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar el catálogo.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (s.openrouterConfigured) void load();
  }, [s.openrouterConfigured]);
  async function save(patch: Partial<SettingsValue>) {
    setError("");
    setNotice("");
    try {
      await p.save(patch);
      setNotice("Ajustes guardados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }
  return (
    <div className="page settings-page">
      <div>
        <div className="page-heading">Ajustes</div>
        <p className="cl-muted">
          Conexiones, modelo y perfil del atleta. Las claves se guardan cifradas
          en este Mac.
        </p>
      </div>
      <Panel
        title="Datos"
        subtitle="La demostración y tus entrenamientos tienen históricos y conversaciones independientes."
      >
        <Segmented
          label="Origen de datos"
          value={s.source}
          onChange={(v) => void save({ source: v as "demo" | "garmin" })}
          options={[
            { value: "demo", label: "Demostración" },
            { value: "garmin", label: "Mis datos" },
          ]}
        />
      </Panel>
      <Panel
        title="Garmin Connect Personal"
        subtitle="Importa todo tu histórico de ciclismo, BTT y ciclismo indoor."
      >
        <Credential
          provider="garmin"
          configured={s.garminConfigured}
          refresh={p.refresh}
        />
        <div className="settings-sync">
          <div className="small cl-muted">
            {sync.phase}
            {sync.total !== null && ` · ${sync.completed} / ${sync.total}`}
            {sync.lastSync &&
              ` · ${new Date(sync.lastSync).toLocaleString("es-ES")}`}
          </div>
          <Button
            icon="sync"
            disabled={
              !s.garminConfigured ||
              sync.state === "syncing" ||
              s.source === "demo"
            }
            onClick={() => {
              void window.cyclelab.sync().catch((e) => setError(e.message));
            }}
          >
            Sincronizar ahora
          </Button>
        </div>
        <p className="small cl-faint">
          La sincronización recorre todo el histórico disponible, sin límite de
          temporada. En Actividades, «Todo» muestra todas las fechas
          descargadas.
        </p>
        {s.source === "demo" && (
          <p className="small cl-faint">
            Selecciona «Mis datos» para sincronizar tu cuenta.
          </p>
        )}
      </Panel>
      <Panel
        title="Etiquetas del histórico"
        subtitle="Recalcula las etiquetas de todas las actividades Garmin descargadas, de cualquier año. No necesita conexión."
      >
        <Button
          disabled={
            reclassifying || (s.source === "garmin" && sync.state === "syncing")
          }
          onClick={async () => {
            setError("");
            setTagMessage("");
            setReclassifying(true);
            try {
              const count = await window.cyclelab.reclassifyActivities();
              await p.refresh();
              setTagMessage(
                `Se han vuelto a etiquetar ${count} actividades de todo el histórico.`,
              );
            } catch (e) {
              setTagMessage(
                e instanceof Error
                  ? e.message
                  : "No se pudieron actualizar las etiquetas.",
              );
            } finally {
              setReclassifying(false);
            }
          }}
        >
          {reclassifying
            ? "Actualizando etiquetas…"
            : "Volver a etiquetar todo"}
        </Button>
        {tagMessage && (
          <p className="small cl-muted" role="status">
            {tagMessage}
          </p>
        )}
      </Panel>
      <Panel
        title="OpenRouter"
        subtitle="Elige el modelo que responderá a tus preguntas y utilizará las herramientas de análisis."
      >
        <Credential
          provider="openrouter"
          configured={s.openrouterConfigured}
          refresh={p.refresh}
        />
        <div className="settings-model">
          <label htmlFor="model-search">Buscar modelo</label>
          <div className="toolbar">
            <input
              id="model-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre o proveedor"
              disabled={!s.openrouterConfigured}
            />
            <Button
              disabled={!s.openrouterConfigured || loading}
              onClick={() => void load()}
            >
              {loading ? "Cargando…" : "Actualizar modelos"}
            </Button>
          </div>
          <label htmlFor="model">Modelo del entrenador</label>
          <select
            id="model"
            disabled={!s.openrouterConfigured || loading}
            value={s.model ?? ""}
            onChange={(e) => void save({ model: e.target.value || null })}
          >
            <option value="">Selecciona un modelo</option>
            {s.model && !models.some((m) => m.id === s.model) && (
              <option value={s.model}>{s.model} · sin verificar</option>
            )}
            {models
              .filter(
                (m) =>
                  m.id === s.model ||
                  (m.name + " " + m.id)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {number(m.context)} tokens · $
                  {number(m.promptPrice, 2)} / ${number(m.completionPrice, 2)}
                </option>
              ))}
          </select>
          <span className="small cl-faint">
            Solo modelos compatibles con herramientas. Precios en USD por millón
            de tokens: entrada / salida.
          </span>
        </div>
      </Panel>
      <Panel
        title="MapTiler"
        subtitle="Cartografía Outdoor para tus rutas y segmentos, con estilos claro y oscuro."
      >
        <Credential
          provider="maptiler"
          configured={s.maptilerConfigured}
          refresh={p.refresh}
        />
        <p className="small cl-faint">
          Los mapas consultados consumen la cuota de tu cuenta. La cartografía
          necesita conexión; tus rutas y métricas siguen disponibles localmente.
        </p>
      </Panel>
      <Panel
        title="Perfil del atleta"
        subtitle="Completa los valores que Garmin no haya proporcionado. Se aplican a «Mis datos»."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ athlete: profile });
          }}
        >
          <div className="profile-fields">
            {[
              { key: "ftp" as const, label: "FTP (W)", min: 1, max: 1000 },
              { key: "weight" as const, label: "Peso (kg)", min: 10, max: 400 },
              {
                key: "lthr" as const,
                label: "Umbral cardíaco LTHR (ppm)",
                min: 30,
                max: 250,
              },
            ].map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.key === "weight" ? ".1" : "1"}
                  value={profile[f.key] ?? ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      [f.key]:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <Button type="submit">Guardar perfil</Button>
        </form>
      </Panel>
      {error && (
        <StateBlock
          kind="error"
          title="No se pudo completar la operación"
          detail={error}
        />
      )}
      {notice && (
        <div role="status" className="small">
          {notice}
        </div>
      )}
    </div>
  );
}
function Credential({
  provider,
  configured,
  refresh,
}: {
  provider: "garmin" | "openrouter" | "maptiler";
  configured: boolean;
  refresh: () => Promise<void>;
}) {
  const [key, setKey] = useState(""),
    [editing, setEditing] = useState(!configured),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const label =
    provider === "garmin"
      ? "Garmin"
      : provider === "maptiler"
        ? "MapTiler"
        : "OpenRouter";
  async function save() {
    setBusy(true);
    setError("");
    try {
      await window.cyclelab.saveCredential(provider, key);
      setKey("");
      setEditing(false);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo comprobar la clave.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      await window.cyclelab.disconnect(provider);
      setKey("");
      setEditing(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo desconectar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="credential">
      <div className="toolbar">
        <Badge tone={configured ? "success" : "neutral"}>
          {configured ? "Clave configurada" : "Sin configurar"}
        </Badge>
        {configured && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Cambiar clave
          </Button>
        )}
        {configured && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            Desconectar
          </Button>
        )}
      </div>
      {editing && (
        <form
          className="credential-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label htmlFor={"key-" + provider}>API key de {label}</label>
          <div className="toolbar">
            <input
              id={"key-" + provider}
              type="password"
              value={key}
              autoComplete="off"
              spellCheck={false}
              placeholder="Introduce tu API key"
              disabled={busy}
              onChange={(e) => setKey(e.target.value)}
            />
            <Button type="submit" disabled={busy || key.trim().length < 8}>
              {busy ? "Comprobando…" : "Guardar y comprobar"}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}
