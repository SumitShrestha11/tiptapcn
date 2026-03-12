import path from "path";
import fs from "fs-extra";

export interface ExtensionFile {
  /** Relative to `components/Editor/` */
  path: string;
  content: string;
  /** Whether this file needs "use client" prepended in Next.js projects */
  useClient?: boolean;
}

export interface ExtensionDef {
  name: string;
  description: string;
  /** Packages to install (on top of base tiptap if not already present) */
  packages: string[];
  /** Base tiptap packages needed when tiptap isn't installed yet */
  basePackages: string[];
  /** Files to copy into components/Editor/ */
  files: ExtensionFile[];
  /** Full Tiptap.tsx to create when no editor exists yet */
  tiptapTemplate: string;
  /** Snippet to show when Tiptap.tsx already exists */
  tiptapPatch: string;
  /** CSS snippet to append to globals.css */
  globalsSnippet: string;
  /** Marker string to check if CSS is already added */
  globalsMarker: string;
  /** Marker to check if extension already wired in Tiptap.tsx */
  tiptapMarker: string;
}

const t = (relPath: string) =>
  path.join(__dirname, "..", "templates", relPath);

export function loadRegistry(): Record<string, ExtensionDef> {
  return {
    mention: {
      name: "Mention",
      description: "Add @mention support to your Tiptap editor",
      basePackages: ["@tiptap/react", "@tiptap/pm", "@tiptap/starter-kit"],
      packages: [
        "@tiptap/extension-mention",
        "@tiptap/suggestion",
        "@floating-ui/dom",
      ],
      files: [
        {
          path: "extensions/Mention/MentionList.tsx",
          content: fs.readFileSync(t("mention/MentionList.tsx"), "utf-8"),
          useClient: true,
        },
        {
          path: "extensions/Mention/suggestions.ts",
          content: fs.readFileSync(t("mention/suggestions.ts"), "utf-8"),
        },
      ],
      tiptapTemplate: fs.readFileSync(t("mention/Tiptap.tsx"), "utf-8"),
      tiptapMarker: "@tiptap/extension-mention",
      tiptapPatch: `  // 1. Add these imports:
  import Mention from "@tiptap/extension-mention";
  import { mentionSuggestion } from "./extensions/Mention/suggestions";

  // 2. Add to your extensions array:
  Mention.configure({
    HTMLAttributes: { class: "mention" },
    suggestion: mentionSuggestion,
  })`,
      globalsSnippet: fs.readFileSync(
        t("mention/globals-snippet.css"),
        "utf-8",
      ),
      globalsMarker: ".mention {",
    },
  };
}
