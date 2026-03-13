# Dev Helper

**Offline-first developer toolkit — single Go binary, zero dependencies.**

Essential daily dev tools bundled in one portable binary. No internet required, no runtime to install. Build once, run on Windows / Linux / Mac.

---

## Quick Start

### Option 1: Docker (Recommended — easiest)

Includes Dev Helper + Ollama AI. No Go, no Ollama installation needed.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.

```bash
# 1. Clone the repo
git clone https://github.com/farizfadian/dev-helper.git
cd dev-helper

# 2. Start everything (Dev Helper + Ollama)
docker compose up

# 3. Open browser
#    http://localhost:9090

# 4. (First time only) Download an AI model for Ollama
docker compose exec ollama ollama pull llama3.2
```

That's it! Dev Helper is running at **http://localhost:9090** with AI features ready.

```bash
# Stop
docker compose down

# Start in background (detached)
docker compose up -d

# View logs
docker compose logs -f dev-helper

# Update to latest version
git pull
docker compose up --build
```

**Notes:**
- AI features (Polish Prompt, AI Chat, Translator): Ollama URL is `http://ollama:11434`
- Your data (files, notes, prompts, snippets) is persisted in Docker volumes
- For NVIDIA GPU support, uncomment the `deploy` section in `docker-compose.yml`

### Option 2: Download Binary (No build required)

