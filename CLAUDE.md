# CLAUDE.md — Dev Helper

## Project Overview
Dev Helper is an offline-first, cross-platform developer toolkit built with pure Go. It provides essential daily dev tools in a single portable binary. The philosophy is: developers shouldn't depend on internet for basic tools.

## Tech Stack
- **Backend**: Go standard library (`net/http`, `html/template`, `encoding/json`)
- **Frontend**: Bootstrap 5.3.3 CDN + Bootstrap Icons CDN + Vanilla JavaScript
- **Editor engine**: Monaco Editor v0.52.2 (AMD, self-hosted in `static/monaco-editor/`)
- **No frameworks, no build step** — just Go templates + static JS files
- **Port**: 9090

## Architecture

### Routing Pattern
Each page has: a route in `main.go` → handler function → template file → JS file.

```
GET /           → handleIndex()           → dashboard.html  → dashboard.js
GET /upload     → handleUpload()          → upload.html     → app.js
GET /explorer   → handleFilesPage()       → files.html      → files.js
GET /prettify   → handlePrettifyPage()    → prettify.html   → prettify.js
GET /logs       → handleLogsPage()        → logs.html       → logs.js
GET /logviewer  → handleLogViewerPage()   → logviewer.html  → logviewer.js
GET /editor     → handleEditorPage()      → editor.html     → editor.js
GET /markdown   → handleMarkdownPage()    → markdown.html   → markdown.js
GET /diff       → handleDiffPage()        → diff.html       → diff.js
GET /jwt        → handleJWTPage()         → jwt.html        → jwt.js
GET /base64     → handleBase64Page()      → base64.html     → base64.js
GET /urlencoder → handleURLEncoderPage()  → urlencoder.html → urlencoder.js
GET /htmleditor → handleHTMLEditorPage()  → htmleditor.html → htmleditor.js
GET /mermaid    → handleMermaidPage()     → mermaid.html    → mermaid-page.js
GET /uuid       → handleUUIDPage()        → uuid.html       → uuid.js
```

### Template Pattern (IMPORTANT)
Templates use `loadPage("page.html")` which parses `layout.html` + the specific page file.
**DO NOT use `template.ParseGlob("*.html")`** — it causes `{{define "content"}}` collisions between pages.

Each page template defines two blocks:
- `{{define "content"}}` — page HTML
- `{{define "scripts"}}` — page-specific JS includes

### File Structure
```
main.go              — All routes & API handlers (single file)
templates/
  layout.html        — Shared layout: navbar, theme switcher, Ask AI dropdown, footer
  dashboard.html     — Homepage with tool cards, search, pinned section
  upload.html        — Upload page (drop zone, preview, lightbox)
  files.html         — File explorer (grid, search, modals)
  prettify.html      — Code beautifier (Monaco side-by-side editors)
  logs.html          — Log aggregator (filters, table)
  logviewer.html     — Large log file viewer (upload, keyword search, regex)
  editor.html        — Code editor (Monaco, full-featured)
  markdown.html      — Markdown viewer (Monaco + live preview)
  diff.html          — Code diff/comparison (Monaco diff editor)
  jwt.html           — JWT encoder/decoder (Monaco + HMAC verify)
  base64.html        — Base64 encoder/decoder (text + binary file support)
  urlencoder.html    — URL encoder/decoder (component/full URL + URL parser)
  htmleditor.html    — HTML/WYSIWYG editor (TinyMCE + Monaco source view)
  mermaid.html       — Mermaid diagram previewer (12 chart types, download, share)
  uuid.html          — UUID generator (v1/v4/v7, bulk, validate, parse)
static/
  dashboard.js       — Tool cards rendering, search, tools registry
  app.js             — Upload page logic (with localStorage recent uploads)
  files.js           — File explorer logic
  prettify.js        — Code beautifier logic (Monaco + js-beautify + sql-formatter + js-yaml)
  logs.js            — Log aggregator logic
  logviewer.js       — Large log file viewer logic
  editor.js          — Code editor logic (Monaco, language detection, URL fetch)
  markdown.js        — Markdown viewer logic (Monaco + marked.js + highlight.js)
  diff.js            — Code diff logic (Monaco diff editor)
  jwt.js             — JWT encoder/decoder logic (Monaco + HMAC-SHA256/384/512)
  base64.js          — Base64 encode/decode logic (text + binary files, URL-safe option)
  urlencoder.js      — URL encode/decode logic (component/full + URL parser)
  htmleditor.js      — HTML editor logic (TinyMCE WYSIWYG + Monaco source toggle)
  mermaid-page.js    — Mermaid diagram logic (live preview, 12 samples, SVG/PNG export, share via URL)
  uuid.js            — UUID generator logic (v1/v4/v7, bulk, validate & parse, history)
  monaco-editor/     — Monaco Editor v0.52.2 assets (self-hosted, ~12MB)
    min/vs/          — AMD modules: loader.js, base/, basic-languages/, editor/, language/
  icons/             — Local AI favicons (claude.png, chatgpt.svg, gemini.png, deepseek.svg, etc.)
files/               — Uploaded files (served via /files/)
logs/                — Log files, one per app (AppName.log), JSON-lines format
```

### API Endpoints
- `POST /api/upload` — File upload (multipart)
- `GET /api/files` — List files, `DELETE /api/files?name=X` or `?all=true`
- `POST /api/logs` — Receive log (JSON), `GET /api/logs?app=X` — Read logs
- `GET /api/logs/send?app=X&level=Y&msg=Z` — Quick log via query string
- `GET /api/logs/apps` — List apps, `DELETE /api/logs?app=X` — Clear logs
- `POST /api/logviewer` — Upload log file with keyword search/filter
- `GET /api/proxy?url=X` — Proxy fetch remote file (avoids CORS, used by editor/markdown)

