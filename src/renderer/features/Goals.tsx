import { useState } from "react";
import type { Goal, GoalInput } from "../../shared/models";
import { DAY } from "../../domain/analysis";
import { Button, Icon, Panel, Progress, StateBlock } from "../components/ui";
import { date, number, shortDuration } from "../format";

const blank: GoalInput = {
  id: null,
  name: "",
  date: "",
  kind: "",
  target: "",
  archived: false,
};
const input = (g: Goal): GoalInput => ({
  id: g.id,
  name: g.name,
  date: new Date(g.date).toISOString().slice(0, 10),
  kind: g.kind,
  target: g.target ?? "",
  archived: !!g.archived,
});
export function Goals({
  goals,
  today,
  demo,
  ctl,
  longest,
}: {
  goals: Goal[];
  today: number;
  demo: boolean;
  ctl: number | null;
  longest: number;
}) {
  const [editing, setEditing] = useState<GoalInput | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = goals.filter((g) => !g.archived),
    archived = goals.filter((g) => g.archived);
  const save = async (goal: GoalInput) => {
    setBusy(true);
    setError("");
    try {
      await window.cyclelab.saveGoal("garmin", goal);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };
  const form = editing && (
    <form
      className="goal goal-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save(editing);
      }}
    >
      <label>
        Nombre
        <input
          required
          maxLength={100}
          value={editing.name}
          placeholder="Por ejemplo, Quebrantahuesos"
          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
        />
      </label>
      <label>
        Fecha
        <input
          required
          type="date"
          value={editing.date}
          onChange={(e) => setEditing({ ...editing, date: e.target.value })}
        />
      </label>
      <label>
        Tipo de prueba
        <input
          maxLength={100}
          value={editing.kind}
          placeholder="Marcha de carretera · 200 km"
          onChange={(e) => setEditing({ ...editing, kind: e.target.value })}
        />
      </label>
      <label>
        Objetivo personal
        <input
          maxLength={300}
          value={editing.target}
          placeholder="Terminar en menos de 8 h"
          onChange={(e) => setEditing({ ...editing, target: e.target.value })}
        />
      </label>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="toolbar">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setEditing(null);
            setError("");
          }}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" variant="primary" disabled={busy}>
          {busy ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
  return (
    <Panel
      className="goals-panel"
      title="Objetivos"
      subtitle={demo ? "Fechas orientativas" : undefined}
      actions={
        !demo &&
        !editing && (
          <Button size="sm" icon="plus" onClick={() => setEditing(blank)}>
            Nuevo objetivo
          </Button>
        )
      }
    >
      {editing?.id === null && form}
      {active.map((g) =>
        editing?.id === g.id ? (
          <div key={g.id}>{form}</div>
        ) : (
          <div className="goal" key={g.id}>
            <div className="goal-head">
              <Icon
                name="target"
                style={{ color: `var(--${g.tone ?? "brand"})` }}
              />
              <b>{g.name}</b>
              <span className="countdown">
                {g.date >= today ? (
                  <>
                    {Math.round((g.date - today) / DAY)}{" "}
                    <span className="small cl-muted">días</span>
                  </>
                ) : (
                  <span className="small cl-muted">Pasado</span>
                )}
              </span>
            </div>
            <div className="small cl-faint">
              {date(g.date)} {new Date(g.date).getUTCFullYear()}
              {g.kind && ` · ${g.kind}`}
            </div>
            {g.target && <div className="small">{g.target}</div>}
            {g.ctl !== undefined && (
              <Progress
                label="Fitness objetivo"
                valueLabel={`${number(ctl, 1)} / ${g.ctl} CTL`}
                value={ctl ?? 0}
                max={g.ctl}
                tone={g.tone}
              />
            )}
            {g.long !== undefined && (
              <Progress
                label="Salida más larga (8 sem)"
                valueLabel={`${shortDuration(longest)} / ${shortDuration(g.long)}`}
                value={longest}
                max={g.long}
                tone={g.tone}
              />
            )}
            {!demo && !editing && (
              <div className="toolbar compact">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(input(g))}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void save({ ...input(g), archived: true })}
                >
                  Archivar
                </Button>
              </div>
            )}
          </div>
        ),
      )}
      {!active.length && !editing && (
        <StateBlock
          title="Sin objetivos"
          detail={
            demo
              ? "Los objetivos de demostración no se aplican a tus datos."
              : "Añade una prueba con su fecha para darle contexto al seguimiento y al entrenador."
          }
        />
      )}
      {archived.length > 0 && (
        <details className="goals-archived">
          <summary className="small cl-muted">
            Archivados · {archived.length}
          </summary>
          {archived.map((g) => (
            <div className="goal-archived" key={g.id}>
              <span className="small">
                {g.name} · {date(g.date)} {new Date(g.date).getUTCFullYear()}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || !!editing}
                onClick={() => void save({ ...input(g), archived: false })}
              >
                Restaurar
              </Button>
            </div>
          ))}
        </details>
      )}
      {!editing && error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </Panel>
  );
}
