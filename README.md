# Dev Helper

**Offline-first developer toolkit — single Go binary, zero dependencies.**

Essential daily dev tools bundled in one portable binary. No internet required, no runtime to install. Build once, run on Windows / Linux / Mac.

## Quick Start

```bash
# Development (hot-reload templates)
go run main.go

# Production build
go build -o dev-helper.exe .
./dev-helper.exe
```

Open **http://localhost:9090**

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `9090` | Server port |
| `--debug` | `false` | Enable verbose HTTP request/response logging |

### Examples

```bash
go run main.go                       # Default: port 9090, no debug
go run main.go --port 8080           # Custom port
go run main.go --debug               # Enable debug logging
go run main.go --debug --port 3000   # Combine flags

# Production binary
./dev-helper.exe --debug --port 8080
```

### Debug Mode (`--debug`)

Prints comprehensive HTTP request/response logs to the terminal. Useful for investigating API behavior during development.

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

What gets logged:
- All API requests/responses with headers and body
- JSON bodies are auto pretty-printed
- Multipart uploads show file names and sizes (not content)
- SSE streaming responses show headers only
- Body truncated at 2KB with `[truncated, total: XXkB]` indicator

What gets skipped (to reduce noise):
- Static files (`/static/`, `/files/`, `/notes-att/`)
- HTML page responses (only API calls are logged)

### Cross-platform Build

```bash
GOOS=windows GOARCH=amd64 go build -o dev-helper.exe .
GOOS=linux   GOARCH=amd64 go build -o dev-helper .
GOOS=darwin  GOARCH=amd64 go build -o dev-helper .     # Mac Intel
GOOS=darwin  GOARCH=arm64 go build -o dev-helper .     # Mac Apple Silicon
```

## Tools (42 pages)

### Code & Text Tools

| Tool | Route | Description |
|------|-------|-------------|
| **Code Editor** | `/editor` | Monaco-powered editor, 40+ languages, file upload, fetch from URL |
| **Prettify** | `/prettify` | Format JSON, XML, HTML, CSS, JS, TS, SQL, YAML, SCSS, LESS |
| **Code Diff** | `/diff` | Monaco diff editor, side-by-side/inline toggle, file upload |
| **Markdown** | `/markdown` | Monaco editor + live preview with syntax-highlighted code blocks |
| **HTML Editor** | `/htmleditor` | TinyMCE WYSIWYG + Monaco source view, import/export HTML |
| **Mermaid Diagram** | `/mermaid` | Live preview, 12 chart types, SVG/PNG download, share via URL |
| **Regex Tester** | `/regex` | Real-time highlighting, capture groups, replace mode, 18 patterns |
| **Notes** | `/notes` | Markdown notes with categories, tags, color labels, attachments, trash/restore |
| **String Utilities** | `/stringutils` | 29 string operations: case conversion, cleanup, encode/decode, extract |
| **Code Snippets** | `/snippets` | Save/organize code snippets, Monaco editor, fuzzy search, categories, tags |
| **Lorem Ipsum** | `/lorem` | Placeholder text generator (classic/hipster/tech), paragraphs/sentences/words |

### Encode / Decode / Convert

| Tool | Route | Description |
|------|-------|-------------|
| **JWT Tool** | `/jwt` | Encode, decode, verify JWTs (HS256/384/512), color-coded display |
| **Base64** | `/base64` | Encode/decode text + binary files, URL-safe option, file download |
| **URL Encoder** | `/urlencoder` | encodeURIComponent/encodeURI, URL parser with param breakdown |
| **JSON ↔ YAML** | `/json2yaml` | Bidirectional conversion, auto-convert, prettify/minify, file import |
| **YAML to Properties** | `/yaml2props` | Convert YAML to Java .properties format |
| **Base Converter** | `/baseconverter` | Binary/octal/decimal/hex, BigInt support, bit visualization |
| **Hash Generator** | `/hash` | MD5, SHA-1, SHA-256, SHA-512 — text + file hashing, hash comparison |

### Generator Tools

| Tool | Route | Description |
|------|-------|-------------|
| **UUID Generator** | `/uuid` | v1/v4/v7, bulk generate (up to 1000), validate & parse, history |
| **Password Generator** | `/password` | Secure random passwords (Web Crypto), passphrases, strength meter |
| **QR Code** | `/qrcode` | Text/URL/WiFi/vCard, PNG/SVG download, custom colors |
| **Color Picker** | `/colorpicker` | HEX/RGB/HSL converter, WCAG contrast checker, palette, EyeDropper API |

