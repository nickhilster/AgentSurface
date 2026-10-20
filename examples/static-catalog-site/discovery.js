const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;
const SUPPORTED_FILTERS = new Set(["q", "make", "model", "maxPrice", "limit"]);

/** Return a bounded set of public catalogue records matching supported filters. */
export function searchCatalog(items, params = new URLSearchParams()) {
  const query = params.get("q")?.trim().toLocaleLowerCase() ?? "";
  const make = params.get("make")?.trim().toLocaleLowerCase() ?? "";
  const model = params.get("model")?.trim().toLocaleLowerCase() ?? "";
  const parsedMaxPrice = Number(params.get("maxPrice"));
  const maxPrice = params.has("maxPrice") && Number.isFinite(parsedMaxPrice) ? parsedMaxPrice : null;
  const requestedLimit = Number.parseInt(params.get("limit") ?? "", 10);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;
  const unsupportedFilters = [...new Set([...params.keys()].filter((key) => !SUPPORTED_FILTERS.has(key)))].sort();

  const filtered = items.filter((item) => {
    if (item.public !== true || !canonicalItemPath(item)) return false;
    if (query && ![item.name, item.make, item.model, item.year, item.trim]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(query))) return false;
    if (make && String(item.make ?? "").toLocaleLowerCase() !== make) return false;
    if (model && String(item.model ?? "").toLocaleLowerCase() !== model) return false;
    if (maxPrice !== null && (typeof item.priceCad !== "number" || item.priceCad > maxPrice)) return false;
    return true;
  });

  return { items: filtered.slice(0, limit), unsupportedFilters };
}

/** Accept only an exact product detail route whose first segment matches the record ID. */
export function canonicalItemPath(item) {
  if (item.public !== true || typeof item.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(item.id) || typeof item.canonicalPath !== "string") return null;
  const id = item.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const routePattern = new RegExp(`^/products/${id}-[a-z0-9]+(?:-[a-z0-9]+)*/$`, "i");
  return routePattern.test(item.canonicalPath) ? item.canonicalPath : null;
}

/** Escape untrusted text before inserting it into an HTML text or quoted attribute. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

async function renderDiscovery() {
  const form = document.querySelector("#discovery-form");
  const results = document.querySelector("#results");
  const status = document.querySelector("#status");
  const params = new URLSearchParams(window.location.search);
  for (const key of ["q", "make", "maxPrice"]) {
    const field = form.elements.namedItem(key);
    if (field) field.value = params.get(key) ?? "";
  }

  try {
    const response = await fetch("./catalog.json");
    if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
    const catalogue = await response.json();
    const result = searchCatalog(catalogue.items, params);
    results.innerHTML = result.items.map((item) => {
      const path = canonicalItemPath(item);
      return `<article class="result-card"><h2><a href="${escapeHtml(path)}">${escapeHtml(item.name)}</a></h2><p>${escapeHtml(item.make)} · ${escapeHtml(item.model)} · ${escapeHtml(String(item.year))}</p><p>${escapeHtml(formatPrice(item.priceCad))}</p></article>`;
    }).join("");
    if (result.items.length === 0) results.innerHTML = "<p>No matching public products were found.</p>";
    const notices = [];
    if (result.unsupportedFilters.length) notices.push(`Ignored unsupported filters: ${result.unsupportedFilters.map(escapeHtml).join(", ")}.`);
    status.textContent = `${result.items.length} result${result.items.length === 1 ? "" : "s"}. ${notices.join(" ")}`;
  } catch {
    status.textContent = "The product catalogue could not be loaded.";
  }
}

if (typeof document !== "undefined") renderDiscovery();
