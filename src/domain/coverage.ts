import type {
  Activity,
  ActivityDetail,
  Dataset,
  SampleCoverage,
  Source,
} from "../shared/models";

export function sampleCoverage(detail: ActivityDetail | null): SampleCoverage {
  const rows = detail?.rows ?? [];
  return {
    samples: rows.length > 0,
    power: rows.some((r) => r.p !== null),
    heart: rows.some((r) => r.hr !== null),
    gps: rows.some(
      (r) =>
        r.lat != null &&
        r.lon != null &&
        Number.isFinite(r.lat) &&
        Number.isFinite(r.lon) &&
        Math.abs(r.lat) <= 90 &&
        Math.abs(r.lon) <= 180,
    ),
  };
}

export const LOAD_PROVENANCE =
  "Estimación local: CTL/ATL parten de 0; CTL 42 d, ATL 7 d y TSB = CTL − ATL de ayer. Solo se acumula el TSS disponible; el TSS desconocido se conserva como ausente y puede infraestimar la carga posterior.";
export function provenance(source: Source) {
  return source === "demo"
    ? "Datos de demostración: resúmenes, muestras y modelos ficticios."
    : "Garmin: resúmenes (potencia, FC, NP, IF, TSS, distancia y desnivel) y muestras FIT. Cálculo local: trabajo (kJ), estadísticas de tramos, zonas, mejores esfuerzos y curva de potencia. Las zonas y W/kg usan el perfil actual. " +
        LOAD_PROVENANCE;
}

export function coverageReport(
  data: Pick<Dataset, "sampleCoverage">,
  activities: Activity[],
) {
  const counts = (
    key: "power" | "heart" | "gps" | "tss" | "samples",
    label: string,
  ) => {
    const values = activities.map((a): boolean | null => {
      const samples = data.sampleCoverage[a.id];
      if (key === "tss") return a.tss !== null;
      if (key === "samples") return samples?.samples ?? false;
      if (key === "power" && (a.avgP !== null || a.np !== null)) return true;
      if (key === "heart" && a.hr !== null) return true;
      return samples?.samples ? samples[key] : null;
    });
    return {
      id: key,
      label,
      present: values.filter((v) => v === true).length,
      absent: values.filter((v) => v === false).length,
      unknown: values.filter((v) => v === null).length,
    };
  };
  return {
    total: activities.length,
    rows: [
      counts("power", "Potencia"),
      counts("heart", "FC"),
      counts("gps", "GPS"),
      counts("tss", "TSS"),
      counts("samples", "Muestras descargadas"),
    ],
    powerSamples: activities.filter((a) => data.sampleCoverage[a.id]?.power)
      .length,
    heartSamples: activities.filter((a) => data.sampleCoverage[a.id]?.heart)
      .length,
    failed: activities
      .filter((a) => a.detailStatus === "error")
      .map((a) => a.id),
    pending: activities.filter(
      (a) =>
        a.detailStatus === "pending" ||
        (!a.detailStatus && !data.sampleCoverage[a.id]?.samples),
    ).length,
    unavailable: activities.filter((a) => a.detailStatus === "unavailable")
      .length,
  };
}
export function coverageNote(
  data: Pick<Dataset, "sampleCoverage">,
  activities: Activity[],
  source: Source,
) {
  const report = coverageReport(data, activities);
  return (
    `${report.total} actividades del periodo en el histórico local. ` +
    report.rows
      .map(
        (r) =>
          `${r.label}: ${r.present} con datos, ${r.absent} sin datos, ${r.unknown} sin comprobar`,
      )
      .join(". ") +
    `. Muestras de potencia: ${report.powerSamples} actividades; muestras de FC: ${report.heartSamples}. Descargas: ${report.failed.length} fallidas, ${report.pending} pendientes, ${report.unavailable} no disponibles. La presencia de un canal no garantiza muestras completas durante toda la sesión. ` +
    provenance(source)
  );
}
