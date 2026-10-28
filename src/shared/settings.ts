import { z } from "zod";

export const settingsSchema = z
  .object({
    theme: z.enum(["dark", "light"]),
    source: z.enum(["demo", "garmin"]),
    model: z.string().max(200).nullable(),
    athlete: z
      .object({
        ftp: z.number().min(1).max(1000).nullable(),
        weight: z.number().min(10).max(400).nullable(),
        lthr: z.number().min(30).max(250).nullable(),
      })
      .strict(),
  })
  .strict();
