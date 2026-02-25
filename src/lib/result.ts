export type Result<T, E = unknown> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type CLIError =
  | { readonly kind: "cancel" }
  | {
      readonly kind: "task";
      readonly stateId: string;
      readonly cause: unknown;
    };
