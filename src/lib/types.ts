import type { Result } from "./result";

export type { CLIError, Result } from "./result";

export interface TextStateDef<Keys extends string = string> {
  readonly type: "text";
  readonly message: string;
  readonly placeholder?: string;
  readonly defaultValue?: string;
  readonly positional?: true;
  readonly validate?: (v: string | undefined) => string | undefined;
  readonly next: Keys | null | ((v: string) => Keys | null);
}

export interface SelectStateDef<
  O extends ReadonlyArray<{
    readonly value: string;
    readonly label?: string;
    readonly hint?: string;
  }>,
  Keys extends string = string,
> {
  readonly type: "select";
  readonly message: string;
  readonly options: O;
  readonly defaultValue?: O[number]["value"];
  readonly next: Keys | null | ((v: O[number]["value"]) => Keys | null);
}

export interface ConfirmStateDef<Keys extends string = string> {
  readonly type: "confirm";
  readonly message: string;
  readonly defaultValue?: boolean;
  readonly next: Keys | null | ((v: boolean) => Keys | null);
}

export interface TaskStateDef<E = unknown, Keys extends string = string> {
  readonly type: "task";
  readonly message: string;
  readonly run: (
    values: Record<string, string | boolean>
  ) => Promise<Result<null, E>>;
  readonly next: { ok: Keys | null; err: Keys | null };
}

export type PromptStateDef<Keys extends string = string> =
  | TextStateDef<Keys>
  | SelectStateDef<
      ReadonlyArray<{
        readonly value: string;
        readonly label?: string;
        readonly hint?: string;
      }>,
      Keys
    >
  | ConfirmStateDef<Keys>;

export type AnyStateDef<Keys extends string = string> =
  | PromptStateDef<Keys>
  | TaskStateDef<unknown, Keys>;

export type StateValue<S extends PromptStateDef> = S extends { type: "confirm" }
  ? boolean
  : S extends { type: "text" }
    ? string
    : S extends {
          type: "select";
          options: ReadonlyArray<{ value: infer V }>;
        }
      ? V
      : never;

export type MachineOutput<States extends Record<string, AnyStateDef>> = {
  [K in keyof States as States[K] extends { type: "task" }
    ? never
    : K]: States[K] extends PromptStateDef ? StateValue<States[K]> : never;
};

export interface Machine<
  S extends Record<string, AnyStateDef>,
  // O is phantom — constrained at defineMachine/createCLI call sites, not here
  O = Record<string, string | boolean>,
> {
  readonly config: { initial: keyof S & string; states: S };
  readonly _output?: O; // phantom; never assigned at runtime
}

export interface CLIOptions<O> {
  intro?: string;
  outro?: string | ((result: O) => string);
  description?: string;
  args?: readonly string[];
}

export type MachineConfig = {
  initial: string;
  states: Record<string, AnyStateDef>;
};
