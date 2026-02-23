# CLAUDE.md — Dev Helper

## Project Overview
Dev Helper is an offline-first, cross-platform developer toolkit built with pure Go. It provides essential daily dev tools in a single portable binary. The philosophy is: developers shouldn't depend on internet for basic tools.

## Tech Stack
- **Backend**: Go standard library (`net/http`, `html/template`, `encoding/json`) + gopsutil v4 (system metrics)
- **Frontend**: Bootstrap 5.3.3 CDN + Bootstrap Icons CDN + Vanilla JavaScript
- **Editor engine**: Monaco Editor v0.52.2 (AMD, self-hosted in `static/monaco-editor/`)
- **No frameworks, no build step** — just Go templates + static JS files
- **Port**: 9090

## Architecture

### Routing Pattern
Each page has: a route in `main.go` → handler function → template file → JS file.

```
GET /              → handleIndex()              → dashboard.html     → dashboard.js
GET /upload        → handleUpload()             → upload.html        → app.js
GET /explorer      → handleFilesPage()          → files.html         → files.js
GET /prettify      → handlePrettifyPage()       → prettify.html      → prettify.js
GET /logs          → handleLogsPage()           → logs.html          → logs.js
GET /logviewer     → handleLogViewerPage()      → logviewer.html     → logviewer.js
GET /editor        → handleEditorPage()         → editor.html        → editor.js
GET /markdown      → handleMarkdownPage()       → markdown.html      → markdown.js
GET /diff          → handleDiffPage()           → diff.html          → diff.js
GET /jwt           → handleJWTPage()            → jwt.html           → jwt.js
GET /base64        → handleBase64Page()         → base64.html        → base64.js
GET /urlencoder    → handleURLEncoderPage()     → urlencoder.html    → urlencoder.js
GET /htmleditor    → handleHTMLEditorPage()     → htmleditor.html    → htmleditor.js
GET /mermaid       → handleMermaidPage()        → mermaid.html       → mermaid-page.js
GET /uuid          → handleUUIDPage()           → uuid.html          → uuid.js
GET /notes         → handleNotesPage()          → notes.html         → notes.js
GET /regex         → handleRegexPage()          → regex.html         → regex.js
GET /charmap       → handleCharmapPage()        → charmap.html       → charmap.js
GET /epoch         → handleEpochPage()          → epoch.html         → epoch.js
GET /hash          → handleHashPage()           → hash.html          → hash.js
GET /colorpicker   → handleColorPickerPage()    → colorpicker.html   → colorpicker.js
GET /cron          → handleCronPage()           → cron.html          → cron.js
GET /password      → handlePasswordPage()       → password.html      → password.js
GET /qrcode        → handleQRCodePage()         → qrcode.html        → qrcode.js
GET /lorem         → handleLoremPage()          → lorem.html         → lorem.js
GET /baseconverter → handleBaseConverterPage()  → baseconverter.html → baseconverter.js
GET /json2yaml     → handleJSON2YAMLPage()      → json2yaml.html     → json2yaml.js
GET /httpclient    → handleHTTPClientPage()     → httpclient.html    → httpclient.js
GET /stringutils   → handleStringUtilsPage()    → stringutils.html   → stringutils.js
GET /snippets      → handleSnippetsPage()       → snippets.html      → snippets.js
GET /aichat        → handleAIChatPage()         → aichat.html        → aichat.js
GET /chat          → handleChatPage()           → chat.html          → chat.js
GET /worldclock    → handleWorldClockPage()     → worldclock.html    → worldclock.js
GET /netscan       → handleNetScanPage()        → netscan.html       → netscan.js
GET /netinspect    → handleNetInspectPage()     → netinspect.html    → netinspect.js
GET /speedtest     → handleSpeedTestPage()      → speedtest.html     → speedtest.js
GET /ocr           → handleOCRPage()            → ocr.html           → ocr.js
GET /yaml2props    → handleYAML2PropsPage()     → yaml2props.html    → yaml2props.js
GET /sysmon        → handleSysMonPage()         → sysmon.html        → sysmon.js
GET /icons         → handleIconsPage()          → icons.html         → icons.js
GET /translator    → handleTranslatorPage()     → translator.html    → translator.js
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
  layout.html        — Shared layout: navbar, theme switcher, Ask AI dropdown, spotlight, focus mode CSS, footer
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
  notes.html         — Markdown notes editor
  snippets.html      — Code snippets manager (Monaco, multi-language)
  regex.html         — Regex tester
  charmap.html       — Emoji & character map
  epoch.html         — Epoch timestamp converter
  hash.html          — Hash generator (MD5/SHA-1/SHA-256/SHA-512)
  colorpicker.html   — Color picker (HEX/RGB/HSL converter)
  cron.html          — Cron expression parser
  password.html      — Password & passphrase generator
  qrcode.html        — QR code generator
  lorem.html         — Lorem ipsum placeholder text generator
  baseconverter.html — Number base converter (bin/oct/dec/hex)
  json2yaml.html     — JSON ↔ YAML converter
  httpclient.html    — HTTP client (mini Postman)
  stringutils.html   — String utility tools
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
  notes.js           — Notes editor logic (Monaco, categories, tags, attachments)
  snippets.js        — Code snippets logic (Monaco, dynamic language, CRUD, copy)
  regex.js           — Regex tester logic (live highlighting, capture groups, replace)
  charmap.js         — Emoji & CharMap logic (search, copy, unicode details)
  epoch.js           — Epoch converter logic (live clock, presets, time diff)
  hash.js            — Hash generator logic (Web Crypto API + MD5 pure JS)
  colorpicker.js     — Color picker logic (HEX/RGB/HSL conversion, WCAG contrast)
  cron.js            — Cron parser logic (human-readable description, next runs)
  password.js        — Password generator logic (Web Crypto randomness, entropy)
  qrcode.js          — QR code generator logic (qrcode-generator lib, PNG/SVG export)
  lorem.js           — Lorem ipsum logic (classic/hipster/tech styles)
  baseconverter.js   — Base converter logic (BigInt, bit visualization)
  json2yaml.js       — JSON↔YAML logic (js-yaml CDN)
  httpclient.js      — HTTP client logic (request builder, history)
  stringutils.js     — String utils logic (29 operations, case/trim/encode/extract)
  translator.js      — Translator logic (Ollama SSE, language detection, history)
  icons.js           — Icon Explorer logic (Bootstrap Icons, Font Awesome, Tabler Icons)
  i18n.js            — Internationalization core (21 languages, auto-translate headings/nav)
  i18n/              — Translation JSON files (en.json, id.json, es.json, ... 21 files)
  monaco-editor/     — Monaco Editor v0.52.2 assets (self-hosted, ~12MB)
    min/vs/          — AMD modules: loader.js, base/, basic-languages/, editor/, language/
  icons/             — Local AI favicons + app icons (favicon.svg, favicon.ico, bootstrap-icon.svg, font-awesome.svg, tabler-icon.svg, etc.)
rsrc.syso              — Windows exe icon resource (generated by rsrc tool, DO NOT delete)
files/               — Uploaded files (served via /files/)
logs/                — Log files, one per app (AppName.log), JSON-lines format
notes/               — Notes data (notes.json + attachments/)
snippets/            — Code snippets data (snippets.json, auto-created with 20 defaults)
```

