"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ChevronDown, Mail, MessageCircle, Phone } from "lucide-react";
import { contactSchema } from "@volt/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const SUPPORT_CHANNELS = [
  {
    icon: Mail,
    title: "Email",
    detail: "support@volttrades.com",
    hint: "Typical response time: within 1 business day.",
  },
  {
    icon: Phone,
    title: "Phone",
    detail: "+255 700 000 000",
    hint: "Weekdays, 9:00–18:00 EAT.",
  },
  {
    icon: MessageCircle,
    title: "Live chat",
    detail: "Available from your dashboard",
    hint: "Sign in and open Support to start a ticket.",
  },
];

const FAQS = [
  {
    question: "How long does a deposit take to reflect in my wallet?",
    answer:
      "Deposits are confirmed server-side once your payment provider verifies the transaction. Most deposits reflect within minutes; your wallet balance updates automatically once confirmed.",
  },
  {
    question: "Are returns on the Trading Floor guaranteed?",
    answer:
      "No. Every opportunity shows a projected outcome or target performance, never a guarantee. Please read the risk disclosure before investing.",
  },
  {
    question: "Do I need to complete KYC before I can browse the platform?",
    answer:
      "No. Registration only needs your name, email or phone, and a password. KYC is requested only when you invest or withdraw funds.",
  },
  {
    question: "How do withdrawals work?",
    answer:
      "Withdrawal requests go through a review process — requested, approved, processed, then completed — with every step recorded against your ledger.",
  },
];

type ContactInput = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Contact · Mandanda Space";
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (values: ContactInput) => {
    // No backend contact endpoint yet — acknowledge locally.
    await new Promise((resolve) => setTimeout(resolve, 400));
    setSubmitted(true);
    reset();
    void values;
  };

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Contact us</h1>
        <p className="mt-4 text-base text-muted-foreground">
          Have a question about Mandanda Space? Send us a message or reach out through one of the channels below.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Send a message</CardTitle>
            <CardDescription>We'll get back to you as soon as possible.</CardDescription>
          </CardHeader>
          <CardContent>
            {submitted && (
              <Alert variant="volt" className="mb-4">
                <AlertTitle>Message received</AlertTitle>
                <p className="text-sm text-muted-foreground">
                  Thanks for reaching out — our team will respond to your message soon.
                </p>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" placeholder="Jane Doe" {...register("name")} />
                {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
                {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" placeholder="How can we help?" rows={5} {...register("message")} />
                {errors.message && <p className="text-xs text-danger">{errors.message.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send message"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4">
            {SUPPORT_CHANNELS.map((channel) => (
              <Card key={channel.title} className="flex items-start gap-4 p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-volt/10 text-volt-dim">
                  <channel.icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="font-semibold">{channel.title}</p>
                  <p className="text-sm text-foreground">{channel.detail}</p>
                  <p className="text-xs text-muted-foreground">{channel.hint}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-center text-2xl font-bold tracking-tight">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={faq.question}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                >
                  <span className="text-sm font-medium">{faq.question}</span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
