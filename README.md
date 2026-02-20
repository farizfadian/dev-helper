# Dev Helper

**A lightweight, offline-first developer toolkit built with Go.**

Born from the frustration of developers whose daily tools are scattered across online services. When the internet goes down — especially in regions where connectivity isn't always reliable — simple tasks like formatting JSON or viewing logs become impossible.

Dev Helper solves this by providing essential developer tools in a single, portable Go binary. Build it once, run it anywhere — Windows, Linux, Mac — no extra dependencies needed.

## Philosophy

> *"I built this because I felt what other developers feel — the frustration of not having the right tools when you need them most. If it helps me, it will help others too."*

- **Offline-first** — Works without internet (except first CDN cache load)
- **Zero dependencies** — Single Go binary, no runtime to install
- **Cross-platform** — Build once, run on Windows, Linux, Mac
- **Extensible** — Easy to add new tools via navbar menu pattern
- **Developer-friendly** — Built by a developer, for developers

## Features

### Upload
Upload files and screenshots with instant URL & path copying. Built as a companion for Claude Console (CLI) which doesn't support direct image attachments.

- **Drag & Drop** — Drop any file onto the upload zone
- **Ctrl+V Paste** — Paste screenshots directly from clipboard
- **Click to Browse** — Traditional file picker
- **Auto Upload** — Files upload immediately, no submit button needed
- **Image Preview** — Thumbnail with lightbox for images
- **File Type Icons** — Visual icons for PDF, Word, Excel, code files, etc.
- **Browser Preview** — Click to open PDF, HTML, TXT, MD, and other browser-renderable files in new tab
- **Copy to Clipboard** — One-click copy for both File URL and File Path

### Files (Explorer)
A Google Drive-like file explorer for all uploaded files.

- **Grid View** — Card layout with thumbnails and file type icons
- **Search** — Real-time filename search
- **Upload** — Drag/drop, Ctrl+V, click browse (same as Upload page)
- **File Details** — Click info button for URL, path, size, date + copy buttons
- **Delete** — Delete individual files or all files at once
- **Browser Preview** — Click to open renderable files in new tab

### Prettify (Code Beautifier)
Offline code formatter — no internet needed, everything runs in the browser.

- **6 Formats** — JSON, XML, HTML, CSS, JavaScript, SQL
- **Side-by-side** — Input left, output right for easy comparison
- **Prettify & Minify** — Format or compress code
- **Indent Options** — 2 spaces, 4 spaces, or tab
- **Auto-detect** — Paste code and format is detected automatically
- **Keyboard Shortcut** — Ctrl+Enter to prettify
- **Copy & Swap** — Copy output or move output back to input

### Logs (Lightweight Log Aggregator)
A mini NewRelic for local development. Send logs from any application via HTTP, view and filter them in the web UI.

- **Multi-platform** — Send logs from C#, Java, Python, Angular, React, Next.js, or any HTTP-capable language
- **Per-app log files** — Each app gets its own `.log` file
- **Filter by level** — ALL / DEBUG / INFO / WARN / ERROR
- **Search** — Real-time text search across log messages
- **Auto-refresh** — Live tail mode with 2-second polling
- **URL persistence** — Selected app saved in URL, survives refresh
- **Copy log file path** — One-click copy to paste into Claude Console

## Requirements

- Go 1.21+ (tested with Go 1.25)

## Quick Start

### Run directly (development)

```bash
cd dev-helper
go run main.go
```

### Build & Run (production)

```bash
cd dev-helper
go build -o dev-helper.exe .
./dev-helper.exe
```

### Cross-platform build

```bash
# Windows
GOOS=windows GOARCH=amd64 go build -o dev-helper.exe .

# Linux
GOOS=linux GOARCH=amd64 go build -o dev-helper .

# Mac (Intel)
GOOS=darwin GOARCH=amd64 go build -o dev-helper .

# Mac (Apple Silicon)
GOOS=darwin GOARCH=arm64 go build -o dev-helper .
```

Server starts at **http://localhost:9090**

## Project Structure

```
dev-helper/
├── main.go                # Go server, routes, all handlers
├── go.mod                 # Go module definition
├── README.md              # This file
├── templates/
│   ├── layout.html        # Base layout (navbar, Bootstrap 5, footer)
│   ├── upload.html        # Upload page (drop zone, preview, lightbox)
│   ├── files.html         # File explorer page (grid, search, delete)
│   ├── prettify.html      # Code beautifier page (side-by-side)
│   └── logs.html          # Log viewer page (filters, table)
├── static/
│   ├── app.js             # Upload page logic
│   ├── files.js           # File explorer logic
│   ├── prettify.js        # Code beautifier logic
│   └── logs.js            # Log viewer logic
├── files/                 # Uploaded files
└── logs/                  # Log files (one per app)
```

## API Reference

### Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload a file (multipart form) |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files` | List all uploaded files (JSON) |
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

### Log JSON Body

```json
{
  "app": "MyApp",
  "level": "info",
  "message": "PR9628 - Load Data success"
}
```

**Fields:**
- `app` — Application name (required, becomes the log filename)
- `level` — `debug`, `info`, `warn`, `error` (default: `info`)
- `message` — Log message text

### Quick Log via URL (Browser / cURL)

```
http://localhost:9090/api/logs/send?app=MyApp&level=warn&msg=connection+timeout
```

---

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

### JavaScript / TypeScript (Angular, React, Next.js)

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
import { devlog } from "./devlog";
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

---

## Adding New Tools

To add a new page/tool:

1. **Add route** in `main.go`:
```go
mux.HandleFunc("/yourpage", handleYourPage)

func handleYourPage(w http.ResponseWriter, r *http.Request) {
    data := PageData{ActivePage: "yourpage"}
    loadPage("yourpage.html").ExecuteTemplate(w, "layout.html", data)
}
```

2. **Add navbar item** in `templates/layout.html`:
```html
<li class="nav-item">
    <a class="nav-link {{if eq .ActivePage "yourpage"}}active{{end}}" href="/yourpage">
        <i class="bi bi-icon-name"></i> Page Name
    </a>
</li>
```

3. **Create template** `templates/yourpage.html` with `{{define "content"}}` and `{{define "scripts"}}` blocks.

4. **Create JS** `static/yourpage.js` for page-specific logic.

---

## Usage with Claude Console

1. Start the server: `go run main.go`
2. Open http://localhost:9090 in your browser
3. Upload a screenshot (drag, paste, or browse)
4. Copy the **File Path** from the result
5. Paste the path into Claude Console — Claude can read the file directly

---

Made with Love by Fariz & Claude
