import { z } from "zod";

export const coachContextSchema = z
  .object({
    screen: z.enum([
      "dashboard",
      "activities",
      "performance",
      "segments",
      "climbs",
      "coach",
      "settings",
    ]),
    activityId: z.string().min(1).max(100).optional(),
    ranges: z
      .array(
        z
          .tuple([
            z.number().int().nonnegative(),
            z.number().int().nonnegative(),
          ])
          .refine(([start, end]) => start <= end, "Tramo inválido"),
      )
      .min(1)
      .max(100)
      .optional(),
    comparison: z
      .tuple([z.string().min(1).max(100), z.string().min(1).max(100)])
      .refine(([a, b]) => a !== b, "Elige dos actividades distintas")
      .optional(),
    segmentId: z.string().min(1).max(100).optional(),
  })
  .strict()
  .refine((c) => !c.ranges || !!c.activityId, "Falta la actividad del tramo")
  .refine(
    (c) => !c.comparison || (!c.ranges && !c.segmentId),
    "Contexto incompatible",
  );
