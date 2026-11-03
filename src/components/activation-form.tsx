"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { ConstellationBackground } from "@/components/constellation-background";
import { cn } from "@/lib/cn";

type Invitation = { purpose: "INVITE" | "RESET"; name: string; email: string };

const fieldClass =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 pr-12 text-[15px] text-white placeholder:text-white/35 outline-none transition focus:border-gold/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-[var(--ring)]";

export function ActivationForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // The token travels after "#" (never sent to the server). Remove it from the
    // address bar and history as soon as it has been read.
    const value = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    setToken(value);
    if (!value) {
      setState("invalid");
      return;
    }
    fetch("/api/auth/invitation/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: value }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.valid) {
          setInvitation(data);
          setState("ready");
        } else {
          setState("invalid");
        }
      })
      .catch(() => setState("invalid"));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch("/api/auth/invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error ?? "Activation impossible");
      if (response.status === 410) setState("invalid");
      return;
    }
    router.push(
      data.role === "ADMIN" ? "/admin/classes" : data.role === "DEPARTMENT_HEAD" ? "/schedule" : "/classes",
    );
    router.refresh();
  }

  const invite = invitation?.purpose !== "RESET";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,var(--navy-mid)_0%,var(--navy-deep)_60%)] px-4 py-10">
      <ConstellationBackground />
      <div className="relative w-full max-w-[420px] rounded-[24px] border border-white/10 bg-navy/70 px-6 py-9 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-10 sm:py-11">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex rounded-xl bg-white px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            <Image src="/issatkr-logo.png" alt="ISSAT Kairouan" width={160} height={40} priority className="h-8 w-auto" />
          </div>
          <h1 className="mt-6 bg-gradient-to-r from-gold-soft to-gold bg-clip-text text-[26px] leading-tight font-bold tracking-tight text-transparent">
            {invite ? "Activer mon compte" : "Nouveau mot de passe"}
          </h1>
        </div>

        {state === "checking" ? (
          <p className="mt-8 text-center text-sm text-white/60">Vérification du lien…</p>
        ) : null}

        {state === "invalid" ? (
          <div className="mt-8 space-y-5 text-center">
            <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-3 text-sm text-red-200">
              Ce lien n’est plus valable : il a déjà été utilisé, il a expiré (72 h) ou il est incomplet.
              Demandez un nouveau lien à l’administration.
            </p>
            <Link href="/" className="inline-block text-sm text-gold hover:underline">
              Aller à la page de connexion
            </Link>
          </div>
        ) : null}

        {state === "ready" && invitation ? (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <p className="text-center text-sm leading-6 text-white/70">
              Bonjour <span className="font-medium text-white">{invitation.name}</span>, choisissez le mot de passe
              de votre compte <span className="font-medium text-white">{invitation.email}</span>.
            </p>
            {/* Lets password managers save the new password under the right account. */}
            <input type="email" autoComplete="username" value={invitation.email} readOnly hidden />
            {[
              { id: "new-password", label: "Mot de passe", value: password, set: setPassword },
              { id: "confirm-password", label: "Confirmer le mot de passe", value: confirm, set: setConfirm },
            ].map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className="mb-2 flex items-center gap-2 text-sm font-medium text-white/85">
                  <Lock size={15} className="text-gold" aria-hidden />
                  {field.label}
                </label>
                <div className="relative">
                  <input
                    id={field.id}
                    required
                    minLength={8}
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={field.value}
                    onChange={(event) => field.set(event.target.value)}
                    className={cn(fieldClass)}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((value) => !value)}
                    aria-label={show ? "Masquer les mots de passe" : "Afficher les mots de passe"}
                    aria-pressed={show}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-white/45 transition hover:text-white/80"
                  >
                    {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                  </button>
                </div>
              </div>
            ))}
            <p className="text-xs text-white/50">8 caractères minimum.</p>
            {error ? (
              <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-gold to-gold-soft text-[15px] font-semibold text-navy-deep shadow-[0_10px_30px_rgba(226,154,43,0.35)] transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : invite ? "Activer mon compte" : "Enregistrer le mot de passe"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
