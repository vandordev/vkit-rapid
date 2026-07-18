import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runConfiguredCommand } from "./run";

test("runs a child command with scalar values resolved from YAML modules", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vkit-config-run-"));
  const fixturePath = join(directory, "print-env.ts");

  try {
    writeFileSync(join(directory, "base.yaml"), "DATABASE_URL: ${DATABASE_URL}\n");
    writeFileSync(join(directory, "api.yaml"), "PORT: ${PORT:-4101}\n");
    writeFileSync(fixturePath, 'console.log(JSON.stringify({ PORT: process.env.PORT }));\n');

    const result = await runConfiguredCommand({
      configDirectory: directory,
      modules: ["base", "api"],
      environment: { DATABASE_URL: "postgresql://db" },
      command: [process.execPath, fixturePath],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"PORT":"4101"');
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
