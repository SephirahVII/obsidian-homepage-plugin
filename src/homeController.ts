import {
  App,
  MarkdownRenderChild,
  MarkdownRenderer,
  Notice,
  TFile,
  parseYaml,
  setIcon,
} from "obsidian";
import type PersonalHomePlugin from "./main";

type BioMode = "default" | "long";

interface HomeConfig {
  handle: string;
  handleUrl: string;
  shortBio: string;
  longBio: string;
  notes: string;
  blogFolder: string;
  blogLimit: number;
  art: string;
  artAlt: string;
}

const DEFAULT_CONFIG: HomeConfig = {
  handle: "@leerob",
  handleUrl: "https://x.com/leerob",
  shortBio: "主页内容/简介-短.md",
  longBio: "主页内容/简介-长.md",
  notes: "主页内容/精选笔记.md",
  blogFolder: "博客",
  blogLimit: 8,
  art: "主页内容/城市与田野.svg",
  artAlt: "An original colorful illustration of city skylines, a river, and rolling fields",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

let homeInstance = 0;

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function readConfig(source: string): HomeConfig {
  const parsed = (parseYaml(source) ?? {}) as Record<string, unknown>;
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The personal-home configuration must be a YAML object.");
  }

  const stringValue = (key: keyof HomeConfig): string => {
    const value = parsed[key];
    return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_CONFIG[key] as string;
  };
  const requestedLimit = Number(parsed.blogLimit);

  return {
    handle: stringValue("handle"),
    handleUrl: stringValue("handleUrl"),
    shortBio: stringValue("shortBio"),
    longBio: stringValue("longBio"),
    notes: stringValue("notes"),
    blogFolder: stringValue("blogFolder").replace(/^\/+|\/+$/g, ""),
    blogLimit: Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(50, Math.floor(requestedLimit)))
      : DEFAULT_CONFIG.blogLimit,
    art: stringValue("art"),
    artAlt: stringValue("artAlt"),
  };
}

export class HomeMarkdownChild extends MarkdownRenderChild {
  private readonly controller: HomeController;

  constructor(
    containerEl: HTMLElement,
    app: App,
    plugin: PersonalHomePlugin,
    source: string,
    sourcePath: string,
  ) {
    super(containerEl);
    this.controller = new HomeController(containerEl, app, plugin, this, source, sourcePath);
  }

  onload(): void {
    void this.controller.mount();
  }

  onunload(): void {
    this.controller.destroy();
  }
}

