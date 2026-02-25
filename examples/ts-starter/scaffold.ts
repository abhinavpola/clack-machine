import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  biomeJsonContent,
  gitignoreContent,
  nxJsonContent,
  packageJsonContent,
  sampleIndexContent,
  type TemplateOptions,
  tsconfigContent,
} from "./templates";

type ScaffoldOptions = TemplateOptions;

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const dir = join(process.cwd(), opts.name);

  if (existsSync(dir)) {
    throw new Error(`Directory already exists: ${opts.name}`);
  }

  const srcDir = join(dir, "src");
  await mkdir(srcDir, { recursive: true });

  const writes: Promise<number>[] = [
    Bun.write(join(dir, "package.json"), packageJsonContent(opts)),
    Bun.write(join(dir, "tsconfig.json"), tsconfigContent(opts)),
    Bun.write(join(dir, "biome.json"), biomeJsonContent()),
    Bun.write(join(dir, ".gitignore"), gitignoreContent()),
    Bun.write(join(srcDir, "index.ts"), sampleIndexContent()),
  ];

  if (opts.nx) {
    writes.push(Bun.write(join(dir, "nx.json"), nxJsonContent()));
  }

  await Promise.all(writes);

  await Bun.$`git -C ${dir} init`.quiet();
}
