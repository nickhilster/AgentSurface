import { readFileSync } from "node:fs";

const [reportPath = ".agentsurface/validate-report.json", ...flags] = process.argv.slice(2);
const strictDrift = flags.includes("--strict-drift");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
if (!Array.isArray(report.records)) throw new Error("Validation report does not contain a records array.");

const failures = report.records.filter((record) => record.status === "fail" &&
  (strictDrift || record.check !== "drift"));
if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[${failure.check}] ${failure.path}: ${failure.detail}`);
  }
  process.exitCode = 1;
} else {
  console.log(strictDrift
    ? "No validation failures (strict drift enabled)."
    : "No truth or safety failures; content drift is informational unless strict mode is enabled.");
}
