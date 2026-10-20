import { readFile } from "node:fs/promises";

export const MAX_RESULTS = 5;
const SUPPORTED_FILTERS = new Set(["q", "make", "bodyType", "drivetrain", "maxPrice", "minYear", "limit"]);

export async function readInventory(catalogPath) {
  const raw = JSON.parse(await readFile(catalogPath, "utf8"));
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.vehicles)) {
    throw new Error("Catalog source must contain a vehicles array");
  }
  return {
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
    vehicles: raw.vehicles.filter((vehicle) =>
      vehicle && typeof vehicle === "object" && typeof vehicle.id === "string" &&
      typeof vehicle.slug === "string" && typeof vehicle.make === "string" &&
      typeof vehicle.model === "string" && Number.isFinite(vehicle.priceCad),
    ),
  };
}

export async function searchInventory(catalogPath, params) {
  const source = await readInventory(catalogPath);
  const unsupportedFilters = [...new Set([...params.keys()].filter((key) => !SUPPORTED_FILTERS.has(key)))];
  const q = (params.get("q") ?? "").trim().toLocaleLowerCase("en-CA");
  const make = (params.get("make") ?? "").trim().toLocaleLowerCase("en-CA");
  const bodyType = (params.get("bodyType") ?? "").trim().toLocaleLowerCase("en-CA");
  const drivetrain = (params.get("drivetrain") ?? "").trim().toLocaleLowerCase("en-CA");
  const maxPrice = parseOptionalNumber(params.get("maxPrice"), "maxPrice");
  const minYear = parseOptionalNumber(params.get("minYear"), "minYear");
  const requestedLimit = parseOptionalNumber(params.get("limit"), "limit") ?? MAX_RESULTS;
  const limit = Math.max(1, Math.min(MAX_RESULTS, Math.floor(requestedLimit)));

  let vehicles = source.vehicles.filter((vehicle) => {
    const searchableText = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim} ${vehicle.bodyType} ${vehicle.drivetrain}`
      .toLocaleLowerCase("en-CA");
    return (!q || searchableText.includes(q)) &&
      (!make || vehicle.make.toLocaleLowerCase("en-CA") === make) &&
      (!bodyType || vehicle.bodyType.toLocaleLowerCase("en-CA") === bodyType) &&
      (!drivetrain || vehicle.drivetrain.toLocaleLowerCase("en-CA") === drivetrain) &&
      (maxPrice === undefined || vehicle.priceCad <= maxPrice) &&
      (minYear === undefined || vehicle.year >= minYear);
  });
  vehicles = vehicles.sort((a, b) => a.priceCad - b.priceCad || a.slug.localeCompare(b.slug));

  return {
    vehicles: vehicles.slice(0, limit),
    total: vehicles.length,
    limit,
    unsupportedFilters,
    metadata: source.metadata,
    query: params.get("q") ?? "",
    make: params.get("make") ?? "",
    bodyType: params.get("bodyType") ?? "",
    drivetrain: params.get("drivetrain") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    minYear: params.get("minYear") ?? "",
  };
}

export async function findVehicle(catalogPath, slug) {
  const source = await readInventory(catalogPath);
  return source.vehicles.find((vehicle) => vehicle.slug === slug) ?? null;
}

export function renderDiscoveryPage(search) {
  const results = search.vehicles.map((vehicle) => `
    <article class="catalog-result">
      <h2><a href="/vehicles/${escapeHtml(encodeURIComponent(vehicle.slug))}">${escapeHtml(`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`)}</a></h2>
      <p>${escapeHtml(vehicle.bodyType)} · ${escapeHtml(vehicle.drivetrain)} · ${escapeHtml(vehicle.availability)}</p>
      <p><strong>${formatAdvertisedPrice(vehicle.priceCad)}</strong> <span>(advertised price)</span></p>
      <p>Stock ${escapeHtml(vehicle.id)} · <a href="/vehicles/${escapeHtml(encodeURIComponent(vehicle.slug))}">View this exact vehicle</a></p>
    </article>`).join("\n");
  const warnings = search.unsupportedFilters.length
    ? `<aside role="status"><strong>Unsupported filters were not applied:</strong> ${search.unsupportedFilters.map(escapeHtml).join(", ")}. Supported filters: q, make, bodyType, drivetrain, maxPrice, minYear, limit.</aside>`
    : "";
  const snapshot = escapeHtml(search.metadata.asOf ?? "unknown");
  const body = results || "<p>No vehicles match these supported filters.</p>";

  return page("Find a vehicle", `
    <header>
      <p class="eyebrow">AgentSurface dynamic catalogue demo</p>
      <h1>Find a vehicle</h1>
      <p>This is a local demonstration using fictional sample inventory. It is not live dealer stock or market pricing.</p>
    </header>
    <main>
      <form method="get" action="/discover" aria-label="Filter vehicles">
        <label>Search <input name="q" value="${escapeHtml(search.query ?? "")}" placeholder="Make, model, trim, or feature"></label>
        <label>Make <input name="make" value="${escapeHtml(search.make ?? "")}" placeholder="Any make"></label>
        <label>Body type <input name="bodyType" value="${escapeHtml(search.bodyType ?? "")}" placeholder="Any body type"></label>
        <label>Drivetrain <input name="drivetrain" value="${escapeHtml(search.drivetrain ?? "")}" placeholder="Any drivetrain"></label>
        <label>Maximum advertised price (CAD) <input name="maxPrice" type="number" min="0" step="1" value="${escapeHtml(search.maxPrice ?? "")}"></label>
        <label>Minimum year <input name="minYear" type="number" min="1900" step="1" value="${escapeHtml(search.minYear ?? "")}"></label>
        <button type="submit">Search vehicles</button>
      </form>
      ${warnings}
      <p class="result-count">Showing ${search.vehicles.length} of ${search.total} matching vehicles (maximum ${MAX_RESULTS}).</p>
      <section aria-label="Matching vehicles">${body}</section>
      <p class="freshness">Source snapshot date: ${snapshot}. This timestamp labels the demo data only; it is not a live availability guarantee.</p>
      <p><a href="/vehicles">Browse all demo vehicles</a></p>
    </main>`);
}

export function renderVehiclePage(vehicle) {
  return page(`${vehicle.year} ${vehicle.make} ${vehicle.model}`, `
    <main>
      <p><a href="/discover">Back to vehicle search</a></p>
      <p class="eyebrow">Exact item page · demo stock ${escapeHtml(vehicle.id)}</p>
      <h1>${escapeHtml(`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`)}</h1>
      <dl>
        <dt>Advertised price</dt><dd>${formatAdvertisedPrice(vehicle.priceCad)} (advertised price; fees and conditions are not represented)</dd>
        <dt>Availability</dt><dd>${escapeHtml(vehicle.availability)}</dd>
        <dt>Body type</dt><dd>${escapeHtml(vehicle.bodyType)}</dd>
        <dt>Drivetrain</dt><dd>${escapeHtml(vehicle.drivetrain)}</dd>
        <dt>Odometer</dt><dd>${escapeHtml(String(vehicle.kilometres ?? "Unknown"))} km</dd>
        <dt>Source timestamp</dt><dd>${escapeHtml(vehicle.updatedAt ?? "Unknown")}</dd>
      </dl>
      <p>This page is generated from fictional local demo data.</p>
    </main>`);
}

export function renderVehicleIndex(vehicles) {
  const cards = vehicles.map((vehicle) => `
    <article class="catalog-result">
      <h2><a href="/vehicles/${escapeHtml(encodeURIComponent(vehicle.slug))}">${escapeHtml(`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`)}</a></h2>
      <p>${formatAdvertisedPrice(vehicle.priceCad)} (advertised price)</p>
    </article>`).join("\n");
  return page("All demo vehicles", `<main><p><a href="/discover">Use bounded search</a></p><h1>All demo vehicles</h1><section aria-label="All demo vehicles">${cards}</section></main>`);
}

export function renderErrorPage(title, message) {
  return page(title, `<main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/discover">Return to vehicle search</a></p></main>`);
}

function parseOptionalNumber(value, name) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number`);
  return parsed;
}

function formatAdvertisedPrice(priceCad) {
  return `CAD $${new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(priceCad)}`;
}

function page(title, content) {
  return `<!doctype html>
<html lang="en-CA">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} · AgentSurface demo</title><link rel="stylesheet" href="/style.css"></head>
<body><div class="page-shell">${content}<footer><p>AgentSurface local dynamic demo · read-only sample catalogue</p></footer></div></body>
</html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}
