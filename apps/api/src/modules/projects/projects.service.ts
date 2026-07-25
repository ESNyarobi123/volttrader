import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Project } from "@prisma/client";
import type { ProjectView } from "@volt/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { ProjectUpsertInput, ProjectUpdateInput } from "./dto/project.schema";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toView(project: Project): ProjectView {
    const milestones = Array.isArray(project.milestones)
      ? (project.milestones as { title: string; done: boolean }[])
      : [];
    return {
      id: project.id,
      slug: project.slug,
      title: project.title,
      category: project.category,
      status: project.status,
      summary: project.summary,
      description: project.description,
      coverUrl: project.coverKey ?? null,
      milestones,
    };
  }

  async listPublic(): Promise<ProjectView[]> {
    const projects = await this.prisma.project.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return projects.map((p) => this.toView(p));
  }

  async getBySlug(slug: string): Promise<ProjectView> {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project) throw new NotFoundException("Project not found");
    return this.toView(project);
  }

  async create(input: ProjectUpsertInput): Promise<ProjectView> {
    const project = await this.prisma.project.create({
      data: {
        title: input.title,
        slug: input.slug,
        category: input.category,
        status: input.status ?? "PLANNED",
        summary: input.summary,
        description: input.description,
        milestones: (input.milestones ?? []) as Prisma.InputJsonValue,
        order: input.order ?? 0,
      },
    });
    return this.toView(project);
  }

  async update(id: string, input: ProjectUpdateInput): Promise<ProjectView> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Project not found");

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        title: input.title,
        slug: input.slug,
        category: input.category,
        status: input.status,
        summary: input.summary,
        description: input.description,
        ...(input.milestones !== undefined
          ? { milestones: input.milestones as Prisma.InputJsonValue }
          : {}),
        order: input.order,
      },
    });
    return this.toView(project);
  }

  async delete(id: string, actorId: string): Promise<{ id: string; deleted: true }> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Project not found");

    await this.prisma.project.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: "project.deleted",
      entityType: "Project",
      entityId: id,
      metadata: { slug: existing.slug },
    });

    return { id, deleted: true };
  }
}
