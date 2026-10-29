"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ipAllowed } from "@/lib/network";

// Fac networks: outside them, teachers cannot save a roll call.
export function NetworkSettings() {
  const [networks, setNetworks] = useState<string[]>([]);
  const [currentIp, setCurrentIp] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings/network")
      .then((response) => response.json())
      .then((data) => {
        setNetworks(data.networks ?? []);
        setCurrentIp(data.currentIp ?? null);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save(next: string[]) {
    setMsg("");
    const response = await fetch("/api/admin/settings/network", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ networks: next }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMsg(data.error ?? "Erreur");
      return false;
    }
    setNetworks(data.networks);
    setMsg("Enregistré ✓");
    return true;
  }

  async function add(value: string) {
    if (!value.trim()) return;
    if (await save([...networks, value])) setEntry("");
  }

  return (
    <section className="surface-card mt-8 max-w-3xl rounded-xl p-4">
      <h2 className="text-lg font-semibold">Réseau de la faculté (pointage)</h2>
      <p className="mt-1 text-sm text-muted">
        Les enseignants ne peuvent faire l’appel que depuis ces adresses (WiFi de la
        faculté). Liste vide : l’appel est possible de partout. L’administration n’est
        pas concernée. Adresse (196.203.10.5), plage (192.168.0.0/16) ou début
        d’adresse (10.20.).
      </p>
      {loaded ? (
        <>
          {networks.length ? (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {networks.map((network) => (
                <li key={network} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-mono">{network}</span>
                  <Button variant="secondary" onClick={() => save(networks.filter((item) => item !== network))}>
                    Retirer
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-muted">
              Aucune restriction : l’appel est possible de partout.
            </p>
          )}
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void add(entry);
            }}
          >
            <Input
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              placeholder="ex. 196.203.10.0/24"
              aria-label="Adresse ou plage"
              className="max-w-xs"
            />
            <Button type="submit" disabled={!entry.trim()}>
              Ajouter
            </Button>
            {currentIp ? (
              <Button
                type="button"
                variant="gold"
                onClick={() => add(currentIp)}
                disabled={networks.length > 0 && ipAllowed(currentIp, networks)}
              >
                Ajouter mon adresse actuelle ({currentIp})
              </Button>
            ) : null}
          </form>
          <p className="mt-2 text-xs text-muted">
            Astuce : connectez-vous au WiFi de la faculté puis cliquez sur « Ajouter mon
            adresse actuelle ».
            {currentIp && networks.length
              ? ipAllowed(currentIp, networks)
                ? " Votre connexion actuelle est dans la liste."
                : " Votre connexion actuelle n’est pas dans la liste."
              : ""}
          </p>
          {msg ? <p className="mt-2 text-sm">{msg}</p> : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">Chargement...</p>
      )}
    </section>
  );
}
