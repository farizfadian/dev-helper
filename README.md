# Dev Helper

**Offline-first developer toolkit — single Go binary, zero dependencies.**

Essential daily dev tools (JSON formatter, code editor, diff viewer, JWT decoder, log aggregator, etc.) bundled in one portable binary. No internet required, no runtime to install. Build once, run on Windows / Linux / Mac.

## Quick Start

```bash
# Development (hot-reload templates)
go run main.go

# Production build
go build -o dev-helper.exe .
./dev-helper.exe
```

Open **http://localhost:9090**

### Cross-platform Build

```bash
GOOS=windows GOARCH=amd64 go build -o dev-helper.exe .
GOOS=linux   GOARCH=amd64 go build -o dev-helper .
GOOS=darwin  GOARCH=amd64 go build -o dev-helper .    # Mac Intel
GOOS=darwin  GOARCH=arm64 go build -o dev-helper .    # Mac Apple Silicon
```

## Tools

| Tool | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | Homepage with search, pinned tools, tool cards |
| **Upload** | `/upload` | Drag/drop, Ctrl+V paste, file upload with instant URL & path copy |
| **File Explorer** | `/explorer` | Google Drive-like grid view, search, delete, file preview |
| **Prettify** | `/prettify` | Format JSON, XML, HTML, CSS, JS, TS, SQL, YAML, SCSS, LESS (Monaco editors) |
| **Log Aggregator** | `/logs` | Receive logs via HTTP POST, filter by app/level/search, auto-refresh |
| **Log Viewer** | `/logviewer` | Upload & search large log files with regex, context lines |
| **Code Editor** | `/editor` | Monaco-powered editor, 40+ languages, file upload, URL fetch |
| **Markdown** | `/markdown` | Monaco editor + live preview, syntax-highlighted code blocks |
| **Code Diff** | `/diff` | Monaco diff editor, side-by-side/inline toggle, file upload |
| **JWT Tool** | `/jwt` | Encode, decode, verify JWTs (HS256/384/512), color-coded display |

### Global Features

- **Theme** — Light / Dark / Auto (system), persisted in localStorage
- **Pin system** — Star any tool to pin it to the navbar, drag-scrollable when many pinned
- **Ask AI** — Dropdown with 9 cloud AIs + Ollama (local), opens in new tab
- **Copy buttons** — Every URL and file path is one-click copyable

## Tech Stack

- **Backend**: Go standard library (`net/http`, `html/template`)
- **Frontend**: Bootstrap 5.3.3 + Bootstrap Icons + Vanilla JS
- **Editor**: Monaco Editor v0.52.2 (self-hosted AMD build)
- **No frameworks, no build step** — just Go templates + static JS

## Project Structure

```
dev-helper/
├── main.go                 # All routes & API handlers (single file)
├── go.mod
├── templates/
│   ├── layout.html         # Shared layout: navbar, theme, Ask AI, footer
│   ├── dashboard.html      # Homepage with tool cards
│   ├── upload.html         # Upload page
│   ├── files.html          # File explorer
│   ├── prettify.html       # Code beautifier
│   ├── logs.html           # Log aggregator
│   ├── logviewer.html      # Log file viewer
│   ├── editor.html         # Code editor
│   ├── markdown.html       # Markdown viewer
│   ├── diff.html           # Code diff
│   └── jwt.html            # JWT encoder/decoder
├── static/
│   ├── dashboard.js        # Tool registry & dashboard logic
│   ├── app.js              # Upload page logic
│   ├── files.js            # File explorer logic
│   ├── prettify.js         # Code beautifier logic
│   ├── logs.js             # Log aggregator logic
│   ├── logviewer.js        # Log viewer logic
│   ├── editor.js           # Code editor logic
│   ├── markdown.js         # Markdown viewer logic
│   ├── diff.js             # Code diff logic
│   ├── jwt.js              # JWT tool logic
│   ├── monaco-editor/      # Monaco Editor v0.52.2 (self-hosted)
│   └── icons/              # Local AI favicons
├── files/                  # Uploaded files (runtime)
└── logs/                   # Log files, JSON-lines (runtime)
```

## API Reference

### Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload file (multipart form) |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
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

### Log Viewer

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/logviewer` | Upload log file with keyword search/filter |

### Proxy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proxy?url=X` | Proxy fetch remote URL (avoids CORS) |

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
    data := PageData{ActivePage: "yourpage"}
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
