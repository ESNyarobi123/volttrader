"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Globe2, Handshake, Sparkles, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";
import { api, ApiRequestError } from "@/lib/api";

const VALUES = [
  {
    icon: Users2,
    title: "Members first",
    description: "Volt Society is built around the people learning and investing with Volt Trades, not around hype.",
  },
  {
    icon: Handshake,
    title: "Shared growth",
    description: "Members share knowledge, mentor each other, and grow their trading discipline together.",
  },
  {
    icon: Globe2,
    title: "Open access",
    description: "No paywall to join the community — value flows from participation, not exclusivity.",
  },
];

const BENEFITS = [
  "Early access to new Forex Academy courses and materials",
  "Invitations to community sessions and market discussions",
  "Priority updates on new Trading Floor opportunities and Volt Projects",
  "A voice in shaping future Volt Trades initiatives",
];

export default function VoltSocietyPage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "Volt Society · Volt Trades";
  }, []);

  const joinMutation = useMutation({
    mutationFn: () => api.post("/community/join", {}),
  });

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mb-3 inline-flex items-center gap-1 rounded-full border border-volt/40 bg-volt/10 px-3 py-1 text-xs font-medium text-volt-dim">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Community
        </span>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Volt Society</h1>
        <p className="mt-4 text-base text-muted-foreground">
          A community for members who want to learn Forex, manage capital thoughtfully, and build the future
          together — beyond the platform itself.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {VALUES.map((value) => (
          <Card key={value.title}>
            <CardHeader>
              <div className="mb-2 grid h-11 w-11 place-items-center rounded-lg bg-volt/10 text-volt-dim">
                <value.icon className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-base">{value.title}</CardTitle>
              <CardDescription>{value.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-14 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>What members get</CardTitle>
            <CardDescription>Volt Society is currently in a waitlist phase as we shape the experience.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-volt-dim" aria-hidden />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mx-auto mt-14 flex max-w-xl flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Join the waitlist</h2>
        <p className="text-sm text-muted-foreground">
          Sign in to join Volt Society directly, or create a free account to get started.
        </p>

        {joinMutation.isSuccess ? (
          <Alert variant="volt" className="w-full text-left">
            <AlertTitle>You're on the list</AlertTitle>
            <p className="text-sm text-muted-foreground">
              Thanks for joining Volt Society — we'll be in touch with next steps.
            </p>
          </Alert>
        ) : loading ? (
          <Spinner />
        ) : user ? (
          <div className="flex w-full flex-col items-center gap-2">
            <Button size="lg" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
              {joinMutation.isPending ? "Joining..." : "Join Volt Society"}
            </Button>
            {joinMutation.isError && (
              <p className="text-xs text-danger">
                {joinMutation.error instanceof ApiRequestError
                  ? joinMutation.error.message
                  : "Something went wrong. Please try again."}
              </p>
            )}
          </div>
        ) : (
          <Link href="/register">
            <Button size="lg">Create an account to join</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
