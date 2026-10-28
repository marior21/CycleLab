import { useState } from "react";
import type { Activity } from "../../shared/models";
import { coverageReport, provenance } from "../../domain/coverage";
import { Badge, Button, DataTable } from "../components/ui";
import type { PageProps } from "./shared";

export function Coverage({
  p,
  activities,
  period,
}: {
  p: PageProps;
  activities: Activity[];
  period: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const report = coverageReport(p.data, activities);
  const incomplete = report.rows.some((r) => r.absent || r.unknown);
  async function retry() {
    setBusy(true);
    setError("");
    try {
      await window.cyclelab.retryDownloads(report.failed);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo reintentar la descarga.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="coverage">
      <summary>
        Cobertura · {period} · {report.total} actividades{" "}
        <Badge tone={!report.total || incomplete ? "warning" : "success"}>
          {!report.total
            ? "Sin actividades"
            : incomplete
              ? "Datos incompletos"
              : "Todos los canales presentes"}
        </Badge>
      </summary>
      <div className="coverage-body">
        <DataTable
          compact
          rows={report.rows}
          columns={[
            { key: "label", label: "Datos" },
            { key: "present", label: "Con datos", align: "right" },
            { key: "absent", label: "Sin datos", align: "right" },
            { key: "unknown", label: "Sin comprobar", align: "right" },
          ]}
        />
        <p className="small cl-muted">
          Potencia y FC: resumen o muestras. Muestras de potencia:{" "}
          {report.powerSamples} actividades; muestras de FC:{" "}
          {report.heartSamples}. La curva y las zonas necesitan muestras.
        </p>
        <p className="small cl-muted">
          Cobertura del histórico local importado. Un canal presente no
          garantiza muestras completas durante toda la sesión. Sin muestras, la
          ausencia de potencia, FC o GPS queda sin comprobar.
        </p>
        <p className="small cl-muted">
          Descargas: {report.pending} pendientes · {report.failed.length}{" "}
          fallidas · {report.unavailable} no disponibles. Un FIT no disponible o
          un canal no registrado no se recuperan reintentando.
        </p>
        {report.failed.length > 0 && !p.demo && (
          <Button
            size="sm"
            disabled={busy || p.syncing}
            onClick={() => void retry()}
          >
            {busy || p.syncing
              ? "Descargando muestras…"
              : "Reintentar descargas fallidas"}
          </Button>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <p className="small cl-muted">
          {provenance(p.demo ? "demo" : "garmin")}
        </p>
      </div>
    </details>
  );
}
