export class HttpError extends Error {
  constructor(
    public status: number,
    public retryAfter: number | null = null,
  ) {
    super(
      status === 401 || status === 403
        ? "La credencial no es válida, ha caducado o no tiene permisos."
        : status === 402
          ? "Saldo insuficiente en OpenRouter."
          : status === 429
            ? "Se ha alcanzado el límite de peticiones. Inténtalo más tarde."
            : status === 404
              ? "El recurso o modelo solicitado no está disponible."
              : `El servicio devolvió un error (${status}).`,
    );
  }
}
export type Fetcher = typeof fetch;
export async function request(
  url: string,
  init: RequestInit = {},
  fetcher: Fetcher = fetch,
  retries = 2,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(30000),
      });
    } catch {
      throw new Error(
        "No se pudo conectar con el servicio. Comprueba la conexión e inténtalo de nuevo.",
      );
    }
    if (response.ok) return response;
    const raw = response.headers.get("retry-after"),
      delay = raw
        ? Number.isFinite(Number(raw))
          ? Number(raw) * 1000
          : Math.max(0, Date.parse(raw) - Date.now())
        : null;
    if (
      (response.status === 429 || response.status >= 500) &&
      attempt < retries &&
      (delay ?? 0) <= 30000
    ) {
      await new Promise((r) => setTimeout(r, delay ?? 1000 * 2 ** attempt));
      continue;
    }
    throw new HttpError(response.status, delay);
  }
}
