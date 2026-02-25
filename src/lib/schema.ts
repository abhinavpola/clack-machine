import { camelToKebab } from "./args";
import type { AnyStateDef } from "./types";

export function generateSchema(
  states: Record<string, AnyStateDef>
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  let positional: string | undefined;
  const flags: Record<string, string> = {};

  for (const [key, state] of Object.entries(states)) {
    if (state.type === "task") {
      continue;
    }
    flags[key] = `--${camelToKebab(key)}`;

    switch (state.type) {
      case "text": {
        const prop: Record<string, unknown> = {
          type: "string",
          description: state.message,
        };
        if (state.defaultValue !== undefined) {
          prop.default = state.defaultValue;
        }
        properties[key] = prop;
        if (state.defaultValue === undefined) {
          required.push(key);
        }
        if (state.positional) {
          positional = key;
        }
        break;
      }
      case "select": {
        const prop: Record<string, unknown> = {
          type: "string",
          enum: state.options.map((o) => o.value),
          description: state.message,
        };
        if (state.defaultValue !== undefined) {
          prop.default = state.defaultValue;
        }
        properties[key] = prop;
        break;
      }
      case "confirm":
        properties[key] = {
          type: "boolean",
          description: state.message,
          default: state.defaultValue ?? false,
        };
        break;
      default: {
        const _exhaustive: never = state;
        void _exhaustive;
      }
    }
  }

  const xCli: Record<string, unknown> = { flags };
  if (positional !== undefined) {
    xCli.positional = positional;
  }

  return {
    $schema: "https://json-schema.org/draft-07/schema",
    type: "object",
    properties,
    required,
    "x-cli": xCli,
  };
}
