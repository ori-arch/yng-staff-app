import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Tells the client which deployment is currently live. Vercel sets
 * VERCEL_GIT_COMMIT_SHA automatically at build time for every deploy — no
 * manual versioning needed. The client (UpdateGate) polls this and compares
 * it to the version it loaded with; a mismatch means a newer version has
 * been deployed since this tab/PWA was opened.
 */
export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev";
  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}
