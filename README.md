# clack-machine

State machine CLI form builder powered by [@clack/prompts](https://github.com/natemoo-re/clack).

Define your CLI wizard as a typed state machine. Get interactive prompts, CLI flags, headless mode, config file loading, and JSON Schema generation — all automatically.

## Install

```sh
bun add clack-machine
```

## Quick start

```ts
#!/usr/bin/env bun
import { createCLI, defineMachine, ok, err } from "clack-machine";

const machine = defineMachine({
  initial: "name",
  states: {
    name: {
      type: "text",
      message: "Project name",
      placeholder: "my-app",
      positional: true,
      next: "language",
    },
    language: {
      type: "select",
      message: "Language",
      options: [
        { value: "ts", label: "TypeScript" },
        { value: "js", label: "JavaScript" },
      ],
      next: "scaffold",
    },
    scaffold: {
      type: "task",
      message: "Scaffolding project",
      run: async (values) => {
        try {
          await writeFiles(values);
          return ok(null);
        } catch (e) {
          return err(e);
        }
      },
      next: { ok: null, err: "name" }, // on failure, loop back to name
    },
  },
});

const result = await createCLI(machine, {
  intro: "create-app",
  outro: (r) => `Done! cd ${r.name}`,
});

if (!result.ok) {
  if (result.error.kind === "cancel") process.exit(0);
  console.error(result.error.cause);
  process.exit(1);
}

// result.value is fully typed: { name: string; language: "ts" | "js" }
// (task states are excluded from the output type)
console.log(result.value);
```

Run it:

```sh
bun cli.ts               # interactive prompts
bun cli.ts my-app --language ts  # prefill from flags
bun cli.ts -y            # accept all defaults non-interactively
```

## State types

### `text`

Free-text input.

```ts
{
  type: "text";
  message: string;
  placeholder?: string;
  defaultValue?: string;
  positional?: true;           // also accept as first positional argument
  validate?: (v: string | undefined) => string | undefined;
  next: string | null | ((v: string) => string | null);
}
```

### `select`

Pick from a list.

```ts
{
  type: "select";
  message: string;
  options: Array<{ value: string; label?: string; hint?: string }>;
  defaultValue?: string;
  next: string | null | ((v: string) => string | null);
}
```

### `confirm`

Yes/no question.

```ts
{
  type: "confirm";
  message: string;
  defaultValue?: boolean;
  next: string | null | ((v: boolean) => string | null);
}
```

### `task`

Runs async logic (file writes, API calls, etc.) as a step inside the machine. Shows a spinner in interactive mode. Routes to different states based on success or failure — so the machine can retry instead of crashing.

```ts
{
  type: "task";
  message: string;               // spinner label
  run: (values) => Promise<Result<null, E>>;
  next: {
    ok: string | null;           // state to go to on success
    err: string | null;          // state to go to on failure (null = return Err)
  };
}
```

`values` contains all prompt answers collected so far. Use `ok(null)` and `err(cause)` from `clack-machine` as the return values:

```ts
import { ok, err } from "clack-machine";

scaffold: {
  type: "task",
  message: "Scaffolding project",
  run: async (values) => {
    try {
      await writeFiles(values.name);
      return ok(null);
    } catch (e) {
      return err(e);
    }
  },
  next: { ok: null, err: "name" },
},
```

Task states are excluded from `MachineOutput` — they don't appear in the result value or `--help` / `--schema` output.

## Result

`createCLI` returns `Promise<Result<O, CLIError>>` instead of throwing. Check `result.ok` before using the value:

```ts
const result = await createCLI(machine, options);

if (!result.ok) {
  if (result.error.kind === "cancel") {
    // user pressed Ctrl-C
    process.exit(0);
  }
  // result.error.kind === "task"
  // result.error.stateId — which task state failed
  // result.error.cause   — the original error
  console.error(result.error.cause);
  process.exit(1);
}

// result.value — typed output, task states excluded
```

In **headless mode**, task failures always return `Err` (there is no interactive retry).

## Transitions

The `next` field controls flow between states:

- `"stateName"` — always go to that state
- `null` — end the machine
- `(value) => string | null` — branch based on the answer

```ts
typescript: {
  type: "confirm",
  message: "Use TypeScript?",
  next: (yes) => (yes ? "tsconfig" : "eslint"),
},
```

## Automatic CLI flags

Every prompt state becomes a CLI flag. `camelCase` state keys become `--kebab-case` flags:

```sh
my-cli --project-name foo --language ts --install
```

Flags prefill answers and skip those prompts. Any unprefilled states are prompted interactively.

## Positional argument

Mark one `text` state with `positional: true` to accept it as the first positional argument:

```sh
my-cli my-app --language ts
# equivalent to: my-cli --name my-app --language ts
```

## Headless / non-interactive mode

When stdin is not a TTY (pipes, CI), the CLI runs headlessly — all required values must be provided via flags or have defaults. Validation still runs.

Pass `-y` / `--yes` to accept all defaults without any prompts:

```sh
my-cli --name my-app -y
```

## Config file

Load answers from a JSON or YAML source via `--config`. Individual flags take precedence.

```sh
my-cli --config config.json          # from file
my-cli --config config.yaml          # from file
my-cli --config '{"name":"my-app"}'  # inline JSON
my-cli --config 'name: my-app'       # inline YAML
```

## JSON Schema

Print a JSON Schema describing the machine's input (useful for editor validation of config files):

```sh
my-cli --schema
```

## Help

Auto-generated help text listing all flags, types, and defaults:

```sh
my-cli --help
```

## `createCLI` options

```ts
createCLI(machine, {
  intro?: string;                           // banner shown at start
  outro?: string | ((result: O) => string); // message shown at end
  description?: string;                     // shown in --help
  args?: string[];                          // override process.argv (useful in tests)
})
```

## Bundling your CLI

### Standalone binary (no runtime needed)

`bun build --compile` bundles your script and embeds a Bun runtime into a single executable:

```sh
bun build --compile ./cli.ts --outfile my-cli
./my-cli
```

### Bundled JS (requires Bun)

```sh
bun build ./cli.ts --outfile dist/cli.js
bun dist/cli.js
```

### Publish to npm with `bunx` support

Add a `bin` entry and publish normally:

```json
{
  "name": "create-my-app",
  "bin": { "create-my-app": "./cli.ts" },
  "dependencies": { "clack-machine": "*" }
}
```

```sh
npm publish
bunx create-my-app
```
