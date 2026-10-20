import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "./server.mjs";

type DemoVehicle = {
  id: string;
  slug: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  bodyType: string;
  drivetrain: string;
  priceCad: number;
  priceKind: string;
  availability: string;
  updatedAt: string;
  dealerInternalMemo?: string;
};

let tempDir: string;
let catalogPath: string;
let server: ReturnType<typeof createServer>;
let baseUrl: string;

function vehicle(overrides: Partial<DemoVehicle> = {}): DemoVehicle {
  return {
    id: "stock-104",
    slug: "stock-104-rav4-xle",
    year: 2023,
    make: "Toyota",
    model: "RAV4",
    trim: "XLE AWD",
    bodyType: "SUV",
    drivetrain: "AWD",
    priceCad: 38995,
    priceKind: "advertised price",
    availability: "available",
    updatedAt: "2026-10-20T12:00:00.000Z",
    dealerInternalMemo: "Never expose this private memo",
    ...overrides,
  };
}

async function startServer(rows: DemoVehicle[]) {
  await writeFile(catalogPath, JSON.stringify({
    metadata: { dataKind: "fictional demo snapshot", asOf: "2026-10-20T12:00:00.000Z" },
    vehicles: rows,
  }), "utf8");
  server = createServer({ catalogPath });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP server address");
  baseUrl = `http://127.0.0.1:${address.port}`;
}

describe("dynamic catalogue demo", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "agentsurface-dynamic-catalog-"));
    catalogPath = join(tempDir, "catalog.json");
  });

  afterEach(async () => {
    if (server?.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reads the existing server-side source again for each discovery request", async () => {
    await startServer([vehicle()]);

    const firstResponse = await fetch(`${baseUrl}/discover?make=Toyota`);
    const firstHtml = await firstResponse.text();
    expect(firstResponse.status).toBe(200);
    expect(firstHtml).toContain("stock-104-rav4-xle");

    await writeFile(catalogPath, JSON.stringify({
      metadata: { dataKind: "fictional demo snapshot", asOf: "2026-10-20T12:01:00.000Z" },
      vehicles: [vehicle({
      id: "stock-205",
      slug: "stock-205-crv-exl",
      make: "Honda",
      model: "CR-V",
      trim: "EX-L AWD",
      })],
    }), "utf8");

    const secondResponse = await fetch(`${baseUrl}/discover?make=Honda`);
    const secondHtml = await secondResponse.text();
    expect(secondResponse.status).toBe(200);
    expect(secondHtml).toContain("stock-205-crv-exl");
    expect(secondHtml).not.toContain("stock-104-rav4-xle");
  });

  it("filters from supported criteria and links to each exact item page", async () => {
    await startServer([
      vehicle(),
      vehicle({ id: "stock-205", slug: "stock-205-crv-exl", make: "Honda", model: "CR-V", priceCad: 36500 }),
    ]);

    const response = await fetch(`${baseUrl}/discover?bodyType=SUV&maxPrice=38000`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('name="drivetrain"');
    expect(html).toContain('href="/vehicles/stock-205-crv-exl"');
    expect(html).not.toContain('href="/vehicles/stock-104-rav4-xle"');
  });

  it("caps results even when the requested limit is larger", async () => {
    await startServer(Array.from({ length: 8 }, (_, index) => vehicle({
      id: `stock-${index}`,
      slug: `stock-${index}-vehicle`,
      model: `Model ${index}`,
    })));

    const response = await fetch(`${baseUrl}/discover?limit=500`);
    const html = await response.text();
    expect((html.match(/class="catalog-result"/g) ?? [])).toHaveLength(5);
    expect(html).toContain("Showing 5 of 8 matching vehicles");
  });

  it("reports unsupported filters and leaves private source fields out of public pages", async () => {
    await startServer([vehicle()]);

    const searchResponse = await fetch(`${baseUrl}/discover?paintColor=blue`);
    const searchHtml = await searchResponse.text();
    expect(searchHtml).toContain("Unsupported filters were not applied:");
    expect(searchHtml).toContain("paintColor");
    expect(searchHtml).not.toContain("Never expose this private memo");

    const detailResponse = await fetch(`${baseUrl}/vehicles/stock-104-rav4-xle`);
    const detailHtml = await detailResponse.text();
    expect(detailResponse.status).toBe(200);
    expect(detailHtml).not.toContain("Never expose this private memo");
  });

  it("returns an exact detail page and a clear not-found response", async () => {
    await startServer([vehicle()]);

    const detailResponse = await fetch(`${baseUrl}/vehicles/stock-104-rav4-xle`);
    const detailHtml = await detailResponse.text();
    expect(detailResponse.status).toBe(200);
    expect(detailHtml).toContain("2023 Toyota RAV4 XLE AWD");
    expect(detailHtml).toContain("CAD $38,995");

    const missingResponse = await fetch(`${baseUrl}/vehicles/missing-item`);
    expect(missingResponse.status).toBe(404);
  });

  it("escapes source and query text before rendering HTML", async () => {
    await startServer([vehicle({ model: '<script>alert("x")</script>' })]);

    const response = await fetch(`${baseUrl}/discover?q=%3Cscript%3E`);
    const html = await response.text();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps the fixture inventory explicitly labeled as demo snapshot data", async () => {
    const fixture = await readFile(new URL("./data/catalog.json", import.meta.url), "utf8");
    expect(JSON.parse(fixture)).toEqual(expect.objectContaining({
      metadata: expect.objectContaining({ dataKind: "fictional demo snapshot" }),
      vehicles: expect.arrayContaining([expect.objectContaining({ id: "stock-104" })]),
    }));
  });
});
