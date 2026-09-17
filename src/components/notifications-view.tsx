"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { notifications as seed } from "@/lib/data";
import { cn } from "@/lib/cn";

export function NotificationsView() {
  const [items, setItems] = useState(seed);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Notifications</h1>
          <p className="mt-1 text-sm text-muted">Alertes académiques et rappels de séance.</p>
        </div>
        {items.some((n) => n.unread) ? (
          <button
            className="text-sm text-muted hover:text-ink"
            onClick={() => setItems((list) => list.map((n) => ({ ...n, unread: false })))}
          >
            Tout marquer lu
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Bell size={20} />}
          title="Aucune notification"
          description="Vous serez informé ici des séances à saisir et des alertes d’assiduité."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() =>
                setItems((list) =>
                  list.map((x) => (x.id === n.id ? { ...x, unread: false } : x)),
                )
              }
              className={cn(
                "surface-card flex w-full items-start gap-3 rounded-[14px] px-4 py-4 text-left",
                n.unread && "ring-1 ring-gold/35",
              )}
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  n.unread ? "bg-gold" : "bg-border",
                )}
              />
              <div>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                <p className="mt-2 text-xs text-muted">{n.time}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
