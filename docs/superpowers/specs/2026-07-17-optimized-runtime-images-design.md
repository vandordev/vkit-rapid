# Optimized Runtime Images Design

## Goal

Make every deployable runtime image small, reproducible, and isolated to its own workspace dependency graph.

## Scope

- Use `turbo prune --docker <workspace>` for web, API, worker, scheduler, and optional realtime images.
- Use separate build-dependency and production-dependency stages for non-web runtimes.
- Keep the Next.js standalone image for web, with Bun and Next BuildKit caches during build.
- Run each final image as a non-root user where its runtime supports it.
- Add Dockerfile boundary tests and local multi-platform-compatible build verification.
- Tighten `.dockerignore` to omit local dependencies, build artifacts, environments, test outputs, and Git metadata.

## Design

Every Dockerfile begins from a pinned Bun Alpine base and creates a pruned workspace output for the runtime it builds. The build stage installs the complete pruned dependency graph and performs TypeScript/Next/Prisma generation as needed. Non-web final stages install only production dependencies from the same pruned manifest, then copy compiled runtime output and required generated Prisma artifacts.

The web image retains its current Next standalone runner. It uses the pruned full source, builds with Node.js, and copies only `.next/standalone`, static output, and public assets into a non-root Node runner.

Prisma generation occurs only in API/worker builds because those runtimes may import the generated client. Scheduler and realtime images do not generate or copy Prisma artifacts unless their future direct dependency graph requires them.

Dockerfile contract tests read the files as text and assert the pruner stage, production-dependency stage for non-web images, and absence of a final-stage builder `node_modules` copy. Each runtime is also built with Buildx for `linux/amd64`.

## Non-goals

- Pushing images to Docker Hub or another registry.
- Deployment manifests, CI/CD pipelines, or registry credentials.
- Adding optional runtimes to the default Compose profile.
- Choosing production image-size budgets that vary across host architectures.

## Verification

- Bun tests validate the Dockerfile structural invariants.
- `docker buildx build --load --platform=linux/amd64` succeeds for each available runtime image.
- `docker image inspect` confirms final containers use the intended entrypoint and non-root user where configured.

