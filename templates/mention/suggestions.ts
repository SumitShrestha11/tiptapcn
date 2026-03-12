import { computePosition, flip, shift } from "@floating-ui/dom";
import { Editor, posToDOMRect, ReactRenderer } from "@tiptap/react";
import { MentionNodeAttrs } from "@tiptap/extension-mention";
import { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { MentionList, MentionListRef } from "./MentionList";

const updatePosition = (editor: Editor, element: HTMLElement) => {
  const virtualElement = {
    getBoundingClientRect: () =>
      posToDOMRect(
        editor.view,
        editor.state.selection.from,
        editor.state.selection.to,
      ),
  };

  computePosition(virtualElement, element, {
    placement: "bottom-start",
    strategy: "absolute",
    middleware: [shift(), flip()],
  }).then(({ x, y, strategy }) => {
    element.style.width = "max-content";
    element.style.position = strategy;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });
};

export const mentionSuggestion = {
  items: ({ query }: { query: string }) => {
    return [
      "Lea Thompson",
      "Cyndi Lauper",
      "Tom Cruise",
      "Madonna",
      "Jerry Hall",
      "Joan Collins",
      "Winona Ryder",
      "Christina Applegate",
      "Alyssa Milano",
      "Molly Ringwald",
      "Ally Sheedy",
      "Debbie Harry",
      "Olivia Newton-John",
      "Elton John",
      "Michael J. Fox",
      "Axl Rose",
      "Emilio Estevez",
      "Ralph Macchio",
      "Rob Lowe",
      "Jennifer Grey",
      "Mickey Rourke",
      "John Cusack",
      "Matthew Broderick",
      "Justine Bateman",
      "Lisa Bonet",
    ]
      .filter((item) => item.toLowerCase().startsWith(query.toLowerCase()))
      .slice(0, 5);
  },

  render: () => {
    let component: ReactRenderer<MentionListRef>;

    return {
      onStart: (props: SuggestionProps<string, MentionNodeAttrs>) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        component.element.style.position = "absolute";
        document.body.appendChild(component.element);
        updatePosition(props.editor, component.element);
      },

      onUpdate(props: SuggestionProps<string, MentionNodeAttrs>) {
        component.updateProps(props);
        if (!props.clientRect) return;
        updatePosition(props.editor, component.element);
      },

      onKeyDown(props: SuggestionKeyDownProps): boolean {
        if (props.event.key === "Escape") {
          component.destroy();
          return true;
        }
        return component.ref?.onKeyDown(props) || false;
      },

      onExit() {
        component.destroy();
      },
    };
  },
};