Download the latest release from [GitHub Releases](https://github.com/farizfadian/dev-helper/releases).

| Platform | File |
|----------|------|
| Windows | `dev-helper-windows-amd64.exe` |
| Linux | `dev-helper-linux-amd64` |
| Linux ARM64 | `dev-helper-linux-arm64` |
| macOS Intel | `dev-helper-macos-amd64` |
| macOS Apple Silicon | `dev-helper-macos-arm64` |

```bash
# Run it
./dev-helper

# Custom port
./dev-helper --port 8080

# Check version
./dev-helper --version
```

Open **http://localhost:9090**

### Option 3: Build from Source

```bash
# Development (hot-reload templates)
go run main.go

# Production build
go build -o dev-helper .
./dev-helper
```

Open **http://localhost:9090**

---

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `9090` | Server port |
| `--debug` | `false` | Enable verbose HTTP request/response logging |
| `--version` | | Show version and exit |

### Examples

```bash
./dev-helper                         # Default: port 9090
./dev-helper --port 8080             # Custom port
./dev-helper --debug                 # Enable debug logging
./dev-helper --debug --port 3000     # Combine flags
./dev-helper --version               # Show version
```

---

## Tools (70 pages)

### Code & Text Tools

| Tool | Route | Description |
|------|-------|-------------|
| **Code Editor** | `/editor` | Monaco-powered editor, 40+ languages, file upload, fetch from URL |
| **Prettify** | `/prettify` | Format JSON, XML, HTML, CSS, JS, TS, SQL, YAML, SCSS, LESS |
| **Code Diff** | `/diff` | Monaco diff editor, side-by-side/inline toggle, file upload |
| **Text Diff** | `/textdiff` | Word-level plain text comparison, highlight additions/deletions |
| **Markdown** | `/markdown` | Monaco editor + live preview with syntax-highlighted code blocks |
| **HTML Editor** | `/htmleditor` | TinyMCE WYSIWYG + Monaco source view, import/export HTML |
| **Mermaid Diagram** | `/mermaid` | Live preview, 12 chart types, SVG/PNG download, share via URL |
| **Regex Tester** | `/regex` | Real-time highlighting, capture groups, replace mode, 18 patterns |
| **Notes** | `/notes` | Markdown notes with categories, tags, color labels, attachments, trash/restore |
| **String Utilities** | `/stringutils` | 29 string operations: case conversion, cleanup, encode/decode, extract |
| **Code Snippets** | `/snippets` | Save/organize code snippets, Monaco editor, fuzzy search, categories, tags |
| **Lorem Ipsum** | `/lorem` | Placeholder text generator (classic/hipster/tech), paragraphs/sentences/words |
| **ASCII Art** | `/asciiart` | Convert text to ASCII art with multiple FIGlet-style fonts |
| **MD Table Generator** | `/mdtable` | Visual table editor, alignment controls, export Markdown/HTML/CSV/ASCII |

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
| **Encoding Detector** | `/encoding` | Detect text/file encoding (UTF-8, ASCII, Shift_JIS, etc.), hex inspector |

### Data & Schema Tools

| Tool | Route | Description |
|------|-------|-------------|
| **CSV Viewer** | `/csv` | Spreadsheet-like CSV/TSV viewer/editor, sort, filter, search, export CSV/JSON/SQL |
| **JSON Schema** | `/jsonschema` | Validate JSON against JSON Schema (Ajv), auto-generate schema, 5 samples |
| **JSONPath** | `/jsonpath` | Query JSON with JSONPath expressions, live results, cheat sheet |
| **Scaffold Generator** | `/scaffold` | Define schema → generate SQL DDL + CRUD code for 10 frameworks |
| **Env File Editor** | `/envfile` | View/edit .env files, compare .env vs .env.example, export JSON/YAML/Docker |
| **SQL Playground** | `/sqlplay` | In-browser SQL editor with SQLite WASM, import CSV as tables |

### Generator Tools

| Tool | Route | Description |
|------|-------|-------------|
| **UUID Generator** | `/uuid` | v1/v4/v7, bulk generate (up to 1000), validate & parse, history |
| **Password Generator** | `/password` | Secure random passwords (Web Crypto), passphrases, strength meter |
| **QR Code** | `/qrcode` | Text/URL/WiFi/vCard, PNG/SVG download, custom colors |
| **Color Picker** | `/colorpicker` | HEX/RGB/HSL converter, WCAG contrast checker, palette, EyeDropper API |
| **Color Palette** | `/palette` | Generate harmonious palettes (complementary, triadic, etc.), extract from image |
| **Placeholder Image** | `/placeholder` | Generate placeholder images with custom size/text/color, PNG/SVG download |
| **Favicon Generator** | `/favicogen` | Upload image → generate full favicon set (ICO, Apple, Android), download ZIP |
| **Chmod Calculator** | `/chmod` | Unix permission calculator, rwx checkboxes ↔ octal ↔ symbolic, ls -l output |

### Image Tools

| Tool | Route | Description |
|------|-------|-------------|
| **Image Base64** | `/imagebase64` | Bidirectional image ↔ Base64 converter, CSS/HTML/Markdown snippets |
| **Image Editor** | `/imageeditor` | Mini Photoshop: crop, resize, rotate, 144 filters, draw, text, shapes, export |
| **Image Converter** | `/imageconvert` | Batch convert PNG/JPG/WebP/BMP/GIF, resize, quality, ZIP download |

### Time & Reference

| Tool | Route | Description |
|------|-------|-------------|
| **Epoch Converter** | `/epoch` | Unix timestamp ↔ date, live clock, presets, time diff calculator |
| **Timestamp Converter** | `/timestamp` | Multi-format date/time converter (ISO 8601, RFC 2822, relative time) |
| **Cron Parser** | `/cron` | Parse/generate cron expressions, human-readable, next 10 runs |
| **World Clock** | `/worldclock` | Multiple timezone display with live update |
| **Emoji & CharMap** | `/charmap` | Search/copy emojis & symbols, unicode details, HTML entities |
| **Keycode Viewer** | `/keycode` | Press any key → see keyCode, key, code, which, location |
| **Font Preview** | `/fontpreview` | Preview text in system/web fonts, compare sizes and weights |
| **Git Cheat Sheet** | `/githelp` | Interactive Git command reference, click to copy commands |

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
| **API Mock Server** | `/apimock` | Define mock REST endpoints, custom status/headers/body/delay, real-time request log |
| **IP Subnet Calculator** | `/subnet` | CIDR calculator, subnet mask, IP range, wildcard mask, bit visualization |
| **Network Scanner** | `/netscan` | Port scanner with interface detection |
| **Network Inspector** | `/netinspect` | IP lookup, DNS lookup, HTTP headers, SSL cert info |
| **Speed Test** | `/speedtest` | Network latency, download/upload speed, disk speed test |

### AI & Productivity

| Tool | Route | Description |
|------|-------|-------------|
| **Prompt Notebook** | `/prompts` | Write, organize, and polish AI prompts. Meta-prompting via Ollama. Sequential prompt lists. |
| **AI Chat** | `/aichat` | Chat with local Ollama models directly from Dev Helper |
| **Translator** | `/translator` | Ollama-powered translation (21 languages, auto-detect, TTS, history) |
| **Chat Room** | `/chat` | Real-time chat room (SSE-based, multi-user) |
| **Kanban Board** | `/kanban` | Simple task board with drag-drop columns (To Do / In Progress / Done) |
| **Pomodoro Timer** | `/pomodoro` | Focus timer with breaks, session counter, and streak tracking |
| **Bookmarks** | `/bookmarks` | Save and organize dev links with tags and categories |

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

---

## Scaffold Generator

The Scaffold Generator (`/scaffold`) lets you define a database schema visually and generates CRUD code for **10 frameworks**:

| Generator | Output |
|-----------|--------|
| SQL DDL | CREATE TABLE (PostgreSQL / MySQL / SQLite) |
| Java Spring | Entity, Repository, Service, Controller, DTO |
| C# .NET | Entity, Controller |
| Python FastAPI | Model (SQLAlchemy), Schema (Pydantic), Router |
| Go | Struct, Handler (Fiber) |
| Node.js | Prisma Model, Controller (Express) |
| TypeScript | Interface + Create DTO |
| Angular | Model, Service, Component (standalone, signals) |
| React | Types, Custom Hook (CRUD), Component (Tailwind) |
| Next.js | Types, API Route, Page Component |

**Import from existing:** paste `CREATE TABLE` SQL or a JSON object to auto-populate the schema grid.

---

## Prompt Notebook

The Prompt Notebook (`/prompts`) is designed for developers who prepare AI prompts ahead of time:

- **Sequential prompt lists** — numbered prompts, drag-reorder, organize by folders
- **Copy All** — copy entire prompt sequence to clipboard, ready to paste into Claude CLI
- **Polish via Ollama** — one-click meta-prompting to improve prompt clarity and effectiveness
- **Re-polish** — iteratively refine polished results
- **Saved to disk** — prompts stored in `prompts/prompts.json`, survives browser cache clear
- **Export/Import** — backup and share prompt notebooks as JSON files

---

## Docker

### docker compose up (Dev Helper + Ollama)

```bash
git clone https://github.com/farizfadian/dev-helper.git
cd dev-helper
docker compose up
```

This starts:
- **Dev Helper** on `http://localhost:9090`
- **Ollama** on `http://localhost:11434`

First time, pull an AI model:
```bash
docker compose exec ollama ollama pull llama3.2
```

Recommended models:
| Model | Size | Best for |
|-------|------|----------|
| `llama3.2` | 2 GB | General purpose, fast |
| `llama3.2:1b` | 1.3 GB | Lightweight, very fast |
| `codellama` | 3.8 GB | Code-focused tasks |
| `mistral` | 4 GB | Good balance of speed and quality |

### Ollama URL Configuration

When running via Docker, use these Ollama URLs in Dev Helper settings:

| Context | Ollama URL |
|---------|-----------|
| Inside Docker (default) | `http://ollama:11434` |
| From host browser directly | `http://localhost:11434` |

### Data Persistence

Docker volumes automatically persist all your data:

| Volume | Content |
|--------|---------|
| `dev-helper-files` | Uploaded files |
| `dev-helper-logs` | Log aggregator data |
| `dev-helper-notes` | Notes & attachments |
| `dev-helper-snippets` | Code snippets |
| `dev-helper-prompts` | Prompt notebook data |
| `ollama-data` | Downloaded AI models |

### GPU Support (NVIDIA)

For faster AI responses, enable GPU passthrough in `docker-compose.yml`:

```yaml
ollama:
  image: ollama/ollama:latest
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

Requires [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html).

---

## Debug Mode (`--debug`)

Prints comprehensive HTTP request/response logs to the terminal.

```bash
./dev-helper --debug
```

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
- Body truncated at 2KB

What gets skipped:
- Static files (`/static/`, `/files/`, `/notes-att/`)
- HTML page responses

---

## Cross-platform Build

```bash
GOOS=windows GOARCH=amd64 go build -o dev-helper.exe .
GOOS=linux   GOARCH=amd64 go build -o dev-helper .
GOOS=linux   GOARCH=arm64 go build -o dev-helper .
GOOS=darwin  GOARCH=amd64 go build -o dev-helper .     # Mac Intel
GOOS=darwin  GOARCH=arm64 go build -o dev-helper .     # Mac Apple Silicon
```

---

## Tech Stack

- **Backend**: Go standard library (`net/http`, `html/template`) + gopsutil v4 (system metrics)
- **Frontend**: Bootstrap 5.3.3 + Bootstrap Icons + Vanilla JavaScript
- **Editor**: Monaco Editor v0.52.2 (self-hosted AMD build)
- **No frameworks, no build step** — just Go templates + static JS files

---

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

### Snippets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/snippets` | List all code snippets |
| POST | `/api/snippets` | Create snippet |
| PUT | `/api/snippets` | Update snippet |
| DELETE | `/api/snippets` | Delete snippet |

### Prompts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prompts` | Get all prompts data |
| POST | `/api/prompts` | Save all prompts data |

### API Mock Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/apimock/endpoints` | Save mock endpoint definitions |
| GET | `/api/apimock/log` | SSE stream of incoming mock requests |
| ANY | `/mock/{path}` | Mock endpoint (responds based on definitions) |

### AI Chat (Ollama)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/aichat/models?url=X` | List Ollama models |
| GET | `/api/aichat/version?url=X` | Get Ollama version |
| POST | `/api/aichat/chat` | SSE chat stream with Ollama model |

### Chat Room

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/send` | Send chat message |
| GET | `/api/chat/stream?username=X` | SSE stream for real-time messages |
| GET | `/api/chat/online` | List online users |

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

---

## Log Integration Examples

### cURL

```bash
# POST with JSON
curl -X POST http://localhost:9090/api/logs \
  -H "Content-Type: application/json" \
  -d '{"app":"TestApp","level":"info","message":"hello world"}'

# Quick log via GET
curl "http://localhost:9090/api/logs/send?app=TestApp&level=warn&msg=something+broke"
```

### JavaScript / TypeScript

```typescript
const DEV_LOG_URL = "http://localhost:9090/api/logs";

export const devlog = {
  info: (msg: string) => send("info", msg),
  warn: (msg: string) => send("warn", msg),
  error: (msg: string) => send("error", msg),
};

function send(level: string, message: string) {
  fetch(DEV_LOG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app: "MyApp", level, message }),
  }).catch(() => {});
}
```

### Python

```python
import requests