### Time & Reference

| Tool | Route | Description |
|------|-------|-------------|
| **Epoch Converter** | `/epoch` | Unix timestamp ↔ date, live clock, presets, time diff calculator |
| **Cron Parser** | `/cron` | Parse/generate cron expressions, human-readable, next 10 runs |
| **World Clock** | `/worldclock` | Multiple timezone display with live update |
| **Emoji & CharMap** | `/charmap` | Search/copy emojis & symbols, unicode details, HTML entities |

### File & Log Tools

| Tool | Route | Description |
|------|-------|-------------|
| **Upload** | `/upload` | Drag/drop/paste file upload, image preview, lightbox, instant URL copy |
| **File Explorer** | `/explorer` | Google Drive-like grid view, search, delete, file preview |
| **Log Aggregator** | `/logs` | Receive logs via HTTP POST, filter by app/level/search, auto-refresh |
| **Log Viewer** | `/logviewer` | Upload & search large log files with regex and context lines |
| **OCR** | `/ocr` | Extract text from images |

### Network & API Tools

| Tool | Route | Description |
|------|-------|-------------|
| **HTTP Client** | `/httpclient` | Mini Postman — all methods, custom headers/body/auth, history |
| **Network Scanner** | `/netscan` | Port scanner with interface detection |
| **Network Inspector** | `/netinspect` | IP lookup, DNS lookup, HTTP headers, SSL cert info |
| **Speed Test** | `/speedtest` | Network latency, download/upload speed, disk speed test |

### AI & Communication

| Tool | Route | Description |
|------|-------|-------------|
| **AI Chat** | `/aichat` | Chat with local Ollama models directly from Dev Helper |
| **Translator** | `/translator` | Ollama-powered translation (21 languages, auto-detect, TTS, history) |
| **Chat Room** | `/chat` | Real-time chat room (SSE-based, multi-user) |

### Reference & Explorer

| Tool | Route | Description |
|------|-------|-------------|
| **Icon Explorer** | `/icons` | Browse Bootstrap Icons, Font Awesome, Tabler Icons — search, copy class/HTML/JSX |
| **System Monitor** | `/sysmon` | Real-time CPU, memory, disk, network, top processes via SSE |

### Global Features

- **Dashboard** (`/`) — Homepage with all tools as searchable cards
- **Theme** — Light / Dark / Auto (system preference), persisted in localStorage
- **Pin system** — Star any tool to pin it to the navbar, drag-scrollable
- **Focus mode** — Fullscreen editor mode (F11 / Esc) on code-heavy pages
- **Spotlight search** — Ctrl+K / Cmd+K to quickly find and open any tool
- **Ask AI** — Navbar dropdown with 9 cloud AIs + Ollama, opens in new tab
- **Copy buttons** — Every URL and file path is one-click copyable
- **i18n** — 21 languages supported, language selector in navbar
- **Favicon** — SVG favicon for browser tabs, ICO embedded in Windows exe

## Tech Stack

- **Backend**: Go standard library (`net/http`, `html/template`)
- **Frontend**: Bootstrap 5.3.3 + Bootstrap Icons + Vanilla JavaScript
- **Editor**: Monaco Editor v0.52.2 (self-hosted AMD build)
- **No frameworks, no build step** — just Go templates + static JS files

## Project Structure

