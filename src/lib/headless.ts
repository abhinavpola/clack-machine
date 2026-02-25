import { camelToKebab } from "./args";
import { traverseMachine } from "./machine";
import type { AnyStateDef, MachineConfig } from "./types";

function validateValue(
  id: string,
  state: AnyStateDef,
  value: string | boolean
): void {
  switch (state.type) {
    case "text": {
      if (state.validate) {
        const error = state.validate(
          typeof value === "string" ? value : undefined
        );
        if (error) {
          throw new Error(`--${camelToKebab(id)}: ${error}`);
        }
      }
      return;
    }
    case "select": {
      const validValues = state.options.map((o) => o.value);
      if (typeof value !== "string" || !validValues.includes(value)) {
        throw new Error(
          `--${camelToKebab(id)}: must be one of ${validValues.join(", ")}`
        );
      }
      return;
    }
    case "confirm":
      return;
    default: {
      state satisfies never;
      throw new Error("Unhandled state type in validateValue");
    }
  }
}

export function runHeadless(
  config: MachineConfig,
  rawValues: Record<string, string | boolean>,
  useYes: boolean
): Record<string, string | boolean> {
  const visited = traverseMachine(config, rawValues);
  const output: Record<string, string | boolean> = {};

  for (const { id, state } of visited) {
    const provided = rawValues[id];
    if (provided !== undefined) {
      validateValue(id, state, provided);
      output[id] = provided;
    } else {
      if (state.defaultValue !== undefined) {
        output[id] = state.defaultValue;
        continue;
      }

      switch (state.type) {
        case "confirm":
          output[id] = false;
          break;
        case "text":
        case "select":
          if (useYes) {
            throw new Error(`no default for --${camelToKebab(id)}`);
          }
          throw new Error(`missing required flag --${camelToKebab(id)}`);
        default: {
          const _exhaustive: never = state;
          throw new Error("unsupported state type in runHeadless");
        }
      }
    }
  }

  return output;
}