### API Endpoints
- `POST /api/upload` — File upload (multipart)
- `GET /api/files` — List files, `DELETE /api/files?name=X` or `?all=true`
- `POST /api/logs` — Receive log (JSON), `GET /api/logs?app=X` — Read logs
- `GET /api/logs/send?app=X&level=Y&msg=Z` — Quick log via query string
- `GET /api/logs/apps` — List apps, `DELETE /api/logs?app=X` — Clear logs
- `POST /api/logviewer` — Upload log file with keyword search/filter
- `GET /api/proxy?url=X` — Proxy fetch remote file (avoids CORS, used by editor/markdown)
- `POST /api/httpclient` — Proxy HTTP requests for HTTP Client tool (supports all methods, custom headers, body)
- `GET/POST/PUT/DELETE /api/notes` — CRUD for notes, `POST /api/notes/restore`, `POST /api/notes/reorder`
- `POST /api/notes/attachment` — Upload note attachment
- `GET/POST/PUT/DELETE /api/snippets` — CRUD for code snippets
- `POST /api/chat/send` — Send chat message, `GET /api/chat/stream` — SSE chat stream, `GET /api/chat/online` — Online users
- `GET /api/netscan/interfaces` — List network interfaces, `GET /api/netscan/scan` — SSE port scan
- `GET /api/netinspect/myip` — Public IP, `/iplookup` — IP geolocation, `/dns` — DNS lookup, `/headers` — HTTP headers, `/ssl` — SSL cert info
- `GET /api/aichat/models` — Ollama models, `/version` — Ollama version, `POST /api/aichat/chat` — SSE chat stream
- `GET /api/speedtest/ping` — Latency test, `/download` — Download speed, `POST /api/speedtest/upload` — Upload speed, `/disk` — Disk speed
- `GET /api/sysmon/snapshot` — Single JSON snapshot (500ms CPU sample), `GET /api/sysmon/stream` — SSE stream (2s interval)

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
- AIs with `?q=` URL scheme support (Claude, ChatGPT, Gemini, DeepSeek, Perplexity, Copilot): show prompt modal before opening
- AIs without URL scheme (Grok, Mistral, HuggingChat): open directly without prompt
- Ollama: modal prompts for URL, saved in localStorage (`devhelper_ollama_url`)
- AI prompt modal: textarea with Enter to send, Shift+Enter for newline, "Open without prompt" fallback
- ChatGPT SVG: hardcoded `fill="#000"`, dark mode uses CSS `filter: invert(1)`

