import path from "path";
import fs from "fs-extra";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export interface ProjectInfo {
  root: string;
  packageJson: Record<string, unknown>;
  packageManager: PackageManager;
  hasTiptap: boolean;
  hasNextJs: boolean;
  /** Existing file that imports @tiptap/react and calls useEditor, if any */
  existingEditorFile: string | null;
  /** Best guess for where to put new components */
  componentsDir: string;
  globalsCSS: string | null;
}

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".cache",
  ".turbo",
  "coverage",
  "out",
]);

export async function detectProject(): Promise<ProjectInfo | null> {
  const cwd = process.cwd();

  // Walk up from cwd to find package.json
  let root = cwd;
  while (true) {
    if (await fs.pathExists(path.join(root, "package.json"))) break;
    const parent = path.dirname(root);
    if (parent === root) return null;
    root = parent;
  }

  const packageJson = await fs.readJson(path.join(root, "package.json"));
  const packageManager = await detectPackageManager(root);

  const allDeps = {
    ...(packageJson.dependencies as Record<string, string> | undefined),
    ...(packageJson.devDependencies as Record<string, string> | undefined),
  };

  const hasTiptap = !!allDeps["@tiptap/react"] || !!allDeps["@tiptap/core"];
  const hasNextJs = !!allDeps["next"];

  // Search the project tree for an existing Tiptap editor file
  const existingEditorFile = hasTiptap
    ? await findTiptapEditorFile(root)
    : null;

  // Find components dir — prefer the directory containing the editor file
  const componentsDir = existingEditorFile
    ? inferComponentsDir(existingEditorFile, root)
    : await findDir(root, [
        "components",
        "src/components",
        "src/lib",
        "lib",
        "src/ui",
        "app/components",
        "src/app/components",
      ]);

  const globalsCSS = await findFile(root, [
    "app/globals.css",
    "src/app/globals.css",
    "styles/globals.css",
    "src/styles/globals.css",
    "src/index.css",
    "app/index.css",
    "styles/index.css",
  ]);

  return {
    root,
    packageJson,
    packageManager,
    hasTiptap,
    hasNextJs,
    existingEditorFile,
    componentsDir,
    globalsCSS,
  };
}

/**
 * Recursively search for a .tsx/.ts file that imports @tiptap/react and uses useEditor.
 */
async function findTiptapEditorFile(root: string): Promise<string | null> {
  async function walk(dir: string): Promise<string | null> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        const result = await walk(path.join(dir, entry.name));
        if (result) return result;
      } else if (/\.(tsx|ts)$/.test(entry.name)) {
        const filePath = path.join(dir, entry.name);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          if (
            content.includes("@tiptap/react") &&
            content.includes("useEditor")
          ) {
            return filePath;
          }
        } catch {
          // skip unreadable files
        }
      }
    }
    return null;
  }

  return walk(root);
}

/**
 * Given an editor file at e.g. src/components/Editor/Tiptap.tsx,
 * return the logical "components root" (src/components/).
 */
function inferComponentsDir(editorFile: string, root: string): string {
  const componentRoots = new Set([
    "components",
    "lib",
    "ui",
    "editor",
    "editors",
  ]);
  let dir = path.dirname(editorFile);
  while (dir !== root && dir !== path.dirname(dir)) {
    if (componentRoots.has(path.basename(dir))) {
      return path.dirname(dir);
    }
    dir = path.dirname(dir);
  }
  // Fallback: editor file's parent directory, clamped to stay within the project
  const parent = path.dirname(editorFile);
  return parent.startsWith(root) ? parent : root;
}

async function findDir(root: string, candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    const full = path.join(root, candidate);
    if (await fs.pathExists(full)) return full;
  }
  return path.join(root, candidates[0]);
}

async function findFile(
  root: string,
  candidates: string[],
): Promise<string | null> {
  for (const candidate of candidates) {
    const full = path.join(root, candidate);
    if (await fs.pathExists(full)) return full;
  }
  return null;
}

async function detectPackageManager(root: string): Promise<PackageManager> {
  if (await fs.pathExists(path.join(root, "bun.lock"))) return "bun";
  if (await fs.pathExists(path.join(root, "bun.lockb"))) return "bun";
  if (await fs.pathExists(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (await fs.pathExists(path.join(root, "yarn.lock"))) return "yarn";
  return "npm";
}
