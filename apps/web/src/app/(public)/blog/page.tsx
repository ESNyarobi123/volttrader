import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Blog",
  description: "Insights on Forex education, markets, and Volt Trades product updates.",
};

const SAMPLE_TOPICS = [
  {
    category: "Education",
    title: "Understanding risk categories before you invest",
    description:
      "A plain-language primer on how Volt Trades classifies opportunities as low, medium, or high risk — and why that matters.",
  },
  {
    category: "Product",
    title: "How the ledger keeps your wallet balance honest",
    description:
      "Every credit and debit is append-only. Here's why your balance is always computed, never stored as a mutable number.",
  },
  {
    category: "Markets",
    title: "Reading a projection without over-trusting it",
    description:
      "Projected outcome, target performance, historical performance — what each label actually means for your expectations.",
  },
];

export default function BlogPage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Insights</h1>
        <p className="mt-4 text-base text-muted-foreground">
          Articles on Forex education, capital management, and how Volt Trades works under the hood.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SAMPLE_TOPICS.map((topic) => (
          <Card key={topic.title} className="flex flex-col">
            <CardHeader>
              <Badge variant="volt" className="mb-2 w-fit">
                {topic.category}
              </Badge>
              <CardTitle className="text-base leading-snug">{topic.title}</CardTitle>
              <CardDescription>{topic.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <span className="text-xs font-medium text-muted-foreground">Coming soon</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <EmptyState
          icon={Newspaper}
          title="Full articles coming soon"
          description="We're preparing our first batch of long-form articles. Check back soon, or follow updates from your dashboard once you register."
        />
      </div>
    </div>
  );
}
