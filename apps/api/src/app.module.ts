import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { configFactory } from "./config/env";
import { PrismaModule } from "./prisma/prisma.module";
import { MailModule } from "./modules/mail/mail.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { UsersModule } from "./modules/users/users.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { CoursesModule } from "./modules/courses/courses.module";
import { CoursePlansModule } from "./modules/course-plans/course-plans.module";
import { EnrollmentsModule } from "./modules/enrollments/enrollments.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { OpportunitiesModule } from "./modules/opportunities/opportunities.module";
import { InvestmentPlansModule } from "./modules/investment-plans/investment-plans.module";
import { InvestmentsModule } from "./modules/investments/investments.module";
import { WithdrawalsModule } from "./modules/withdrawals/withdrawals.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { CommunityModule } from "./modules/community/community.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SupportModule } from "./modules/support/support.module";
import { AdminModule } from "./modules/admin/admin.module";
import { LandingModule } from "./modules/landing/landing.module";
import { PlanAccessModule } from "./modules/plan-access/plan-access.module";
import { StorageModule } from "./modules/storage/storage.module";

@Module({
  imports: [
    // Env is loaded from the repo-root .env. When run via the root `dev`/`db:*`
    // scripts (dotenv-cli) it is already in process.env; envFilePath is the
    // fallback for running nest directly inside apps/api ("../../.env" = root).
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configFactory],
      cache: true,
      envFilePath: [".env", "../../.env"],
    }),
    PrismaModule,
    MailModule,
    StorageModule,
    PlanAccessModule,
    LedgerModule,
    AuditModule,
    AuthModule,
    HealthModule,
    UsersModule,
    KycModule,
    CoursesModule,
    CoursePlansModule,
    EnrollmentsModule,
    WalletModule,
    PaymentsModule,
    OpportunitiesModule,
    InvestmentPlansModule,
    InvestmentsModule,
    WithdrawalsModule,
    CouponsModule,
    ProjectsModule,
    CommunityModule,
    NotificationsModule,
    SupportModule,
    AdminModule,
    LandingModule,
  ],
})
export class AppModule {}