```
dev-helper/
├── main.go                 # All routes & API handlers (single file)
├── go.mod
├── CLAUDE.md               # Full architecture docs for Claude AI assistant
├── templates/
│   ├── layout.html         # Shared layout: navbar, theme, spotlight, footer
│   ├── dashboard.html      # Homepage with tool cards
│   ├── editor.html         # Code editor
│   ├── prettify.html       # Code beautifier
│   ├── diff.html           # Code diff
│   ├── markdown.html       # Markdown viewer
│   ├── htmleditor.html     # HTML/WYSIWYG editor
│   ├── mermaid.html        # Mermaid diagrams
│   ├── upload.html         # File upload
│   ├── files.html          # File explorer
│   ├── logs.html           # Log aggregator
│   ├── logviewer.html      # Log file viewer
│   ├── notes.html          # Notes editor
│   ├── jwt.html            # JWT tool
│   ├── base64.html         # Base64 encoder
│   ├── urlencoder.html     # URL encoder
│   ├── json2yaml.html      # JSON ↔ YAML
│   ├── yaml2props.html     # YAML to Properties
│   ├── hash.html           # Hash generator
│   ├── uuid.html           # UUID generator
│   ├── password.html       # Password generator
│   ├── qrcode.html         # QR code generator
│   ├── colorpicker.html    # Color picker
│   ├── regex.html          # Regex tester
│   ├── stringutils.html    # String utilities
│   ├── baseconverter.html  # Base converter
│   ├── lorem.html          # Lorem ipsum
│   ├── epoch.html          # Epoch converter
│   ├── cron.html           # Cron parser
│   ├── worldclock.html     # World clock
│   ├── charmap.html        # Emoji & CharMap
│   ├── httpclient.html     # HTTP client
│   ├── netscan.html        # Network scanner
│   ├── netinspect.html     # Network inspector
│   ├── speedtest.html      # Speed test
│   ├── ocr.html            # OCR
│   ├── aichat.html         # AI chat
│   ├── chat.html           # Chat room
│   ├── icons.html          # Icon Explorer
│   ├── translator.html     # Translator
│   ├── snippets.html       # Code snippets
│   └── sysmon.html         # System monitor
├── rsrc.syso                # Windows exe icon resource
├── static/
│   ├── *.js                # One JS file per page (vanilla JavaScript)
│   ├── i18n.js             # Internationalization core (21 languages)
│   ├── i18n/               # Translation JSON files (en, id, es, ja, ... 21 files)
│   ├── icons-bootstrap.js  # Bootstrap Icons data (~2000 icons)
│   ├── icons-fa.js         # Font Awesome data (~2000 icons)
│   ├── icons-tabler.js     # Tabler Icons data (~5000 icons)
│   ├── monaco-editor/      # Monaco Editor v0.52.2 (self-hosted)
│   └── icons/              # App icons + AI favicons
├── files/                  # Uploaded files (runtime, gitignored)
├── logs/                   # Log files, JSON-lines (runtime, gitignored)
└── notes/                  # Notes data + attachments (runtime, gitignored)
```

## API Reference

### Upload & Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload file (multipart form) |
| GET | `/api/files` | List all uploaded files |
| DELETE | `/api/files?name=X` | Delete a specific file |
| DELETE | `/api/files?all=true` | Delete all files |

### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/logs` | Send log entry (JSON body) |
| GET | `/api/logs/send?app=X&level=Y&msg=Z` | Quick log via query string |
| GET | `/api/logs?app=X` | Read logs (optional: `level`, `search`) |
| GET | `/api/logs/apps` | List all apps with logs |
| DELETE | `/api/logs?app=X` | Clear logs for an app |
| POST | `/api/logviewer` | Upload log file with keyword search/filter |

### Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes` | List all notes |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes` | Update note |
| DELETE | `/api/notes` | Delete note (soft delete to trash) |
| POST | `/api/notes/restore` | Restore note from trash |
| POST | `/api/notes/reorder` | Reorder notes |
| POST | `/api/notes/attachment` | Upload note attachment |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/send` | Send chat message |
| GET | `/api/chat/stream?username=X` | SSE stream for real-time messages |
| GET | `/api/chat/online` | List online users |

### AI Chat (Ollama)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/aichat/models?url=X` | List Ollama models |
| GET | `/api/aichat/version?url=X` | Get Ollama version |
| POST | `/api/aichat/chat` | SSE chat stream with Ollama model |

### Network

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/netscan/interfaces` | List server's network interfaces |
| GET | `/api/netscan/scan?target=...&ports=...` | SSE port scan stream |
| GET | `/api/netinspect/myip` | Detect public IP |
| GET | `/api/netinspect/iplookup?ip=X` | IP geolocation lookup |
| GET | `/api/netinspect/dns?domain=X` | DNS lookup |
| GET | `/api/netinspect/headers?url=X` | Fetch HTTP response headers |
| GET | `/api/netinspect/ssl?host=X` | SSL certificate info |

### Speed Test

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/speedtest/ping` | Minimal JSON for latency measurement |
| GET | `/api/speedtest/download?size=N` | Stream random bytes (size in MB) |
| POST | `/api/speedtest/upload` | Upload speed test |
| GET | `/api/speedtest/disk` | Disk read/write speed test |

### Snippets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/snippets` | List all code snippets |
| POST | `/api/snippets` | Create snippet |
| PUT | `/api/snippets` | Update snippet |
| DELETE | `/api/snippets` | Delete snippet |

