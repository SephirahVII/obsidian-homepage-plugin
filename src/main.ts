import { Plugin, TFile } from "obsidian";
import { HomeMarkdownChild } from "./homeController";
import { createPersonalHomeExtension } from "./livePreview";
import { registerArticleSupport } from "./article";
import { createArticlePreviewExtension } from "./articlePreview";

export default class PersonalHomePlugin extends Plugin {
  onload(): void {
    this.registerMarkdownCodeBlockProcessor("personal-home", (source, el, ctx) => {
      el.empty();
      const child = new HomeMarkdownChild(el, this.app, this, source, ctx.sourcePath);
      ctx.addChild(child);
    });

    registerArticleSupport(this);
    this.registerEditorExtension(createPersonalHomeExtension(this.app, this));
    this.registerEditorExtension(createArticlePreviewExtension(this.app));
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.updateOptions();
    });

    this.addCommand({
      id: "open-personal-home",
      name: "Open personal home",
      callback: async () => {
        const file = this.app.vault.getAbstractFileByPath("个人主页.md");
        if (!(file instanceof TFile)) return;
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
        this.app.workspace.revealLeaf(leaf);
      },
    });
  }
}
