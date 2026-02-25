import { camelToKebab } from "./args";
import { resolveNext } from "./machine";
import { err, ok } from "./result";
import type {
  AnyStateDef,
  CLIError,
  MachineConfig,
  PromptStateDef,
  Result,
} from "./types";

function validateValue(
  id: string,
  state: PromptStateDef,
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

export async function runHeadless(
  config: MachineConfig,
  rawValues: Record<string, string | boolean>,
  useYes: boolean
): Promise<Result<Record<string, string | boolean>, CLIError>> {
  const output: Record<string, string | boolean> = {};
  let currentId: string | null = config.initial;

  while (currentId !== null) {
    const state: AnyStateDef | undefined = config.states[currentId];
    if (!state) {
      break;
    }

    if (state.type === "task") {
      const taskResult = await state.run(output);
      if (!taskResult.ok) {
        return err({
          kind: "task",
          stateId: currentId,
          cause: taskResult.error,
        });
      }
      currentId = state.next.ok;
      continue;
    }

    // Prompt state
    const provided = rawValues[currentId];
    let value: string | boolean;

    if (provided !== undefined) {
      validateValue(currentId, state, provided);
      value = provided;
    } else if (state.defaultValue !== undefined) {
      value = state.defaultValue;
    } else {
      switch (state.type) {
        case "confirm":
          value = false;
          break;
        case "text":
        case "select":
          if (useYes) {
            return err({
              kind: "task",
              stateId: currentId,
              cause: new Error(`no default for --${camelToKebab(currentId)}`),
            });
          }
          return err({
            kind: "task",
            stateId: currentId,
            cause: new Error(
              `missing required flag --${camelToKebab(currentId)}`
            ),
          });
        default: {
          const _exhaustive: never = state;
          throw new Error(
            `unsupported state type in runHeadless: ${String(_exhaustive)}`
          );
        }
      }
    }

    output[currentId] = value;
    currentId = resolveNext(state, value);
  }

  return ok(output);
}
