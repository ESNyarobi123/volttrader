import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "How refunds work for Volt Trades courses, deposits, and investments.",
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "1. Overview",
    body: [
      "This Refund Policy explains when Volt Trades may refund payments for courses, wallet deposits, or related services. It should be read together with our Terms of Service and Risk Disclosure.",
      "Investment outcomes are never guaranteed. Capital allocated to Trading Floor opportunities is subject to market and product risk and is not covered by a general “cooling-off” refund of projected returns.",
    ],
  },
  {
    heading: "2. Course purchases",
    body: [
      "If a paid course payment fails verification, you are not charged and no enrollment is created.",
      "For successfully paid courses, you may request a refund within 7 days of purchase if you have not started more than one lesson (or any preview-gated paid lesson beyond the free preview).",
      "Refund requests are reviewed by support. Approved refunds are credited back to your Volt wallet ledger (or, where required by law/provider rules, to the original payment method).",
    ],
  },
  {
    heading: "3. Wallet deposits",
    body: [
      "Deposits are credited only after your payment provider confirms the transfer. A deposit that is never confirmed does not create a wallet credit.",
      "Once a deposit is confirmed and credited, it becomes wallet balance. You may withdraw subject to KYC, review, and platform limits — that is not the same as a purchase refund.",
    ],
  },
  {
    heading: "4. Investments",
    body: [
      "Amounts invested into an opportunity are not refundable as a “change of mind” once the investment is ACTIVE.",
      "If an investment funding payment fails before activation, no investment is activated and no principal is taken from your wallet.",
      "Projected or target performance figures are illustrative only and never create a right to a refund of expected returns.",
    ],
  },
  {
    heading: "5. How to request a refund",
    body: [
      "Open a support ticket from your dashboard (Support) or contact us via the Contact page. Include your payment reference, course or investment id if relevant, and the reason for the request.",
      "We aim to respond within a reasonable business timeframe. Fraud, abuse, or chargeback misuse may result in account review.",
    ],
  },
  {
    heading: "6. Contact",
    body: [
      "Questions about this policy: use the Contact page or email support@volttrades.com.",
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Refund Policy</h1>
        <p className="mt-3 text-muted-foreground">
          Last updated for the Volt Trades platform. See also{" "}
          <Link href="/terms" className="font-medium text-volt-dim hover:underline">
            Terms
          </Link>
          ,{" "}
          <Link href="/privacy" className="font-medium text-volt-dim hover:underline">
            Privacy
          </Link>
          , and{" "}
          <Link href="/risk-disclosure" className="font-medium text-volt-dim hover:underline">
            Risk disclosure
          </Link>
          .
        </p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
              {section.body.map((p) => (
                <p key={p.slice(0, 48)} className="text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
