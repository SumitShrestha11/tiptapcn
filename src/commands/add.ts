import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { detectProject, type ProjectInfo } from "../utils/detect";
import { installPackages } from "../utils/packages";
import { loadRegistry } from "../registry";

export async function addCommand(
  extensionName: string,
  options: { yes: boolean },
) {
  console.log();

  const registry = loadRegistry();
  const extension = registry[extensionName];

  if (!extension) {
    console.error(chalk.red(`✗ Unknown extension: "${extensionName}"`));
    console.log(
      `\nAvailable extensions: ${chalk.cyan(Object.keys(registry).join(", "))}`,
    );
    process.exit(1);
  }

  // Detect project
  const detectSpinner = ora("Detecting project...").start();
  const project = await detectProject();

  if (!project) {
    detectSpinner.fail(
      "No package.json found. Run this command inside your project directory.",
    );
    process.exit(1);
  }

  detectSpinner.succeed(
    `Found project ${chalk.dim(`(${project.packageManager})`)}`,
  );

  // Check if extension is already fully set up
  if (await isAlreadyInstalled(extension, project)) {
    console.log(
      chalk.dim(`\n  ${extension.name} is already set up in this project.`),
    );
    console.log();
    return;
  }

  // Setup base tiptap if not installed
  if (!project.hasTiptap) {
    console.log(chalk.yellow("\n  Tiptap is not set up in this project."));

    let proceed = options.yes;
    if (!proceed) {
      const res = await prompts({
        type: "confirm",
        name: "value",
        message: "Set up a basic Tiptap editor now?",
        initial: true,
      });
      exitIfCancelled(res.value);
      proceed = res.value;
    }

    if (!proceed) {
      console.log("\nAborted.");
      process.exit(0);
    }

    console.log(chalk.dim("  Installing Tiptap base packages..."));
    try {
      await installPackages(
        extension.basePackages,
        project.packageManager,
        project.root,
      );
      console.log(`  ${chalk.green("✓")} Installed base Tiptap packages`);
    } catch {
      console.error(chalk.red("  ✗ Failed to install base packages"));
      process.exit(1);
    }
  }

  // Install extension packages (skip any already present in package.json)
  const installedDeps = allDeps(project);
  const missingPackages = extension.packages.filter((p) => !installedDeps[p]);

  if (missingPackages.length > 0) {
    console.log(chalk.dim(`  Installing ${extension.name} packages...`));
    try {
      await installPackages(
        missingPackages,
        project.packageManager,
        project.root,
      );
      console.log(
        `  ${chalk.green("✓")} Installed: ${chalk.cyan(missingPackages.join(", "))}`,
      );
    } catch {
      console.error(chalk.red("  ✗ Failed to install packages"));
      process.exit(1);
    }
  }

  console.log();

  // Determine editor directory:
  // - If an existing editor file was found, place extensions alongside it
  // - Otherwise create under components/Editor/
  const editorDir = project.existingEditorFile
    ? path.dirname(project.existingEditorFile)
    : path.join(project.componentsDir, "Editor");

  await fs.ensureDir(editorDir);

  for (const file of extension.files) {
    const targetPath = path.join(editorDir, file.path);
    const rel = path.relative(project.root, targetPath);

    if (await fs.pathExists(targetPath)) {
      if (!options.yes) {
        const res = await prompts({
          type: "confirm",
          name: "overwrite",
          message: `${chalk.yellow(rel)} already exists. Overwrite?`,
          initial: false,
        });
        exitIfCancelled(res.overwrite);
        if (!res.overwrite) {
          console.log(`  ${chalk.dim("–")} Skipped ${rel}`);
          continue;
        }
      }
    }

    await fs.ensureDir(path.dirname(targetPath));
    const content =
      file.useClient && project.hasNextJs
        ? `"use client";\n\n${file.content}`
        : file.content;
    await fs.writeFile(targetPath, content);
    console.log(`  ${chalk.green("+")} ${rel}`);
  }

  // Handle Tiptap.tsx
  await handleTiptapFile(extension, project, editorDir, options.yes);

  // Update globals.css
  await handleGlobalsCSS(extension, project);

  console.log(
    `\n${chalk.green("✓")} ${chalk.bold(extension.name)} extension added!\n`,
  );
  console.log(
    `  Type ${chalk.cyan("@")} in your editor to trigger mention suggestions.`,
  );
  console.log();
}

