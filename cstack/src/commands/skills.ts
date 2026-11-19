import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import {
  addRule,
  backupTaken,
  PERMISSION_RULE,
  readSettings,
} from "../claude-settings.js";
import type { Io } from "../io.js";

const USAGE = "Usage: cstack skills install [--adopt <name>]... [--add-permission]\n";
const NAME = /^[a-z0-9][a-z0-9-]*$/;
const MARKER = ".cstack-managed";

export type SkillsOptions = {
  home: string;
  packageRoot: string;
  now?: () => Date;
  uid?: number;
};

type Owner = "missing" | "cstack" | "not a folder" | "a symbolic link" | "no marker";

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

// WHY: ADR-SIC-C. The marker is the only proof that cstack wrote a folder, so a link,
// a plain file or an unmarked folder is always someone else's work.
// A target is ours only when it is a real folder (never a link) with the marker.
async function ownerOf(path: string): Promise<Owner> {
  let info;
  try {
    info = await lstat(path);
  } catch {
    return "missing";
  }
  if (info.isSymbolicLink()) return "a symbolic link";
  if (!info.isDirectory()) return "not a folder";
  return (await exists(join(path, MARKER))) ? "cstack" : "no marker";
}

async function sameFolder(a: string, b: string): Promise<boolean> {
  const left = (await readdir(a, { withFileTypes: true })).sort((x, y) =>
    x.name.localeCompare(y.name),
  );
  const right = (await readdir(b, { withFileTypes: true })).sort((x, y) =>
    x.name.localeCompare(y.name),
  );
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    const l = left[i]!;
    const r = right[i]!;
    if (l.name !== r.name) return false;
    const lp = join(a, l.name);
    const rp = join(b, r.name);
    if (l.isDirectory() && r.isDirectory()) {
      if (!(await sameFolder(lp, rp))) return false;
    } else if (l.isSymbolicLink() && r.isSymbolicLink()) {
      if ((await readlink(lp)) !== (await readlink(rp))) return false;
    } else if (l.isFile() && r.isFile()) {
      if (!(await readFile(lp)).equals(await readFile(rp))) return false;
    } else {
      return false;
    }
  }
  return true;
}

// Rename; across disks (EXDEV) copy and then delete, as mv does.
export async function moveFolder(
  from: string,
  to: string,
  renameFn: typeof rename = rename,
): Promise<void> {
  try {
    await renameFn(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    await cp(from, to, { recursive: true, verbatimSymlinks: true });
    await rm(from, { recursive: true, force: true });
  }
}

function stamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}

type Plan =
  | { name: string; action: "installed" | "unchanged" }
  | { name: string; action: "replaced" | "removed" }
  | { name: string; action: "skipped"; reason: Owner };

