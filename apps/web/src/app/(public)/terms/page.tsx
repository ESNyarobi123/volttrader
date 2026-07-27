import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms and conditions governing use of Mandanda Space.",
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "1. Acceptance of terms",
    body: [
      "By creating an account, accessing, or using the Mandanda Space platform (\"Mandanda Space\", \"we\", \"us\"), you agree to be bound by these Terms of Service and any policies referenced within them, including our Privacy Policy and Risk Disclosure.",
      "If you do not agree with any part of these terms, you must not register for or use the platform.",
    ],
  },
  {
    heading: "2. Eligibility",
    body: [
      "You must be at least 18 years old and legally capable of entering into binding contracts in your jurisdiction to use Mandanda Space.",
      "You are responsible for ensuring that your use of the platform complies with the laws applicable to you, including any restrictions on investment or trading activity in your country of residence.",
    ],
  },
  {
    heading: "3. Account registration and security",
    body: [
      "Registration requires a name, a valid email or phone number, and a password. Additional identity verification (KYC) is required before you can invest capital or request a withdrawal.",
      "You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately of any unauthorized use.",
    ],
  },
  {
    heading: "4. Courses and the Forex Academy",
    body: [
      "Course content is provided for educational purposes only and does not constitute personalized financial, investment, tax, or legal advice.",
      "Free courses are accessible upon enrollment; paid courses require successful, server-verified payment before access is granted.",
    ],
  },
  {
    heading: "5. Wallet, payments, and investments",
    body: [
      "Your wallet balance is calculated from an append-only ledger of credits and debits — it is never a manually editable number.",
      "All deposits are confirmed only after verification by our payment provider; the platform never treats a client-side confirmation as final.",
      "Investing in a Trading Floor opportunity requires you to review and accept the applicable risk disclosure before your investment is submitted. Opportunities show projected or target performance figures which are illustrative only and are never guaranteed.",
      "Withdrawal requests go through a review process (requested, approved, processing, completed or failed) and may require additional identity verification.",
    ],
  },
  {
    heading: "6. Prohibited conduct",
    body: [
      "You agree not to misuse the platform, including attempting to defraud other members, circumvent KYC or anti-money-laundering controls, or interfere with the security or proper functioning of the service.",
    ],
  },
  {
    heading: "7. Termination",
    body: [
      "We may suspend or terminate accounts that violate these terms, present a security or compliance risk, or engage in fraudulent activity, subject to applicable law.",
    ],
  },
  {
    heading: "8. Limitation of liability",
    body: [
      "To the maximum extent permitted by law, Mandanda Space is not liable for indirect, incidental, or consequential losses arising from your use of the platform, including trading or investment losses arising from market conditions.",
    ],
  },
  {
    heading: "9. Changes to these terms",
    body: [
      "We may update these terms from time to time. Continued use of the platform after changes take effect constitutes acceptance of the revised terms.",
    ],
  },
  {
    heading: "10. Contact",
    body: ["Questions about these terms can be sent to support@volttrades.com or via the Contact page."],
  },
];

export default function TermsPage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: 22 July 2026</p>

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
