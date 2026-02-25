import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import { buildParseArgsOptions, camelToKebab, kebabToCamel } from "./args";
import { parseConfigArg } from "./config-parser";
import { runHeadless } from "./headless";
import { runInteractive } from "./interactive";
import { resolveNext } from "./machine";
import type { Result } from "./result";
import { generateSchema } from "./schema";
import type {
  AnyStateDef,
  CLIError,
  CLIOptions,
  Machine,
  MachineConfig,
  MachineOutput,
} from "./types";

export { defineMachine } from "./machine";

function findPositionalState(
  states: Record<string, AnyStateDef>
): string | undefined {
  for (const [key, state] of Object.entries(states)) {
    if (state.type === "task") {
      continue;
    }
    switch (state.type) {
      case "text":
        if (state.positional) {
          return key;
        }
        break;
      case "select":
      case "confirm":
        break;
      default: {
        state satisfies never;
      }
    }
  }
  return undefined;
}

function printHelp(
  states: Record<string, AnyStateDef>,
  description: string | undefined
): void {
  const lines: string[] = [];
  if (description) {
    lines.push(description);
    lines.push("");
  }
  lines.push("Usage:");
  lines.push("  create-ts [options]");
  lines.push("");
  lines.push("Options:");
  for (const [key, state] of Object.entries(states)) {
    if (state.type === "task") {
      continue;
    }
    const flag = `--${camelToKebab(key)}`;
    let line = `  ${flag}`;
    switch (state.type) {
      case "text":
        line += " <string>";
        break;
      case "select":
        line += ` <${state.options.map((o) => o.value).join("|")}>`;
        break;
      case "confirm":
        break;
      default: {
        state satisfies never;
      }
    }
    line += `  ${state.message}`;
    if (state.defaultValue !== undefined) {
      line += ` (default: ${String(state.defaultValue)})`;
    }
    lines.push(line);
  }
  lines.push(
    "  --config <json|yaml|file>  Load config from JSON/YAML string or file"
  );
  lines.push("  --schema                   Print JSON Schema and exit");
  lines.push("  -y, --yes                  Accept all defaults");
  lines.push("  -h, --help                 Show this help");
  console.log(lines.join("\n"));
}

// Walks the machine and prints all skipped prefill values for visibility
function logSkippedPrefill(
  config: MachineConfig,
  prefill: Record<string, string | boolean>
): void {
  let currentId: string | null = config.initial;
  while (currentId !== null) {
    const state = config.states[currentId];
    if (!state) {
      break;
    }
    if (state.type === "task") {
      break;
    }
    const val = prefill[currentId];
    if (val !== undefined) {
      p.log.info(`${camelToKebab(currentId)}: ${String(val)}`);
      currentId = resolveNext(state, val);
    } else {
      break;
    }
  }
}

export async function createCLI<
  S extends Record<string, AnyStateDef>,
  O extends MachineOutput<S>,
>(
  machine: Machine<S, O>,
  options?: CLIOptions<O>
): Promise<Result<O, CLIError>>;

export async function createCLI(
  machine: { config: MachineConfig },
  options?: CLIOptions<Record<string, string | boolean>>
): Promise<Result<Record<string, string | boolean>, CLIError>> {
  const { config } = machine;
  const stateOptions = buildParseArgsOptions(config.states);

  const { values, positionals } = parseArgs({
    args: options?.args ? [...options.args] : process.argv.slice(2),
    options: {
      ...stateOptions,
      config: { type: "string" },
      schema: { type: "boolean", default: false },
      yes: { type: "boolean", short: "y", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.schema === true) {
    console.log(JSON.stringify(generateSchema(config.states), null, 2));
    process.exit(0);
  }

  if (values.help === true) {
    printHelp(config.states, options?.description);
    process.exit(0);
  }

  // Collect flag values, converting kebab-case keys to camelCase
  const rawValues: Record<string, string | boolean> = {};

  for (const [kebabKey, value] of Object.entries(values)) {
    if (["config", "schema", "yes", "help"].includes(kebabKey)) {
      continue;
    }
    if (typeof value === "string" || typeof value === "boolean") {
      rawValues[kebabToCamel(kebabKey)] = value;
    }
  }

  // Merge --config values (individual flags take precedence)
  if (typeof values.config === "string") {
    const configValues = await parseConfigArg(values.config);
    for (const [key, value] of Object.entries(configValues)) {
      if (
        !(key in rawValues) &&
        (typeof value === "string" || typeof value === "boolean")
      ) {
        rawValues[key] = value;
      }
    }
  }

  // Resolve positional argument
  const positionalStateId = findPositionalState(config.states);
  const positionalArg = positionals[0];
  if (
    positionalStateId !== undefined &&
    positionalArg !== undefined &&
    !(positionalStateId in rawValues)
  ) {
    rawValues[positionalStateId] = positionalArg;
  }

  const isTTY = Boolean(process.stdin.isTTY);
  const useYes = values.yes === true;
  const intro = options?.intro ?? "CLI";
  const outroFn = options?.outro;

  if (!isTTY || useYes) {
    const result = await runHeadless(config, rawValues, useYes);
    if (!result.ok) {
      return result;
    }
    const outroText =
      typeof outroFn === "function"
        ? outroFn(result.value)
        : (outroFn ?? "Done!");
    console.log(outroText);
    return result;
  }

  p.intro(intro);
  logSkippedPrefill(config, rawValues);
  const result = await runInteractive(config, rawValues);
  if (!result.ok) {
    return result;
  }
  const outroText =
    typeof outroFn === "function"
      ? outroFn(result.value)
      : (outroFn ?? "Done!");
  p.outro(outroText);
  return result;
}
