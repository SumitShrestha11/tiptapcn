# tiptapcn

A CLI tool to add [Tiptap](https://tiptap.dev) editor extensions to your project — similar to shadcn/ui but for Tiptap.

## Usage

```bash
npx tiptapcn add <extension>
```

No installation required. Just run the command inside your project directory.

## Extensions

| Extension | Command                    | Description                                |
| --------- | -------------------------- | ------------------------------------------ |
| Mention   | `npx tiptapcn add mention` | Add @mention support to your Tiptap editor |

## How it works

1. **Detects your project** — Finds your package manager (npm, yarn, pnpm, bun) and project structure.
2. **Sets up Tiptap base** — If Tiptap isn't installed yet, it installs the base packages for you.
3. **Installs dependencies** — Installs only the packages needed for the extension.
4. **Copies files** — Adds the extension components into your `components/Editor/` directory.
5. **Patches your editor** — Automatically wires the extension into your existing `Tiptap.tsx`, or creates one from scratch.
6. **Updates globals.css** — Appends any required CSS to your global stylesheet.

## Options

| Flag        | Description                   |
| ----------- | ----------------------------- |
| `-y, --yes` | Skip all confirmation prompts |

```bash
npx tiptapcn add mention --yes
bunx tiptapcn add mention --yes
```

## Requirements

- Node.js >= 18
- A React project (Next.js supported)
