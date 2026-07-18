import { expect, test } from "bun:test";

test("containers use the committed YAML configuration and one root environment file", async () => {
  const [compose, webDockerfile, apiDockerfile, workerDockerfile, schedulerDockerfile, realtimeDockerfile] = await Promise.all([
    Bun.file("docker-compose.yml").text(),
    Bun.file("Dockerfile.web").text(),
    Bun.file("Dockerfile.api").text(),
    Bun.file("Dockerfile.worker").text(),
    Bun.file("Dockerfile.scheduler").text(),
    Bun.file("Dockerfile.realtime").text(),
  ]);

  expect(compose).toContain("- .env");
  expect(compose).not.toContain(".env.web");
  expect(compose).not.toContain(".env.api");

  for (const dockerfile of [webDockerfile, apiDockerfile, workerDockerfile, schedulerDockerfile, realtimeDockerfile]) {
    expect(dockerfile).toContain("/app/config");
  }
});
