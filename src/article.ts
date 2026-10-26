import {
  App,
  MarkdownView,
  Notice,
  TFile,
  parseYaml,
  setIcon,
} from "obsidian";
import type PersonalHomePlugin from "./main";

export const ARTICLE_CLASS = "personal-article";

export interface ArticleMetadata {
  date: string;
  author: string;
  avatar: string;
}

export interface ArticleDocument {
  titleLine: number | null;
  metadata: ArticleMetadata;
}

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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isArticleFrontmatter(value: unknown): boolean {
  const classes = asRecord(value).cssclasses;
  if (Array.isArray(classes)) return classes.includes(ARTICLE_CLASS);
  return typeof classes === "string" && classes.split(/\s+/).includes(ARTICLE_CLASS);
}

function getArticleMetadata(value: unknown): ArticleMetadata {
  const record = asRecord(value);
  return {
    date: stringField(record, "date"),
    author: stringField(record, "author"),
    avatar: stringField(record, "avatar"),
  };
}

function findArticleTitleLine(markdown: string, firstLine = 0): number | null {
  const lines = markdown.split(/\r?\n/);
  let fence: "```" | "~~~" | null = null;

  for (let index = firstLine; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (fence) {
      if (trimmed.startsWith(fence)) fence = null;
      continue;
    }
    if (trimmed.startsWith("```")) {
      fence = "```";
      continue;
    }
    if (trimmed.startsWith("~~~")) {
      fence = "~~~";
      continue;
    }
    if (/^ {0,3}#(?!#)\s+/.test(line)) return index;
  }

  return null;
}

export function readArticleDocument(markdown: string): ArticleDocument | null {
  const lines = markdown.split(/\r?\n/);
  let frontmatter: Record<string, unknown> = {};
  let bodyStart = 0;

  if (lines[0] === "---") {
    const closing = lines.findIndex((line, index) => index > 0 && (line === "---" || line === "..."));
    if (closing < 1) return null;
    try {
      frontmatter = asRecord(parseYaml(lines.slice(1, closing).join("\n")));
    } catch {
      return null;
    }
    bodyStart = closing + 1;
  }

  if (!isArticleFrontmatter(frontmatter)) return null;
  return {
    titleLine: findArticleTitleLine(markdown, bodyStart),
    metadata: getArticleMetadata(frontmatter),
  };
}

export function hasArticleMetadata(metadata: ArticleMetadata): boolean {
  return Boolean(metadata.date || metadata.author || metadata.avatar);
}

function formatArticleDate(value: string): string {
  const match = value.match(/^(\d{4})(?:-(\d{1,2}))?/);
  if (!match) return value;
  if (!match[2]) return match[1];
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : value;
}

function authorInitials(author: string): string {
  const words = author.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.slice(0, 2).map((word) => Array.from(word)[0]).join("").toUpperCase();
  }
  return Array.from(words[0] ?? "").slice(0, 2).join("").toUpperCase();
}

function makeAvatar(app: App, metadata: ArticleMetadata): HTMLElement | null {
  if (metadata.avatar) {
    const file = app.vault.getAbstractFileByPath(metadata.avatar);
    if (file instanceof TFile) {
      const image = document.createElement("img");
      image.className = "ph-article-avatar";
      image.src = app.vault.getResourcePath(file);
      image.alt = "";
      image.onerror = () => image.remove();
      return image;
    }
  }

  if (!metadata.author) return null;
  const initials = document.createElement("span");
  initials.className = "ph-article-avatar ph-article-initials";
  initials.textContent = authorInitials(metadata.author);
  initials.setAttribute("aria-hidden", "true");
  return initials;
}

function openMetadataEditor(app: App, button: HTMLElement): void {
  const leaf = app.workspace.getLeavesOfType("markdown").find(
    (candidate) => candidate.view.containerEl.contains(button),
  );
  if (!(leaf?.view instanceof MarkdownView)) return;
  const view = leaf.view;

  void view.setState({ ...view.getState(), mode: "source", source: true }, { history: false })
    .then(() => {
      app.workspace.revealLeaf(leaf);
      view.editor.setCursor({ line: 1, ch: 0 });
      view.editor.focus();
    })
    .catch((error: unknown) => {
      new Notice(error instanceof Error ? error.message : String(error));
    });
}

export function renderArticleMetadata(app: App, metadata: ArticleMetadata): HTMLDivElement | null {
  if (!hasArticleMetadata(metadata)) return null;

  const container = document.createElement("div");
  container.className = "ph-article-meta";
  const avatar = makeAvatar(app, metadata);
  if (avatar) container.append(avatar);

  const byline = document.createElement("span");
  byline.className = "ph-article-byline";
  if (metadata.date) {
    const time = document.createElement("time");
    time.dateTime = metadata.date;
    time.textContent = formatArticleDate(metadata.date);
    byline.append(time);
  }
  if (metadata.date && metadata.author) {
    const separator = document.createElement("span");
    separator.className = "ph-article-separator";
    separator.textContent = "·";
    separator.setAttribute("aria-hidden", "true");
    byline.append(separator);
  }
  if (metadata.author) {
    const author = document.createElement("span");
    author.className = "ph-article-author";
    author.textContent = metadata.author;
    byline.append(author);
  }
  container.append(byline);

  const edit = document.createElement("button");
  edit.className = "ph-article-edit";
  edit.type = "button";
  edit.setAttribute("aria-label", "Edit article metadata");
  edit.title = "Edit article metadata";
  setIcon(edit, "pencil");
  edit.onclick = () => openMetadataEditor(app, edit);
  container.append(edit);
  return container;
}

function cachedTitleLine(app: App, sourcePath: string): number | null {
  const file = app.vault.getAbstractFileByPath(sourcePath);
  if (!(file instanceof TFile)) return null;
  const heading = app.metadataCache.getFileCache(file)?.headings?.find((item) => item.level === 1);
  return heading?.position.start.line ?? null;
}

export function registerArticleSupport(plugin: PersonalHomePlugin): void {
  const app = plugin.app;
  plugin.registerMarkdownPostProcessor((element, context) => {
    if (!isArticleFrontmatter(context.frontmatter)) return;
    const section = context.getSectionInfo(element);
    if (!section) return;
    const titleLine = cachedTitleLine(app, context.sourcePath) ?? findArticleTitleLine(section.text);
    if (titleLine === null || titleLine < section.lineStart || titleLine > section.lineEnd) return;
    const heading = Array.from(element.querySelectorAll("h1")).find(
      (candidate) => !candidate.closest(".markdown-embed"),
    );
    if (!heading) return;

    heading.nextElementSibling?.classList.contains("ph-article-meta")
      ? heading.nextElementSibling.remove()
      : undefined;
    const metadata = renderArticleMetadata(app, getArticleMetadata(context.frontmatter));
    if (metadata) heading.insertAdjacentElement("afterend", metadata);
  });

  plugin.registerEvent(
    app.metadataCache.on("changed", (file) => {
      for (const leaf of app.workspace.getLeavesOfType("markdown")) {
        if (!(leaf.view instanceof MarkdownView)) continue;
        const view = leaf.view;
        if (view.file?.path !== file.path || view.getMode() !== "preview") continue;
        const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
        if (
          isArticleFrontmatter(frontmatter)
          || view.previewMode.containerEl.querySelector(".ph-article-meta")
        ) {
          view.previewMode.rerender();
        }
      }
    }),
  );
}
