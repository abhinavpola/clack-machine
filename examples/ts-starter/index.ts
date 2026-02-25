#!/usr/bin/env bun
import { createCLI, defineMachine, err, ok } from "../../src";
import { scaffold } from "./scaffold";

const machine = defineMachine({
  initial: "name",
  states: {
    name: {
      type: "text",
      message: "Project name",
      placeholder: "my-project",
      positional: true,
      validate(v) {
        if (!v?.trim()) {
          return "Project name is required";
        }
        if (!/^[a-z0-9@/_.-]+$/.test(v)) {
          return "Use lowercase letters, numbers, hyphens, underscores, or scoped names (@scope/name)";
        }
      },
      next: "typescript",
    },
    typescript: {
      type: "select",
      message: "TypeScript compiler",
      options: [
        { value: "tsgo", label: "tsgo", hint: "~10x faster Go-based compiler" },
        { value: "tsc", label: "tsc", hint: "standard TypeScript compiler" },
      ],
      defaultValue: "tsgo",
      next: "nx",
    },
    nx: {
      type: "confirm",
      message: "Add NX with TypeScript project references?",
      defaultValue: false,
      next: "scaffold",
    },
    scaffold: {
      type: "task",
      message: "Scaffolding project",
      run: async (values) => {
        try {
          await scaffold({
            name: String(values.name),
            typescript: values.typescript === "tsc" ? "tsc" : "tsgo",
            nx: Boolean(values.nx),
          });
          return ok(null);
        } catch (e) {
          return err(e);
        }
      },
      next: { ok: null, err: "name" },
    },
  },
});

const result = await createCLI(machine, {
  intro: "create-ts — TypeScript project scaffolder",
  outro: (r) => `Done!  cd ${r.name} && bun install`,
  description: "Scaffold a new TypeScript project with Biome, Knip, and Bun",
});

if (!result.ok) {
  if (result.error.kind === "cancel") {
    process.exit(0);
  }
  console.error(result.error.cause);
  process.exit(1);
}
