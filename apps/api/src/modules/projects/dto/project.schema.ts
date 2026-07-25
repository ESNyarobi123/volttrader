import { z } from "zod";
import { ProjectCategory, ProjectStatus } from "@volt/config";

const milestoneSchema = z.object({
  title: z.string().min(1).max(200),
  done: z.boolean().default(false),
});

export const projectUpsertSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  category: z.nativeEnum(ProjectCategory),
  status: z.nativeEnum(ProjectStatus).optional(),
  summary: z.string().min(2).max(500),
  description: z.string().min(2),
  milestones: z.array(milestoneSchema).optional(),
  order: z.number().int().min(0).optional(),
});
export type ProjectUpsertInput = z.infer<typeof projectUpsertSchema>;

export const projectUpdateSchema = projectUpsertSchema.partial();
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
