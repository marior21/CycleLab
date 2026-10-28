import { expect, it, vi } from "vitest";
import {
  MapTilerSource,
  mapResourceURL,
  sanitizeMapJSON,
} from "../../src/main/maptiler";
const secret = "private-test-key";
const style = {
  version: 8,
  sources: {
    base: {
      type: "vector",
      url: `https://api.maptiler.com/tiles/v4/tiles.json?key=${secret}`,
    },
  },
  glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${secret}`,
  sprite: `https://api.maptiler.com/maps/outdoor-v4/sprite?key=${secret}`,
  logo: "https://api.maptiler.com/resources/logo.svg",
  layers: [],
};
it("strips keys, preserves resource templates and rejects non-map destinations", () => {
  const clean = JSON.stringify(sanitizeMapJSON(style, secret));
  expect(clean).not.toContain(secret);
  expect(clean).toContain("cyclemap://api.maptiler.com/resources/logo.svg");
  expect(clean).toContain(
    "cyclemap://api.maptiler.com/fonts/{fontstack}/{range}.pbf",
  );
  for (const path of [
    "https://evil.test/x",
    "//evil.test/maps/x",
    "/maps/../../admin",
    "/secret",
    "/maps/../admin",
    "/maps/x#secret",
  ])
    expect(() => mapResourceURL(path)).toThrow();
});
it("validates credentials and coalesces/cache requests without returning the key", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify(style), {
        headers: {
          "content-type": "application/json",
          "cache-control": "max-age=60",
        },
      }),
  );
  const source = new MapTilerSource(() => secret, fetcher);
  await source.validate();
  await source.validate();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const data = await source.resource("/maps/outdoor-v4/style.json");
  expect(JSON.stringify(data)).not.toContain(secret);
  source.clear();
  await Promise.all([source.validate(), source.validate()]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("returns binary tiles and respects no-store", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "cache-control": "no-store" },
      }),
  );
  const source = new MapTilerSource(() => secret, fetcher);
  expect(await source.resource("/tiles/v4/0/0/0.pbf")).toEqual({
    kind: "binary",
    data: new Uint8Array([1, 2, 3]),
  });
  await source.resource("/tiles/v4/0/0/0.pbf");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("does not leak provider bodies, fetch errors or invalid JSON", async () => {
  for (const response of [
    () => Promise.resolve(new Response(secret, { status: 403 })),
    () => Promise.reject(new Error(secret)),
    () =>
      Promise.resolve(
        new Response(secret, {
          headers: { "content-type": "application/json" },
        }),
      ),
  ]) {
    const source = new MapTilerSource(() => secret, response);
    await expect(source.validate()).rejects.not.toThrow(secret);
  }
});
it("accepts 204 empty tiles but rejects missing style and TileJSON bodies", async () => {
  const source = new MapTilerSource(
    () => secret,
    async () => new Response(null, { status: 204 }),
  );
  for (const extension of ["pbf", "png"])
    expect(await source.resource(`/tiles/v4/0/0/0.${extension}`)).toEqual({
      kind: "binary",
      data: new Uint8Array(),
    });
  await expect(source.validate()).rejects.toThrow("respuesta vacía");
  await expect(source.resource("/tiles/v4/tiles.json")).rejects.toThrow(
    "respuesta vacía",
  );
});
it("backs off after 429 without hammering the provider", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response("limit", { status: 429, headers: { "retry-after": "60" } }),
  );
  const source = new MapTilerSource(() => secret, fetcher);
  await expect(source.validate()).rejects.toThrow("Límite");
  await expect(source.validate()).rejects.toThrow("Límite");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