class HomeController {
  private config: HomeConfig = DEFAULT_CONFIG;
  private mode: BioMode = "default";
  private readonly editing = new Set<string>();
  private readonly instanceId = ++homeInstance;
  private destroyed = false;
  private bioVersion = 0;
  private notesVersion = 0;
  private artVersion = 0;
  private bioChild: MarkdownRenderChild | null = null;
  private notesChild: MarkdownRenderChild | null = null;
  private bioContent!: HTMLElement;
  private notesContent!: HTMLElement;
  private blogsContent!: HTMLElement;
  private artContent!: HTMLElement;
  private defaultButton!: HTMLButtonElement;
  private longButton!: HTMLButtonElement;

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly app: App,
    private readonly plugin: PersonalHomePlugin,
    private readonly component: HomeMarkdownChild,
    private readonly source: string,
    private readonly sourcePath: string,
  ) {}

  async mount(): Promise<void> {
    try {
      this.config = readConfig(this.source);
      this.buildLayout();
      this.registerEvents();
      await Promise.all([this.renderBio(), this.renderNotes(), this.renderBlogs(), this.renderArt()]);
    } catch (error) {
      this.showError(this.containerEl, error);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.editing.clear();
    this.bioChild?.unload();
    this.notesChild?.unload();
    this.bioChild = null;
    this.notesChild = null;
  }

  private buildLayout(): void {
    this.containerEl.classList.add("personal-home");
    this.containerEl.replaceChildren();

    const shell = createElement("div", "ph-shell");
    const frame = createElement("article", "ph-content-frame");
    const layout = createElement("div", "ph-home-layout");
    const copy = createElement("div", "ph-home-copy");

    const title = createElement("h1", "ph-site-title");
    const titleLink = createElement("a", "ph-site-title-link");
    titleLink.href = this.config.handleUrl;
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
    if (this.config.handle.startsWith("@")) {
      titleLink.append(
        createElement("span", "ph-site-title-at", "@"),
        document.createTextNode(this.config.handle.slice(1)),
      );
    } else {
      titleLink.textContent = this.config.handle;
    }
    title.append(titleLink);

    const bioSection = createElement("section", "ph-bio-section");
    bioSection.setAttribute("aria-label", "Biography");
    const bioToggle = createElement("div", "ph-bio-toggle");
    bioToggle.append(createElement("span", undefined, "Bio"));
    const bioActions = createElement("div", "ph-bio-actions");
    bioActions.append(
      this.makeEditButton("Edit biography", () => {
        void this.openEditor(this.currentBioPath(), this.bioContent);
      }),
    );
    const bioOptions = createElement("div", "ph-bio-options");
    bioOptions.setAttribute("aria-label", "Bio length");
    this.defaultButton = createElement("button", undefined, "Default");
    this.longButton = createElement("button", undefined, "Long");
    for (const button of [this.defaultButton, this.longButton]) {
      button.type = "button";
      button.setAttribute("aria-controls", `ph-bio-content-${this.instanceId}`);
    }
    this.defaultButton.setAttribute("aria-pressed", "true");
    this.longButton.setAttribute("aria-pressed", "false");
    bioOptions.append(this.defaultButton, this.longButton);
    bioActions.append(bioOptions);
    bioToggle.append(bioActions);
    this.bioContent = createElement("div", "ph-bio-content");
    this.bioContent.id = `ph-bio-content-${this.instanceId}`;
    bioSection.append(bioToggle, this.bioContent);

    const notesSection = createElement("section", "ph-notes-section");
    notesSection.setAttribute("aria-labelledby", `ph-notes-heading-${this.instanceId}`);
    const notesHeadingRow = createElement("div", "ph-section-heading");
    const notesHeading = createElement("h2", undefined, "Notes");
    notesHeading.id = `ph-notes-heading-${this.instanceId}`;
    notesHeadingRow.append(
      notesHeading,
      this.makeEditButton("Edit curated notes", () => {
        void this.openEditor(this.config.notes, this.notesContent);
      }),
    );
    this.notesContent = createElement("div", "ph-notes-content");
    notesSection.append(notesHeadingRow, this.notesContent);

    const blogsSection = createElement("section", "ph-blogs-section");
    blogsSection.setAttribute("aria-labelledby", `ph-blogs-heading-${this.instanceId}`);
    const blogsHeading = createElement("h2", undefined, "Blogs");
    blogsHeading.id = `ph-blogs-heading-${this.instanceId}`;
    this.blogsContent = createElement("div", "ph-blogs-content");
    blogsSection.append(blogsHeading, this.blogsContent);

    copy.append(title, bioSection, notesSection, blogsSection);

    const visual = createElement("aside", "ph-home-visual");
    visual.setAttribute("role", "img");
    visual.setAttribute("aria-label", this.config.artAlt);
    this.artContent = createElement("div", "ph-home-painting");
    visual.append(this.artContent);

    layout.append(copy, visual);
    frame.append(layout);
    shell.append(frame);
    this.containerEl.append(shell);

    const updateWidth = () => {
      const width = shell.getBoundingClientRect().width;
      if (this.destroyed || width === 0) return;
      shell.classList.toggle("ph-wide", width >= 1100);
      shell.classList.toggle("ph-narrow", width < 640);
    };
    const observer = new ResizeObserver(updateWidth);
    observer.observe(shell);
    this.component.register(() => observer.disconnect());
    const widthTimer = window.setInterval(updateWidth, 250);
    this.component.register(() => window.clearInterval(widthTimer));
    this.component.registerEvent(this.app.workspace.on("resize", updateWidth));
    updateWidth();
    requestAnimationFrame(updateWidth);
    setTimeout(updateWidth, 150);
  }

  private registerEvents(): void {
    this.component.registerDomEvent(this.defaultButton, "click", () => this.setMode("default"));
    this.component.registerDomEvent(this.longButton, "click", () => this.setMode("long"));

    this.component.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file.path === this.currentBioPath()) void this.renderBio();
        if (file.path === this.config.notes) void this.renderNotes();
        if (this.isInBlogFolder(file.path)) this.renderBlogs();
      }),
    );
    this.component.registerEvent(
      this.app.vault.on("create", (file) => {
        if (this.isInBlogFolder(file.path)) this.renderBlogs();
      }),
    );
    this.component.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (this.isInBlogFolder(file.path)) this.renderBlogs();
      }),
    );
    this.component.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (this.isInBlogFolder(file.path) || this.isInBlogFolder(oldPath)) this.renderBlogs();
      }),
    );
  }

  private makeEditButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = createElement("button", "ph-edit-button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    setIcon(button, "pencil");
    this.component.registerDomEvent(button, "click", onClick);
    return button;
  }

  private setMode(mode: BioMode): void {
    if (this.editing.has(this.currentBioPath())) {
      new Notice("Save or cancel the biography edit before changing its length.");
      return;
    }
    this.mode = mode;
    this.defaultButton.setAttribute("aria-pressed", String(mode === "default"));
    this.longButton.setAttribute("aria-pressed", String(mode === "long"));
    void this.renderBio();
  }

  private currentBioPath(): string {
    return this.mode === "long" ? this.config.longBio : this.config.shortBio;
  }

  private getFile(path: string): TFile {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`Note not found: ${path}`);
    return file;
  }

  private async renderBio(): Promise<void> {
    const path = this.currentBioPath();
    if (this.editing.has(path) || this.destroyed) return;
    const version = ++this.bioVersion;

    try {
      const file = this.getFile(path);
      const markdown = await this.app.vault.cachedRead(file);
      if (this.destroyed || version !== this.bioVersion || path !== this.currentBioPath()) return;

      this.bioChild?.unload();
      this.bioContent.replaceChildren();
      const child = new MarkdownRenderChild(this.bioContent);
      this.bioChild = child;
      child.load();
      await MarkdownRenderer.render(this.app, markdown, this.bioContent, file.path, child);
    } catch (error) {
      if (version === this.bioVersion) this.showError(this.bioContent, error);
    }
  }

  private async renderNotes(): Promise<void> {
    if (this.editing.has(this.config.notes) || this.destroyed) return;
    const version = ++this.notesVersion;

    try {
      const file = this.getFile(this.config.notes);
      const markdown = await this.app.vault.cachedRead(file);
      if (this.destroyed || version !== this.notesVersion) return;

      this.notesChild?.unload();
      this.notesContent.replaceChildren();
      const child = new MarkdownRenderChild(this.notesContent);
      this.notesChild = child;
      child.load();
      await MarkdownRenderer.render(this.app, markdown, this.notesContent, file.path, child);
      this.notesContent.querySelector("ul")?.classList.add("ph-notes-list");
    } catch (error) {
      if (version === this.notesVersion) this.showError(this.notesContent, error);
    }
  }

  private renderBlogs(): void {
    if (this.destroyed) return;
    const folderPrefix = `${this.config.blogFolder}/`;
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => {
        const type = this.app.metadataCache.getFileCache(file)?.frontmatter?.type;
        return file.path.startsWith(folderPrefix) && type === "blog";
      })
      .sort((left, right) => {
        const byDate = this.blogDate(right).localeCompare(this.blogDate(left));
        if (byDate !== 0) return byDate;
        const leftOrder = Number(this.app.metadataCache.getFileCache(left)?.frontmatter?.order ?? 1000);
        const rightOrder = Number(this.app.metadataCache.getFileCache(right)?.frontmatter?.order ?? 1000);
        return leftOrder - rightOrder || left.path.localeCompare(right.path);
      })
      .slice(0, this.config.blogLimit);

    const list = createElement("div", "ph-blogs-list");
    if (files.length === 0) {
      list.append(
        createElement(
          "p",
          "ph-empty",
          `No blog notes yet. Add type: blog and date to a note in ${this.config.blogFolder}/.`,
        ),
      );
    }

    for (const file of files) {
      const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const title = typeof metadata?.title === "string" && metadata.title.trim()
        ? metadata.title.trim()
        : file.basename;
      const date = this.blogDate(file);
      const row = createElement("a", "ph-blog-row");
      row.href = file.path;
      row.setAttribute("aria-label", `${title}, ${this.formatBlogDate(date)}`);
      row.append(createElement("span", undefined, title));
      const time = createElement("time", undefined, this.formatBlogDate(date));
      time.dateTime = date;
      row.append(time);
      row.onclick = (event) => {
        event.preventDefault();
        void this.app.workspace.openLinkText(file.path, this.sourcePath, event.metaKey || event.ctrlKey);
      };
      list.append(row);
    }

    this.blogsContent.replaceChildren(list);
  }

  private blogDate(file: TFile): string {
    const value = this.app.metadataCache.getFileCache(file)?.frontmatter?.date;
    return value === undefined || value === null ? "" : String(value);
  }

  private formatBlogDate(value: string): string {
    const match = value.match(/^(\d{4})(?:-(\d{1,2}))?/);
    if (!match) return value || "Undated";
    const monthIndex = match[2] ? Number(match[2]) - 1 : 0;
    const month = MONTHS[monthIndex] ?? MONTHS[0];
    return `${month} ${match[1]}`;
  }

  private async renderArt(): Promise<void> {
    const version = ++this.artVersion;
    try {
      const file = this.getFile(this.config.art);
      if (file.extension.toLowerCase() === "svg") {
        const source = await this.app.vault.cachedRead(file);
        if (this.destroyed || version !== this.artVersion) return;
        const svg = this.parseSafeSvg(source);
        this.artContent.replaceChildren(svg);
      } else {
        const image = createElement("img", "ph-home-image");
        image.src = this.app.vault.getResourcePath(file);
        image.alt = "";
        this.artContent.replaceChildren(image);
      }
    } catch (error) {
      if (version === this.artVersion) this.showError(this.artContent, error);
    }
  }

  private parseSafeSvg(source: string): SVGSVGElement {
    const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
    const svg = documentNode.documentElement;
    if (svg.nodeName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) {
      throw new Error(`Invalid SVG artwork: ${this.config.art}`);
    }

    svg.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((node) => node.remove());
    for (const element of [svg, ...Array.from(svg.querySelectorAll("*"))]) {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on")) element.removeAttribute(attribute.name);
        if ((name === "href" || name.endsWith(":href")) && !attribute.value.trim().startsWith("#")) {
          element.removeAttribute(attribute.name);
        }
      }
    }
    svg.setAttribute("aria-hidden", "true");
    return document.importNode(svg, true) as unknown as SVGSVGElement;
  }

  private async openEditor(path: string, target: HTMLElement): Promise<void> {
    if (this.editing.has(path)) return;
    this.editing.add(path);

    try {
      const file = this.getFile(path);
      const original = await this.app.vault.read(file);
      if (this.destroyed) return;

      if (path === this.config.notes) {
        this.notesChild?.unload();
        this.notesChild = null;
      } else {
        this.bioChild?.unload();
        this.bioChild = null;
      }

      const editor = createElement("div", "ph-inline-editor");
      const textarea = createElement("textarea");
      textarea.value = original;
      textarea.setAttribute("aria-label", `Edit Markdown for ${file.basename}`);
      textarea.spellcheck = true;
      const controls = createElement("div", "ph-editor-controls");
      const saveButton = createElement("button", "ph-save-button", "Save");
      const cancelButton = createElement("button", "ph-cancel-button", "Cancel");
      saveButton.type = "button";
      cancelButton.type = "button";
      saveButton.disabled = true;
      const status = createElement("span", "ph-editor-status");
      status.setAttribute("aria-live", "polite");
      controls.append(saveButton, cancelButton, status);
      editor.append(textarea, controls);
      target.replaceChildren(editor);

      const resize = () => {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight + 4, 220), 680)}px`;
      };
      textarea.oninput = () => {
        saveButton.disabled = textarea.value === original;
        resize();
      };
      resize();
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);

      cancelButton.onclick = () => {
        this.editing.delete(path);
        void this.renderForPath(path);
      };

      saveButton.onclick = () => {
        void (async () => {
          saveButton.disabled = true;
          saveButton.textContent = "Saving…";
          status.textContent = "";
          let conflict = false;

          try {
            await this.app.vault.process(file, (current) => {
              if (current !== original) {
                conflict = true;
                return current;
              }
              return textarea.value;
            });

            if (conflict) {
              status.textContent = "This note changed elsewhere. Copy your edits, then cancel and reopen it.";
              new Notice("The note changed elsewhere; your edits were not saved.");
              return;
            }

            this.editing.delete(path);
            await this.renderForPath(path);
          } catch (error) {
            status.textContent = error instanceof Error ? error.message : String(error);
          } finally {
            saveButton.disabled = false;
            saveButton.textContent = "Save";
          }
        })();
      };
    } catch (error) {
      this.editing.delete(path);
      this.showError(target, error);
    }
  }

  private async renderForPath(path: string): Promise<void> {
    if (path === this.config.notes) {
      await this.renderNotes();
    } else {
      await this.renderBio();
    }
  }

  private isInBlogFolder(path: string): boolean {
    return path.startsWith(`${this.config.blogFolder}/`);
  }

  private showError(target: HTMLElement, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    target.replaceChildren(createElement("p", "ph-error", message));
  }
}
