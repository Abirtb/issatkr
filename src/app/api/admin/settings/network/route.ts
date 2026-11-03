import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getAllowedNetworks, setAllowedNetworks } from "@/lib/settings";
import { normalizeIp, normalizeNetwork } from "@/lib/network";
import { clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/security-log";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const ip = clientIp(req);
  return NextResponse.json({
    networks: await getAllowedNetworks(),
    currentIp: ip === "unknown" ? null : normalizeIp(ip),
  });
}

export async function PUT(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const parsed = z
    .object({ networks: z.array(z.string().max(64)).max(50) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Liste invalide" }, { status: 400 });
  const networks: string[] = [];
  for (const entry of parsed.data.networks) {
    if (!entry.trim()) continue;
    const network = normalizeNetwork(entry);
    if (!network) {
      return NextResponse.json({ error: `Adresse invalide : « ${entry} »` }, { status: 400 });
    }
    if (!networks.includes(network)) networks.push(network);
  }
  await setAllowedNetworks(networks);
  await audit(admin, "settings.update", { type: "setting", id: "allowed_networks" }, { networks }, req);
  return NextResponse.json({ networks });
}
