import { z } from "zod";

const profileEntry = z
  .object({
    date: z.iso.date(),
    metric: z.enum(["ftp", "weight", "lthr"]),
    value: z.number().nullable(),
    origin: z.enum(["manual", "Garmin", "demostración"]),
  })
  .strict()
  .refine(
    (e) =>
      e.value === null ||
      (e.metric === "ftp"
        ? e.value >= 1 && e.value <= 1000
        : e.metric === "weight"
          ? e.value >= 10 && e.value <= 400
          : e.value >= 30 && e.value <= 250),
    "Valor de perfil fuera de rango",
  );

export const settingsSchema = z
  .object({
    theme: z.enum(["dark", "light"]),
    source: z.enum(["demo", "garmin"]),
    model: z.string().max(200).nullable(),
    coachLimit: z.number().positive().max(100).nullable().optional(),
    welcomed: z.boolean().optional(),
    athlete: z
      .object({
        history: z
          .array(profileEntry)
          .max(10000)
          .refine(
            (entries) =>
              new Set(entries.map((e) => e.date + e.metric)).size ===
              entries.length,
            "Solo puede haber un valor por magnitud y fecha",
          )
          .optional(),
        ftp: z.number().min(1).max(1000).nullable(),
        weight: z.number().min(10).max(400).nullable(),
        lthr: z.number().min(30).max(250).nullable(),
      })
      .strict(),
  })
  .strict();
