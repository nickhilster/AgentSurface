import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findVehicle, readInventory, renderDiscoveryPage, renderErrorPage, renderVehicleIndex, renderVehiclePage, searchInventory } from "./catalog.mjs";

const DEFAULT_CATALOG_PATH = fileURLToPath(new URL("./data/catalog.json", import.meta.url));
const STYLE_PATH = fileURLToPath(new URL("./style.css", import.meta.url));

export function createServer({ catalogPath = DEFAULT_CATALOG_PATH } = {}) {
  return createHttpServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET") {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "GET" });
      response.end("This demo supports read-only GET requests only.\n");
      return;
    }

    let url;
    try {
      url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname === "/") {
        response.writeHead(302, { Location: "/discover" });
        response.end();
        return;
      }
      if (url.pathname === "/style.css") {
        const css = await readFile(STYLE_PATH);
        response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
        response.end(css);
        return;
      }
      if (url.pathname === "/discover") {
        const result = await searchInventory(catalogPath, url.searchParams);
        sendHtml(response, 200, renderDiscoveryPage(result));
        return;
      }
      if (url.pathname === "/vehicles") {
        const inventory = await readInventory(catalogPath);
        const ordered = [...inventory.vehicles].sort((a, b) => a.priceCad - b.priceCad || a.slug.localeCompare(b.slug));
        sendHtml(response, 200, renderVehicleIndex(ordered));
        return;
      }
      if (url.pathname.startsWith("/vehicles/")) {
        const encodedSlug = url.pathname.slice("/vehicles/".length);
        let slug;
        try {
          slug = decodeURIComponent(encodedSlug);
        } catch {
          sendHtml(response, 404, renderErrorPage("Vehicle not found", "That item URL is not valid."));
          return;
        }
        const vehicle = await findVehicle(catalogPath, slug);
        if (!vehicle) {
          sendHtml(response, 404, renderErrorPage("Vehicle not found", "No public demo vehicle has that exact item route."));
          return;
        }
        sendHtml(response, 200, renderVehiclePage(vehicle));
        return;
      }
      sendHtml(response, 404, renderErrorPage("Page not found", "This demo route does not exist."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The catalogue could not be read.";
      const status = /must be a non-negative number/.test(message) ? 400 : 500;
      sendHtml(response, status, renderErrorPage(status === 400 ? "Invalid search filter" : "Catalogue unavailable", message));
    }
  });
}

function sendHtml(response, status, html) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 3000);
  const server = createServer();
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`AgentSurface dynamic demo listening at http://127.0.0.1:${port}/discover\n`);
  });
}
