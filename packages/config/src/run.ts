import { loadConfig } from "./loader";

export type RunConfiguredCommandOptions = {
  command: readonly string[];
  configDirectory?: string;
  environment?: Record<string, string | undefined>;
  modules: readonly string[];
  stdio?: "inherit" | "pipe";
};

export type ConfiguredCommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export function resolvedConfigEnvironment(
  modules: readonly string[],
  environment: Record<string, string | undefined> = process.env,
  configDirectory?: string,
): Record<string, string> {
  const config = loadConfig({ configDirectory, modules, environment });

  return Object.fromEntries(
    Object.entries(config).flatMap(([key, value]) => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return [[key, String(value)]];
      }

      return [];
    }),
  );
}

export function publicConfigEnvironment(
  modules: readonly string[],
  environment: Record<string, string | undefined> = process.env,
  configDirectory?: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(resolvedConfigEnvironment(modules, environment, configDirectory)).filter(([key]) =>
      key.startsWith("NEXT_PUBLIC_"),
    ),
  );
}

export async function runConfiguredCommand({
  command,
  configDirectory,
  environment = process.env,
  modules,
  stdio = "pipe",
}: RunConfiguredCommandOptions): Promise<ConfiguredCommandResult> {
  if (command.length === 0) {
    throw new Error("A command is required after --");
  }

  const child = Bun.spawn({
    cmd: [...command],
    env: { ...environment, ...resolvedConfigEnvironment(modules, environment, configDirectory) },
    stderr: stdio,
    stdout: stdio,
  });

  if (stdio === "inherit") {
    return { exitCode: await child.exited, stderr: "", stdout: "" };
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stderr, stdout };
}

function parseCommandLine(arguments_: readonly string[]) {
  const modulesFlag = arguments_.indexOf("--modules");
  const separator = arguments_.indexOf("--");

  if (modulesFlag === -1 || modulesFlag + 1 >= arguments_.length) {
    throw new Error("Usage: run.ts --modules base,api -- command [arguments]");
  }
  if (separator === -1 || separator <= modulesFlag + 1) {
    throw new Error("Usage: run.ts --modules base,api -- command [arguments]");
  }

  const moduleList = arguments_[modulesFlag + 1];
  if (moduleList === undefined) {
    throw new Error("Usage: run.ts --modules base,api -- command [arguments]");
  }

  return {
    command: arguments_.slice(separator + 1),
    modules: moduleList.split(",").filter(Boolean),
  };
}

if (import.meta.main) {
  const { command, modules } = parseCommandLine(process.argv.slice(2));
  const result = await runConfiguredCommand({ command, modules, stdio: "inherit" });
  process.exitCode = result.exitCode;
}
