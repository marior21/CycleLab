import { z } from "zod";

export const activityFeelSchema = z
  .object({
    rpe: z.number().int().min(1).max(10).nullable(),
    fatigue: z.enum(["fresh", "normal", "tired"]).nullable(),
    notes: z.string().trim().max(1000),
    type: z
      .enum([
        "endurance",
        "intervals",
        "climb",
        "mtb",
        "indoor",
        "gravel",
        "cycling",
      ])
      .nullable(),
  })
  .strict();
