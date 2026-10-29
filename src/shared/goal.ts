import { z } from "zod";

export const goalSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    date: z.number().int(),
    kind: z.string().trim().max(100),
    target: z.string().trim().max(300),
    archived: z.boolean(),
  })
  .strict();
export const goalInputSchema = goalSchema
  .omit({ id: true, date: true })
  .extend({ id: z.string().uuid().nullable(), date: z.iso.date() })
  .strict();
