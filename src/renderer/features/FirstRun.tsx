import type { AppState } from "../../shared/models";
import { Button, Icon, Panel } from "../components/ui";

/** First steps until Garmin has synced once or the user hides them. */
export function FirstRun(p: {
  state: AppState;
  settings: () => void;
  sync: () => void;
  hide: () => void;
}) {
  const s = p.state.settings,
    athlete = p.state.settings.athlete;
  const steps = [
    {
      title: "Explora la demo",
      detail:
        "Todo lo que ves ahora son datos de demostración: recorre las pantallas o pregunta al entrenador sin conectar nada.",
      done: true,
    },
    {
      title: "Conecta Garmin",
      detail:
        "En Ajustes, guarda tu API key de Garmin Connect Personal y elige «Mis datos».",
      done: s.garminConfigured,
      action: (
        <Button size="sm" onClick={p.settings}>
          Abrir Ajustes
        </Button>
      ),
    },
    {
      title: "Completa tu perfil",
      detail:
        "FTP, peso y LTHR con su fecha: zonas, W/kg y carga dependen de ellos.",
      done: !!athlete.ftp && !!athlete.weight && !!athlete.lthr,
      action: (
        <Button size="sm" variant="secondary" onClick={p.settings}>
          Editar perfil
        </Button>
      ),
    },
    {
      title: "Primera sincronización",
      detail:
        "Importa todo tu histórico. Puedes seguir usando la app mientras descarga.",
      done: !!p.state.sync.lastSync,
      action: (
        <Button
          size="sm"
          variant="secondary"
          icon="sync"
          disabled={!s.garminConfigured || p.state.sync.state === "syncing"}
          onClick={p.sync}
        >
          Sincronizar ahora
        </Button>
      ),
    },
  ];
  return (
    <Panel
      className="first-run"
      title="Primeros pasos"
      subtitle="OpenRouter (entrenador) y MapTiler (mapas) pueden configurarse después en Ajustes."
      actions={
        <Button size="sm" variant="ghost" onClick={p.hide}>
          Ocultar
        </Button>
      }
    >
      <ol>
        {steps.map((step) => (
          <li key={step.title} className={step.done ? "done" : undefined}>
            <div className="grow">
              <div className="first-run-title toolbar compact">
                <span className="first-run-mark" aria-hidden="true">
                  {step.done && <Icon name="check" size={14} />}
                </span>
                {step.title}
                {step.done && <span className="sr-only"> (hecho)</span>}
              </div>
              <div className="small cl-faint">{step.detail}</div>
            </div>
            {!step.done && step.action}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
