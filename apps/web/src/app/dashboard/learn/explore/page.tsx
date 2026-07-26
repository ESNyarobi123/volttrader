import { redirect } from "next/navigation";

/** Catalogue browse replaced by plan-gated Learn. */
export default function LearnExploreRedirectPage() {
  redirect("/dashboard/learn");
}
