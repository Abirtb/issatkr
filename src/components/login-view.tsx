"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginView() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-deep text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[420px] w-[420px] bg-navy-mid/40 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="grid w-full items-center gap-16 lg:grid-cols-2">
          <div className="hidden lg:block">
            <div className="inline-flex rounded-[12px] bg-white px-3 py-2">
              <Image
                src="/issatkr-logo.png"
                alt="ISSATKR"
                width={280}
                height={80}
                className="h-12 w-auto"
                priority
              />
            </div>
            <h1 className="mt-10 max-w-md text-4xl font-semibold tracking-tight">
              La présence, avec la précision d’un produit technologique.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-7 text-white/65">
              Plateforme académique d’ISSAT Kairouan. Intelligence, clarté, et une
              prise de présence en moins d’une minute.
            </p>
          </div>

          <div className="mx-auto w-full max-w-md rounded-[16px] border border-white/10 bg-white/[0.04] p-7 backdrop-blur">
            <div className="mb-8 inline-flex rounded-[12px] bg-white px-3 py-2 lg:hidden">
              <Image
                src="/issatkr-logo.png"
                alt="ISSATKR"
                width={200}
                height={56}
                className="h-10 w-auto"
              />
            </div>
            <p className="text-sm text-white/55">Espace enseignant</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Connexion</h2>
            <form
              className="mt-6 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setLoading(true);
                setTimeout(() => router.push("/dashboard"), 500);
              }}
            >
              <label className="block text-sm">
                <span className="mb-1.5 block text-white/60">E-mail institutionnel</span>
                <Input
                  defaultValue="abir.trabelsi@issatkr.u-kairouan.tn"
                  className="border-white/10 bg-white/8 text-white placeholder:text-white/35"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-white/60">Mot de passe</span>
                <Input
                  type="password"
                  defaultValue="••••••••"
                  className="border-white/10 bg-white/8 text-white"
                />
              </label>
              <Button variant="gold" size="lg" className="mt-2 w-full" disabled={loading}>
                {loading ? "Ouverture…" : "Continuer"}
              </Button>
            </form>
            <p className="mt-5 text-center text-xs text-white/40">
              Démonstration · ISSATKR Presence
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
