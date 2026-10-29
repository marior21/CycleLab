import { useMemo, useState } from "react";
import type { Activity, Sample, Source } from "../../shared/models";
import {
  blockPattern,
  detectWorkBlocks,
  savedBlocks,
  type WorkBlock,
} from "../../domain/workBlocks";
import { Button, DataTable, Panel, StateBlock } from "../components/ui";
import { duration, number } from "../format";

/** Work blocks proposed on the power signal, correctable by hand. */
export function WorkBlocks(p: {
  a: Activity;
  rows: Sample[];
  source: Source;
  ftp: number | null;
  range: [number, number] | null;
  select: (range: [number, number] | null) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const manual = p.a.blocks;
  const blocks = useMemo(
    () =>
      manual ? savedBlocks(p.rows, manual) : detectWorkBlocks(p.rows, p.ftp),
    [p.rows, p.ftp, manual],
  );
  const pattern = useMemo(() => blockPattern(p.rows, blocks), [p.rows, blocks]);
  const hasPower = p.rows.some((r) => r.p !== null);
  const save = async (next: [number, number][] | null) => {
    setBusy(true);
    setError("");
    try {
      await window.cyclelab.saveActivityBlocks(p.source, p.a.id, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };
  const ranges = (list: WorkBlock[]) =>
    list.map((b): [number, number] => [b.x0, b.x1]);
  const selected = blocks.find(
    (b) => p.range && b.i0 === p.range[0] && b.i1 === p.range[1],
  );
  return (
    <Panel
      flush
      className="work-blocks"
      title="Bloques de trabajo"
      subtitle={
        manual
          ? "Corregidos a mano · la sincronización y «Volver a etiquetar todo» los conservan"
          : "Propuestos sobre la potencia · empiezan por encima del 88 % del FTP y terminan por debajo del 75 %"
      }
      actions={
        <div className="toolbar compact">
          <Button
            size="sm"
            disabled={busy || !p.range || !!selected}
            onClick={() =>
              p.range &&
              void save([
                ...ranges(blocks),
                [p.rows[p.range[0]].x, p.rows[p.range[1]].x],
              ])
            }
          >
            Añadir selección
          </Button>
          {manual && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void save(null)}
            >
              Restablecer propuesta
            </Button>
          )}
        </div>
      }
    >
      {pattern && (
        <p className="small block-pattern">
          Patrón: {pattern.repetitions} × {duration(pattern.workSeconds)} a{" "}
          {number(pattern.workWatts)} W, recuperación a{" "}
          {number(pattern.recoveryWatts)} W. La repetición indica estructura, no
          la intención del entrenamiento.
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <DataTable
        compact
        rowKey="x0"
        rows={blocks}
        selected={selected?.x0}
        onSelect={(_key, b) => p.select(b === selected ? null : [b.i0, b.i1])}
        onEscape={() => p.select(null)}
        columns={[
          {
            key: "x0",
            label: "Inicio",
            render: (b) => duration(b.x0),
          },
          {
            key: "dur",
            label: "Duración",
            align: "right",
            render: (b) => duration(b.dur),
          },
          {
            key: "avgP",
            label: "Pot. media",
            align: "right",
            render: (b) =>
              number(b.avgP) +
              " W" +
              (p.ftp && b.avgP !== null
                ? ` · ${number((b.avgP / p.ftp) * 100)} %`
                : ""),
          },
          {
            key: "hr",
            label: "FC",
            align: "right",
            render: (b) => number(b.hr) + " ppm",
          },
          {
            key: "discard",
            label: "",
            align: "right",
            render: (b) => (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                aria-label={`Descartar el bloque de ${duration(b.x0)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (b === selected) p.select(null);
                  void save(ranges(blocks.filter((other) => other !== b)));
                }}
              >
                Descartar
              </Button>
            ),
          },
        ]}
        empty={
          <StateBlock
            title={
              !hasPower
                ? "Sin potencia para proponer bloques"
                : !p.ftp && !manual
                  ? "Falta el FTP de esta fecha"
                  : "Sin bloques de trabajo"
            }
            detail={
              !hasPower
                ? undefined
                : !p.ftp && !manual
                  ? "Indica tu FTP en Ajustes para proponer bloques; también puedes añadir una selección."
                  : "Selecciona un tramo y pulsa «Añadir selección» para marcarlo."
            }
          />
        }
      />
    </Panel>
  );
}
