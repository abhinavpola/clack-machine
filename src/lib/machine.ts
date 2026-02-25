import type {
  AnyStateDef,
  Machine,
  MachineConfig,
  MachineOutput,
  PromptStateDef,
  TaskStateDef,
} from "./types";

export function defineMachine<const S extends Record<string, AnyStateDef>>(
  config: { initial: keyof S & string; states: S } & (S extends Record<
    string,
    AnyStateDef<keyof S & string>
  >
    ? unknown
    : { states: { [K in keyof S]: AnyStateDef<keyof S & string> } })
): Machine<S, MachineOutput<S>>;

export function defineMachine(
  config: MachineConfig
): Machine<Record<string, AnyStateDef>> {
  return { config };
}

export function resolveNext(
  state: PromptStateDef,
  value: string | boolean
): string | null {
  switch (state.type) {
    case "confirm": {
      const { next } = state;
      if (next === null || typeof next === "string") {
        return next;
      }
      if (typeof value === "boolean") {
        return next(value);
      }
      return null;
    }
    case "text": {
      const { next } = state;
      if (next === null || typeof next === "string") {
        return next;
      }
      if (typeof value === "string") {
        return next(value);
      }
      return null;
    }
    case "select": {
      const { next } = state;
      if (next === null || typeof next === "string") {
        return next;
      }
      if (typeof value === "string") {
        return next(value);
      }
      return null;
    }
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function resolveTaskNext(
  state: TaskStateDef,
  outcome: "ok" | "err"
): string | null {
  return state.next[outcome];
}

function syntheticZero(state: PromptStateDef): string | boolean {
  switch (state.type) {
    case "confirm":
      return false;
    case "select":
      return state.options[0]?.value ?? "";
    case "text":
      return "";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function traverseMachine(
  config: MachineConfig,
  values: Record<string, string | boolean>
): Array<{ id: string; state: PromptStateDef }> {
  const visited: Array<{ id: string; state: PromptStateDef }> = [];
  let currentId: string | null = config.initial;

  while (currentId !== null) {
    const state: AnyStateDef | undefined = config.states[currentId];
    if (!state) {
      break;
    }
    if (state.type === "task") {
      // Skip task states — follow ok path, don't add to visited
      currentId = state.next.ok;
      continue;
    }
    visited.push({ id: currentId, state });
    const effectiveValue =
      values[currentId] ?? state.defaultValue ?? syntheticZero(state);
    currentId = resolveNext(state, effectiveValue);
  }

  return visited;
}
