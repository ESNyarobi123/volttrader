import { Skeleton } from "@/components/ui/skeleton";

/** Instant route transition UI while the next dashboard page chunk loads. */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
      </div>
      <Skeleton className="h-36 w-full rounded-[1.75rem]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-[1.75rem]" />
        <Skeleton className="h-56 w-full rounded-[1.75rem]" />
      </div>
    </div>
  );
}
