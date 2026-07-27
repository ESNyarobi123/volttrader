import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Risk Disclosure",
  description: "Important risk information about Forex trading and Trading Floor investments on Mandanda Space.",
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "1. Trading and investing carry risk of loss",
    body: [
      "Forex trading and participation in Trading Floor opportunities involve substantial risk, including the potential loss of some or all of your invested capital. You should never invest money you cannot afford to lose.",
      "Past or historical performance shown on the platform is not indicative of future results. Markets are volatile and unpredictable, and no strategy or opportunity can eliminate risk.",
    ],
  },
  {
    heading: "2. No guaranteed returns",
    body: [
      "Mandanda Space never guarantees returns on any course, opportunity, or investment. Any multiplier, percentage, or figure shown (for example, a projection model such as \"x5\") is a configurable projection or target set by our team, not a promise or commitment of actual performance.",
      "All figures shown on opportunity pages are described using one of the following labels: Projected Outcome, Target Performance, or Historical Performance. None of these labels represent a guarantee.",
    ],
  },
  {
    heading: "3. Risk categories",
    body: [
      "Each opportunity is assigned a risk category (for example, low, medium, or high) to help you understand its relative risk profile. Risk categorization is informational and does not eliminate the possibility of loss at any level, including \"low risk\" opportunities.",
    ],
  },
  {
    heading: "4. Your responsibility before investing",
    body: [
      "Before investing, you must review the specific risk disclosure and terms attached to that opportunity and actively confirm that you understand and accept the risk involved. Mandanda Space will not process an investment until this acknowledgement is recorded.",
      "You are responsible for assessing whether an opportunity is suitable for your personal financial situation. Mandanda Space does not provide individualized investment advice.",
    ],
  },
  {
    heading: "5. Liquidity and duration",
    body: [
      "Investments in Trading Floor opportunities typically run for a fixed duration and may not be redeemable before maturity. Withdrawal of invested capital before maturity may not be possible, or may be subject to conditions disclosed at the time of investment.",
    ],
  },
  {
    heading: "6. Regulatory status",
    body: [
      "Mandanda Space' real-money investment features are subject to ongoing legal and compliance review and may be limited, delayed, or unavailable in certain jurisdictions pending regulatory clearance.",
    ],
  },
  {
    heading: "7. Educational content is not financial advice",
    body: [
      "Forex Academy courses are provided for educational purposes only. Nothing in our course content, marketing material, or platform communications should be construed as personalized financial, legal, or tax advice.",
    ],
  },
  {
    heading: "8. Questions",
    body: [
      "If you do not fully understand the risks described here, please contact our support team before making any investment through support@volttrades.com or the Contact page.",
    ],
  },
];

export default function RiskDisclosurePage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Risk Disclosure</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: 22 July 2026</p>

        <Alert variant="danger" className="mt-6">
          <div className="flex gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <AlertTitle>Trading and investing involve risk of loss</AlertTitle>
              <p className="text-sm leading-relaxed">
                Mandanda Space does not guarantee returns on any course, opportunity, or investment. All performance
                figures are Projected Outcome, Target Performance, or Historical Performance — never a promise.
                Only invest capital you can afford to lose.
              </p>
            </div>
          </div>
        </Alert>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph, index) => (
                  <p key={index} className="text-sm leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