async function handleTiptapFile(
  extension: ReturnType<typeof loadRegistry>[string],
  project: ProjectInfo,
  editorDir: string,
  yes: boolean,
) {
  const tiptapPath =
    project.existingEditorFile ?? path.join(editorDir, "Tiptap.tsx");
  const rel = path.relative(project.root, tiptapPath);

  if (!(await fs.pathExists(tiptapPath))) {
    await fs.writeFile(tiptapPath, extension.tiptapTemplate);
    console.log(`  ${chalk.green("+")} ${rel}`);
    return;
  }

  const content = await fs.readFile(tiptapPath, "utf-8");
  if (content.includes(extension.tiptapMarker)) {
    console.log(`  ${chalk.dim("–")} ${rel} (already configured)`);
    return;
  }

  const patchResult = tryPatchTiptap(content, extension);
  if (patchResult) {
    if (!yes) {
      const res = await prompts({
        type: "confirm",
        name: "apply",
        message: `Auto-patch ${chalk.cyan(rel)} to add the extension?`,
        initial: true,
      });
      exitIfCancelled(res.apply);
      if (!res.apply) {
        printManualInstructions(extension);
        return;
      }
    }

    if (patchResult.extraPackages.length > 0) {
      const deps = allDeps(project);
      const toInstall = patchResult.extraPackages.filter((p) => !deps[p]);
      if (toInstall.length > 0) {
        console.log(chalk.dim(`  Installing ${toInstall.join(", ")}...`));
        try {
          await installPackages(
            toInstall,
            project.packageManager,
            project.root,
          );
          console.log(
            `  ${chalk.green("✓")} Installed: ${chalk.cyan(toInstall.join(", "))}`,
          );
        } catch {
          console.error(
            chalk.red("  ✗ Failed to install extra packages"),
          );
        }
      }
    }

    await fs.writeFile(tiptapPath, patchResult.patched);
    console.log(`  ${chalk.green("~")} ${rel} (patched)`);
  } else {
    printManualInstructions(extension);
  }
}

