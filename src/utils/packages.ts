import { execa } from "execa";
import type { PackageManager } from "./detect";

export async function installPackages(
  packages: string[],
  packageManager: PackageManager,
  cwd: string,
): Promise<void> {
  const subcommand = packageManager === "npm" ? "install" : "add";
  await execa(packageManager, [subcommand, ...packages], {
    cwd,
    stdio: "inherit",
  });
}
