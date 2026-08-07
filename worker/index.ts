/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { dashboardConfig } from "../lib/dashboard-config";
import {
  canliiCaseIdForAppeal,
  canliiMetadataUrl,
  normalizeCanliiAppealNumber,
  normalizeCanliiMetadata,
} from "../lib/canlii";
import type { CanliiLookupResponse, CanliiMetadata } from "../lib/permit";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  CANLII_API_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type CachedCanliiRow = {
  status: "available" | "not_found" | "unavailable";
  payload: string | null;
  fetched_at: number;
  expires_at: number;
};

type LeaseResult = "acquired" | "rate_limited" | "busy";

const CANLII_ROUTE = "/api/canlii-metadata";

function jsonResponse(body: CanliiLookupResponse, status = 200, maxAge = 0) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": maxAge > 0
        ? `public, max-age=${Math.min(maxAge, 3600)}, s-maxage=${maxAge}`
        : "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function cachedResponse(row: CachedCanliiRow): CanliiLookupResponse | null {
  const common = {
    cachedAt: new Date(row.fetched_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    cached: true,
  };
  if (row.status === "available" && row.payload) {
    try {
      return { status: "available", metadata: JSON.parse(row.payload) as CanliiMetadata, ...common };
    } catch {
      return null;
    }
  }
  if (row.status === "not_found" || row.status === "unavailable") {
    return { status: row.status, ...common };
  }
  return null;
}

async function readCanliiCache(db: D1Database, appealNumber: string, now: number) {
  const row = await db.prepare(
    `SELECT status, payload, fetched_at, expires_at
     FROM canlii_metadata_cache
     WHERE appeal_number = ? AND expires_at > ?`,
  ).bind(appealNumber, now).first<CachedCanliiRow>();
  return row ? cachedResponse(row) : null;
}

