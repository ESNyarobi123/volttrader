"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

function ChartFallback({ height = 220 }: { height?: number }) {
  return <Skeleton className="w-full rounded-xl" style={{ height }} />;
}

/** Lazy recharts wrappers — keeps dashboard route chunks light for faster nav. */
export const TrendArea = dynamic(() => import("./charts").then((m) => m.TrendArea), {
  ssr: false,
  loading: () => <ChartFallback height={260} />,
});

export const BarGroup = dynamic(() => import("./charts").then((m) => m.BarGroup), {
  ssr: false,
  loading: () => <ChartFallback height={220} />,
});

export const Donut = dynamic(() => import("./charts").then((m) => m.Donut), {
  ssr: false,
  loading: () => <ChartFallback height={180} />,
});
