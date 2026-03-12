import { Command } from "commander";
import { addCommand } from "./commands/add";

const program = new Command()
  .name("tiptapcn")
  .description("Add Tiptap extensions to your project")
  .version("0.1.1");

program
  .command("add")
  .description("Add a Tiptap extension")
  .argument("<extension>", "Extension name (e.g. mention)")
  .option("-y, --yes", "Skip confirmation prompts", false)
  .action(addCommand);

program.parse();
