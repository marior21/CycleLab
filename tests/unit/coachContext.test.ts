import { expect, it } from "vitest";
import { coachContextSchema } from "../../src/shared/coachContext";

it("accepts bounded references and rejects invalid or contradictory selections at IPC", () => {
  expect(
    coachContextSchema.parse({
      screen: "activities",
      activityId: "a",
      ranges: [
        [0, 5],
        [20, 25],
      ],
    }).ranges,
  ).toHaveLength(2);
  for (const extra of [
    { ranges: [[0, 1]] },
    { activityId: "a", ranges: [[3, 1]] },
    { activityId: "a", ranges: [[-1, 2]] },
    { activityId: "a", ranges: [[0.5, 2]] },
    { activityId: "a", ranges: Array(101).fill([0, 1]) },
    { comparison: ["a", "a"] },
    { comparison: ["a", "b"], segmentId: "s" },
    { lat: 42 },
  ])
    expect(() =>
      coachContextSchema.parse({ screen: "activities", ...extra }),
    ).toThrow();
});
