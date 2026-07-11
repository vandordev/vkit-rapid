import { expect, test } from "bun:test";

const taskfile = await Bun.file("Taskfile.yml").text();

test("Taskfile exposes every runtime operation", () => {
  for (const task of [
    "build:api",
    "build:web",
    "build:worker",
    "build:scheduler",
    "dev:standalone-api",
    "dev:jobs",
    "start:jobs",
    "test:api",
    "test:web",
    "test:worker",
    "test:scheduler",
    "test:config",
    "test:queue",
    "test:database",
    "lint:api",
    "lint:web",
    "lint:worker",
    "lint:scheduler",
    "check-types:api",
    "check-types:web",
    "check-types:worker",
    "check-types:scheduler",
    "db:generate",
    "compose:up",
    "compose:jobs",
    "compose:down",
    "web:health",
  ]) {
    expect(taskfile).toContain(`  ${task}:`);
  }
});