### Internationalization (i18n)
- 21 languages supported, stored in `static/i18n/{lang}.json`
- Core library: `static/i18n.js` — loaded globally before Bootstrap
- `t(key, params)` function for translations, `data-i18n` attributes on DOM elements
- Language selector dropdown in navbar (between theme toggle and Ask AI)
- Auto-translates page headings via `#pinToggle` pin star `data-tool` attribute
- Auto-translates navbar tool names via `#pinnedNav [data-tool]` elements
- Dashboard + Spotlight search are i18n-aware (search both translated and original names)
- Events: `devhelper-lang-change` (language changed), `devhelper-i18n-ready` (initial load)
- Preference stored in localStorage (`devhelper_language`), default: `en`
- Flags from flagcdn.com using country codes (us, id, jp, etc.)
- Translation values must use actual characters, NOT unicode escape sequences

### Focus Mode (Shared Fullscreen Editor)
- Shared CSS in `layout.html`: `.focus-wrapper`, `.focus-active`, `.focus-hide`, `.focus-grow`, `.focus-fill`, `.focus-toolbar`
- Uses `position: fixed` with `z-index: 1050` for true fullscreen overlay
- Toggle via Expand button, F11 key, Escape to exit
- State persisted in localStorage per page (e.g., `devhelper_markdown_fullscreen`)
- Pages with focus mode: markdown, diff, editor, prettify, mermaid, htmleditor
- Page heading (icon + title + pin star) stays visible in focus mode for page awareness
- Monaco editors need `editor.layout()` with 50ms timeout after toggle

### Spotlight Search (Ctrl+K)
- Global search overlay for all tools
- Keyboard: Ctrl+K / Cmd+K to open, Escape to close, arrows to navigate, Enter to open
- TOOLS array in layout.html must be updated when adding new pages

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

### CDN Libraries (non-Monaco)
- **TinyMCE v7**: `https://cdn.jsdelivr.net/npm/tinymce@7` (htmleditor)
- **Mermaid.js v11**: `https://cdn.jsdelivr.net/npm/mermaid@11` (mermaid)
- **js-yaml v4.1**: `https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js` (prettify, json2yaml)
- **qrcode-generator v1.4.4**: `https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js` (qrcode)
- **marked.js**: UMD build `lib/marked.umd.js` (markdown)
- **highlight.js**: (markdown code blocks)
- **js-beautify**: (prettify — HTML/CSS/JS/TS formatting)
- **sql-formatter**: (prettify — SQL formatting)

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

### Development
```bash
go run main.go                     # Start dev server (auto-reload templates)
go run main.go --port 8080         # Custom port
go run main.go --debug             # Enable verbose HTTP request/response logging
go run main.go --debug --port 8080 # Combine flags
```

### Windows Exe Icon
The `rsrc.syso` file in project root embeds `favicon.ico` as the Windows exe icon. It's auto-included by `go build`. To regenerate:
```bash
go install github.com/akavel/rsrc@latest
rsrc -ico static/icons/favicon.ico -o rsrc.syso
```

### Production Build
```bash
go build -o dev-helper.exe .       # Build binary (with icon on Windows)
./dev-helper.exe                   # Run with defaults (port 9090)
./dev-helper.exe --debug           # Run with debug logging
./dev-helper.exe --port 3000       # Run on custom port
```

### Cross-platform Build
```bash
GOOS=windows GOARCH=amd64 go build -o dev-helper.exe .
GOOS=linux   GOARCH=amd64 go build -o dev-helper .
GOOS=darwin  GOARCH=amd64 go build -o dev-helper .     # Mac Intel
GOOS=darwin  GOARCH=arm64 go build -o dev-helper .     # Mac Apple Silicon
```

### CLI Flags
| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `9090` | Server port |
| `--debug` | `false` | Enable verbose HTTP request/response logging to terminal |

### Debug Mode (`--debug`)
Logs all API requests/responses to the terminal for investigation & debugging:
- **Logged**: All API endpoints (`/api/*`), non-HTML responses
- **Skipped**: Static files (`/static/`, `/files/`, `/notes-att/`), HTML page responses
- **Multipart**: Shows field names + file names/sizes (not file content)
- **SSE streaming**: Shows headers only, body marked `[streaming — not captured]`
- **JSON**: Auto pretty-printed with indentation
- **Body truncation**: Max 2KB per body, shows `[truncated, total: XXkB]` if larger
- **Duration**: Shows request-to-response time

Example output:
```
━━ REQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[2026-02-23 23:15:00] POST /api/upload
Headers:
  Content-Type: multipart/form-data; boundary=...
Body (multipart):
  [file] file: "screenshot.png" (245.3KB)
━━ RES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: 200 OK (0.05s)
Headers:
  Content-Type: application/json
Body:
{
  "url": "/files/20260223-231500-screenshot.png",
  "filename": "20260223-231500-screenshot.png"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Implementation: `debugMiddleware` wraps the `mux` in `main()`. Uses `responseRecorder` (custom `http.ResponseWriter` that captures status code + response body). Zero overhead when `--debug` is not set.

## User Context
- Owner: Fariz Fadian (https://github.com/farizfadian)
- Tech stack used in projects: C#, Angular, Java, Python, React, Next.js
- Communicates in Bahasa Indonesia
- Uses Claude Console (CLI) — prefers file path copying for screenshot sharing with Claude
