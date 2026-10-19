import type { AgentSurfaceConfig } from "../types/config.js";
import type { RouteRecord } from "../types/model.js";

export type DestinationResolution =
  | { valid: true; destination: { entityId: string; canonicalUrl: string; routePath: string } }
  | { valid: false; reason: string };

/** Resolve an item only to an owner-hosted HTTPS URL backed by an inspected public HTML route. */
export function resolveCanonicalDestination(
  item: { id: string; canonicalPageUrl: string | null },
  config: AgentSurfaceConfig,
  routes: RouteRecord[]
): DestinationResolution {
  if (!item || typeof item.id !== "string" || !item.id || item.id.length > 256 || /[\u0000-\u001f]/.test(item.id)) {
    return invalid("catalog item identity is invalid.");
  }
  if (!config.site.hostnames.length) return invalid("no owner-configured site hostname is available.");
  if (typeof item.canonicalPageUrl !== "string" || !item.canonicalPageUrl || /[\\?#%\s\u0000-\u001f]/.test(item.canonicalPageUrl)) {
    return invalid("item destination must be a canonical path or HTTPS URL without query or fragment data.");
  }

  let parsed: URL;
  try {
    if (item.canonicalPageUrl.startsWith("/")) {
      if (item.canonicalPageUrl.startsWith("//")) return invalid("protocol-relative destinations are not allowed.");
      parsed = new URL(item.canonicalPageUrl, `https://${config.site.hostnames[0]}`);
    } else {
      parsed = new URL(item.canonicalPageUrl);
    }
  } catch { return invalid("item destination is not a valid URL."); }

  if (parsed.protocol !== "https:") return invalid("item destination must use HTTPS.");
  if (parsed.username || parsed.password) return invalid("destination credentials are not allowed.");
  if (parsed.port || parsed.search || parsed.hash) return invalid("ports, query strings, and fragments are not allowed in destinations.");
  const allowedHosts = new Set(config.site.hostnames.map((host) => host.toLowerCase()));
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) return invalid("destination origin is not owner-approved.");
  if (!isSafeRoutePath(parsed.pathname)) return invalid("destination path is not canonical.");

  const route = routes.find((candidate) => routePathMatches(candidate.path, parsed.pathname));
  if (!route) return invalid("destination does not resolve to an inspected route.");
  if (route.contentType !== "page" || (route.classification !== "public-static" && route.classification !== "public-dynamic") || route.surfaceType === "human-gated") {
    return invalid("destination route is not an inspected public HTML page.");
  }
  const routePath = normalizePath(parsed.pathname);
  if (config.routes.exclude.some((prefix) => routePath === prefix || routePath.startsWith(prefix === "/" ? "/" : `${prefix}/`))) {
    return invalid("destination route is excluded by owner configuration.");
  }

  return { valid: true, destination: { entityId: item.id, canonicalUrl: parsed.toString(), routePath } };
}

function routePathMatches(template: string, path: string): boolean {
  const expected = normalizePath(template).split("/").filter(Boolean);
  const actual = normalizePath(path).split("/").filter(Boolean);
  const match = (i: number, j: number): boolean => {
    if (i === expected.length) return j === actual.length;
    const segment = expected[i];
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) return i === expected.length - 1;
    if (/^\[\.\.\..+\]$/.test(segment)) return i === expected.length - 1 && j < actual.length;
    if (/^\[.+\]$/.test(segment) || /^\{[^{}]+\}$/.test(segment) || /^:[A-Za-z][\w-]*$/.test(segment)) {
      return j < actual.length && match(i + 1, j + 1);
    }
    return segment === actual[j] && match(i + 1, j + 1);
  };
  return match(0, 0);
}

function isSafeRoutePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") &&
    !/[\\?#%\s\u0000-\u001f]/.test(path) && !/(^|\/)\.{1,2}(\/|$)/.test(path);
}

function normalizePath(path: string): string {
  if (path === "/") return "/";
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
}

function invalid(reason: string): DestinationResolution {
  return { valid: false, reason };
}
