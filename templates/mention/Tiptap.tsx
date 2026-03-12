"use client";

import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { mentionSuggestion } from "./extensions/Mention/suggestions";

export const TiptapEditor = () => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Mention.configure({
        HTMLAttributes: {
          class: "mention",
        },
        suggestion: mentionSuggestion,
      }),
    ],
    content: "<p>Hello World! 🌎️</p>",
    immediatelyRender: false,
  });

  return (
    <div className="border border-gray-200 rounded-lg p-4 min-h-[200px]">
      <EditorContent editor={editor} />
    </div>
  );
};
