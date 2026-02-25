import { parse as parseYaml } from "yaml";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function parseConfigArg(
  raw: string
): Promise<Record<string, unknown>> {
  if (raw.endsWith(".json") || raw.endsWith(".yaml") || raw.endsWith(".yml")) {
    const text = await Bun.file(raw).text();
    if (raw.endsWith(".json")) {
      const parsed: Record<string, unknown> = JSON.parse(text);
      return parsed;
    }
    const parsed: unknown = parseYaml(text);
    if (!isRecord(parsed)) {
      throw new Error("Invalid YAML config: expected an object");
    }
    return parsed;
  }

  if (raw.startsWith("{")) {
    const parsed: Record<string, unknown> = JSON.parse(raw);
    return parsed;
  }

  // Inline YAML
  const parsed: unknown = parseYaml(raw);
  if (!isRecord(parsed)) {
    throw new Error("Invalid YAML config: expected an object");
  }
  return parsed;
}
