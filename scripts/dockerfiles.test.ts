import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

const root = join(import.meta.dir, "..");

for (const [file, workspace] of [["Dockerfile.api", "@repo/api"], ["Dockerfile.worker", "@repo/worker"], ["Dockerfile.scheduler", "@repo/scheduler"]] as const) {
  test(`${file} prunes and ships only production dependencies`, () => {
    const dockerfile = readFileSync(join(root, file), "utf8");
    expect(dockerfile).toContain(`turbo@2.8.1 prune ${workspace} --docker`);
    expect(dockerfile).toContain("bun install --production --frozen-lockfile --ignore-scripts");
    expect(dockerfile).not.toContain("COPY --from=builder /app/node_modules ./node_modules");
  });
}

test("Dockerfile.web builds from a pruned graph", () => {
  expect(readFileSync(join(root, "Dockerfile.web"), "utf8")).toContain("turbo@2.8.1 prune web --docker");
});
