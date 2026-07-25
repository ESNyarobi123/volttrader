import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Volt Trades collects, uses, and protects your personal information.",
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "1. Information we collect",
    body: [
      "Account information: name, email address and/or phone number, and a securely hashed password.",
      "Profile information: country and other details you choose to add to your profile.",
      "KYC information: identity documents and selfie images, collected only when you invest capital or request a withdrawal, and stored in secure object storage — never on application servers or in the database directly.",
      "Financial activity: deposits, withdrawals, investments, enrollments, and wallet ledger entries.",
      "Technical information: device, browser, and log data used for security and fraud prevention.",
    ],
  },
  {
    heading: "2. How we use your information",
    body: [
      "To provide and operate the platform, including course access, wallet management, and processing of investments and withdrawals.",
      "To verify your identity where required by law or by our risk and compliance processes.",
      "To detect, prevent, and investigate fraud, security incidents, and violations of our Terms of Service.",
      "To communicate with you about your account, transactions, and material changes to our policies.",
    ],
  },
  {
    heading: "3. How we store and protect data",
    body: [
      "Passwords are hashed using bcrypt and are never stored or logged in plain text.",
      "Documents, videos, and images (including KYC documents) are stored in S3-compatible object storage, never as binary data inside our database.",
      "Financial write operations are authenticated, authorized by role, validated, and audit-logged.",
    ],
  },
  {
    heading: "4. Sharing of information",
    body: [
      "We share information with payment providers strictly as required to process deposits and withdrawals, and with regulators or law enforcement where legally required.",
      "We do not sell your personal information to third parties.",
    ],
  },
  {
    heading: "5. Your rights",
    body: [
      "You may request access to, correction of, or deletion of your personal data, subject to our legal and regulatory obligations to retain financial records.",
      "You can update most profile information directly from your dashboard.",
    ],
  },
  {
    heading: "6. Data retention",
    body: [
      "We retain financial and ledger records for as long as required by applicable law and regulation, even after account closure, to preserve an accurate and auditable transaction history.",
    ],
  },
  {
    heading: "7. Changes to this policy",
    body: [
      "We may update this Privacy Policy periodically. Material changes will be communicated through the platform or by email.",
    ],
  },
  {
    heading: "8. Contact",
    body: ["For privacy-related questions or requests, contact support@volttrades.com or use the Contact page."],
  },
];

export default function PrivacyPage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
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
