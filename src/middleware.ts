import { NextRequest, NextResponse } from "next/server";

// Route handlers still authenticate every request; this is the first gate.
const publicPaths = [
  "/",
  "/api/auth/login",
  "/api/cron/notifications",
  "/health",
  "/api/health",
];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_BODY_BYTES = 12 * 1024 * 1024;

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    // Files served from public/ (logo, images). Never applies to the API.
    (!pathname.startsWith("/api/") && /\.[a-z0-9]{2,5}$/i.test(pathname))
  );
}

function isCrossSite(req: NextRequest) {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return true;
  }
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host");
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && !SAFE_METHODS.has(req.method)) {
    // CSRF defence in depth on top of the SameSite=Lax session cookie.
    if (isCrossSite(req)) {
      return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
    }
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Requête trop volumineuse" }, { status: 413 });
    }
  }

  if (publicPaths.includes(pathname) || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get("issatkr_session")?.value;
  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
