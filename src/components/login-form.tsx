"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        ? "/admin/classes"
        : data.role === "DEPARTMENT_HEAD"
          ? "/schedule"
          : "/classes",
    );
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-deep px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-white/10 bg-white/5 p-6 text-white">
        <div className="mb-6 inline-flex rounded bg-white px-3 py-2">
          <Image src="/issatkr-logo.png" alt="ISSATKR" width={160} height={40} className="h-8 w-auto" />
        </div>
        <h1 className="text-xl font-semibold">Connexion</h1>
        <p className="mt-1 text-sm text-white/60">Présence ISSATKR</p>
        <div className="mt-5 space-y-3">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="E-mail"
            className="border-white/15 bg-white/10 text-white"
          />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Mot de passe"
            className="border-white/15 bg-white/10 text-white"
          />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button type="submit" variant="gold" className="w-full" disabled={loading}>
            {loading ? "..." : "Entrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
