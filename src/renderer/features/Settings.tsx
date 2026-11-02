import {
  profileAt,
  profileMetrics,
  utcDay,
  withProfileEntries,
} from "../../domain/athlete";
import { useEffect, useState } from "react";
import type {
  AppState,
  Model,
  MaintenanceInfo,
  Settings as SettingsValue,
} from "../../shared/models";
import {
  Badge,
  Button,
  DataTable,
  Panel,
  Progress,
  Segmented,
  StateBlock,
} from "../components/ui";
import { number } from "../format";
interface Props {
  state: AppState;
  refresh: () => Promise<void>;
  save: (patch: Partial<SettingsValue>) => Promise<void>;
}
export function Settings(p: Props) {
  const { settings: s, sync, update } = p.state;
  const [maintenance, setMaintenance] = useState<MaintenanceInfo | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  useEffect(() => {
    void window.cyclelab
      .maintenance()
      .then(setMaintenance)
      .catch(() => setMaintenance(null));
  }, [p.state]);
  async function maintain(action: () => Promise<unknown>) {
    setMaintenanceBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      await p.refresh();
      if (result)
        setNotice(
          typeof result === "string"
            ? `Diagnóstico guardado en ${result}`
            : "Datos borrados.",
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
    } finally {
      setMaintenanceBusy(false);
    }
  }
  const [models, setModels] = useState<Model[]>([]),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(false),
    [backupBusy, setBackupBusy] = useState(false),
    [reclassifying, setReclassifying] = useState(false),
    [tagMessage, setTagMessage] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [profile, setProfile] = useState(s.athlete),
    [effectiveDate, setEffectiveDate] = useState(utcDay());
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
  async function backup(restore: boolean) {
    setBackupBusy(true);
    setError("");
    setNotice("");
    try {
      const path = await (restore
        ? window.cyclelab.restoreBackup()
        : window.cyclelab.exportBackup());
      if (path) {
        await p.refresh();
        setNotice(
          restore
            ? `Copia restaurada. Copia previa guardada en ${path}`
            : `Copia guardada en ${path}`,
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la copia.",
      );
    } finally {
      setBackupBusy(false);
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
        title="Mantenimiento y privacidad"
        subtitle="Gestiona cada origen por separado. El borrado requiere confirmación."
      >
        {maintenance ? (
          <>
            <p className="small cl-muted">
              Base de datos y archivos auxiliares:{" "}
              {number(maintenance.databaseBytes / 1048576, 2)} MB · Copias
              automáticas: {number(maintenance.backupBytes / 1048576, 2)} MB
            </p>
            {maintenance.sources.map((item) => (
              <div key={item.source}>
                <p>
                  <strong>
                    {item.source === "demo" ? "Demostración" : "Garmin"}
                  </strong>{" "}
                  · {number(item.activities)} actividades ·{" "}
                  {number(item.segments)} segmentos · {number(item.messages)}{" "}
                  mensajes
                </p>
                <p className="small cl-muted">
                  Muestras: {number(item.ready)} descargadas ·{" "}
                  {number(item.pending)} pendientes · {number(item.failed)}{" "}
                  fallidas · {number(item.unavailable)} no disponibles
                </p>
                <div className="toolbar">
                  <Button
                    disabled={maintenanceBusy || sync.state === "syncing"}
                    onClick={() =>
                      void maintain(() =>
                        window.cyclelab.deleteLocal(item.source, "messages"),
                      )
                    }
                  >
                    Borrar conversaciones de{" "}
                    {item.source === "demo" ? "demostración" : "Garmin"}
                  </Button>
                  <Button
                    disabled={maintenanceBusy || sync.state === "syncing"}
                    onClick={() =>
                      void maintain(() =>
                        window.cyclelab.deleteLocal(item.source, "all"),
                      )
                    }
                  >
                    Borrar datos de{" "}
                    {item.source === "demo" ? "demostración" : "Garmin"}
                  </Button>
                </div>
              </div>
            ))}
          </>
        ) : (
          <p>No se pudo consultar el almacenamiento.</p>
        )}
        <p className="small cl-faint">
          El borrado conserva las claves y las copias existentes; no borra datos
          en Garmin. SQLite reutiliza el espacio liberado. Las copias exportadas
          fuera del perfil no se incluyen en el tamaño.
        </p>
        <Button
          disabled={maintenanceBusy}
          onClick={() =>
            void maintain(() => window.cyclelab.exportDiagnostic())
          }
        >
          Exportar diagnóstico
        </Button>
        <p className="small cl-faint">
          Incluye versión, plataforma, tamaño y contadores. No incluye claves,
          coordenadas, rutas de archivos, nombres, fechas de actividad,
          conversaciones ni registros de errores.
        </p>
      </Panel>
      <Panel
        title="Copias de seguridad"
        subtitle="Conserva actividades, segmentos, conversaciones y ajustes de ambos orígenes. Las copias no incluyen las claves."
      >
        <div className="toolbar">
          <Button disabled={backupBusy} onClick={() => void backup(false)}>
            Exportar copia
          </Button>
          <Button
            disabled={backupBusy || sync.state === "syncing"}
            onClick={() => void backup(true)}
          >
            Restaurar copia
          </Button>
          {backupBusy && (
            <span role="status" className="small cl-muted">
              Preparando copia…
            </span>
          )}
        </div>
        <p className="small cl-faint">
          Restaurar sustituye los datos locales y guarda antes una copia de
          recuperación. También se guarda una copia antes de migrar la base de
          datos. En otro Mac, configura de nuevo Garmin, OpenRouter y MapTiler.
          La copia contiene datos personales: guárdala en un lugar seguro.
        </p>
      </Panel>
      <Panel
        title="Actualizaciones"
        subtitle="CycleLab busca versiones nuevas al abrirse y cada seis horas, y las instala al cerrar la app."
      >
        <div className="toolbar">
          <Badge tone={update.status === "ready" ? "success" : "neutral"}>
            Versión {update.current}
          </Badge>
          {update.status === "ready" ? (
            <Button
              onClick={() => void maintain(window.cyclelab.installUpdate)}
            >
              Reiniciar y actualizar a {update.next}
            </Button>
          ) : (
            <Button
              disabled={update.status !== "idle" && update.status !== "error"}
              onClick={() => void maintain(window.cyclelab.checkUpdate)}
            >
              Buscar actualizaciones
            </Button>
          )}
          <span role="status" className="small cl-muted">
            {
              {
                disabled: "No disponible en la versión de desarrollo.",
                idle: "",
                checking: "Buscando…",
                downloading: "",
                ready: `La versión ${update.next} está lista.`,
                error: update.message,
              }[update.status]
            }
          </span>
        </div>
        {update.status === "downloading" && (
          <Progress
            label={`Descargando la versión ${update.next}`}
            valueLabel={`${update.percent ?? 0} %`}
            value={update.percent ?? 0}
            max={100}
          />
        )}
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
          {s.source === "garmin" && sync.state === "syncing" && (
            <>
              <Button
                disabled={maintenanceBusy}
                onClick={() =>
                  void maintain(() => window.cyclelab.stopSync("pause"))
                }
              >
                Pausar importación
              </Button>
              <Button
                disabled={maintenanceBusy}
                onClick={() =>
                  void maintain(() => window.cyclelab.stopSync("cancel"))
                }
              >
                Cancelar importación
              </Button>
            </>
          )}
        </div>
        <p className="small cl-faint">
          La sincronización recorre todo el histórico disponible, sin límite de
          temporada. En Actividades, «Todo» muestra todas las fechas
          descargadas. Pausar conserva el punto de avance; cancelar reinicia el
          recorrido de resúmenes en la próxima sincronización. Ambas opciones
          guardan la descarga en curso y conservan lo ya descargado. No se
          reanudan automáticamente al abrir la app.
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
          <label htmlFor="coach-limit">
            Límite de gasto por petición (US$)
          </label>
          <input
            id="coach-limit"
            type="number"
            min={0.001}
            max={100}
            step={0.01}
            placeholder="Sin límite"
            defaultValue={s.coachLimit ?? ""}
            onBlur={(e) => {
              const value =
                e.target.value === "" ? null : Number(e.target.value);
              if (value === (s.coachLimit ?? null)) return;
              if (value !== null && !(value > 0 && value <= 100))
                setError("El límite debe estar entre 0,001 y 100 US$.");
              else void save({ coachLimit: value });
            }}
          />
          <span className="small cl-faint">
            Antes de cada llamada se estima el coste con los precios publicados
            y el análisis se detiene si podría superar el límite. Es una
            estimación: el coste final lo determina OpenRouter.
          </span>
        </div>
      </Panel>
      <Panel title="Privacidad del entrenador">
        <p>
          Antes del primer envío real se pide aceptación. OpenRouter y el
          proveedor del modelo reciben tu pregunta, hasta 20 mensajes recientes
          de la conversación, la pantalla y actividad seleccionadas, cobertura y
          resultados de análisis con nombres, fechas y métricas.
        </p>
        <p className="small cl-muted">
          No se adjuntan GPS, FIT ni claves guardadas al contexto. El texto que
          escribas sí se envía: evita incluir secretos o ubicaciones privadas.
          La clave de OpenRouter se utiliza para autenticar la conexión. Las
          consultas pueden tener coste y están sujetas a las políticas del
          proveedor. La demo funciona localmente.
        </p>
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
        subtitle="Valores con fecha de vigencia para «Mis datos». Día local, igual que las actividades."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({
              athlete: withProfileEntries(
                s.athlete,
                profileMetrics.map((metric) => ({
                  metric,
                  value: profile[metric],
                  date: effectiveDate,
                  origin: "manual",
                })),
              ),
            });
          }}
        >
          <p className="small cl-muted">
            Los valores anteriores sin fecha se conservan como referencia
            actual; no se aplican al pasado. Un campo vacío registra un valor
            desconocido desde esa fecha. Guardar sustituye los valores de la
            misma fecha. IF y TSS importados no se recalculan.
          </p>
          <div className="profile-fields">
            <label>
              Vigente desde
              <input
                type="date"
                required
                value={effectiveDate}
                max={utcDay()}
                onChange={(e) => {
                  setEffectiveDate(e.target.value);
                  if (e.target.value)
                    setProfile(
                      profileAt(s.athlete, Date.parse(e.target.value)),
                    );
                }}
              />
            </label>
          </div>
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
          <p className="small cl-faint">
            Las zonas y W/kg se calculan localmente con el valor vigente en la
            fecha de la actividad. Añadir o corregir una fecha pasada actualiza
            esas referencias de forma explícita.
          </p>
        </form>
      </Panel>
      <Panel title="Historial del perfil" flush>
        <DataTable
          rows={[...(s.athlete.history ?? [])]
            .reverse()
            .map((e) => ({ ...e, id: e.date + e.metric }))}
          columns={[
            { key: "date", label: "Vigente desde" },
            {
              key: "metric",
              label: "Magnitud",
              render: (e) =>
                e.metric === "weight" ? "Peso" : e.metric.toUpperCase(),
            },
            {
              key: "value",
              label: "Valor",
              align: "right",
              render: (e) =>
                e.value === null
                  ? "Desconocido"
                  : number(e.value, e.metric === "weight" ? 1 : 0) +
                    (e.metric === "weight"
                      ? " kg"
                      : e.metric === "ftp"
                        ? " W"
                        : " ppm"),
            },
            { key: "origin", label: "Procedencia" },
            {
              key: "edit",
              label: "",
              render: (e) => (
                <Button
                  size="sm"
                  onClick={() => {
                    setEffectiveDate(e.date);
                    setProfile(profileAt(s.athlete, Date.parse(e.date)));
                  }}
                >
                  Editar {e.date}
                </Button>
              ),
            },
          ]}
          empty="Sin valores con fecha de vigencia"
        />
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
