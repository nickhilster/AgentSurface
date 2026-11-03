import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ViteSpaAdapter } from "./viteSpa.js";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("ViteSpaAdapter", () => {
  it("detects explicit standalone routes and records their source boundary", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentsurface-vite-"));
    tempRoots.push(root);
    mkdirSync(join(root, "src", "components"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { react: "18", vite: "6" } }));
    writeFileSync(
      join(root, "src", "main.tsx"),
      [
        "import Home from './components/Home'",
        "import About from './components/About'",
        "const standalonePages = {",
        "  '/': Home,",
        "  '/about': About,",
        "}",
        "const RootPage = standalonePages['/']",
      ].join("\n")
    );
    writeFileSync(join(root, "src", "components", "Home.tsx"), "export default function Home() { return <main>Home</main> }");
    writeFileSync(join(root, "src", "components", "About.tsx"), "export default function About() { return <main>About</main> }");

    const adapter = new ViteSpaAdapter();
    await expect(adapter.detect({ rootDir: root })).resolves.toMatchObject({ framework: "vite-react-spa", confidence: 1 });
    await expect(adapter.inspectRoutes({ rootDir: root, excludeRoutes: ["/about"] })).resolves.toMatchObject([
      {
        path: "/",
        classification: "public-static",
        contentType: "page",
        contentBoundaryTag: "main",
        sourceFiles: ["src/main.tsx", "src/components/Home.tsx"],
      },
    ]);
  });
});
