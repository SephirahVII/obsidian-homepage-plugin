import { RangeSetBuilder, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { editorLivePreviewField, type App } from "obsidian";
import {
  hasArticleMetadata,
  readArticleDocument,
  renderArticleMetadata,
  type ArticleMetadata,
} from "./article";

class ArticleMetadataWidget extends WidgetType {
  constructor(
    private readonly app: App,
    private readonly metadata: ArticleMetadata,
  ) {
    super();
  }

  eq(other: ArticleMetadataWidget): boolean {
    return this.metadata.date === other.metadata.date
      && this.metadata.author === other.metadata.author
      && this.metadata.avatar === other.metadata.avatar;
  }

  toDOM(): HTMLElement {
    return renderArticleMetadata(this.app, this.metadata) ?? document.createElement("span");
  }
}

export function createArticlePreviewExtension(app: App): Extension {
  function build(state: EditorState): DecorationSet {
    if (!state.field(editorLivePreviewField)) return Decoration.none;
    const document = readArticleDocument(state.doc.toString());
    if (!document || document.titleLine === null || !hasArticleMetadata(document.metadata)) {
      return Decoration.none;
    }

    const titleLine = state.doc.line(document.titleLine + 1);
    const builder = new RangeSetBuilder<Decoration>();
    builder.add(
      titleLine.to,
      titleLine.to,
      Decoration.widget({
        widget: new ArticleMetadataWidget(app, document.metadata),
        block: true,
        side: 1,
      }),
    );
    return builder.finish();
  }

  return StateField.define<DecorationSet>({
    create: build,
    update: (_value, transaction) => build(transaction.state),
    provide: (field) => EditorView.decorations.from(field),
  });
}
