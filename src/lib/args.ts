import type { AnyStateDef } from "./types";

export function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

interface ParseArgsOptionConfig {
  type: "string" | "boolean";
  short?: string;
  default?: string | boolean;
}

export function buildParseArgsOptions(
  states: Record<string, AnyStateDef>
): Record<string, ParseArgsOptionConfig> {
  const options: Record<string, ParseArgsOptionConfig> = {};

  for (const [key, state] of Object.entries(states)) {
    const flagName = camelToKebab(key);
    switch (state.type) {
      case "task":
        break;
      case "confirm":
        options[flagName] = {
          type: "boolean",
          default: state.defaultValue ?? false,
        };
        break;
      case "text":
      case "select": {
        const opt: ParseArgsOptionConfig = { type: "string" };
        if (state.defaultValue !== undefined) {
          opt.default = state.defaultValue;
        }
        options[flagName] = opt;
        break;
      }
      default: {
        state satisfies never;
      }
    }
  }

  return options;
}
