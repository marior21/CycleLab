import { z } from "zod";

/** Manual work blocks as [start, end] elapsed seconds; empty means «none». */
export const activityBlocksSchema = z
  .array(
    z
      .tuple([z.number().finite().nonnegative(), z.number().finite()])
      .refine(([x0, x1]) => x1 > x0),
  )
  .max(200);
