import * as p from "@clack/prompts";
import { resolveNext } from "./machine";
import { err, ok } from "./result";
import type {
  AnyStateDef,
  CLIError,
  MachineConfig,
  PromptStateDef,
  Result,
} from "./types";

async function promptForState(
  state: PromptStateDef,
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
): Promise<Result<Record<string, string | boolean>, CLIError>> {
  const values: Record<string, string | boolean> = {};
  let currentId: string | null = config.initial;

  while (currentId !== null) {
    const state: AnyStateDef | undefined = config.states[currentId];
    if (!state) {
      break;
    }

    if (state.type === "task") {
      const s = p.spinner();
      s.start(state.message);
      const taskResult = await state.run(values);
      if (taskResult.ok) {
        s.stop(state.message);
        currentId = state.next.ok;
      } else {
        const errMsg =
          taskResult.error instanceof Error
            ? taskResult.error.message
            : String(taskResult.error);
        s.stop(`${state.message} — ${errMsg}`);
        if (state.next.err === null) {
          return err({
            kind: "task",
            stateId: currentId,
            cause: taskResult.error,
          });
        }
        currentId = state.next.err;
      }
      continue;
    }

    // Prompt state
    const prefillValue = prefill[currentId];
    let value: string | boolean;

    if (prefillValue !== undefined) {
      value = prefillValue;
    } else {
      const result = await promptForState(state, undefined);
      if (p.isCancel(result)) {
        p.cancel("Cancelled.");
        return err({ kind: "cancel" });
      }
      // TypeScript narrows result to string | boolean after isCancel guard + return
      value = result;
    }

    values[currentId] = value;
    currentId = resolveNext(state, value);
  }

  return ok(values);
}
