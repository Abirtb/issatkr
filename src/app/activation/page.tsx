import type { Metadata } from "next";
import { ActivationForm } from "@/components/activation-form";

export const metadata: Metadata = {
  title: "Activation du compte — ISSATKR Présence",
  // Never index or keep a page reached through a personal link.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ActivationPage() {
  return <ActivationForm />;
}
