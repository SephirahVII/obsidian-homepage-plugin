# Personal Home for Obsidian

A local, Markdown-backed personal home and editorial article reader for Obsidian. The homepage combines a reading column, biography switch, curated notes, a dynamic blog index, and a local narrative illustration. Opted-in article notes add a quiet long-form reading layout with real metadata.

The implementation uses Obsidian's native Markdown renderer, plugin APIs, CodeMirror, and scoped CSS. It does not embed a remote website, use an iframe, or require a Next.js runtime.

## Features

### Personal home

- A configurable identity link and short/long biography switch.
- Page-local Markdown editing with save, cancel, and conflict-aware writes.
- Curated internal links rendered as a two-column Notes list on wide panes.
- Blog rows generated from `type`, `title`, `date`, and optional `order` Frontmatter.
- A local SVG illustration with bounded hover motion.
- Light/dark themes, keyboard focus, and responsive layouts.

### Article pages

- An approximately 650px reading column with editorial typography.
- A native Markdown H1 as the article title; no duplicate title is required.
- Date, author, and an optional local avatar or author initials from Frontmatter.
- The same metadata component in Reading view and Live Preview.
- A metadata edit button that opens the article's Frontmatter for editing.
- Opt-in styling through `cssclasses: personal-article`, without forcing a theme on unrelated notes.

## Verified environment

- Obsidian 1.13.7 on macOS.
- Reading view and Live Preview.
- 1192px desktop and 390px narrow-viewport layouts.

Physical iOS and Android devices have not been verified. The plugin currently declares `isDesktopOnly: false`; validate your target devices before relying on mobile behavior.

## Install manually

1. Create this directory in your Vault:

   ```text
   <Vault>/.obsidian/plugins/personal-home/
   ```

2. Copy these files into it:

   ```text
   main.js
   manifest.json
   styles.css
   ```

3. In Obsidian, open **Settings → Community plugins**, allow community plugins, and enable **Personal Home**.
4. For a ready-to-edit example, copy `examples/个人主页.md` to your Vault root as `个人主页.md`, and copy `examples/home-content/`, `examples/blog/`, and `examples/notes/` into an `examples/` directory in your Vault.
5. Open `个人主页.md` in Reading view or Live Preview. You can also run **Personal Home: Open personal home** from the command palette.

The example uses placeholder identity and content, not your personal information. Replace its paths and text with your own files when you are ready.

## Configure the homepage

The homepage is an ordinary Markdown note containing a `personal-home` code block:

````markdown
---
cssclasses:
  - personal-home-page
---
```personal-home
handle: "@yourname"
handleUrl: "https://example.com"
shortBio: "examples/home-content/short-bio.md"
longBio: "examples/home-content/long-bio.md"
notes: "examples/home-content/notes.md"
blogFolder: "examples/blog"
blogLimit: 8
art: "examples/home-content/art.svg"
artAlt: "A colorful city, a river, and rolling fields"
```
````

All paths are relative to the **Vault root**, not the note's folder.

| Setting | Purpose |
| --- | --- |
| `handle` | Displayed identity text. |
| `handleUrl` | External identity link. |
| `shortBio` / `longBio` | Markdown files used by the Default / Long switch. |
| `notes` | Markdown list of curated Wikilinks. |
| `blogFolder` | Folder scanned for notes with `type: blog`. |
| `blogLimit` | Maximum blog rows, from 1 to 50. |
| `art` | Local SVG or image file shown on wide panes. |
| `artAlt` | Accessible description of the artwork. |

Biography and curated-list content can be edited directly in their Markdown files or through the pencil buttons on the homepage. The biography switch changes the displayed file, not its contents.

## Create an article

Add `personal-article` to the note's `cssclasses`. Keep one native H1 as the article title and write the rest as ordinary Markdown:

````markdown
---
cssclasses:
  - personal-article
date: 2025-01
author: "Your Name"
avatar: "attachments/avatar.png"
---
# Your article title

## The first section

Write your editable Markdown content here.

## The next section

Add more paragraphs, links, lists, quotes, code, tables, or images as needed.
````

- `date` is optional. `YYYY-MM` is displayed as an English month and year, such as `January 2025`.
- `author` is optional.
- `avatar` is optional and must point to a file inside the Vault. Without it, the plugin displays the author's initials.
- Missing metadata does not create an empty byline.
- Use the metadata pencil or Source mode to edit Frontmatter. The body remains normal Markdown.
- A missing H1 leaves Obsidian's native inline title in place.

To include an article in the homepage's Blogs section, put it in the configured `blogFolder` and add:

```yaml
type: blog
title: "Your article title"
date: 2025-01
```

Rows are sorted by date descending, then by the optional numeric `order` field, and finally by path.

## Customize appearance

Styles are scoped to `personal-home` and `personal-article`. You can add another class to a note for local variations:

```yaml
cssclasses:
  - personal-article
  - compact-note
```

An Obsidian CSS snippet can then adjust the existing variables without changing the rest of the Vault:

```css
body .compact-note {
  --pa-measure: 760px;
  --pa-body-size: 16px;
}
```

Enable the snippet in **Settings → Appearance → CSS snippets**. Adding CSS alone cannot provide new metadata or interactive behavior; those require plugin code.

## Develop

Node.js and npm are needed only to modify and rebuild the plugin. They are not needed to install the compiled plugin.

```bash
npm ci
npm run typecheck
npm run build
```

The build updates `main.js`. After changing TypeScript, build and reload the plugin in Obsidian. `npm run dev` starts the esbuild watch process for development.

Source layout:

```text
src/main.ts             Plugin registration and commands
src/homeController.ts   Homepage layout, editing, and dynamic content
src/livePreview.ts      Homepage CodeMirror integration
src/article.ts          Article metadata and Reading-view rendering
src/articlePreview.ts   Article metadata in Live Preview
styles.css              Scoped homepage and article styles
```

## Release and community distribution

For an installable GitHub release, create a tag that exactly matches `manifest.json`'s `version` and attach `main.js`, `manifest.json`, and `styles.css` to that release.

Uploading a repository does not publish the plugin to the Obsidian community directory. Community submission requires a separate review through `community.obsidian.md`, a public source repository, a README, and a LICENSE.

Official guide: <https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>

## Content and licensing

The `examples/` directory contains placeholder text and the locally drawn SVG artwork created for this project. It does not include the reference site's photographs, complete illustration, or full article text.

No open-source license has been selected yet. Before making this repository public or submitting it to the community, the repository owner must explicitly choose a license and add `LICENSE`.
