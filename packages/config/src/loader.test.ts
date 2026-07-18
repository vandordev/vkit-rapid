import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "./loader";

function withConfigDirectory(
  modules: Record<string, string>,
  run: (configDirectory: string) => void,
) {
  const configDirectory = mkdtempSync(join(tmpdir(), "vkit-config-"));

  try {
    for (const [name, contents] of Object.entries(modules)) {
      writeFileSync(join(configDirectory, `${name}.yaml`), contents);
    }

    run(configDirectory);
  } finally {
    rmSync(configDirectory, { force: true, recursive: true });
  }
}

test("loads the base, api, and web configuration modules", () => {
  const configDirectory = new URL("../../../config", import.meta.url).pathname;

  expect(
    loadConfig({
      configDirectory,
      modules: ["base", "api", "web"],
      environment: {
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://db",
      },
    }),
  ).toMatchObject({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://db",
    PORT: "4101",
    NEXT_PUBLIC_APP_URL: "http://localhost:4100",
  });
});

test("deep-merges objects while later arrays replace earlier arrays", () => {
  withConfigDirectory(
    {
      base: "http:\n  host: 127.0.0.1\n  port: 4100\nqueues:\n  - default\n",
      override: "http:\n  port: 4101\nqueues:\n  - critical\n",
    },
    (configDirectory) => {
      expect(
        loadConfig({ configDirectory, modules: ["base", "override"], environment: {} }),
      ).toEqual({
        http: { host: "127.0.0.1", port: 4101 },
        queues: ["critical"],
      });
    },
  );
});

test("rejects an absent configuration module", () => {
  withConfigDirectory({}, (configDirectory) => {
    expect(() => loadConfig({ configDirectory, modules: ["missing"], environment: {} })).toThrow(
      'Configuration module "missing" was not found',
    );
  });
});

test("rejects duplicate and invalid module names", () => {
  withConfigDirectory({ base: "value: base\n" }, (configDirectory) => {
    expect(() => loadConfig({ configDirectory, modules: ["base", "base"], environment: {} })).toThrow(
      'Configuration module "base" was selected more than once',
    );
    expect(() => loadConfig({ configDirectory, modules: ["../base"], environment: {} })).toThrow(
      'Invalid configuration module name "../base"',
    );
  });
});

test("rejects missing required interpolation values", () => {
  withConfigDirectory({ required: "DATABASE_URL: ${DATABASE_URL}\n" }, (configDirectory) => {
    expect(() => loadConfig({ configDirectory, modules: ["required"], environment: {} })).toThrow(
      'Missing configuration environment variable "DATABASE_URL" in module "required"',
    );
  });
});

test("interpolates present values, defaults, and explicit empty defaults", () => {
  withConfigDirectory(
    { defaults: "required: ${NAME}\ndefault: ${PORT:-4101}\noptional: ${OPTIONAL:-}\n" },
    (configDirectory) => {
      expect(
        loadConfig({
          configDirectory,
          modules: ["defaults"],
          environment: { NAME: "configured", PORT: "4200", OPTIONAL: "value" },
        }),
      ).toEqual({ required: "configured", default: "4200", optional: "value" });
      expect(loadConfig({ configDirectory, modules: ["defaults"], environment: { NAME: "configured" } })).toEqual(
        { required: "configured", default: "4101", optional: "" },
      );
      expect(
        loadConfig({
          configDirectory,
          modules: ["defaults"],
          environment: { NAME: "configured", PORT: "", OPTIONAL: "" },
        }),
      ).toEqual({ required: "configured", default: "4101", optional: "" });
    },
  );
});

test("interpolates only once and preserves non-interpolated scalar types", () => {
  withConfigDirectory(
    { values: "value: ${VALUE}\nport: 4101\nenabled: true\nempty: null\n" },
    (configDirectory) => {
      expect(
        loadConfig({
          configDirectory,
          modules: ["values"],
          environment: { VALUE: "${SECOND:-not-used}" },
        }),
      ).toEqual({ value: "${SECOND:-not-used}", port: 4101, enabled: true, empty: null });
    },
  );
});
