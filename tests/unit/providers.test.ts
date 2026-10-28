import { describe, it, expect, vi } from "vitest";
import { GarminPersonalSource, normalizeActivity } from "../../src/main/garmin";
import { OpenRouterCoachProvider, AnalysisTools } from "../../src/main/coach";
import { HttpError, request } from "../../src/main/http";
import { demoDataset, DemoGarminSource } from "../../src/data/demo/provider";
import type { Store } from "../../src/main/store";
import type { ChatMessage } from "../../src/shared/models";
const response = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) => new Response(JSON.stringify(data), { status, headers });
const row = {
  activityId: 123,
  activityName: "Rodaje",
  startTimeGMT: "2026-10-25 08:00:00",
  duration: 3600,
  distance: 30000,
  activityType: { typeKey: "road_biking" },
};
describe("Garmin Personal contract", () => {
  it.each([false, true])(
    "accepts a JWT response (JSON string: %s) and uses it as Bearer",
    async (json) => {
      const token =
        "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE5MDAwMDAwMDB9.test_signature";
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(json ? JSON.stringify(token) : "  " + token + "\n"),
        )
        .mockResolvedValueOnce(response([row]));
      const source = new GarminPersonalSource(() => "test-key", fetcher);
      expect(await source.listActivities(0, 99)).toHaveLength(1);
      expect(fetcher.mock.calls[1][1]?.headers).toEqual({
        Authorization: "Bearer " + token,
      });
    },
  );
  it.each([
    "",
    "<html>private-token</html>",
    '{"access_token":"private-token"',
    '{"access_token":"private-token\\nheader"}',
    "private-token",
  ])(
    "rejects malformed authentication without exposing the response: %s",
    async (body) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(body));
      await expect(
        new GarminPersonalSource(() => "test-key", fetcher).authenticate(),
      ).rejects.toThrow(
        "Garmin devolvió una respuesta de autenticación no válida. Vuelve a intentarlo.",
      );
    },
  );
  it("converts units and retains absent metrics", () => {
    expect(normalizeActivity(row)).toMatchObject({
      id: "123",
      dist: 30,
      np: null,
      hr: null,
      tss: null,
    });
    expect(() =>
      normalizeActivity({ ...row, activityId: Number.MAX_SAFE_INTEGER + 2 }),
    ).toThrow();
  });
  it("authenticates, paginates, and renews once after 401", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ access_token: "first", expires_in: 86400 }),
      )
      .mockResolvedValueOnce(response({}, 401))
      .mockResolvedValueOnce(
        response({ access_token: "second", expires_in: 86400 }),
      )
      .mockResolvedValueOnce(response([row]));
    const source = new GarminPersonalSource(() => "test-key", fetcher);
    expect(await source.listActivities(99, 99)).toHaveLength(1);
    expect(fetcher.mock.calls[1][0]).toContain("start=99&limit=99");
    expect(fetcher.mock.calls[3][1]?.headers).toEqual({
      Authorization: "Bearer second",
    });
  });
  it("does not endlessly refresh a revoked key", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ access_token: "first" }))
      .mockResolvedValueOnce(response({}, 401))
      .mockResolvedValueOnce(response({ access_token: "second" }))
      .mockResolvedValueOnce(response({}, 401));
    await expect(
      new GarminPersonalSource(() => "test-key", fetcher).listActivities(0, 99),
    ).rejects.toBeInstanceOf(HttpError);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("reports long Retry-After instead of hammering the service", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({}, 429, { "retry-after": "120" }));
    await expect(
      request("https://example.test", {}, fetcher),
    ).rejects.toMatchObject({ status: 429, retryAfter: 120000 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("retries transient server errors within bounds", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response([]));
    const pending = request("https://example.test", {}, fetcher);
    await vi.runAllTimersAsync();
    expect((await pending).ok).toBe(true);
    vi.useRealTimers();
  });
});
describe("OpenRouter", () => {
  const history: ChatMessage[] = [
    {
      id: "1",
      role: "user",
      text: "Analiza mi carga",
      status: "done",
      tools: [],
      createdAt: 1,
    },
  ];
  it("filters incompatible models and converts pricing units", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        data: [
          {
            id: "good",
            name: "Good",
            context_length: 1000,
            supported_parameters: ["tools"],
            pricing: { prompt: "0.000001", completion: "0.000002" },
          },
          {
            id: "bad",
            name: "Bad",
            context_length: 1000,
            supported_parameters: [],
            pricing: { prompt: "0", completion: "0" },
          },
        ],
      }),
    );
    const provider = new OpenRouterCoachProvider(
      () => "key",
      "good",
      {} as AnalysisTools,
      fetcher,
    );
    expect(await provider.models()).toEqual([
      {
        id: "good",
        name: "Good",
        context: 1000,
        promptPrice: 1,
        completionPrice: 2,
      },
    ]);
  });
  it("executes a bounded tool loop and returns the same tool result to UI and model", async () => {
    const tool = {
      tool: "carga_entrenamiento" as const,
      args: "{}",
      title: "Carga",
      kind: "line" as const,
      rows: [{ x: 0, ctl: 42 }],
      series: [],
    };
    const run = vi.fn().mockReturnValue(tool);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: "tool-1",
                    type: "function",
                    function: {
                      name: "carga_entrenamiento",
                      arguments: '{"dias":30}',
                    },
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({ choices: [{ message: { content: "Tu CTL es 42." } }] }),
      );
    const onTool = vi.fn();
    const provider = new OpenRouterCoachProvider(
      () => "key",
      "chosen",
      {
        run,
        selection: () => null,
        coverage: () => "Cobertura de prueba: 2 actividades sin TSS.",
      } as unknown as AnalysisTools,
      fetcher,
    );
    expect(
      await provider.respond(history, { screen: "dashboard" }, onTool),
    ).toBe("Tu CTL es 42.");
    expect(onTool).toHaveBeenCalledWith(tool);
    const body = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(body.model).toBe("chosen");
    expect(body.messages[0].content).toContain("2 actividades sin TSS");
    expect(JSON.parse(body.messages.at(-1).content)).toEqual(tool);
  });
  it("never selects a default model or falls back to a demo response", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      new OpenRouterCoachProvider(
        () => "key",
        null,
        {} as AnalysisTools,
        fetcher,
      ).respond(history, { screen: "coach" }, () => {}),
    ).rejects.toThrow("Elige un modelo");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("stops after five tool rounds", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      response({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "x",
                  type: "function",
                  function: { name: "carga_entrenamiento", arguments: "{}" },
                },
              ],
            },
          },
        ],
      }),
    );
    const tools = {
      run: () => ({ rows: [], series: [] }),
      selection: () => null,
      coverage: () => "Sin datos",
    } as unknown as AnalysisTools;
    await expect(
      new OpenRouterCoachProvider(
        () => "key",
        "chosen",
        tools,
        fetcher,
      ).respond(history, { screen: "coach" }, () => {}),
    ).rejects.toThrow("límite");
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
});