### System Monitor

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sysmon/snapshot` | Single JSON snapshot (CPU, memory, disk, network) |
| GET | `/api/sysmon/stream` | SSE stream (2s interval real-time metrics) |

### Proxy & HTTP Client

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proxy?url=X` | Proxy fetch remote URL (avoids CORS) |
| POST | `/api/httpclient` | Proxy HTTP request (all methods, headers, body) |

### Log JSON Format

```json
{
  "app": "MyApp",
  "level": "info",
  "message": "Order processed successfully"
}
```

- `app` — Application name (becomes the log filename)
- `level` — `debug` / `info` / `warn` / `error` (default: `info`)
- `message` — Log message text

## Log Integration Examples

### C# (.NET)

```csharp
public static class DevLog
{
    private static readonly HttpClient _http = new();
    private const string Url = "http://localhost:9090/api/logs";
    private const string App = "MyDotNetApp";

    public static void Info(string msg) => Send("info", msg);
    public static void Warn(string msg) => Send("warn", msg);
    public static void Error(string msg) => Send("error", msg);
    public static void Debug(string msg) => Send("debug", msg);

    private static async void Send(string level, string msg)
    {
        try
        {
            var json = $"{{\"app\":\"{App}\",\"level\":\"{level}\",\"message\":\"{msg.Replace("\"", "\\\"")}\"}}";
            await _http.PostAsync(Url, new StringContent(json, Encoding.UTF8, "application/json"));
        }
        catch { /* silently ignore */ }
    }
}

// Usage:
DevLog.Info("PR9628 - Load Data success");
DevLog.Error("Failed to connect to database");
```

### Java

```java
HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("http://localhost:9090/api/logs"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(
        "{\"app\":\"MyJavaApp\",\"level\":\"info\",\"message\":\"Order processed\"}"))
    .build();
client.sendAsync(request, HttpResponse.BodyHandlers.ofString());
```

### Python

```python
import requests

class DevLog:
    URL = "http://localhost:9090/api/logs"

    def __init__(self, app):
        self.app = app

    def info(self, msg):  self._send("info", msg)
    def warn(self, msg):  self._send("warn", msg)
    def error(self, msg): self._send("error", msg)
    def debug(self, msg): self._send("debug", msg)

    def _send(self, level, msg):
        try:
            requests.post(self.URL, json={"app": self.app, "level": level, "message": msg}, timeout=1)
        except:
            pass

# Usage:
log = DevLog("MyPythonScript")
log.info("Data pipeline completed")
log.error("File not found: data.csv")
```

### JavaScript / TypeScript

```typescript
const DEV_LOG_URL = "http://localhost:9090/api/logs";
const APP_NAME = "MyReactApp";

export const devlog = {
  info: (msg: string) => send("info", msg),
  warn: (msg: string) => send("warn", msg),
  error: (msg: string) => send("error", msg),
  debug: (msg: string) => send("debug", msg),
};

function send(level: string, message: string) {
  fetch(DEV_LOG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app: APP_NAME, level, message }),
  }).catch(() => {});
}

// Usage:
devlog.info("User logged in");
devlog.error("API call failed: /users/123");
```

### cURL

```bash
# POST with JSON
curl -X POST http://localhost:9090/api/logs \
  -H "Content-Type: application/json" \
  -d '{"app":"TestApp","level":"info","message":"hello world"}'

# Quick log via GET
curl "http://localhost:9090/api/logs/send?app=TestApp&level=warn&msg=something+broke"
```

## Adding New Tools

1. **Route + handler** in `main.go`:
```go
mux.HandleFunc("/yourpage", handleYourPage)

func handleYourPage(w http.ResponseWriter, r *http.Request) {
    data := newPageData("yourpage")
    loadPage("yourpage.html").ExecuteTemplate(w, "layout.html", data)
}
```

2. **Navbar item** in `templates/layout.html` (`#pinnedNav`):
```html
<li class="nav-item d-none" data-tool="yourtool">
    <a class="nav-link {{if eq .ActivePage "yourpage"}}active{{end}}" href="/yourpage">
        <i class="bi bi-icon-name"></i> Tool Name
    </a>
</li>
```

3. **Template** `templates/yourpage.html` with `{{define "content"}}` and `{{define "scripts"}}` blocks.

4. **JS file** `static/yourpage.js` for frontend logic.

5. **Dashboard entry** in `static/dashboard.js` — add to `tools` array.

6. **If using Monaco**: follow the worker URL pattern in `CLAUDE.md`.

## Requirements

- Go 1.21+ (tested with Go 1.25)

## License

Made by [Fariz](https://github.com/farizfadian) & [Claude](https://claude.ai)