export async function skills(
  args: string[],
  io: Io,
  options: SkillsOptions,
): Promise<number> {
  const usageError = (problem: string) => {
    io.stderr(`${problem}\n${USAGE}`);
    return 2;
  };
  const [subcommand, ...rest] = args;
  if (subcommand !== "install") {
    return usageError(
      subcommand === undefined
        ? "Missing subcommand."
        : `Unknown subcommand: ${subcommand}`,
    );
  }
  let values: { adopt?: string[]; "add-permission"?: boolean };
  try {
    ({ values } = parseArgs({
      args: rest,
      options: {
        adopt: { type: "string", multiple: true },
        "add-permission": { type: "boolean" },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    return usageError((error as Error).message);
  }
  const adopt = new Set(values.adopt ?? []);
  for (const name of adopt) {
    if (!NAME.test(name)) return usageError(`Bad skill name: ${name}`);
  }
  if ((options.uid ?? process.getuid?.()) === 0) {
    io.stderr("Run cstack skills install without sudo.\n");
    return 1;
  }

  const { home, packageRoot } = options;
  const now = options.now ?? (() => new Date());
  const { version } = JSON.parse(
    await readFile(join(packageRoot, "package.json"), "utf8"),
  ) as { version: string };

  const shipped = (
    await readdir(join(packageRoot, "skills"), { withFileTypes: true })
  )
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const name of adopt) {
    if (!shipped.includes(name)) {
      return usageError(`This version does not ship a skill named ${name}.`);
    }
  }

  // The settings file is checked before any skill moves, so a refusal changes nothing.
  const settings = await readSettings(home);
  const addPermission = values["add-permission"] === true;
  if (addPermission) {
    if (settings.kind === "invalid") {
      io.stderr(`Cannot use ${settings.path}: ${settings.reason}. Nothing was changed.\n`);
      return 3;
    }
    if (await backupTaken(settings, stamp(now()))) {
      io.stderr(`Backup target already exists: ${settings.path}.backup-${stamp(now())}\n`);
      return 1;
    }
  }

  const skillsDir = join(home, ".claude", "skills");
  await mkdir(skillsDir, { recursive: true });
  const tmp = await mkdtemp(join(dirname(await realpath(skillsDir)), ".cstack-install-"));
  try {
    // Step 1: decide what to do with every folder. Nothing moves yet.
    const plans: Plan[] = [];
    for (const name of shipped) {
      const copy = join(tmp, name);
      await cp(join(packageRoot, "skills", name), copy, { recursive: true });
      await writeFile(join(copy, MARKER), `${version}\n`);
      const target = join(skillsDir, name);
      const owner = await ownerOf(target);
      if (owner === "missing") plans.push({ name, action: "installed" });
      else if (owner === "cstack") {
        plans.push({
          name,
          action: (await sameFolder(target, copy)) ? "unchanged" : "replaced",
        });
      } else if (adopt.has(name)) plans.push({ name, action: "replaced" });
      else plans.push({ name, action: "skipped", reason: owner });
    }
    const removed = (await readdir(skillsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !shipped.includes(e.name))
      .map((e) => e.name)
      .sort();
    for (const name of removed) {
      if ((await ownerOf(join(skillsDir, name))) === "cstack") {
        plans.push({ name, action: "removed" });
      }
    }

    // Step 2: every backup target must be free before anything moves.
    const backupRoot = join(home, ".claude", "skill-backups", stamp(now()));
    const backedUp = plans.filter(
      (p) => p.action === "replaced" || p.action === "removed",
    );
    for (const p of backedUp) {
      if (await exists(join(backupRoot, p.name))) {
        io.stderr(`Backup target already exists: ${join(backupRoot, p.name)}\n`);
        return 1;
      }
    }

    // Step 3: act.
    for (const p of backedUp) {
      // WHY: ADR-SIC-C. Old folders are moved aside, never deleted, so a replace or a
      // removal can always be undone by hand.
      await mkdir(backupRoot, { recursive: true });
      await moveFolder(join(skillsDir, p.name), join(backupRoot, p.name));
    }
    for (const p of plans) {
      if (p.action === "installed" || p.action === "replaced") {
        await rename(join(tmp, p.name), join(skillsDir, p.name));
      }
    }

    let skipped = 0;
    for (const p of plans.filter((x) => shipped.includes(x.name))) {
      if (p.action === "skipped") {
        skipped++;
        io.stdout(
          `skipped ${p.name}: ${p.reason}, so cstack did not write it. ` +
            `Run "cstack skills install --adopt ${p.name}" to take it over after a backup.\n`,
        );
      } else if (p.action === "replaced") {
        io.stdout(`replaced ${p.name}, backup in ${join(backupRoot, p.name)}\n`);
      } else io.stdout(`${p.action} ${p.name}\n`);
    }
    for (const p of plans.filter((x) => x.action === "removed")) {
      io.stdout(`removed ${p.name}, backup in ${join(backupRoot, p.name)}\n`);
    }
    if (addPermission) {
      const copy = await addRule(settings, stamp(now()));
      io.stdout(
        settings.kind === "ok" && settings.hasRule
          ? `permission ${PERMISSION_RULE} is already in ${settings.path}\n`
          : `added permission ${PERMISSION_RULE} to ${settings.path}` +
              (copy ? `, copy of the old file in ${copy}\n` : "\n"),
      );
    } else if (settings.kind === "invalid") {
      io.stderr(`cstack cannot read ${settings.path}: ${settings.reason}.\n`);
    } else if (settings.kind === "missing" || !settings.hasRule) {
      io.stderr(
        `The permission rule ${PERMISSION_RULE} is not in ${settings.path}. ` +
          `Run "cstack skills install --add-permission" to add it.\n`,
      );
    }
    return skipped > 0 ? 1 : 0;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