function tryPatchTiptap(
  content: string,
  extension: ReturnType<typeof loadRegistry>[string],
): { patched: string; extraPackages: string[] } | null {
  if (extension.tiptapMarker !== "@tiptap/extension-mention") return null;

  const extraPackages: string[] = [];

  const lastImportMatch = [...content.matchAll(/^import .+$/gm)].pop();
  if (!lastImportMatch) return null;

  // Detect extensions array on the original content before any mutation
  const extLineMatch = content.match(/^([ \t]*)extensions:\s*\[/m);
  if (!extLineMatch) return null;
  const baseIndent = extLineMatch[1];
  const itemIndent = baseIndent + "  ";

  const arrayMatch = content.match(/(extensions:\s*\[)([^\]]*?)(\])/s);
  if (!arrayMatch) return null;

  const [, , inner] = arrayMatch;
  const isEmpty = !inner.trim();

  // Bail out if inner content has nested arrays — can't safely patch
  if (!isEmpty && inner.includes("[")) return null;

  const isMultiLine = inner.includes("\n");

  // Determine if StarterKit needs to be added (empty array + not already imported)
  const needsStarterKit =
    isEmpty && !content.includes("@tiptap/starter-kit");
  if (needsStarterKit) extraPackages.push("@tiptap/starter-kit");

  // Build the full import block in one shot — no chained replacements
  const importLines = [
    ...(needsStarterKit
      ? ['import StarterKit from "@tiptap/starter-kit";']
      : []),
    'import Mention from "@tiptap/extension-mention";',
    'import { mentionSuggestion } from "./extensions/Mention/suggestions";',
  ].join("\n");

  // Insert imports at a precise index, not via string.replace
  const insertAt = lastImportMatch.index! + lastImportMatch[0].length;
  let patched =
    content.slice(0, insertAt) +
    "\n" +
    importLines +
    content.slice(insertAt);

  // Re-match the array in the now-mutated string (import insertion shifted offsets)
  const patchedArrayMatch = patched.match(
    /(extensions:\s*\[)([^\]]*?)(\])/s,
  );
  if (!patchedArrayMatch) return null;

  const [fullMatch, open, patchedInner, close] = patchedArrayMatch;
  const arrayIdx = patched.indexOf(fullMatch);
  if (arrayIdx === -1) return null;

  const mentionBlock =
    `Mention.configure({\n` +
    `${itemIndent}  HTMLAttributes: { class: "mention" },\n` +
    `${itemIndent}  suggestion: mentionSuggestion,\n` +
    `${itemIndent}})`;

  let newArray: string;
  if (isEmpty) {
    const starterKitLine = needsStarterKit
      ? `\n${itemIndent}StarterKit,`
      : "";
    newArray = `${open}${starterKitLine}\n${itemIndent}${mentionBlock},\n${baseIndent}${close}`;
  } else if (!isMultiLine) {
    const items = patchedInner.trim();
    newArray = `${open}\n${itemIndent}${items},\n${itemIndent}${mentionBlock},\n${baseIndent}${close}`;
  } else {
    const trimmed = patchedInner.trimEnd();
    const trailing = !trimmed.endsWith(",") ? "," : "";
    newArray = `${open}${trimmed}${trailing}\n${itemIndent}${mentionBlock},\n${baseIndent}${close}`;
  }

  patched =
    patched.slice(0, arrayIdx) +
    newArray +
    patched.slice(arrayIdx + fullMatch.length);

  return { patched, extraPackages };
}

function printManualInstructions(
  extension: ReturnType<typeof loadRegistry>[string],
) {
  console.log(
    `\n  ${chalk.cyan("→")} Add the following to your ${chalk.bold("Tiptap.tsx")}:`,
  );
  console.log();
  console.log(chalk.dim(extension.tiptapPatch));
}

async function isAlreadyInstalled(
  extension: ReturnType<typeof loadRegistry>[string],
  project: ProjectInfo,
): Promise<boolean> {
  const deps = allDeps(project);
  if (!extension.packages.every((p) => !!deps[p])) return false;

  // Fix: missing Tiptap.tsx means not fully installed
  const tiptapPath =
    project.existingEditorFile ??
    path.join(project.componentsDir, "Editor", "Tiptap.tsx");
  if (!(await fs.pathExists(tiptapPath))) return false;
  const content = await fs.readFile(tiptapPath, "utf-8");
  if (!content.includes(extension.tiptapMarker)) return false;

  const editorDir = project.existingEditorFile
    ? path.dirname(project.existingEditorFile)
    : path.join(project.componentsDir, "Editor");
  for (const file of extension.files) {
    if (!(await fs.pathExists(path.join(editorDir, file.path)))) return false;
  }

  return true;
}

async function handleGlobalsCSS(
  extension: ReturnType<typeof loadRegistry>[string],
  project: ProjectInfo,
) {
  if (!project.globalsCSS) return;

  const content = await fs.readFile(project.globalsCSS, "utf-8");
  if (content.includes(extension.globalsMarker)) return;

  await fs.appendFile(project.globalsCSS, `\n${extension.globalsSnippet}`);
  const rel = path.relative(project.root, project.globalsCSS);
  console.log(`  ${chalk.green("~")} ${rel} (updated)`);
}

function allDeps(project: ProjectInfo): Record<string, string> {
  return {
    ...(project.packageJson.dependencies as Record<string, string> | undefined),
    ...(project.packageJson.devDependencies as
      | Record<string, string>
      | undefined),
  };
}

/** Exit cleanly when the user presses Ctrl+C through a prompts() call. */
function exitIfCancelled(value: unknown): void {
  if (value === undefined) {
    console.log("\nAborted.");
    process.exit(0);
  }
}
