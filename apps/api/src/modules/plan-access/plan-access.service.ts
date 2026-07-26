import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PlanAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Highest ACTIVE Forex plan for the user (by sortOrder). */
  async getActiveCoursePlan(userId: string) {
    const sub = await this.prisma.coursePlanSubscription.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { coursePlan: true },
      orderBy: { coursePlan: { sortOrder: "desc" } },
    });
    return sub?.coursePlan ?? null;
  }

  /** Highest ACTIVE management plan for the user. */
  async getActiveInvestmentPlan(userId: string) {
    const sub = await this.prisma.investmentPlanSubscription.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { investmentPlan: true },
      orderBy: { investmentPlan: { sortOrder: "desc" } },
    });
    return sub?.investmentPlan ?? null;
  }

  /**
   * User can access a course if they hold a plan with sortOrder >= the course's plan.
   * Courses without a plan stay locked behind membership (except FREE accessType for legacy).
   */
  async canAccessCourse(
    userId: string,
    course: { coursePlanId: string | null; accessType: string },
  ): Promise<boolean> {
    if (!course.coursePlanId) {
      // Untagged legacy: FREE courses remain open; PAID need enrollment-only path.
      return course.accessType === "FREE";
    }
    const coursePlan = await this.prisma.coursePlan.findUnique({
      where: { id: course.coursePlanId },
    });
    if (!coursePlan) return false;
    const active = await this.getActiveCoursePlan(userId);
    if (!active) return false;
    return active.sortOrder >= coursePlan.sortOrder;
  }

  /**
   * Management plans are investable packages (not exclusive course-style tiers).
   * Any OPEN opportunity linked to a published plan is available; users may hold
   * multiple plans / investments at once.
   */
  async canAccessOpportunity(
    _userId: string,
    opportunity: { investmentPlanId: string | null },
  ): Promise<boolean> {
    if (!opportunity.investmentPlanId) return false;
    const plan = await this.prisma.investmentPlan.findUnique({
      where: { id: opportunity.investmentPlanId },
    });
    return Boolean(plan?.published);
  }
}