def devlog(level, msg, app="MyApp"):
    requests.post("http://localhost:9090/api/logs",
        json={"app": app, "level": level, "message": msg}, timeout=1)
```

### C# (.NET)

```csharp
await httpClient.PostAsJsonAsync("http://localhost:9090/api/logs",
    new { app = "MyApp", level = "info", message = "hello" });
```

### Java

```java
HttpClient.newHttpClient().sendAsync(
    HttpRequest.newBuilder()
        .uri(URI.create("http://localhost:9090/api/logs"))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(
            "{\"app\":\"MyApp\",\"level\":\"info\",\"message\":\"hello\"}"))
        .build(),
    HttpResponse.BodyHandlers.ofString());
```

---

## Adding New Tools

1. **Route + handler** in `main.go`
2. **Navbar item** in `templates/layout.html` (`#pinnedNav`)
3. **Template** `templates/yourpage.html`
4. **JS file** `static/yourpage.js`
5. **Dashboard entry** in `static/dashboard.js`

See `CLAUDE.md` for full architecture documentation.

---

## Requirements

- **Binary**: No requirements — just download and run
- **Docker**: Docker Desktop
- **Build from source**: Go 1.21+

---

## License

Made by [Fariz](https://github.com/farizfadian) & [Claude](https://claude.ai)