async function writeCanliiCache(
  db: D1Database,
  appealNumber: string,
  status: CachedCanliiRow["status"],
  metadata: CanliiMetadata | null,
  fetchedAt: number,
  ttlSeconds: number,
) {
  const expiresAt = fetchedAt + ttlSeconds * 1000;
  await db.prepare(
    `INSERT INTO canlii_metadata_cache
       (appeal_number, status, payload, fetched_at, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(appeal_number) DO UPDATE SET
       status = excluded.status,
       payload = excluded.payload,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at`,
  ).bind(
    appealNumber,
    status,
    metadata ? JSON.stringify(metadata) : null,
    fetchedAt,
    expiresAt,
  ).run();

  const common = {
    cachedAt: new Date(fetchedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    cached: false,
  };
  return status === "available" && metadata
    ? ({ status, metadata, ...common } satisfies CanliiLookupResponse)
    : ({ status, ...common } satisfies CanliiLookupResponse);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function acquireCanliiLease(db: D1Database): Promise<LeaseResult> {
  const minimumInterval = Math.ceil(1000 / dashboardConfig.canlii.requestsPerSecond);
  const leaseDuration = dashboardConfig.canlii.requestTimeoutMilliseconds + 3000;

  await db.prepare(
    `INSERT OR IGNORE INTO canlii_rate_state (id, lease_until, last_started_at)
     VALUES (1, 0, 0)`,
  ).run();

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const now = Date.now();
    const result = await db.prepare(
      `UPDATE canlii_rate_state
       SET lease_until = ?, last_started_at = ?
       WHERE id = 1
         AND lease_until <= ?
         AND last_started_at <= ?`,
    ).bind(now + leaseDuration, now, now, now - minimumInterval).run();

    if ((result.meta.changes ?? 0) === 1) {
      const cutoff = now - 24 * 60 * 60 * 1000;
      await db.prepare("DELETE FROM canlii_request_log WHERE requested_at < ?").bind(cutoff).run();
      const count = await db.prepare(
        "SELECT COUNT(*) AS total FROM canlii_request_log WHERE requested_at >= ?",
      ).bind(cutoff).first<{ total: number }>();

      if ((count?.total ?? 0) >= dashboardConfig.canlii.dailyQueryLimit) {
        await db.prepare("UPDATE canlii_rate_state SET lease_until = 0 WHERE id = 1").run();
        return "rate_limited";
      }

      await db.prepare("INSERT INTO canlii_request_log (requested_at) VALUES (?)").bind(now).run();
      return "acquired";
    }

    await delay(100);
  }

  return "busy";
}

async function releaseCanliiLease(db: D1Database) {
  await db.prepare("UPDATE canlii_rate_state SET lease_until = 0 WHERE id = 1").run();
}

async function handleCanliiMetadata(request: Request, env: Env) {
  const requestUrl = new URL(request.url);
  const appealNumber = normalizeCanliiAppealNumber(requestUrl.searchParams.get("appeal"));
  if (!appealNumber) return jsonResponse({ status: "unavailable" }, 400);
  if (!env.DB) return jsonResponse({ status: "unavailable" });

  try {
    const now = Date.now();
    const cached = await readCanliiCache(env.DB, appealNumber, now);
    if (cached) {
      const secondsRemaining = Math.max(1, Math.floor((Date.parse(cached.expiresAt ?? "") - now) / 1000));
      return jsonResponse(cached, 200, secondsRemaining);
    }

    const apiKey = env.CANLII_API_KEY?.trim();
    if (!apiKey) return jsonResponse({ status: "not_configured" });

    const lease = await acquireCanliiLease(env.DB);
    if (lease === "rate_limited") return jsonResponse({ status: "rate_limited" });
    if (lease !== "acquired") return jsonResponse({ status: "unavailable" });

    try {
      const apiUrl = canliiMetadataUrl({
        apiBaseUrl: dashboardConfig.canlii.apiBaseUrl,
        language: dashboardConfig.canlii.language,
        databaseId: dashboardConfig.canlii.databaseId,
        appealNumber,
        apiKey,
      });
      const caseId = canliiCaseIdForAppeal(appealNumber, dashboardConfig.canlii.databaseId);
      if (!apiUrl || !caseId) return jsonResponse({ status: "unavailable" });

      const response = await fetch(apiUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(dashboardConfig.canlii.requestTimeoutMilliseconds),
      });
      const fetchedAt = Date.now();

      if (response.status === 404) {
        const result = await writeCanliiCache(
          env.DB,
          appealNumber,
          "not_found",
          null,
          fetchedAt,
          dashboardConfig.canlii.notFoundCacheSeconds,
        );
        return jsonResponse(result, 200, dashboardConfig.canlii.notFoundCacheSeconds);
      }

      if (!response.ok) {
        const result = await writeCanliiCache(
          env.DB,
          appealNumber,
          "unavailable",
          null,
          fetchedAt,
          dashboardConfig.canlii.errorCacheSeconds,
        );
        return jsonResponse(result, 200, dashboardConfig.canlii.errorCacheSeconds);
      }

      const metadata = normalizeCanliiMetadata(
        await response.json(),
        dashboardConfig.canlii.databaseId,
        caseId,
      );
      if (!metadata) {
        const result = await writeCanliiCache(
          env.DB,
          appealNumber,
          "unavailable",
          null,
          fetchedAt,
          dashboardConfig.canlii.errorCacheSeconds,
        );
        return jsonResponse(result, 200, dashboardConfig.canlii.errorCacheSeconds);
      }

      const result = await writeCanliiCache(
        env.DB,
        appealNumber,
        "available",
        metadata,
        fetchedAt,
        dashboardConfig.canlii.successCacheSeconds,
      );
      return jsonResponse(result, 200, dashboardConfig.canlii.successCacheSeconds);
    } finally {
      await releaseCanliiLease(env.DB);
    }
  } catch {
    return jsonResponse({ status: "unavailable" });
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === CANLII_ROUTE) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return handleCanliiMetadata(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
