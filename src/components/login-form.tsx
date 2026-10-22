"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { ConstellationBackground } from "@/components/constellation-background";
import { cn } from "@/lib/cn";

const fieldClass =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-white/35 outline-none transition focus:border-gold/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-[var(--ring)]";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    router.push(
      data.role === "ADMIN"
        ? "/admin"
        : data.role === "DEPARTMENT_HEAD"
          ? "/schedule"
          : "/classes",
    );
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,var(--navy-mid)_0%,var(--navy-deep)_60%)] px-4 py-10">
      <ConstellationBackground />

      <form
        onSubmit={submit}
        className="relative w-full max-w-[400px] rounded-[24px] border border-white/10 bg-navy/70 px-6 py-9 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-10 sm:py-11"
      >
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex rounded-xl bg-white px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            <Image
              src="/issatkr-logo.png"
              alt="ISSAT Kairouan"
              width={160}
              height={40}
              priority
              className="h-8 w-auto"
            />
          </div>
          <h1 className="mt-6 bg-gradient-to-r from-gold-soft to-gold bg-clip-text text-[28px] leading-tight font-bold tracking-tight text-transparent sm:text-[32px]">
            ISSAT Kairouan
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Connexion à l’espace de suivi des présences
          </p>
        </div>

        <div className="mt-8 space-y-5">
          <div>
            <label htmlFor="login-email" className="mb-2 flex items-center gap-2 text-sm font-medium text-white/85">
              <Mail size={15} className="text-gold" aria-hidden />
              E-mail
            </label>
            <input
              id="login-email"
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Entrez votre adresse e-mail"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-2 flex items-center gap-2 text-sm font-medium text-white/85">
              <Lock size={15} className="text-gold" aria-hidden />
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="login-password"
                required
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez votre mot de passe"
                className={cn(fieldClass, "pr-12")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-white/45 transition hover:text-white/80"
              >
                {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-gold to-gold-soft text-[15px] font-semibold text-navy-deep shadow-[0_10px_30px_rgba(226,154,43,0.35)] transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </div>
      </form>
    </div>
  );
}
