import { RangeSetBuilder, StateField, type EditorState, type Extension, type Text } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { editorLivePreviewField, type App } from "obsidian";
import type PersonalHomePlugin from "./main";
import { HomeMarkdownChild } from "./homeController";

interface HomeBlock {
  from: number;
  to: number;
  source: string;
}

function findHomeBlocks(doc: Text): HomeBlock[] {
  const blocks: HomeBlock[] = [];
  let from = -1;
  let source: string[] = [];

  for (let index = 1; index <= doc.lines; index += 1) {
    const line = doc.line(index);
    const opening = /^\s*```personal-home\s*$/.test(line.text);
    const closing = /^\s*```\s*$/.test(line.text);

    if (from < 0 && opening) {
      from = line.from;
      source = [];
      continue;
    }

    if (from >= 0 && closing) {
      blocks.push({ from, to: line.to, source: source.join("\n") });
      from = -1;
      source = [];
      continue;
    }

    if (from >= 0) source.push(line.text);
  }

  return blocks;
}

class PersonalHomeWidget extends WidgetType {
  private children = new Map<HTMLElement, HomeMarkdownChild>();

  constructor(
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly app: App,
    private readonly plugin: PersonalHomePlugin,
  ) {
    super();
  }

  eq(other: PersonalHomeWidget): boolean {
    return this.source === other.source && this.sourcePath === other.sourcePath;
  }

  toDOM(): HTMLElement {
    const element = document.createElement("div");
    const child = new HomeMarkdownChild(element, this.app, this.plugin, this.source, this.sourcePath);
    this.children.set(element, child);
    child.load();
    return element;
  }

  destroy(element: HTMLElement): void {
    this.children.get(element)?.unload();
    this.children.delete(element);
  }
}

export function createPersonalHomeExtension(app: App, plugin: PersonalHomePlugin): Extension {
  function build(state: EditorState): DecorationSet {
    if (!state.field(editorLivePreviewField)) return Decoration.none;

    const builder = new RangeSetBuilder<Decoration>();
    const sourcePath = app.workspace.getActiveFile()?.path ?? "个人主页.md";

    for (const block of findHomeBlocks(state.doc)) {
      const editing = state.selection.ranges.some(
        (range) => range.from <= block.to && range.to >= block.from,
      );
      if (editing) continue;

      builder.add(
        block.from,
        block.to,
        Decoration.replace({
          widget: new PersonalHomeWidget(block.source, sourcePath, app, plugin),
          block: true,
        }),
      );
    }

    return builder.finish();
  }

  const field = StateField.define<DecorationSet>({
    create: build,
    update: (_value, transaction) => build(transaction.state),
    provide: (field) => EditorView.decorations.from(field),
  });

  return [field];
}