it("sends the exact locally computed selection to OpenRouter even without model tool calls", async () => {
  const activity = demoDataset.activities[0];
  const detail = await new DemoGarminSource().getActivity(activity.id);
  const store = {
    dataset: () => demoDataset,
    detail: () => detail,
  } as unknown as Store;
  const tools = new AnalysisTools(store, "demo");
  const context = {
    screen: "activities" as const,
    activityId: activity.id,
    ranges: [
      [0, 5],
      [20, 25],
      [40, 45],
      [60, 65],
    ] as [number, number][],
  };
  const onTool = vi.fn();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      response({ choices: [{ message: { content: "Cuatro tramos." } }] }),
    );
  const provider = new OpenRouterCoachProvider(
    () => "test-key",
    "chosen",
    tools,
    fetcher,
  );
  await provider.respond([], context, onTool);
  const selection = tools.selection(context);
  expect(onTool).toHaveBeenCalledWith(selection);
  const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(body.messages[0].content).toContain(JSON.stringify(selection));
  expect(body.messages[0].content).not.toMatch(/"(lat|lon|points)":/);
  expect(
    body.tools.find(
      (t: { function: { name: string } }) =>
        t.function.name === "buscar_actividades",
    ).function.parameters.properties,
  ).toHaveProperty("desde");
});