### Dashboard & Navigation
- **`/` (Dashboard)**: Homepage showing all tools as cards with search. Tools defined in `dashboard.js` `tools` array.
- **Navbar**: Shows pinned tools only (managed via localStorage). Horizontal scrollable when many tools pinned.
- **Pin system**: Star icon on every page header + dashboard cards. Stored in localStorage (`devhelper_pinned_tools`).
- **Default pinned**: `['upload', 'files', 'prettify', 'editor', 'markdown', 'diff']`
- **Adding a new tool to dashboard**: Append to `tools` array in `static/dashboard.js` and add `<li>` to `#pinnedNav` in `layout.html`.

### Theme System
- **3 modes**: Light, Dark, Auto (follows system `prefers-color-scheme`)
- **Stored in**: localStorage (`devhelper_theme`), default: `auto`
- **Bootstrap**: Uses `data-bs-theme` attribute on `<html>` — Bootstrap 5.3.3 handles most styling
- **Flash prevention**: Inline `<script>` in `<head>` applies theme before CSS loads
- **Monaco sync**: `applyTheme()` calls `monaco.editor.setTheme()` globally + dispatches `devhelper-theme` event
- **CSS convention**: Use Bootstrap CSS variables (`var(--bs-body-bg)`, `var(--bs-border-color)`, `var(--bs-secondary-color)`, `var(--bs-tertiary-bg)`) instead of hardcoded colors like `#fff`, `#f8f9fa`, `#dee2e6`, `#6c757d`

### Ask AI Dropdown
- Navbar dropdown with 9 cloud AIs + Ollama (local)
- AI icons stored locally in `static/icons/` for offline use
- Each AI opens in named `window.open()` (reuses same tab on repeated clicks)
- Ollama: modal prompts for URL, saved in localStorage (`devhelper_ollama_url`)
- ChatGPT SVG: hardcoded `fill="#000"`, dark mode uses CSS `filter: invert(1)`

### Monaco Editor Setup (IMPORTANT)
Monaco v0.52.2 (last AMD-supported version) is self-hosted in `static/monaco-editor/min/vs/`.

**Worker URL pattern** (must use in every page that loads Monaco):
```javascript
require.config({ paths: { 'vs': '/static/monaco-editor/min/vs' } });
window.MonacoEnvironment = {
    getWorkerUrl: function (workerId, label) {
        const base = window.location.origin + '/static/monaco-editor/min';
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(
            `self.MonacoEnvironment = { baseUrl: '${base}/' }; importScripts('${base}/vs/base/worker/workerMain.js');`
        )}`;
    }
};
```

**DO NOT** set `baseUrl` to `.../min/vs/` — this causes double `vs/vs/` in worker paths.

**Theme on init**: Read current theme from `document.documentElement.getAttribute('data-bs-theme')`:
```javascript
theme: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'vs-dark' : 'vs',
```

Pages using Monaco: editor.js, prettify.js, markdown.js, diff.js, jwt.js, htmleditor.js, mermaid-page.js

### Prettify Formats
Supported: JSON, XML, HTML, CSS, JavaScript, TypeScript, SQL, YAML, SCSS, LESS
- **JSON/XML**: Native JS (JSON.parse, DOMParser)
- **HTML/CSS/JS/TS**: js-beautify CDN
- **SQL**: sql-formatter CDN
- **YAML**: js-yaml CDN
- **SCSS/LESS**: css_beautify (js-beautify)

### Key Conventions
- **Auto-reload templates**: `loadPage()` re-parses on every request — only `main.go` changes need server restart
- **Static files**: JS/CSS changes only need browser refresh (Ctrl+Shift+R for cache bypass)
- **Timestamp filenames**: Uploads get `YYYYMMDD-HHMMSS-originalname.ext` prefix
- **Copy-to-clipboard**: Every URL and file path has a copy button — essential for Claude Console workflow
- **Browser-renderable files**: PDF, HTML, TXT, MD, JSON, XML, CSV, MP4, MP3 open in new tab on click
- **Recent uploads persist**: Stored in `localStorage` (key: `devhelper_recent_uploads`, max 20 items)
- **const/let hoisting**: When using `const` arrays/objects in DOMContentLoaded, ensure any code referencing them runs AFTER the declarations (temporal dead zone)
- **External favicons**: Download to `static/icons/` — external sites block direct loading via CSP
- **Footer**: Clickable links — Fariz → github.com/farizfadian, Claude → claude.ai (with local icon)

## Adding a New Page
1. Add `mux.HandleFunc("/yourpage", handlerFunc)` in `main.go`
2. Create handler that calls `loadPage("yourpage.html").ExecuteTemplate(w, "layout.html", data)`
3. Add navbar `<li>` with `d-none` and `data-tool="toolid"` in `templates/layout.html` `#pinnedNav`
4. Create `templates/yourpage.html` with `{{define "content"}}` and `{{define "scripts"}}` blocks
5. Create `static/yourpage.js` for frontend logic
6. Add entry to `tools` array in `static/dashboard.js`
7. Use CSS variables (not hardcoded colors) for dark mode compatibility
8. If using Monaco: follow worker URL pattern above, set theme from `data-bs-theme`

## Build & Run
```bash
go run main.go           # Development (auto-reload templates)
go build -o dev-helper.exe .  # Production build
```

## User Context
- Owner: Fariz Fadian (https://github.com/farizfadian)
- Tech stack used in projects: C#, Angular, Java, Python, React, Next.js
- Communicates in Bahasa Indonesia
- Uses Claude Console (CLI) — prefers file path copying for screenshot sharing with Claude
