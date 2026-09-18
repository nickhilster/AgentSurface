#!/usr/bin/env node
import { runInit } from "../commands/init.js";
import { runInspect } from "../commands/inspect.js";
import { runGenerate } from "../commands/generate.js";
import { runValidate } from "../commands/validate.js";

function parseArgs(argv: string[]): { command: string; flags: Record<string, string> } {
  const [command, ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    }
  }
  return { command: command ?? "", flags };
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const repoRoot = flags.repo ?? process.cwd();

  switch (command) {
    case "init": {
      const hostnames = flags.hostnames ? flags.hostnames.split(",") : [];
      const result = runInit({ repoRoot, siteName: flags.name, hostnames });
      console.log(`Created ${result.path}`);
      break;
    }
    case "inspect": {
      const model = await runInspect({ repoRoot });
      console.log(`Inspected ${repoRoot}`);
      console.log(`Framework: ${model.site.framework} (confidence ${model.site.frameworkConfidence})`);
      console.log(`Routes found: ${model.routes.length}`);
      console.log(`Capabilities found: ${model.capabilities.length}`);
      if (model.unknowns.length > 0) {
        console.log(`Unknowns (${model.unknowns.length}):`);
        for (const u of model.unknowns) console.log(`  - ${u}`);
      }
      console.log(`Model written to ${repoRoot}/.agentsurface/model/`);
      break;
    }
    case "generate": {
      // No framework-specific default (e.g. Next.js's localhost:3000): generation is
      // render-based and needs a real running instance, which is repo-specific. Adapters
      // will eventually declare this (renderRecipe, plan §2.2/§4.1); until then it must
      // be explicit rather than silently assumed.
      if (!flags.server) {
        console.error(`"generate" requires --server <url>, the base URL of a running instance of the target site.`);
        process.exitCode = 1;
        break;
      }
      const serverBaseUrl = flags.server;
      const result = await runGenerate({ repoRoot, serverBaseUrl });
      console.log(`Generated ${result.generated.length} page(s):`);
      for (const p of result.generated) console.log(`  - ${p}`);
      if (result.skipped.length > 0) {
        console.log(`Skipped ${result.skipped.length}:`);
        for (const s of result.skipped) console.log(`  - ${s.path}: ${s.reason}${s.fatal ? " (fatal)" : ""}`);
      }
      if (result.llmsTxt.conflict) {
        console.log(`llms.txt was not written: a pre-existing, non-AgentSurface-owned file was found and left untouched.`);
      } else if (result.llmsTxt.written) {
        console.log(`llms.txt written.`);
      }
      break;
    }
    case "validate": {
      const serverBaseUrl = flags.server;
      const acknowledgeNoServer = flags["no-drift-check"] === "true";
      const result = await runValidate({ repoRoot, serverBaseUrl, acknowledgeNoServer });
      console.log(`Checked ${result.checkedGeneratedFiles} generated file(s), ${result.checkedDiscoveryLinks} discovery link(s).`);
      if (result.unchecked.length > 0) {
        console.log(`${result.unchecked.length} check(s) could not be completed:`);
        for (const u of result.unchecked) console.log(`  [${u.check}] ${u.path}: ${u.reason}`);
      }
      if (result.failures.length === 0) {
        console.log("No validation failures.");
      } else {
        console.log(`${result.failures.length} failure(s):`);
        for (const f of result.failures) console.log(`  [${f.check}] ${f.path}: ${f.message}`);
        process.exitCode = 1;
      }
      break;
    }
    case "diff": {
      console.error(`"${command}" is not implemented in this slice yet.`);
      process.exitCode = 1;
      break;
    }
    default: {
      console.error(`Unknown or missing command: "${command}"`);
      console.error("Usage: agentsurface <init|inspect|generate|validate|diff> [--repo <path>] [--name <name>] [--hostnames a,b] [--server <url>] [--no-drift-check]");
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
