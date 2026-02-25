import * as p from "@clack/prompts";
import { resolveNext } from "./machine";
import type { AnyStateDef, MachineConfig } from "./types";

async function promptForState(
  state: AnyStateDef,
  prefillValue: string | boolean | undefined
): Promise<string | boolean | symbol> {
  switch (state.type) {
    case "text":
      return p.text({
        message: state.message,
        placeholder: state.placeholder,
        initialValue: typeof prefillValue === "string" ? prefillValue : "",
        validate: state.validate,
      });
    case "select":
      return p.select({
        message: state.message,
        options: state.options.map((o) => ({
          value: o.value,
          label: o.label ?? o.value,
          hint: o.hint,
        })),
        initialValue:
          typeof prefillValue === "string" ? prefillValue : state.defaultValue,
      });
    case "confirm":
      return p.confirm({
        message: state.message,
        initialValue:
          typeof prefillValue === "boolean"
            ? prefillValue
            : (state.defaultValue ?? false),
      });
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export async function runInteractive(
  config: MachineConfig,
  prefill: Record<string, string | boolean>
): Promise<Record<string, string | boolean>> {
  const values: Record<string, string | boolean> = {};
  let currentId: string | null = config.initial;

  while (currentId !== null) {
    const state = config.states[currentId];
    if (!state) {
      break;
    }

    const prefillValue = prefill[currentId];
    let value: string | boolean;

    if (prefillValue !== undefined) {
      value = prefillValue;
    } else {
      const result = await promptForState(state, undefined);
      if (p.isCancel(result)) {
        p.cancel("Cancelled.");
        process.exit(0);
      }
      // TypeScript narrows result to string | boolean after isCancel guard + exit
      value = result;
    }

    values[currentId] = value;
    currentId = resolveNext(state, value);
  }

  return values;
}
