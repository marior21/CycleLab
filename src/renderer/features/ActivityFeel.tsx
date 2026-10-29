import { useState } from "react";
import type {
  Activity,
  ActivityFeel as Feel,
  ActivityType,
  Fatigue,
  Source,
} from "../../shared/models";
import { Button, Panel } from "../components/ui";
import { TYPES } from "../format";

const empty: Feel = { rpe: null, fatigue: null, notes: "", type: null };
const fatigue: Record<Fatigue, string> = {
  fresh: "Fresco",
  normal: "Normal",
  tired: "Cansado",
};
export function ActivityFeel({ a, source }: { a: Activity; source: Source }) {
  const saved = a.feel ?? empty;
  const [draft, setDraft] = useState(saved),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Feel>) => setDraft({ ...draft, ...patch });
  const save = async () => {
    setBusy(true);
    setError(null);
    const feel = { ...draft, notes: draft.notes.trim() };
    try {
      await window.cyclelab.saveActivityFeel(
        source,
        a.id,
        JSON.stringify(feel) === JSON.stringify(empty) ? null : feel,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Sensaciones"
      subtitle="Lo que declaras tú; el entrenador no lo mezcla con las métricas registradas."
      actions={
        <Button
          size="sm"
          disabled={!changed || busy}
          onClick={() => void save()}
        >
          {busy ? "Guardando…" : "Guardar"}
        </Button>
      }
    >
      <div className="profile-fields">
        <label>
          Esfuerzo percibido (RPE)
          <select
            value={draft.rpe ?? ""}
            onChange={(e) =>
              set({ rpe: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">Sin indicar</option>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fatiga
          <select
            value={draft.fatigue ?? ""}
            onChange={(e) =>
              set({ fatigue: (e.target.value || null) as Fatigue | null })
            }
          >
            <option value="">Sin indicar</option>
            {Object.entries(fatigue).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Etiqueta
          <select
            value={draft.type ?? ""}
            onChange={(e) =>
              set({ type: (e.target.value || null) as ActivityType | null })
            }
          >
            <option value="">
              Automática · {TYPES[a.automaticType ?? a.type].label}
            </option>
            {Object.entries(TYPES).map(([value, t]) => (
              <option key={value} value={value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="feel-notes">
        Notas
        <textarea
          rows={2}
          maxLength={1000}
          value={draft.notes}
          placeholder="Cómo te sentiste, sueño, molestias…"
          onChange={(e) => set({ notes: e.target.value })}
        />
      </label>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </Panel>
  );
}
