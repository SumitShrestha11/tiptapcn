"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export const TiptapEditor = () => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p>Hello World! 🌎️</p>",
    immediatelyRender: false,
  });

  return (
    <div className="border border-gray-200 rounded-lg p-4 min-h-[200px]">
      <EditorContent editor={editor} />
    </div>
  );
};
