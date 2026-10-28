import type { MapResource } from "../shared/models";
import { HttpError, request, type Fetcher } from "./http";

const ORIGIN = "https://api.maptiler.com";
export function mapResourceURL(path: string) {
  if (
    path.length > 4096 ||
    !/^\/(maps|tiles|fonts|sprites|resources)\//.test(path) ||
    /[\\\r\n#]/.test(path)
  )
    throw new Error("Recurso de mapa no permitido.");
  const url = new URL(path, ORIGIN);
  if (
    url.origin !== ORIGIN ||
    !/^\/(maps|tiles|fonts|sprites|resources)\//.test(url.pathname) ||
    decodeURIComponent(url.pathname)
      .split("/")
      .some((s) => s === ".." || s === ".")
  )
    throw new Error("Recurso de mapa no permitido.");
  url.searchParams.delete("key");
  return url;
}
export function sanitizeMapJSON(value: unknown, key: string): unknown {
  if (typeof value === "string") {
    if (value.startsWith(ORIGIN + "/")) {
      const url = mapResourceURL(value.slice(ORIGIN.length));
      return (
        "cyclemap://" +
        url.host +
        url.pathname.replace(/%7B/gi, "{").replace(/%7D/gi, "}") +
        url.search
      );
    }
    return value.replaceAll(key, "[redacted]");
  }
  if (Array.isArray(value)) return value.map((v) => sanitizeMapJSON(v, key));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !["key", "apiKey"].includes(k))
        .map(([k, v]) => [k, sanitizeMapJSON(v, key)]),
    );
  return value;
}
export class MapTilerSource {
  private cache = new Map<
    string,
    { value: MapResource; expires: number; size: number }
  >();
  private pending = new Map<string, Promise<MapResource>>();
  private generation = 0;
  private blockedUntil = 0;
  constructor(
    private key: () => string,
    private fetcher: Fetcher = (...args) => fetch(...args),
  ) {}
  clear() {
    this.cache.clear();
    this.pending.clear();
    this.blockedUntil = 0;
    this.generation++;
  }
  async validate() {
    const result = await this.resource("/maps/outdoor-v4/style.json");
    if (
      result.kind !== "json" ||
      result.data.version !== 8 ||
      !result.data.sources ||
      !Array.isArray(result.data.layers)
    )
      throw new Error("MapTiler no devolvió un estilo de mapa válido.");
  }
  async resource(path: string): Promise<MapResource> {
    const url = mapResourceURL(path),
      key = this.key();
    const cacheKey = url.pathname + url.search;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.value;
    if (this.blockedUntil > Date.now())
      throw new Error(
        "Límite de MapTiler alcanzado. Espera antes de reintentar.",
      );
    const pending = this.pending.get(cacheKey);
    if (pending) return pending;
    const generation = this.generation;
    const task = this.download(url, key)
      .then(({ value, size, maxAge }) => {
        if (generation !== this.generation)
          throw new Error(
            "La configuración de MapTiler ha cambiado. Reintenta el mapa.",
          );
        if (maxAge > 0) {
          this.cache.set(cacheKey, {
            value,
            size,
            expires: Date.now() + maxAge * 1000,
          });
          let total = [...this.cache.values()].reduce(
            (n, entry) => n + entry.size,
            0,
          );
          while (total > 32 * 1024 * 1024 || this.cache.size > 256) {
            const oldest = this.cache.keys().next().value!;
            total -= this.cache.get(oldest)!.size;
            this.cache.delete(oldest);
          }
        }
        return value;
      })
      .finally(() => {
        if (this.pending.get(cacheKey) === task) this.pending.delete(cacheKey);
      });
    this.pending.set(cacheKey, task);
    return task;
  }
  private async download(url: URL, key: string) {
    url.searchParams.set("key", key);
    let response: Response;
    try {
      response = await request(
        url.href,
        { redirect: "error" },
        this.fetcher,
        0,
      );
    } catch (e) {
      if (e instanceof HttpError && e.status === 429)
        this.blockedUntil = Date.now() + Math.max(1000, e.retryAfter ?? 60000);
      if (e instanceof HttpError && [401, 403].includes(e.status))
        throw new Error(
          "MapTiler: clave no válida o restringida. Comprueba los permisos para esta app de escritorio.",
        );
      throw new Error(
        e instanceof HttpError && e.status === 429
          ? "Límite de MapTiler alcanzado. Inténtalo más tarde."
          : "No se pudo cargar MapTiler. Comprueba la conexión y la configuración.",
      );
    }
    // MapTiler uses 204 for tiles with no features or imagery in this area.
    if (
      response.status === 204 &&
      url.pathname.startsWith("/tiles/") &&
      !url.pathname.endsWith(".json")
    )
      return {
        value: { kind: "binary" as const, data: new Uint8Array() },
        size: 0,
        maxAge: 0,
      };
    const reader = response.body?.getReader();
    if (!reader) throw new Error("MapTiler devolvió una respuesta vacía.");
    const parts: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("size");
        }
        parts.push(value);
      }
    } catch {
      throw new Error("No se pudo descargar el recurso de MapTiler.");
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    let value: MapResource;
    if (
      response.headers.get("content-type")?.includes("json") ||
      url.pathname.endsWith(".json")
    ) {
      try {
        const data = sanitizeMapJSON(
          JSON.parse(new TextDecoder().decode(bytes)),
          key,
        );
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw new Error("json");
        value = { kind: "json", data: data as Record<string, unknown> };
      } catch {
        throw new Error("MapTiler devolvió un recurso no válido.");
      }
    } else value = { kind: "binary", data: bytes };
    const control = response.headers.get("cache-control") ?? "";
    const maxAge = /no-store|no-cache/.test(control)
      ? 0
      : Math.min(3600, Number(control.match(/max-age=(\d+)/)?.[1] ?? 0));
    return { value, size, maxAge };
  }
}
