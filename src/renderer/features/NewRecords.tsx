import { useMemo, useState } from "react";
import { newRecords, type PeriodBest } from "../../domain/powerCurve";
import { Button, DataTable, Panel } from "../components/ui";
import { date, effort, number } from "../format";
import type { PageProps } from "./shared";

/** Power records from activities that arrived after the last acknowledgement. */
export function NewRecords({ p }: { p: PageProps }) {
  const since = p.recordsSince,
    [error, setError] = useState("");
  const records = useMemo(
    () => (since === null ? [] : newRecords(p.data, since)),
    [p.data, since],
  );
  if (since === null || !records.length) return null;
  const names = new Map(p.data.activities.map((a) => [a.id, a.name]));
  const open = (r: PeriodBest) => (
    <Button
      size="sm"
      variant="ghost"
      title={date(r.date, true)}
      onClick={() =>
        p.openActivity(
          r.activityId,
          r.i0 !== undefined && r.i1 !== undefined ? [r.i0, r.i1] : undefined,
        )
      }
    >
      {names.get(r.activityId) ?? "Actividad"}
    </Button>
  );
  const dismiss = () =>
    // Up to the newest record only: later activities still waiting for samples stay pending.
    window.cyclelab
      .markRecordsSeen(
        p.demo ? "demo" : "garmin",
        Math.max(...records.map((r) => r.date)),
      )
      .catch((e: Error) => setError(e.message));
  return (
    <Panel
      title="Nuevas marcas de potencia"
      subtitle={`Desde tu última revisión del ${date(since)}`}
      actions={
        <Button size="sm" onClick={() => void dismiss()}>
          Entendido
        </Button>
      }
    >
      <DataTable
        compact
        rowKey="t"
        rows={records}
        columns={[
          { key: "t", label: "Duración", render: (r) => effort(r.t) },
          {
            key: "p",
            label: "Nueva",
            align: "right",
            render: (r) => `${number(r.p)} W`,
          },
          {
            key: "previous",
            label: "Anterior",
            align: "right",
            render: (r) => `${number(r.previous.p)} W`,
          },
          {
            key: "gain",
            label: "Mejora",
            align: "right",
            render: (r) =>
              `+${number(r.p - r.previous.p)} W (+${number(((r.p - r.previous.p) / r.previous.p) * 100, 1)} %)`,
          },
          { key: "activity", label: "Tramo", render: (r) => open(r) },
          {
            key: "before",
            label: "Marca anterior",
            render: (r) => open(r.previous),
          },
        ]}
      />
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="small cl-muted">
        Comparadas con todo tu histórico hasta esa fecha. Solo cuentan ventanas
        con potencia registrada en todo el tramo; un pico aislado del medidor
        también puede aparecer como marca.
      </div>
    </Panel>
  );
}
