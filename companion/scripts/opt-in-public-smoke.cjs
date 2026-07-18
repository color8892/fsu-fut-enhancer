#!/usr/bin/env node
/**
 * H3 optional live smoke against public allowlisted endpoints.
 * Default: SKIPPED unless FSU_PUBLIC_SMOKE=1.
 * Never hits EA transfer-market or sends session headers.
 */

const ALLOWED = [
  "https://api.fut.to/26/updata.json",
  "https://enhancer-api.futnext.com/players/prices"
];

async function main() {
  if (process.env.FSU_PUBLIC_SMOKE !== "1") {
    console.log(
      "[opt-in-public-smoke] skipped (set FSU_PUBLIC_SMOKE=1 to enable)"
    );
    return;
  }

  for (const url of ALLOWED) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "error",
        credentials: "omit",
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      console.log(
        `[opt-in-public-smoke] ${new URL(url).host}${new URL(url).pathname} → ${res.status}`
      );
      if (!res.ok && res.status !== 404) {
        // Provider outage should not fail CI hard when opt-in is manual.
        console.warn(`  non-OK status ${res.status}`);
      }
    } catch (error) {
      console.warn(
        `[opt-in-public-smoke] transport error for ${new URL(url).host}:`,
        error.name || error.message
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
