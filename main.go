package main

import (
	"bufio"
	"bytes"
	"context"
	crand "crypto/rand"
	"crypto/tls"
	"embed"
	"encoding/binary"
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"math"
	"mime"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	gopshost "github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	gopsnet "github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"
)

//go:embed all:templates
var templatesFS embed.FS

//go:embed all:static
var staticFS embed.FS

var (
	version   = "dev"
	baseDir   string
	filesDir  string
	logsDir   string
	notesDir    string
	notesMu     sync.Mutex
	snippetsDir string
	snippetsMu  sync.Mutex
	promptsDir  string
	promptsMu   sync.Mutex
	devMode   bool
	debugMode bool

	// API Mock Server
	mockEndpoints []MockEndpoint
	mockMu        sync.RWMutex
	mockLogChs    []chan MockLogEntry
	mockLogMu     sync.Mutex
)

type PageData struct {
	ActivePage string
	PageTitle  string
}

var pageTitles = map[string]string{
	"home": "", "upload": "File Upload", "files": "File Explorer",
	"prettify": "Prettify", "logs": "Log Aggregator", "logviewer": "Log Viewer",
	"editor": "Code Editor", "markdown": "Markdown Viewer", "diff": "Code Diff",
	"jwt": "JWT Tool", "base64": "Base64", "urlencoder": "URL Encoder",
	"htmleditor": "HTML Editor", "mermaid": "Mermaid Diagram", "uuid": "UUID Generator",
	"notes": "Notes", "snippets": "Code Snippets", "regex": "Regex Tester", "charmap": "Emoji & CharMap",
	"epoch": "Epoch Converter", "hash": "Hash Generator", "colorpicker": "Color Picker",
	"cron": "Cron Parser", "password": "Password Generator", "qrcode": "QR Code",
	"lorem": "Lorem Ipsum", "baseconverter": "Base Converter", "json2yaml": "JSON ↔ YAML",
	"httpclient": "HTTP Client", "stringutils": "String Utilities",
	"aichat": "AI Chat", "chat": "Chat Room", "worldclock": "World Clock",
	"netscan": "Network Scanner", "netinspect": "Network Inspector",
	"speedtest": "Speed Test", "ocr": "OCR", "yaml2props": "YAML to Properties",
	"sysmon": "System Monitor",
	"icons": "Icon Explorer",
	"translator": "Translator",
	"imagebase64": "Image Base64",
	"imageeditor":  "Image Editor",
	"imageconvert": "Image Converter",
	"csv":          "CSV Viewer",
	"jsonschema":   "JSON Schema Validator",
	"jsonpath":     "JSONPath Playground",
	"subnet":       "IP Subnet Calculator",
	"envfile":      "Env File Editor",
	"mdtable":      "Markdown Table Generator",
	"chmod":        "Chmod Calculator",
	"apimock":      "API Mock Server",
	"placeholder":  "Placeholder Image",
	"asciiart":     "ASCII Art Generator",
	"favicogen":    "Favicon Generator",
	"encoding":     "Encoding Detector",
	"githelp":      "Git Cheat Sheet",
	"kanban":       "Kanban Board",
	"pomodoro":     "Pomodoro Timer",
	"bookmarks":    "Bookmark Manager",
	"sqlplay":      "SQL Playground",
	"timestamp":    "Timestamp Converter",
	"textdiff":     "Text Diff",
	"palette":      "Color Palette",
	"keycode":      "Keycode Viewer",
	"fontpreview":  "Font Preview",
	"prompts":      "Prompt Notebook",
	"scaffold":     "Scaffold Generator",
}

func newPageData(activePage string) PageData {
	title := pageTitles[activePage]
	return PageData{ActivePage: activePage, PageTitle: title}
}

type UploadResponse struct {
	URL      string `json:"url"`
	Path     string `json:"path"`
	Filename string `json:"filename"`
}

type LogEntry struct {
	Timestamp string `json:"timestamp"`
	App       string `json:"app"`
	Level     string `json:"level"`
	Message   string `json:"message"`
}

func main() {
	port := flag.Int("port", 9090, "server port")
	debug := flag.Bool("debug", false, "enable verbose HTTP request/response logging")
	showVersion := flag.Bool("version", false, "show version and exit")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, `Dev Helper %s — Offline-first developer toolkit

Usage:
  dev-helper [flags]

Flags:
  --port int       Server port (default 9090)
  --debug          Enable verbose HTTP request/response logging
  --version        Show version and exit
  --help           Show this help message

Examples:
  dev-helper                       Start on default port 9090
  dev-helper --port 8080           Start on custom port
  dev-helper --debug               Start with debug logging
  dev-helper --debug --port 3000   Combine flags

Documentation: https://github.com/farizfadian/dev-helper
`, version)
	}

	flag.Parse()

	if *showVersion {
		fmt.Printf("Dev Helper %s\n", version)
		os.Exit(0)
	}

	debugMode = *debug

	// Detect dev mode: templates/ exists in working directory → read from disk (hot reload)
	// Production mode: use embedded files from binary
	if _, err := os.Stat("templates"); err == nil {
		devMode = true
		baseDir, _ = os.Getwd()
	} else {
		exe, _ := os.Executable()
		baseDir = filepath.Dir(exe)
	}

	filesDir = filepath.Join(baseDir, "files")
	logsDir = filepath.Join(baseDir, "logs")
	notesDir = filepath.Join(baseDir, "notes")
	snippetsDir = filepath.Join(baseDir, "snippets")
	promptsDir = filepath.Join(baseDir, "prompts")
	os.MkdirAll(filesDir, 0755)
	os.MkdirAll(logsDir, 0755)
	os.MkdirAll(filepath.Join(notesDir, "attachments"), 0755)
	os.MkdirAll(snippetsDir, 0755)
	os.MkdirAll(promptsDir, 0755)
	initDefaultSnippets()

	mux := http.NewServeMux()
	mux.HandleFunc("/", handleIndex)
	mux.HandleFunc("/upload", handleUpload)
	mux.HandleFunc("/api/upload", handleAPIUpload)
	mux.HandleFunc("/explorer", handleFilesPage)
	mux.HandleFunc("/api/files", handleAPIFiles)
	mux.HandleFunc("/prettify", handlePrettifyPage)
	mux.HandleFunc("/logs", handleLogsPage)
	mux.HandleFunc("/api/logs", handleAPILogs)
	mux.HandleFunc("/api/logs/send", handleAPILogsSend)
	mux.HandleFunc("/api/logs/apps", handleAPILogsApps)
	mux.HandleFunc("/logviewer", handleLogViewerPage)
	mux.HandleFunc("/api/logviewer", handleAPILogViewer)
	mux.HandleFunc("/editor", handleEditorPage)
	mux.HandleFunc("/api/proxy", handleAPIProxy)
	mux.HandleFunc("/markdown", handleMarkdownPage)
	mux.HandleFunc("/diff", handleDiffPage)
	mux.HandleFunc("/jwt", handleJWTPage)
	mux.HandleFunc("/base64", handleBase64Page)
	mux.HandleFunc("/urlencoder", handleURLEncoderPage)
	mux.HandleFunc("/htmleditor", handleHTMLEditorPage)
	mux.HandleFunc("/mermaid", handleMermaidPage)
	mux.HandleFunc("/uuid", handleUUIDPage)
	mux.HandleFunc("/notes", handleNotesPage)
	mux.HandleFunc("/regex", handleRegexPage)
	mux.HandleFunc("/charmap", handleCharmapPage)
	mux.HandleFunc("/epoch", handleEpochPage)
	mux.HandleFunc("/hash", handleHashPage)
	mux.HandleFunc("/colorpicker", handleColorPickerPage)
	mux.HandleFunc("/cron", handleCronPage)
	mux.HandleFunc("/password", handlePasswordPage)
	mux.HandleFunc("/qrcode", handleQRCodePage)
	mux.HandleFunc("/lorem", handleLoremPage)
	mux.HandleFunc("/baseconverter", handleBaseConverterPage)
	mux.HandleFunc("/json2yaml", handleJSON2YAMLPage)
	mux.HandleFunc("/httpclient", handleHTTPClientPage)
	mux.HandleFunc("/api/httpclient", handleAPIHTTPClient)
	mux.HandleFunc("/stringutils", handleStringUtilsPage)
	mux.HandleFunc("/chat", handleChatPage)
	mux.HandleFunc("/api/chat/stream", handleAPIChatStream)
	mux.HandleFunc("/api/chat/send", handleAPIChatSend)
	mux.HandleFunc("/api/chat/online", handleAPIChatOnline)
	mux.HandleFunc("/netscan", handleNetScanPage)
	mux.HandleFunc("/worldclock", handleWorldClockPage)
	mux.HandleFunc("/ocr", handleOCRPage)
	mux.HandleFunc("/yaml2props", handleYAML2PropsPage)
	mux.HandleFunc("/netinspect", handleNetInspectPage)
	mux.HandleFunc("/api/netinspect/myip", handleAPINetInspectMyIP)
	mux.HandleFunc("/api/netinspect/iplookup", handleAPINetInspectIPLookup)
	mux.HandleFunc("/api/netinspect/dns", handleAPINetInspectDNS)
	mux.HandleFunc("/api/netinspect/headers", handleAPINetInspectHeaders)
	mux.HandleFunc("/api/netinspect/ssl", handleAPINetInspectSSL)
	mux.HandleFunc("/aichat", handleAIChatPage)
	mux.HandleFunc("/api/aichat/models", handleAPIAIChatModels)
	mux.HandleFunc("/api/aichat/version", handleAPIAIChatVersion)
	mux.HandleFunc("/api/aichat/chat", handleAPIAIChatStream)
	mux.HandleFunc("/api/netscan/interfaces", handleAPINetInterfaces)
	mux.HandleFunc("/api/netscan/scan", handleAPINetScan)
	mux.HandleFunc("/api/notes", handleAPINotes)
	mux.HandleFunc("/api/notes/restore", handleAPINotesRestore)
	mux.HandleFunc("/api/notes/reorder", handleAPINotesReorder)
	mux.HandleFunc("/api/notes/attachment", handleAPINotesAttachment)
	mux.HandleFunc("/snippets", handleSnippetsPage)
	mux.HandleFunc("/api/snippets", handleAPISnippets)
	mux.HandleFunc("/speedtest", handleSpeedTestPage)
	mux.HandleFunc("/api/speedtest/ping", handleAPISpeedTestPing)
	mux.HandleFunc("/api/speedtest/download", handleAPISpeedTestDownload)
	mux.HandleFunc("/api/speedtest/upload", handleAPISpeedTestUpload)
	mux.HandleFunc("/api/speedtest/disk", handleAPISpeedTestDisk)
	mux.HandleFunc("/sysmon", handleSysMonPage)
	mux.HandleFunc("/api/sysmon/snapshot", handleAPISysMonSnapshot)
	mux.HandleFunc("/api/sysmon/stream", handleAPISysMonStream)
	mux.HandleFunc("/icons", handleIconsPage)
	mux.HandleFunc("/translator", handleTranslatorPage)
	mux.HandleFunc("/imagebase64", handleImageBase64Page)
	mux.HandleFunc("/imageeditor", handleImageEditorPage)
	mux.HandleFunc("/imageconvert", handleImageConvertPage)
	mux.HandleFunc("/csv", handleCSVPage)
	mux.HandleFunc("/jsonschema", handleJSONSchemaPage)
	mux.HandleFunc("/jsonpath", handleJSONPathPage)
	mux.HandleFunc("/subnet", handleSubnetPage)
	mux.HandleFunc("/envfile", handleEnvFilePage)
	mux.HandleFunc("/mdtable", handleMDTablePage)
	mux.HandleFunc("/chmod", handleChmodPage)
	mux.HandleFunc("/apimock", handleAPIMockPage)
	mux.HandleFunc("/api/apimock/endpoints", handleAPIMockEndpoints)
	mux.HandleFunc("/api/apimock/log", handleAPIMockLog)
	mux.HandleFunc("/mock/", handleMockRequest)
	mux.HandleFunc("/placeholder", handlePlaceholderPage)
	mux.HandleFunc("/asciiart", handleASCIIArtPage)
	mux.HandleFunc("/favicogen", handleFavicoGenPage)
	mux.HandleFunc("/encoding", handleEncodingPage)
	mux.HandleFunc("/githelp", handleGitHelpPage)
	mux.HandleFunc("/kanban", handleKanbanPage)
	mux.HandleFunc("/pomodoro", handlePomodoroPage)
	mux.HandleFunc("/bookmarks", handleBookmarksPage)
	mux.HandleFunc("/sqlplay", handleSQLPlayPage)
	mux.HandleFunc("/timestamp", handleTimestampPage)
	mux.HandleFunc("/textdiff", handleTextDiffPage)
	mux.HandleFunc("/palette", handlePalettePage)
	mux.HandleFunc("/keycode", handleKeycodePage)
	mux.HandleFunc("/fontpreview", handleFontPreviewPage)
	mux.HandleFunc("/prompts", handlePromptsPage)
	mux.HandleFunc("/api/prompts", handleAPIPrompts)
	mux.HandleFunc("/scaffold", handleScaffoldPage)

	// Uploaded files — always served from disk
	mux.Handle("/files/", http.StripPrefix("/files/", http.FileServer(http.Dir(filesDir))))

	// Notes attachments
	mux.Handle("/notes-att/", http.StripPrefix("/notes-att/", http.FileServer(http.Dir(filepath.Join(notesDir, "attachments")))))

	// Static files — disk in dev mode, embedded in production
	if devMode {
		mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(filepath.Join(baseDir, "static")))))
	} else {
		staticSub, _ := fs.Sub(staticFS, "static")
		mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticSub))))
	}

	addr := fmt.Sprintf(":%d", *port)
	mode := "embedded"
	if devMode {
		mode = "dev (disk)"
	}
	fmt.Printf("Dev Helper %s (%s) running at http://localhost%s\n", version, mode, addr)

	var handler http.Handler = mux
	if debugMode {
		handler = debugMiddleware(mux)
		fmt.Println("[DEBUG] Verbose HTTP logging enabled — API requests will be logged")
	}

	if err := http.ListenAndServe(addr, handler); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}

// --- Debug middleware (ANSI colors) ---

const (
	cReset   = "\033[0m"
	cBold    = "\033[1m"
	cDim     = "\033[2m"
	cRed     = "\033[31m"
	cGreen   = "\033[32m"
	cYellow  = "\033[33m"
	cBlue    = "\033[34m"
	cMagenta = "\033[35m"
	cCyan    = "\033[36m"
	cWhite   = "\033[37m"
	cBGreen  = "\033[1;32m"
	cBYellow = "\033[1;33m"
	cBRed    = "\033[1;31m"
	cBCyan   = "\033[1;36m"
	cBBlue   = "\033[1;34m"
)

const debugBodyMaxCapture = 64 * 1024 // 64KB capture limit
const debugBodyMaxPrint = 4096        // 4KB print limit

type responseRecorder struct {
	http.ResponseWriter
	statusCode int
	body       bytes.Buffer
	wroteHead  bool
}

func (rec *responseRecorder) WriteHeader(code int) {
	if !rec.wroteHead {
		rec.statusCode = code
		rec.wroteHead = true
	}
	rec.ResponseWriter.WriteHeader(code)
}

func (rec *responseRecorder) Write(b []byte) (int, error) {
	if !rec.wroteHead {
		rec.statusCode = 200
		rec.wroteHead = true
	}
	if rec.body.Len() < debugBodyMaxCapture {
		remaining := debugBodyMaxCapture - rec.body.Len()
		if len(b) <= remaining {
			rec.body.Write(b)
		} else {
			rec.body.Write(b[:remaining])
		}
	}
	return rec.ResponseWriter.Write(b)
}

func (rec *responseRecorder) Flush() {
	if f, ok := rec.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func debugMethodColor(method string) string {
	switch method {
	case "GET":
		return cBGreen
	case "POST":
		return cBYellow
	case "PUT":
		return cBBlue
	case "DELETE":
		return cBRed
	default:
		return cBCyan
	}
}

func debugStatusColor(code int) string {
	switch {
	case code >= 200 && code < 300:
		return cBGreen
	case code >= 300 && code < 400:
		return cBCyan
	case code >= 400 && code < 500:
		return cBYellow
	default:
		return cBRed
	}
}

func debugMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path

		// Only log API paths — skip static assets, uploaded files, and page routes
		if !strings.HasPrefix(p, "/api/") {
			next.ServeHTTP(w, r)
			return
		}

		start := time.Now()

		// --- Capture request body ---
		var reqBodyStr string
		isMultipart := false
		ct := r.Header.Get("Content-Type")
		mediaType, params, _ := mime.ParseMediaType(ct)

		if mediaType == "multipart/form-data" {
			isMultipart = true
			boundary := params["boundary"]
			if boundary != "" {
				bodyBytes, _ := io.ReadAll(r.Body)
				r.Body.Close()
				r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

				var sb strings.Builder
				mr := multipart.NewReader(bytes.NewReader(bodyBytes), boundary)
				for {
					part, err := mr.NextPart()
					if err != nil {
						break
					}
					formName := part.FormName()
					fileName := part.FileName()
					if fileName != "" {
						partBytes, _ := io.ReadAll(part)
						sb.WriteString(fmt.Sprintf("  %s[file]%s %s: %q (%s)\n", cMagenta, cReset, formName, fileName, formatBytes(int64(len(partBytes)))))
					} else {
						val, _ := io.ReadAll(part)
						valStr := string(val)
						if len(valStr) > 200 {
							valStr = valStr[:200] + "..."
						}
						sb.WriteString(fmt.Sprintf("  %s[field]%s %s: %s\n", cCyan, cReset, formName, valStr))
					}
					part.Close()
				}
				reqBodyStr = sb.String()
			}
		} else if r.Body != nil && r.ContentLength != 0 {
			bodyBytes, _ := io.ReadAll(r.Body)
			r.Body.Close()
			r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

			if len(bodyBytes) > 0 {
				reqBodyStr = debugFormatBody(bodyBytes, ct, debugBodyMaxPrint)
			}
		}

		// --- Serve and capture response ---
		rec := &responseRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rec, r)

		duration := time.Since(start)

		resCT := rec.Header().Get("Content-Type")
		mc := debugMethodColor(r.Method)
		sc := debugStatusColor(rec.statusCode)

		// --- Print request ---
		fmt.Printf("%s━━ REQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n", cCyan, cReset)
		fmt.Printf("%s[%s]%s %s%s%s %s\n", cDim, time.Now().Format("2006-01-02 15:04:05"), cReset, mc, r.Method, cReset, r.URL.String())
		fmt.Printf("%sHeaders:%s\n", cDim, cReset)
		for k, v := range r.Header {
			if k == "Accept-Encoding" || k == "Connection" || k == "User-Agent" {
				continue
			}
			fmt.Printf("  %s%s%s: %s\n", cCyan, k, cReset, strings.Join(v, ", "))
		}
		if reqBodyStr != "" {
			if isMultipart {
				fmt.Printf("%sBody (multipart):%s\n", cDim, cReset)
				fmt.Print(reqBodyStr)
			} else {
				fmt.Printf("%sBody:%s\n", cDim, cReset)
				fmt.Println(reqBodyStr)
			}
		}

		// --- Print response ---
		fmt.Printf("%s━━ RES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n", cYellow, cReset)
		fmt.Printf("Status: %s%d %s%s %s(%.2fs)%s\n", sc, rec.statusCode, http.StatusText(rec.statusCode), cReset, cDim, duration.Seconds(), cReset)
		fmt.Printf("%sHeaders:%s\n", cDim, cReset)
		for k, v := range rec.Header() {
			fmt.Printf("  %s%s%s: %s\n", cYellow, k, cReset, strings.Join(v, ", "))
		}

		isSSE := strings.Contains(resCT, "text/event-stream")
		if isSSE {
			fmt.Printf("%sBody:%s %s[streaming — not captured]%s\n", cDim, cReset, cDim, cReset)
		} else if rec.body.Len() > 0 {
			fmt.Printf("%sBody:%s\n", cDim, cReset)
			resBytes := rec.body.Bytes()
			fmt.Println(debugFormatBody(resBytes, resCT, debugBodyMaxPrint))
		}
		fmt.Printf("%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n\n", cDim, cReset)
	})
}

func debugFormatBody(data []byte, contentType string, maxLen int) string {
	// Try JSON pretty-print
	if strings.Contains(contentType, "json") || (len(data) > 0 && (data[0] == '{' || data[0] == '[')) {
		var buf bytes.Buffer
		if json.Indent(&buf, data, "", "  ") == nil {
			s := buf.String()
			if len(s) > maxLen {
				return cGreen + s[:maxLen] + cReset + fmt.Sprintf("\n%s[truncated, total: %s]%s", cDim, formatBytes(int64(len(s))), cReset)
			}
			return cGreen + s + cReset
		}
	}

	s := string(data)
	if len(s) > maxLen {
		return s[:maxLen] + fmt.Sprintf("\n%s[truncated, total: %s]%s", cDim, formatBytes(int64(len(data))), cReset)
	}
	return s
}

func formatBytes(b int64) string {
	switch {
	case b >= 1<<20:
		return fmt.Sprintf("%.1fMB", float64(b)/float64(1<<20))
	case b >= 1<<10:
		return fmt.Sprintf("%.1fKB", float64(b)/float64(1<<10))
	default:
		return fmt.Sprintf("%dB", b)
	}
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	data := newPageData("home")
	loadPage("dashboard.html").ExecuteTemplate(w, "layout.html", data)
}

func loadPage(page string) *template.Template {
	if devMode {
		return template.Must(template.ParseFiles(
			filepath.Join(baseDir, "templates", "layout.html"),
			filepath.Join(baseDir, "templates", page),
		))
	}
	return template.Must(template.ParseFS(templatesFS, "templates/layout.html", "templates/"+page))
}

func handleUpload(w http.ResponseWriter, r *http.Request) {
	data := newPageData("upload")
	loadPage("upload.html").ExecuteTemplate(w, "layout.html", data)
}

func handleAPIUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.ParseMultipartForm(100 << 20) // 100 MB max

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Generate unique filename with timestamp
	ext := filepath.Ext(header.Filename)
	name := strings.TrimSuffix(header.Filename, ext)
	timestamp := time.Now().Format("20060102-150405")
	filename := fmt.Sprintf("%s-%s%s", timestamp, name, ext)

	destPath := filepath.Join(filesDir, filename)
	dst, err := os.Create(destPath)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to write file", http.StatusInternalServerError)
		return
	}

	absPath, _ := filepath.Abs(destPath)

	resp := UploadResponse{
		URL:      fmt.Sprintf("http://localhost:9090/files/%s", filename),
		Path:     absPath,
		Filename: filename,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// ── Prettify handler ──

func handlePrettifyPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("prettify")
	loadPage("prettify.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Files (explorer) handlers ──

type FileInfo struct {
	Filename string `json:"filename"`
	URL      string `json:"url"`
	Path     string `json:"path"`
	Size     int64  `json:"size"`
	ModTime  string `json:"modTime"`
	IsImage  bool   `json:"isImage"`
}

func handleFilesPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("files")
	loadPage("files.html").ExecuteTemplate(w, "layout.html", data)
}

func handleAPIFiles(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		handleAPIFilesGet(w, r)
	case http.MethodDelete:
		handleAPIFilesDelete(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// GET /api/files — list all uploaded files
func handleAPIFilesGet(w http.ResponseWriter, r *http.Request) {
	entries, _ := os.ReadDir(filesDir)
	imageExts := map[string]bool{
		".png": true, ".jpg": true, ".jpeg": true, ".gif": true,
		".webp": true, ".svg": true, ".bmp": true, ".ico": true,
	}

	var files []FileInfo
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		absPath, _ := filepath.Abs(filepath.Join(filesDir, e.Name()))
		files = append(files, FileInfo{
			Filename: e.Name(),
			URL:      fmt.Sprintf("http://localhost:9090/files/%s", e.Name()),
			Path:     absPath,
			Size:     info.Size(),
			ModTime:  info.ModTime().Format(time.RFC3339),
			IsImage:  imageExts[ext],
		})
	}
	if files == nil {
		files = []FileInfo{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

// DELETE /api/files?name=X or DELETE /api/files?all=true
func handleAPIFilesDelete(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	if q.Get("all") == "true" {
		entries, _ := os.ReadDir(filesDir)
		for _, e := range entries {
			if !e.IsDir() {
				os.Remove(filepath.Join(filesDir, e.Name()))
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "all deleted"})
		return
	}

	name := q.Get("name")
	if name == "" {
		http.Error(w, "name parameter required", http.StatusBadRequest)
		return
	}

	// Prevent path traversal
	name = filepath.Base(name)
	os.Remove(filepath.Join(filesDir, name))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// ── Logs handlers ──

func handleLogsPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("logs")
	loadPage("logs.html").ExecuteTemplate(w, "layout.html", data)
}

// handleAPILogs handles GET (read logs) and DELETE (clear logs) for a given app
func handleAPILogs(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		handleAPILogsPost(w, r)
	case http.MethodGet:
		handleAPILogsGet(w, r)
	case http.MethodDelete:
		handleAPILogsDelete(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// POST /api/logs — receive log entry via JSON body
func handleAPILogsPost(w http.ResponseWriter, r *http.Request) {
	var entry LogEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if entry.App == "" {
		entry.App = "default"
	}
	if entry.Level == "" {
		entry.Level = "info"
	}
	entry.Level = strings.ToLower(entry.Level)
	entry.Timestamp = time.Now().Format(time.RFC3339)

	writeLogEntry(entry)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// GET /api/logs/send?app=X&level=Y&msg=Z — quick log via query string
func handleAPILogsSend(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	entry := LogEntry{
		App:       q.Get("app"),
		Level:     q.Get("level"),
		Message:   q.Get("msg"),
		Timestamp: time.Now().Format(time.RFC3339),
	}
	if entry.App == "" {
		entry.App = "default"
	}
	if entry.Level == "" {
		entry.Level = "info"
	}
	entry.Level = strings.ToLower(entry.Level)

	writeLogEntry(entry)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// GET /api/logs?app=X — read log entries, optional filters: level, search
func handleAPILogsGet(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	app := q.Get("app")
	if app == "" {
		http.Error(w, "app parameter required", http.StatusBadRequest)
		return
	}

	levelFilter := strings.ToLower(q.Get("level"))
	searchFilter := strings.ToLower(q.Get("search"))

	logFile := filepath.Join(logsDir, sanitizeFilename(app)+".log")
	file, err := os.Open(logFile)
	if err != nil {
		// No logs yet, return empty array
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("[]"))
		return
	}
	defer file.Close()

	var entries []LogEntry
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)
	for scanner.Scan() {
		var entry LogEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}
		if levelFilter != "" && levelFilter != "all" && entry.Level != levelFilter {
			continue
		}
		if searchFilter != "" && !strings.Contains(strings.ToLower(entry.Message), searchFilter) {
			continue
		}
		entries = append(entries, entry)
	}

	if entries == nil {
		entries = []LogEntry{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"entries": entries,
		"path":    logFile,
		"count":   len(entries),
	})
}

// DELETE /api/logs?app=X — clear log file
func handleAPILogsDelete(w http.ResponseWriter, r *http.Request) {
	app := r.URL.Query().Get("app")
	if app == "" {
		http.Error(w, "app parameter required", http.StatusBadRequest)
		return
	}

	logFile := filepath.Join(logsDir, sanitizeFilename(app)+".log")
	os.Remove(logFile)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
}

// GET /api/logs/apps — list all app names that have log files
func handleAPILogsApps(w http.ResponseWriter, r *http.Request) {
	entries, _ := os.ReadDir(logsDir)
	var apps []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".log") {
			apps = append(apps, strings.TrimSuffix(e.Name(), ".log"))
		}
	}
	if apps == nil {
		apps = []string{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apps)
}

// writeLogEntry appends a log entry as JSON line to the app's log file
func writeLogEntry(entry LogEntry) {
	logFile := filepath.Join(logsDir, sanitizeFilename(entry.App)+".log")
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	line, _ := json.Marshal(entry)
	f.Write(line)
	f.Write([]byte("\n"))
}

// ── Log Viewer handlers ──

func handleLogViewerPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("logviewer")
	loadPage("logviewer.html").ExecuteTemplate(w, "layout.html", data)
}

type LogViewerResult struct {
	LineNum int    `json:"lineNum"`
	Text    string `json:"text"`
	IsMatch bool   `json:"isMatch"`
}

type LogViewerResponse struct {
	TotalLines   int               `json:"totalLines"`
	MatchedLines int               `json:"matchedLines"`
	FileSize     string            `json:"fileSize"`
	FileName     string            `json:"fileName"`
	ElapsedMs    int64             `json:"elapsedMs"`
	Results      []LogViewerResult `json:"results"`
}

func formatFileSize(size int64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)
	switch {
	case size >= GB:
		return fmt.Sprintf("%.2f GB", float64(size)/float64(GB))
	case size >= MB:
		return fmt.Sprintf("%.2f MB", float64(size)/float64(MB))
	case size >= KB:
		return fmt.Sprintf("%.2f KB", float64(size)/float64(KB))
	default:
		return fmt.Sprintf("%d B", size)
	}
}

// POST /api/logviewer — upload log file or paste text, then filter
func handleAPILogViewer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	start := time.Now()

	r.ParseMultipartForm(500 << 20) // 500 MB max

	keyword := r.FormValue("keyword")
	mode := r.FormValue("mode") // "and" or "or"
	caseSensitive := r.FormValue("caseSensitive") == "true"
	useRegex := r.FormValue("regex") == "true"
	contextLines, _ := strconv.Atoi(r.FormValue("contextLines"))
	if contextLines < 0 {
		contextLines = 0
	}
	if contextLines > 10 {
		contextLines = 10
	}

	// Determine source: uploaded file or pasted text
	var reader io.Reader
	var fileName string
	var fileSize int64

	pastedContent := r.FormValue("content")
	if pastedContent != "" {
		// Paste mode
		reader = strings.NewReader(pastedContent)
		fileName = "pasted-text"
		fileSize = int64(len(pastedContent))
	} else {
		// File upload mode
		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "No file uploaded and no text pasted", http.StatusBadRequest)
			return
		}
		defer file.Close()
		reader = file
		fileName = header.Filename
		fileSize = header.Size
	}

	// Parse keywords
	var keywords []string
	if keyword != "" {
		for _, k := range strings.Split(keyword, ",") {
			k = strings.TrimSpace(k)
			if k != "" {
				keywords = append(keywords, k)
			}
		}
	}

	if len(keywords) == 0 {
		http.Error(w, "At least one keyword is required", http.StatusBadRequest)
		return
	}

	// Compile regex patterns if needed
	var regexPatterns []*regexp.Regexp
	if useRegex {
		for _, k := range keywords {
			flags := ""
			if !caseSensitive {
				flags = "(?i)"
			}
			re, err := regexp.Compile(flags + k)
			if err != nil {
				http.Error(w, fmt.Sprintf("Invalid regex pattern: %s — %v", k, err), http.StatusBadRequest)
				return
			}
			regexPatterns = append(regexPatterns, re)
		}
	}

	// Read all lines
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024) // 10MB max line

	var allLines []string
	for scanner.Scan() {
		allLines = append(allLines, scanner.Text())
	}

	totalLines := len(allLines)

	// Find matching line indices
	matchSet := make(map[int]bool)
	for i, line := range allLines {
		if matchLine(line, keywords, regexPatterns, mode, caseSensitive, useRegex) {
			matchSet[i] = true
		}
	}

	// Build result with context lines
	includeSet := make(map[int]bool)
	for idx := range matchSet {
		for c := idx - contextLines; c <= idx+contextLines; c++ {
			if c >= 0 && c < totalLines {
				includeSet[c] = true
			}
		}
	}

	// Collect results in order
	var results []LogViewerResult
	for i := 0; i < totalLines; i++ {
		if !includeSet[i] {
			continue
		}
		results = append(results, LogViewerResult{
			LineNum: i + 1, // 1-based line number
			Text:    allLines[i],
			IsMatch: matchSet[i],
		})
	}

	elapsed := time.Since(start).Milliseconds()

	resp := LogViewerResponse{
		TotalLines:   totalLines,
		MatchedLines: len(matchSet),
		FileSize:     formatFileSize(fileSize),
		FileName:     fileName,
		ElapsedMs:    elapsed,
		Results:      results,
	}
	if resp.Results == nil {
		resp.Results = []LogViewerResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// matchLine checks if a line matches the keywords based on mode
func matchLine(line string, keywords []string, regexPatterns []*regexp.Regexp, mode string, caseSensitive, useRegex bool) bool {
	if mode == "and" {
		for i, k := range keywords {
			if useRegex {
				if !regexPatterns[i].MatchString(line) {
					return false
				}
			} else {
				if caseSensitive {
					if !strings.Contains(line, k) {
						return false
					}
				} else {
					if !strings.Contains(strings.ToLower(line), strings.ToLower(k)) {
						return false
					}
				}
			}
		}
		return true
	}

	// OR mode (default)
	for i, k := range keywords {
		if useRegex {
			if regexPatterns[i].MatchString(line) {
				return true
			}
		} else {
			if caseSensitive {
				if strings.Contains(line, k) {
					return true
				}
			} else {
				if strings.Contains(strings.ToLower(line), strings.ToLower(k)) {
					return true
				}
			}
		}
	}
	return false
}

// sanitizeFilename removes characters unsafe for filenames
func sanitizeFilename(name string) string {
	replacer := strings.NewReplacer("/", "_", "\\", "_", ":", "_", "*", "_", "?", "_", "\"", "_", "<", "_", ">", "_", "|", "_")
	return replacer.Replace(name)
}

// ── Markdown Viewer handler ──

func handleMarkdownPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("markdown")
	loadPage("markdown.html").ExecuteTemplate(w, "layout.html", data)
}

func handleDiffPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("diff")
	loadPage("diff.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Code Editor handlers ──

func handleEditorPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("editor")
	loadPage("editor.html").ExecuteTemplate(w, "layout.html", data)
}

// ── JWT handler ──

func handleJWTPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("jwt")
	loadPage("jwt.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Base64 handler ──

func handleBase64Page(w http.ResponseWriter, r *http.Request) {
	data := newPageData("base64")
	loadPage("base64.html").ExecuteTemplate(w, "layout.html", data)
}

// ── URL Encoder handler ──

func handleURLEncoderPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("urlencoder")
	loadPage("urlencoder.html").ExecuteTemplate(w, "layout.html", data)
}

// ── HTML Editor handler ──

func handleHTMLEditorPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("htmleditor")
	loadPage("htmleditor.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Mermaid handler ──

func handleMermaidPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("mermaid")
	loadPage("mermaid.html").ExecuteTemplate(w, "layout.html", data)
}

// ── UUID handler ──

func handleUUIDPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("uuid")
	loadPage("uuid.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Regex handler ──

func handleRegexPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("regex")
	loadPage("regex.html").ExecuteTemplate(w, "layout.html", data)
}

// ── CharMap handler ──

func handleCharmapPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("charmap")
	loadPage("charmap.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Epoch handler ──

func handleEpochPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("epoch")
	loadPage("epoch.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Notes handlers ──

type Note struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Content     string   `json:"content"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	Color       string   `json:"color"`
	Pinned      bool     `json:"pinned"`
	Attachments []string `json:"attachments"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
	TrashedAt   string   `json:"trashedAt,omitempty"`
}

func handleNotesPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("notes")
	loadPage("notes.html").ExecuteTemplate(w, "layout.html", data)
}

func loadNotes() []Note {
	data, err := os.ReadFile(filepath.Join(notesDir, "notes.json"))
	if err != nil {
		return []Note{}
	}
	var notes []Note
	if err := json.Unmarshal(data, &notes); err != nil {
		return []Note{}
	}
	return notes
}

func saveNotes(notes []Note) error {
	data, err := json.MarshalIndent(notes, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(notesDir, "notes.json"), data, 0644)
}

func handleAPINotes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		notesMu.Lock()
		notes := loadNotes()
		notesMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(notes)

	case http.MethodPost:
		var note Note
		if err := json.NewDecoder(r.Body).Decode(&note); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		note.CreatedAt = time.Now().Format(time.RFC3339)
		note.UpdatedAt = note.CreatedAt
		if note.Tags == nil {
			note.Tags = []string{}
		}
		if note.Attachments == nil {
			note.Attachments = []string{}
		}

		notesMu.Lock()
		notes := loadNotes()
		notes = append([]Note{note}, notes...) // prepend
		saveNotes(notes)
		notesMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(note)

	case http.MethodPut:
		var updated Note
		if err := json.NewDecoder(r.Body).Decode(&updated); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		updated.UpdatedAt = time.Now().Format(time.RFC3339)

		notesMu.Lock()
		notes := loadNotes()
		for i, n := range notes {
			if n.ID == updated.ID {
				// Preserve fields not sent by client
				if updated.CreatedAt == "" {
					updated.CreatedAt = n.CreatedAt
				}
				if updated.Attachments == nil {
					updated.Attachments = n.Attachments
				}
				if updated.Tags == nil {
					updated.Tags = n.Tags
				}
				notes[i] = updated
				break
			}
		}
		saveNotes(notes)
		notesMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)

	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "id required", http.StatusBadRequest)
			return
		}
		permanent := r.URL.Query().Get("permanent") == "true"

		notesMu.Lock()
		notes := loadNotes()
		if permanent {
			// Remove permanently + delete attachments
			filtered := make([]Note, 0, len(notes))
			for _, n := range notes {
				if n.ID != id {
					filtered = append(filtered, n)
				}
			}
			notes = filtered
			os.RemoveAll(filepath.Join(notesDir, "attachments", id))
		} else {
			// Soft delete
			for i, n := range notes {
				if n.ID == id {
					notes[i].TrashedAt = time.Now().Format(time.RFC3339)
					break
				}
			}
		}
		saveNotes(notes)
		notesMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleAPINotesRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "id required", http.StatusBadRequest)
		return
	}

	notesMu.Lock()
	notes := loadNotes()
	for i, n := range notes {
		if n.ID == id {
			notes[i].TrashedAt = ""
			break
		}
	}
	saveNotes(notes)
	notesMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "restored"})
}

func handleAPINotesReorder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var ids []string
	if err := json.NewDecoder(r.Body).Decode(&ids); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	notesMu.Lock()
	notes := loadNotes()
	noteMap := make(map[string]Note)
	for _, n := range notes {
		noteMap[n.ID] = n
	}
	reordered := make([]Note, 0, len(notes))
	seen := make(map[string]bool)
	for _, id := range ids {
		if n, ok := noteMap[id]; ok {
			reordered = append(reordered, n)
			seen[id] = true
		}
	}
	// Append any notes not in the order list
	for _, n := range notes {
		if !seen[n.ID] {
			reordered = append(reordered, n)
		}
	}
	saveNotes(reordered)
	notesMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleAPINotesAttachment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	noteId := r.URL.Query().Get("noteId")
	if noteId == "" {
		http.Error(w, "noteId required", http.StatusBadRequest)
		return
	}

	r.ParseMultipartForm(50 << 20) // 50 MB
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Create note attachment directory
	attDir := filepath.Join(notesDir, "attachments", sanitizeFilename(noteId))
	os.MkdirAll(attDir, 0755)

	// Generate filename with timestamp
	ext := filepath.Ext(header.Filename)
	name := strings.TrimSuffix(header.Filename, ext)
	timestamp := time.Now().Format("20060102-150405")
	filename := fmt.Sprintf("%s-%s%s", timestamp, sanitizeFilename(name), ext)

	destPath := filepath.Join(attDir, filename)
	dst, err := os.Create(destPath)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to write file", http.StatusInternalServerError)
		return
	}

	// Add to note's attachments list
	url := fmt.Sprintf("/notes-att/%s/%s", sanitizeFilename(noteId), filename)

	notesMu.Lock()
	notes := loadNotes()
	for i, n := range notes {
		if n.ID == noteId {
			notes[i].Attachments = append(notes[i].Attachments, filename)
			break
		}
	}
	saveNotes(notes)
	notesMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"filename": filename,
		"url":      url,
	})
}

// ── Code Snippets handlers ──

type Snippet struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Code        string   `json:"code"`
	Language    string   `json:"language"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	Pinned      bool     `json:"pinned"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

func handleSnippetsPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("snippets")
	loadPage("snippets.html").ExecuteTemplate(w, "layout.html", data)
}

func loadSnippets() []Snippet {
	data, err := os.ReadFile(filepath.Join(snippetsDir, "snippets.json"))
	if err != nil {
		return []Snippet{}
	}
	var snippets []Snippet
	if err := json.Unmarshal(data, &snippets); err != nil {
		return []Snippet{}
	}
	return snippets
}

func saveSnippets(snippets []Snippet) error {
	data, err := json.MarshalIndent(snippets, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(snippetsDir, "snippets.json"), data, 0644)
}

func handleAPISnippets(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		snippetsMu.Lock()
		snippets := loadSnippets()
		snippetsMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(snippets)

	case http.MethodPost:
		var s Snippet
		if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		s.CreatedAt = time.Now().Format(time.RFC3339)
		s.UpdatedAt = s.CreatedAt
		if s.Tags == nil {
			s.Tags = []string{}
		}

		snippetsMu.Lock()
		snippets := loadSnippets()
		snippets = append([]Snippet{s}, snippets...)
		saveSnippets(snippets)
		snippetsMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(s)

	case http.MethodPut:
		var updated Snippet
		if err := json.NewDecoder(r.Body).Decode(&updated); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		updated.UpdatedAt = time.Now().Format(time.RFC3339)

		snippetsMu.Lock()
		snippets := loadSnippets()
		for i, s := range snippets {
			if s.ID == updated.ID {
				if updated.CreatedAt == "" {
					updated.CreatedAt = s.CreatedAt
				}
				if updated.Tags == nil {
					updated.Tags = s.Tags
				}
				snippets[i] = updated
				break
			}
		}
		saveSnippets(snippets)
		snippetsMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)

	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "id required", http.StatusBadRequest)
			return
		}

		snippetsMu.Lock()
		snippets := loadSnippets()
		filtered := make([]Snippet, 0, len(snippets))
		for _, s := range snippets {
			if s.ID != id {
				filtered = append(filtered, s)
			}
		}
		saveSnippets(filtered)
		snippetsMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func initDefaultSnippets() {
	jsonPath := filepath.Join(snippetsDir, "snippets.json")
	if _, err := os.Stat(jsonPath); err == nil {
		return // already exists
	}

	now := time.Now().Format(time.RFC3339)
	defaults := []Snippet{
		{ID: "def01", Title: "Fetch API (GET + POST)", Language: "javascript", Category: "Frontend", Tags: []string{"fetch", "api", "async"}, Description: "Async/await fetch for GET and POST requests with error handling.", Code: "// GET request\nasync function fetchData(url) {\n  try {\n    const response = await fetch(url);\n    if (!response.ok) throw new Error(`HTTP ${response.status}`);\n    return await response.json();\n  } catch (error) {\n    console.error('Fetch failed:', error);\n    throw error;\n  }\n}\n\n// POST request\nasync function postData(url, data) {\n  const response = await fetch(url, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify(data),\n  });\n  return await response.json();\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def02", Title: "Debounce Function", Language: "javascript", Category: "Utility", Tags: []string{"debounce", "performance"}, Description: "Classic debounce — delays function execution until after wait milliseconds of inactivity.", Code: "function debounce(fn, wait = 300) {\n  let timer;\n  return function (...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), wait);\n  };\n}\n\n// Usage:\n// const handleSearch = debounce((query) => {\n//   fetch(`/api/search?q=${query}`);\n// }, 500);", CreatedAt: now, UpdatedAt: now},
		{ID: "def03", Title: "Deep Clone Object", Language: "javascript", Category: "Utility", Tags: []string{"clone", "deep copy"}, Description: "Modern deep clone using structuredClone, with fallback.", Code: "// Modern (Chrome 98+, Node 17+)\nconst clone = structuredClone(original);\n\n// Fallback for older environments\nfunction deepClone(obj) {\n  if (obj === null || typeof obj !== 'object') return obj;\n  if (obj instanceof Date) return new Date(obj);\n  if (obj instanceof RegExp) return new RegExp(obj);\n  if (Array.isArray(obj)) return obj.map(deepClone);\n  const cloned = {};\n  for (const key of Object.keys(obj)) {\n    cloned[key] = deepClone(obj[key]);\n  }\n  return cloned;\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def04", Title: "React useState + useEffect", Language: "typescript", Category: "Frontend", Tags: []string{"react", "hooks"}, Description: "React component with state management and side effects using hooks.", Code: "import { useState, useEffect } from 'react';\n\ninterface User {\n  id: number;\n  name: string;\n  email: string;\n}\n\nexport function UserList() {\n  const [users, setUsers] = useState<User[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState<string | null>(null);\n\n  useEffect(() => {\n    const controller = new AbortController();\n\n    async function fetchUsers() {\n      try {\n        const res = await fetch('/api/users', { signal: controller.signal });\n        if (!res.ok) throw new Error(`HTTP ${res.status}`);\n        setUsers(await res.json());\n      } catch (err: any) {\n        if (err.name !== 'AbortError') setError(err.message);\n      } finally {\n        setLoading(false);\n      }\n    }\n\n    fetchUsers();\n    return () => controller.abort();\n  }, []);\n\n  if (loading) return <p>Loading...</p>;\n  if (error) return <p>Error: {error}</p>;\n\n  return (\n    <ul>\n      {users.map(u => <li key={u.id}>{u.name} ({u.email})</li>)}\n    </ul>\n  );\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def05", Title: "Express Route Handler", Language: "javascript", Category: "Backend", Tags: []string{"express", "node", "middleware"}, Description: "Express.js route with middleware, validation, and async error handling.", Code: "const express = require('express');\nconst router = express.Router();\n\n// Middleware: auth check\nconst requireAuth = (req, res, next) => {\n  const token = req.headers.authorization?.split(' ')[1];\n  if (!token) return res.status(401).json({ error: 'Unauthorized' });\n  try {\n    req.user = verifyToken(token);\n    next();\n  } catch {\n    res.status(403).json({ error: 'Invalid token' });\n  }\n};\n\n// GET /api/items\nrouter.get('/items', requireAuth, async (req, res, next) => {\n  try {\n    const { page = 1, limit = 20, search } = req.query;\n    const items = await Item.find(search ? { name: new RegExp(search, 'i') } : {})\n      .skip((page - 1) * limit)\n      .limit(Number(limit));\n    const total = await Item.countDocuments();\n    res.json({ items, total, page: Number(page) });\n  } catch (err) {\n    next(err);\n  }\n});\n\n// POST /api/items\nrouter.post('/items', requireAuth, async (req, res, next) => {\n  try {\n    const { name, description } = req.body;\n    if (!name) return res.status(400).json({ error: 'Name is required' });\n    const item = await Item.create({ name, description, createdBy: req.user.id });\n    res.status(201).json(item);\n  } catch (err) {\n    next(err);\n  }\n});\n\nmodule.exports = router;", CreatedAt: now, UpdatedAt: now},
		{ID: "def06", Title: "Python Read File", Language: "python", Category: "Backend", Tags: []string{"python", "file", "io"}, Description: "Read files with context manager — text, JSON, and CSV.", Code: "import json\nimport csv\nfrom pathlib import Path\n\n# Read text file\ndef read_text(filepath: str) -> str:\n    with open(filepath, 'r', encoding='utf-8') as f:\n        return f.read()\n\n# Read JSON file\ndef read_json(filepath: str) -> dict:\n    with open(filepath, 'r', encoding='utf-8') as f:\n        return json.load(f)\n\n# Read CSV file\ndef read_csv(filepath: str) -> list[dict]:\n    with open(filepath, 'r', encoding='utf-8') as f:\n        return list(csv.DictReader(f))\n\n# Write JSON file\ndef write_json(filepath: str, data: dict) -> None:\n    with open(filepath, 'w', encoding='utf-8') as f:\n        json.dump(data, f, indent=2, ensure_ascii=False)\n\n# Read with Path (modern)\ncontent = Path('data.txt').read_text(encoding='utf-8')\nlines = Path('data.txt').read_text().splitlines()", CreatedAt: now, UpdatedAt: now},
		{ID: "def07", Title: "Python List Comprehension", Language: "python", Category: "Backend", Tags: []string{"python", "list", "comprehension"}, Description: "List comprehension patterns — filter, transform, nested, dict comprehension.", Code: "# Basic — transform\nsquares = [x ** 2 for x in range(10)]\n\n# Filter — even numbers only\nevens = [x for x in range(20) if x % 2 == 0]\n\n# Transform + filter\nnames = [name.title() for name in raw_names if name.strip()]\n\n# Nested — flatten 2D list\nflat = [x for row in matrix for x in row]\n\n# Dict comprehension\nword_lengths = {word: len(word) for word in words}\n\n# Set comprehension\nunique_lengths = {len(word) for word in words}\n\n# Conditional expression (ternary)\nlabels = ['even' if x % 2 == 0 else 'odd' for x in range(10)]\n\n# With enumerate\nindexed = [(i, val) for i, val in enumerate(items) if val > threshold]\n\n# Walrus operator (Python 3.8+)\nresults = [y for x in data if (y := process(x)) is not None]", CreatedAt: now, UpdatedAt: now},
		{ID: "def08", Title: "Go HTTP Handler", Language: "go", Category: "Backend", Tags: []string{"go", "http", "json", "handler"}, Description: "Idiomatic Go HTTP handler with JSON response and error handling.", Code: "package main\n\nimport (\n\t\"encoding/json\"\n\t\"log\"\n\t\"net/http\"\n)\n\ntype Response struct {\n\tData    interface{} `json:\"data,omitempty\"`\n\tError   string      `json:\"error,omitempty\"`\n}\n\nfunc respondJSON(w http.ResponseWriter, status int, payload interface{}) {\n\tw.Header().Set(\"Content-Type\", \"application/json\")\n\tw.WriteHeader(status)\n\tjson.NewEncoder(w).Encode(payload)\n}\n\nfunc handleGetUsers(w http.ResponseWriter, r *http.Request) {\n\tif r.Method != http.MethodGet {\n\t\trespondJSON(w, http.StatusMethodNotAllowed, Response{Error: \"method not allowed\"})\n\t\treturn\n\t}\n\n\tusers, err := db.GetUsers(r.Context())\n\tif err != nil {\n\t\tlog.Printf(\"GetUsers error: %v\", err)\n\t\trespondJSON(w, http.StatusInternalServerError, Response{Error: \"internal error\"})\n\t\treturn\n\t}\n\n\trespondJSON(w, http.StatusOK, Response{Data: users})\n}\n\nfunc main() {\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"/api/users\", handleGetUsers)\n\tlog.Fatal(http.ListenAndServe(\":8080\", mux))\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def09", Title: "Go Error Handling", Language: "go", Category: "Backend", Tags: []string{"go", "error", "wrap"}, Description: "Idiomatic Go error handling with wrapping, custom errors, and sentinel errors.", Code: "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\n// Sentinel errors\nvar (\n\tErrNotFound   = errors.New(\"not found\")\n\tErrForbidden  = errors.New(\"forbidden\")\n)\n\n// Custom error type\ntype ValidationError struct {\n\tField   string\n\tMessage string\n}\n\nfunc (e *ValidationError) Error() string {\n\treturn fmt.Sprintf(\"validation: %s — %s\", e.Field, e.Message)\n}\n\n// Wrapping errors (Go 1.13+)\nfunc getUser(id string) (*User, error) {\n\tuser, err := db.FindByID(id)\n\tif err != nil {\n\t\treturn nil, fmt.Errorf(\"getUser(%s): %w\", id, err)\n\t}\n\tif user == nil {\n\t\treturn nil, fmt.Errorf(\"getUser(%s): %w\", id, ErrNotFound)\n\t}\n\treturn user, nil\n}\n\n// Checking errors\nfunc handleRequest() {\n\tuser, err := getUser(\"123\")\n\tif err != nil {\n\t\tif errors.Is(err, ErrNotFound) {\n\t\t\t// handle 404\n\t\t}\n\t\tvar ve *ValidationError\n\t\tif errors.As(err, &ve) {\n\t\t\t// handle validation error\n\t\t\tfmt.Println(ve.Field, ve.Message)\n\t\t}\n\t}\n\t_ = user\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def10", Title: "C# Async/Await HttpClient", Language: "csharp", Category: "Backend", Tags: []string{"csharp", "async", "http"}, Description: "C# HttpClient with async/await, JSON serialization, and error handling.", Code: "using System.Net.Http.Json;\n\npublic class ApiService\n{\n    private readonly HttpClient _http;\n\n    public ApiService(HttpClient http)\n    {\n        _http = http;\n        _http.BaseAddress = new Uri(\"https://api.example.com/\");\n    }\n\n    public async Task<List<User>> GetUsersAsync(CancellationToken ct = default)\n    {\n        var response = await _http.GetAsync(\"users\", ct);\n        response.EnsureSuccessStatusCode();\n        return await response.Content.ReadFromJsonAsync<List<User>>(ct)\n               ?? new List<User>();\n    }\n\n    public async Task<User> CreateUserAsync(CreateUserRequest request, CancellationToken ct = default)\n    {\n        var response = await _http.PostAsJsonAsync(\"users\", request, ct);\n        response.EnsureSuccessStatusCode();\n        return (await response.Content.ReadFromJsonAsync<User>(ct))!;\n    }\n}\n\n// Registration in DI:\n// builder.Services.AddHttpClient<ApiService>();", CreatedAt: now, UpdatedAt: now},
		{ID: "def11", Title: "C# LINQ Query", Language: "csharp", Category: "Backend", Tags: []string{"csharp", "linq"}, Description: "LINQ method syntax — Where, Select, OrderBy, GroupBy, Aggregate.", Code: "using System.Linq;\n\nvar users = GetUsers();\n\n// Filter + Transform\nvar activeEmails = users\n    .Where(u => u.IsActive && u.Age >= 18)\n    .Select(u => new { u.Name, u.Email })\n    .OrderBy(u => u.Name)\n    .ToList();\n\n// GroupBy\nvar byDepartment = users\n    .GroupBy(u => u.Department)\n    .Select(g => new\n    {\n        Department = g.Key,\n        Count = g.Count(),\n        AvgAge = g.Average(u => u.Age)\n    })\n    .OrderByDescending(x => x.Count);\n\n// First / Single / Any\nvar admin = users.FirstOrDefault(u => u.Role == \"Admin\");\nbool hasMinors = users.Any(u => u.Age < 18);\n\n// Aggregate\nvar totalSalary = users.Sum(u => u.Salary);\nvar oldest = users.MaxBy(u => u.Age);\n\n// Distinct + SelectMany (flatten)\nvar allTags = users\n    .SelectMany(u => u.Tags)\n    .Distinct()\n    .OrderBy(t => t);", CreatedAt: now, UpdatedAt: now},
		{ID: "def12", Title: "SQL JOIN with GROUP BY", Language: "sql", Category: "Database", Tags: []string{"sql", "join", "group by"}, Description: "INNER/LEFT JOIN patterns with GROUP BY, HAVING, and aggregate functions.", Code: "-- Orders summary per customer\nSELECT\n    c.id,\n    c.name,\n    COUNT(o.id)              AS total_orders,\n    COALESCE(SUM(o.amount), 0) AS total_spent,\n    MAX(o.created_at)        AS last_order\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE c.is_active = true\nGROUP BY c.id, c.name\nHAVING COUNT(o.id) > 0\nORDER BY total_spent DESC\nLIMIT 50;\n\n-- Multi-table join\nSELECT\n    p.name        AS product,\n    cat.name      AS category,\n    SUM(oi.qty)   AS units_sold,\n    SUM(oi.qty * oi.price) AS revenue\nFROM order_items oi\nINNER JOIN products p   ON p.id = oi.product_id\nINNER JOIN categories cat ON cat.id = p.category_id\nINNER JOIN orders o     ON o.id = oi.order_id\nWHERE o.created_at >= '2025-01-01'\nGROUP BY p.name, cat.name\nORDER BY revenue DESC;", CreatedAt: now, UpdatedAt: now},
		{ID: "def13", Title: "SQL UPSERT (INSERT ON CONFLICT)", Language: "sql", Category: "Database", Tags: []string{"sql", "upsert", "insert"}, Description: "INSERT ON CONFLICT (PostgreSQL) and INSERT ON DUPLICATE KEY (MySQL).", Code: "-- PostgreSQL: UPSERT\nINSERT INTO users (email, name, updated_at)\nVALUES ('user@example.com', 'John Doe', NOW())\nON CONFLICT (email)\nDO UPDATE SET\n    name       = EXCLUDED.name,\n    updated_at = EXCLUDED.updated_at;\n\n-- PostgreSQL: Bulk upsert\nINSERT INTO products (sku, name, price)\nVALUES\n    ('SKU001', 'Widget A', 9.99),\n    ('SKU002', 'Widget B', 19.99),\n    ('SKU003', 'Widget C', 29.99)\nON CONFLICT (sku)\nDO UPDATE SET\n    name  = EXCLUDED.name,\n    price = EXCLUDED.price;\n\n-- MySQL: INSERT ON DUPLICATE KEY\nINSERT INTO users (email, name, updated_at)\nVALUES ('user@example.com', 'John Doe', NOW())\nON DUPLICATE KEY UPDATE\n    name       = VALUES(name),\n    updated_at = VALUES(updated_at);", CreatedAt: now, UpdatedAt: now},
		{ID: "def14", Title: "Docker Compose Template", Language: "yaml", Category: "DevOps", Tags: []string{"docker", "compose", "devops"}, Description: "Docker Compose with web app, database, and Redis — volumes, networks, health checks.", Code: "version: '3.8'\n\nservices:\n  app:\n    build: .\n    ports:\n      - '3000:3000'\n    environment:\n      - NODE_ENV=production\n      - DATABASE_URL=postgres://user:pass@db:5432/myapp\n      - REDIS_URL=redis://redis:6379\n    depends_on:\n      db:\n        condition: service_healthy\n      redis:\n        condition: service_started\n    restart: unless-stopped\n\n  db:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_USER: user\n      POSTGRES_PASSWORD: pass\n      POSTGRES_DB: myapp\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n    ports:\n      - '5432:5432'\n    healthcheck:\n      test: ['CMD-SHELL', 'pg_isready -U user -d myapp']\n      interval: 5s\n      timeout: 5s\n      retries: 5\n\n  redis:\n    image: redis:7-alpine\n    ports:\n      - '6379:6379'\n    volumes:\n      - redisdata:/data\n\nvolumes:\n  pgdata:\n  redisdata:", CreatedAt: now, UpdatedAt: now},
		{ID: "def15", Title: "Bash Script Template", Language: "shell", Category: "DevOps", Tags: []string{"bash", "shell", "script"}, Description: "Bash script boilerplate with strict mode, colors, logging, and cleanup trap.", Code: "#!/usr/bin/env bash\nset -euo pipefail\nIFS=$'\\n\\t'\n\n# Colors\nRED='\\033[0;31m'\nGREEN='\\033[0;32m'\nYELLOW='\\033[1;33m'\nNC='\\033[0m' # No Color\n\nlog()   { echo -e \"${GREEN}[INFO]${NC} $*\"; }\nwarn()  { echo -e \"${YELLOW}[WARN]${NC} $*\" >&2; }\nerror() { echo -e \"${RED}[ERROR]${NC} $*\" >&2; exit 1; }\n\n# Cleanup on exit\ncleanup() {\n  log \"Cleaning up...\"\n  # rm -rf \"$TMPDIR\" etc.\n}\ntrap cleanup EXIT\n\n# Check dependencies\ncommand -v jq >/dev/null 2>&1 || error \"jq is required but not installed\"\n\n# Parse arguments\nVERBOSE=false\nwhile [[ $# -gt 0 ]]; do\n  case $1 in\n    -v|--verbose) VERBOSE=true; shift ;;\n    -h|--help)    echo \"Usage: $0 [-v] [-h]\"; exit 0 ;;\n    *)            error \"Unknown option: $1\" ;;\n  esac\ndone\n\nlog \"Starting script...\"\n# Your code here\nlog \"Done!\"", CreatedAt: now, UpdatedAt: now},
		{ID: "def16", Title: "CSS Flexbox Center", Language: "css", Category: "Frontend", Tags: []string{"css", "flexbox", "center", "layout"}, Description: "Common flexbox patterns — center, space between, responsive cards, sticky footer.", Code: "/* Center anything */\n.center {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n\n/* Space between with wrapping */\n.toolbar {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 1rem;\n  flex-wrap: wrap;\n}\n\n/* Responsive card grid */\n.card-grid {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 1rem;\n}\n.card-grid > * {\n  flex: 1 1 300px; /* min 300px, grow/shrink equally */\n}\n\n/* Sticky footer layout */\n.page {\n  display: flex;\n  flex-direction: column;\n  min-height: 100vh;\n}\n.page > main {\n  flex: 1;\n}\n\n/* Truncate text in flex child */\n.flex-truncate {\n  display: flex;\n  align-items: center;\n  min-width: 0; /* allows child to shrink */\n}\n.flex-truncate > span {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def17", Title: "HTML Responsive Grid", Language: "html", Category: "Frontend", Tags: []string{"html", "css", "grid", "responsive"}, Description: "CSS Grid responsive layout — auto-fit, named areas, holy grail.", Code: "<!-- Auto-fit responsive grid -->\n<style>\n.auto-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));\n  gap: 1.5rem;\n  padding: 1rem;\n}\n\n/* Holy grail layout */\n.layout {\n  display: grid;\n  grid-template-areas:\n    'header header header'\n    'nav    main   aside'\n    'footer footer footer';\n  grid-template-columns: 250px 1fr 200px;\n  grid-template-rows: auto 1fr auto;\n  min-height: 100vh;\n}\n.layout > header { grid-area: header; }\n.layout > nav    { grid-area: nav; }\n.layout > main   { grid-area: main; }\n.layout > aside  { grid-area: aside; }\n.layout > footer { grid-area: footer; }\n\n@media (max-width: 768px) {\n  .layout {\n    grid-template-areas:\n      'header'\n      'main'\n      'footer';\n    grid-template-columns: 1fr;\n  }\n  .layout > nav,\n  .layout > aside { display: none; }\n}\n</style>\n\n<div class=\"auto-grid\">\n  <div class=\"card\">Card 1</div>\n  <div class=\"card\">Card 2</div>\n  <div class=\"card\">Card 3</div>\n  <div class=\"card\">Card 4</div>\n</div>", CreatedAt: now, UpdatedAt: now},
		{ID: "def18", Title: "Regex Common Patterns", Language: "javascript", Category: "Utility", Tags: []string{"regex", "validation", "email", "url"}, Description: "Frequently used regex patterns — email, URL, phone, IP, date, password.", Code: "// Email (RFC 5322 simplified)\nconst email = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;\n\n// URL (http/https)\nconst url = /^https?:\\/\\/[\\w.-]+(?:\\.[\\w.-]+)+[\\w\\-._~:/?#[\\]@!$&'()*+,;=]*$/;\n\n// Phone (international, flexible)\nconst phone = /^\\+?[1-9]\\d{1,14}$/;\n\n// IPv4\nconst ipv4 = /^(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$/;\n\n// Date (YYYY-MM-DD)\nconst isoDate = /^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])$/;\n\n// Strong password (8+, upper, lower, digit, special)\nconst strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*]).{8,}$/;\n\n// Hex color (#RGB or #RRGGBB)\nconst hexColor = /^#(?:[0-9a-fA-F]{3}){1,2}$/;\n\n// Slug (URL-friendly)\nconst slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;\n\n// Usage:\nconsole.log(email.test('user@example.com'));  // true\nconsole.log(hexColor.test('#ff5733'));         // true", CreatedAt: now, UpdatedAt: now},
		{ID: "def19", Title: "Git Commands Cheatsheet", Language: "shell", Category: "DevOps", Tags: []string{"git", "commands", "cheatsheet"}, Description: "Most-used Git commands — branching, stash, rebase, reset, log.", Code: "# ── Branch management ──\ngit branch -a                    # list all branches\ngit checkout -b feature/name     # create + switch\ngit branch -d feature/name       # delete local branch\ngit push origin --delete branch  # delete remote branch\n\n# ── Stash ──\ngit stash                        # save work-in-progress\ngit stash pop                    # restore last stash\ngit stash list                   # list all stashes\ngit stash drop stash@{0}         # delete specific stash\n\n# ── Rebase ──\ngit rebase main                  # rebase current onto main\ngit rebase -i HEAD~3             # interactive rebase last 3 commits\ngit rebase --abort               # cancel rebase\n\n# ── Undo / Reset ──\ngit reset --soft HEAD~1          # undo last commit, keep changes staged\ngit reset --mixed HEAD~1         # undo last commit, unstage changes\ngit restore --staged file.txt    # unstage a file\ngit checkout -- file.txt         # discard local changes to file\n\n# ── Log ──\ngit log --oneline -20            # compact log\ngit log --graph --all --oneline  # visual branch graph\ngit log --author='name' --since='2025-01-01'\n\n# ── Useful ──\ngit diff --stat main             # summary of changes vs main\ngit cherry-pick abc123           # apply specific commit\ngit bisect start                 # find bug-introducing commit", CreatedAt: now, UpdatedAt: now},
		{ID: "def20", Title: "TypeScript Generic Function", Language: "typescript", Category: "Frontend", Tags: []string{"typescript", "generics"}, Description: "TypeScript generics — functions, constraints, utility types, mapped types.", Code: "// Generic function\nfunction first<T>(arr: T[]): T | undefined {\n  return arr[0];\n}\n\n// With constraint\nfunction getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {\n  return obj[key];\n}\n\n// Generic interface\ninterface ApiResponse<T> {\n  data: T;\n  status: number;\n  message: string;\n}\n\n// Generic class\nclass Repository<T extends { id: string }> {\n  private items: Map<string, T> = new Map();\n\n  add(item: T): void {\n    this.items.set(item.id, item);\n  }\n\n  findById(id: string): T | undefined {\n    return this.items.get(id);\n  }\n\n  findAll(): T[] {\n    return Array.from(this.items.values());\n  }\n}\n\n// Utility types\ntype UserInput = Pick<User, 'name' | 'email'>;\ntype PartialUser = Partial<User>;\ntype ReadonlyUser = Readonly<User>;\ntype UserRecord = Record<string, User>;\n\n// Mapped type\ntype Nullable<T> = {\n  [K in keyof T]: T[K] | null;\n};", CreatedAt: now, UpdatedAt: now},

		// ── Java / Spring Boot / Hibernate ──
		{ID: "def21", Title: "Spring Boot REST Controller", Language: "java", Category: "Backend", Tags: []string{"java", "spring", "rest", "controller"}, Description: "Spring Boot REST controller with CRUD endpoints, validation, and ResponseEntity.", Code: "import org.springframework.http.ResponseEntity;\nimport org.springframework.web.bind.annotation.*;\nimport jakarta.validation.Valid;\nimport java.util.List;\n\n@RestController\n@RequestMapping(\"/api/users\")\npublic class UserController {\n\n    private final UserService userService;\n\n    public UserController(UserService userService) {\n        this.userService = userService;\n    }\n\n    @GetMapping\n    public ResponseEntity<List<UserDTO>> getAll(\n            @RequestParam(defaultValue = \"0\") int page,\n            @RequestParam(defaultValue = \"20\") int size) {\n        return ResponseEntity.ok(userService.findAll(page, size));\n    }\n\n    @GetMapping(\"/{id}\")\n    public ResponseEntity<UserDTO> getById(@PathVariable Long id) {\n        return userService.findById(id)\n                .map(ResponseEntity::ok)\n                .orElse(ResponseEntity.notFound().build());\n    }\n\n    @PostMapping\n    public ResponseEntity<UserDTO> create(@Valid @RequestBody CreateUserRequest request) {\n        UserDTO created = userService.create(request);\n        return ResponseEntity.status(201).body(created);\n    }\n\n    @PutMapping(\"/{id}\")\n    public ResponseEntity<UserDTO> update(@PathVariable Long id,\n                                          @Valid @RequestBody UpdateUserRequest request) {\n        return ResponseEntity.ok(userService.update(id, request));\n    }\n\n    @DeleteMapping(\"/{id}\")\n    public ResponseEntity<Void> delete(@PathVariable Long id) {\n        userService.delete(id);\n        return ResponseEntity.noContent().build();\n    }\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def22", Title: "Spring Boot JPA Repository", Language: "java", Category: "Backend", Tags: []string{"java", "spring", "jpa", "repository"}, Description: "JpaRepository with custom queries — derived, JPQL, native, and Specification.", Code: "import org.springframework.data.jpa.repository.JpaRepository;\nimport org.springframework.data.jpa.repository.Query;\nimport org.springframework.data.repository.query.Param;\nimport java.util.List;\nimport java.util.Optional;\n\npublic interface UserRepository extends JpaRepository<User, Long> {\n\n    // Derived query\n    Optional<User> findByEmail(String email);\n    List<User> findByActiveTrue();\n    List<User> findByNameContainingIgnoreCase(String name);\n    boolean existsByEmail(String email);\n\n    // JPQL query\n    @Query(\"SELECT u FROM User u WHERE u.department = :dept AND u.active = true ORDER BY u.createdAt DESC\")\n    List<User> findActivByDepartment(@Param(\"dept\") String department);\n\n    // JPQL with projection\n    @Query(\"SELECT new com.example.dto.UserSummary(u.id, u.name, u.email) FROM User u WHERE u.role = :role\")\n    List<UserSummary> findSummariesByRole(@Param(\"role\") String role);\n\n    // Native query\n    @Query(value = \"SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '30 days'\", nativeQuery = true)\n    List<User> findRecentUsers();\n\n    // Delete\n    void deleteByActivefalseAndCreatedAtBefore(java.time.LocalDateTime before);\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def23", Title: "Hibernate JPA Entity", Language: "java", Category: "Backend", Tags: []string{"java", "hibernate", "jpa", "entity"}, Description: "JPA entity with relationships, auditing, and lifecycle callbacks.", Code: "import jakarta.persistence.*;\nimport java.time.LocalDateTime;\nimport java.util.ArrayList;\nimport java.util.List;\n\n@Entity\n@Table(name = \"users\", indexes = {\n    @Index(name = \"idx_user_email\", columnList = \"email\", unique = true)\n})\npublic class User {\n\n    @Id\n    @GeneratedValue(strategy = GenerationType.IDENTITY)\n    private Long id;\n\n    @Column(nullable = false, length = 100)\n    private String name;\n\n    @Column(nullable = false, unique = true)\n    private String email;\n\n    @Column(nullable = false)\n    private boolean active = true;\n\n    @Enumerated(EnumType.STRING)\n    @Column(nullable = false)\n    private Role role = Role.USER;\n\n    @OneToMany(mappedBy = \"user\", cascade = CascadeType.ALL, orphanRemoval = true)\n    private List<Order> orders = new ArrayList<>();\n\n    @ManyToOne(fetch = FetchType.LAZY)\n    @JoinColumn(name = \"department_id\")\n    private Department department;\n\n    @Column(updatable = false)\n    private LocalDateTime createdAt;\n\n    private LocalDateTime updatedAt;\n\n    @PrePersist\n    protected void onCreate() {\n        createdAt = LocalDateTime.now();\n        updatedAt = createdAt;\n    }\n\n    @PreUpdate\n    protected void onUpdate() {\n        updatedAt = LocalDateTime.now();\n    }\n\n    // Getters, setters, equals, hashCode...\n\n    public enum Role { USER, ADMIN, MODERATOR }\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def24", Title: "Spring Boot application.yml", Language: "yaml", Category: "Backend", Tags: []string{"spring", "config", "yaml"}, Description: "Common Spring Boot config — datasource, JPA, logging, security.", Code: "spring:\n  application:\n    name: my-app\n\n  datasource:\n    url: jdbc:postgresql://localhost:5432/mydb\n    username: ${DB_USER:postgres}\n    password: ${DB_PASS:postgres}\n    hikari:\n      maximum-pool-size: 10\n      minimum-idle: 5\n\n  jpa:\n    hibernate:\n      ddl-auto: validate\n    show-sql: false\n    properties:\n      hibernate:\n        format_sql: true\n        default_batch_fetch_size: 20\n    open-in-view: false\n\n  jackson:\n    serialization:\n      write-dates-as-timestamps: false\n    default-property-inclusion: non_null\n\nserver:\n  port: ${PORT:8080}\n  servlet:\n    context-path: /api\n\nlogging:\n  level:\n    root: INFO\n    com.example: DEBUG\n    org.hibernate.SQL: DEBUG\n\nmanagement:\n  endpoints:\n    web:\n      exposure:\n        include: health,info,metrics", CreatedAt: now, UpdatedAt: now},
		{ID: "def25", Title: "Java Stream API", Language: "java", Category: "Backend", Tags: []string{"java", "stream", "lambda", "functional"}, Description: "Java Stream patterns — filter, map, collect, groupBy, reduce, flatMap.", Code: "import java.util.*;\nimport java.util.stream.*;\nimport static java.util.stream.Collectors.*;\n\nList<User> users = getUsers();\n\n// Filter + Map + Collect\nList<String> activeEmails = users.stream()\n    .filter(User::isActive)\n    .map(User::getEmail)\n    .sorted()\n    .collect(toList());\n\n// GroupBy\nMap<String, List<User>> byDept = users.stream()\n    .collect(groupingBy(User::getDepartment));\n\n// GroupBy + Count\nMap<String, Long> countByDept = users.stream()\n    .collect(groupingBy(User::getDepartment, counting()));\n\n// toMap\nMap<Long, User> userById = users.stream()\n    .collect(toMap(User::getId, u -> u));\n\n// Reduce\nint totalAge = users.stream()\n    .mapToInt(User::getAge)\n    .sum();\n\n// FlatMap (flatten nested lists)\nList<String> allTags = users.stream()\n    .flatMap(u -> u.getTags().stream())\n    .distinct()\n    .collect(toList());\n\n// Optional chain\nString name = users.stream()\n    .filter(u -> u.getId() == 1L)\n    .findFirst()\n    .map(User::getName)\n    .orElse(\"Unknown\");\n\n// Partition (split into true/false groups)\nMap<Boolean, List<User>> partitioned = users.stream()\n    .collect(partitioningBy(u -> u.getAge() >= 18));", CreatedAt: now, UpdatedAt: now},

		// ── Python / Flask / Sanic ──
		{ID: "def26", Title: "Flask REST API", Language: "python", Category: "Backend", Tags: []string{"python", "flask", "rest", "api"}, Description: "Flask REST API with blueprints, request parsing, error handling, and JSON responses.", Code: "from flask import Flask, Blueprint, request, jsonify\nfrom functools import wraps\n\napp = Flask(__name__)\napi = Blueprint('api', __name__, url_prefix='/api')\n\n# Error handler\n@app.errorhandler(404)\ndef not_found(e):\n    return jsonify(error='Not found'), 404\n\n@app.errorhandler(400)\ndef bad_request(e):\n    return jsonify(error=str(e.description)), 400\n\n# Auth decorator\ndef require_auth(f):\n    @wraps(f)\n    def decorated(*args, **kwargs):\n        token = request.headers.get('Authorization', '').replace('Bearer ', '')\n        if not token:\n            return jsonify(error='Unauthorized'), 401\n        # verify token...\n        return f(*args, **kwargs)\n    return decorated\n\n@api.route('/users', methods=['GET'])\n@require_auth\ndef get_users():\n    page = request.args.get('page', 1, type=int)\n    limit = request.args.get('limit', 20, type=int)\n    users = User.query.paginate(page=page, per_page=limit)\n    return jsonify(\n        data=[u.to_dict() for u in users.items],\n        total=users.total,\n        page=page\n    )\n\n@api.route('/users', methods=['POST'])\n@require_auth\ndef create_user():\n    data = request.get_json()\n    if not data or not data.get('email'):\n        return jsonify(error='Email is required'), 400\n    user = User(name=data['name'], email=data['email'])\n    db.session.add(user)\n    db.session.commit()\n    return jsonify(user.to_dict()), 201\n\n@api.route('/users/<int:user_id>', methods=['PUT'])\n@require_auth\ndef update_user(user_id):\n    user = User.query.get_or_404(user_id)\n    data = request.get_json()\n    user.name = data.get('name', user.name)\n    db.session.commit()\n    return jsonify(user.to_dict())\n\n@api.route('/users/<int:user_id>', methods=['DELETE'])\n@require_auth\ndef delete_user(user_id):\n    user = User.query.get_or_404(user_id)\n    db.session.delete(user)\n    db.session.commit()\n    return '', 204\n\napp.register_blueprint(api)\n\nif __name__ == '__main__':\n    app.run(debug=True, port=5000)", CreatedAt: now, UpdatedAt: now},
		{ID: "def27", Title: "Flask SQLAlchemy Model", Language: "python", Category: "Backend", Tags: []string{"python", "flask", "sqlalchemy", "model"}, Description: "Flask-SQLAlchemy model with relationships, serialization, and common patterns.", Code: "from flask_sqlalchemy import SQLAlchemy\nfrom datetime import datetime\n\ndb = SQLAlchemy()\n\nclass User(db.Model):\n    __tablename__ = 'users'\n\n    id = db.Column(db.Integer, primary_key=True)\n    name = db.Column(db.String(100), nullable=False)\n    email = db.Column(db.String(255), unique=True, nullable=False, index=True)\n    password_hash = db.Column(db.String(255), nullable=False)\n    active = db.Column(db.Boolean, default=True)\n    role = db.Column(db.String(20), default='user')\n    created_at = db.Column(db.DateTime, default=datetime.utcnow)\n    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)\n\n    # Relationships\n    orders = db.relationship('Order', backref='user', lazy='dynamic', cascade='all, delete-orphan')\n    profile = db.relationship('Profile', backref='user', uselist=False)\n\n    def to_dict(self):\n        return {\n            'id': self.id,\n            'name': self.name,\n            'email': self.email,\n            'active': self.active,\n            'role': self.role,\n            'created_at': self.created_at.isoformat(),\n        }\n\n    def __repr__(self):\n        return f'<User {self.email}>'\n\n\nclass Order(db.Model):\n    __tablename__ = 'orders'\n\n    id = db.Column(db.Integer, primary_key=True)\n    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)\n    amount = db.Column(db.Numeric(10, 2), nullable=False)\n    status = db.Column(db.String(20), default='pending')\n    created_at = db.Column(db.DateTime, default=datetime.utcnow)\n\n    items = db.relationship('OrderItem', backref='order', lazy='joined')", CreatedAt: now, UpdatedAt: now},
		{ID: "def28", Title: "Sanic Async API", Language: "python", Category: "Backend", Tags: []string{"python", "sanic", "async", "api"}, Description: "Sanic async web server with routes, middleware, request/response handling.", Code: "from sanic import Sanic, json, text\nfrom sanic.exceptions import NotFound, BadRequest\nfrom sanic import Blueprint\nimport aiohttp\n\napp = Sanic(\"MyApp\")\napi = Blueprint(\"api\", url_prefix=\"/api\")\n\n# Middleware\n@app.middleware('request')\nasync def log_request(request):\n    request.ctx.start_time = time.time()\n\n@app.middleware('response')\nasync def add_headers(request, response):\n    response.headers['X-Request-ID'] = str(uuid.uuid4())\n\n# Error handler\n@app.exception(NotFound)\nasync def handle_404(request, exception):\n    return json({'error': 'Not found'}, status=404)\n\n# Routes\n@api.get('/users')\nasync def get_users(request):\n    page = request.args.get('page', 1)\n    users = await User.filter(active=True).offset((int(page)-1)*20).limit(20)\n    return json({'data': [u.to_dict() for u in users]})\n\n@api.post('/users')\nasync def create_user(request):\n    data = request.json\n    if not data or not data.get('email'):\n        raise BadRequest('Email is required')\n    user = await User.create(**data)\n    return json(user.to_dict(), status=201)\n\n@api.get('/users/<user_id:int>')\nasync def get_user(request, user_id: int):\n    user = await User.get_or_none(id=user_id)\n    if not user:\n        raise NotFound('User not found')\n    return json(user.to_dict())\n\n@api.delete('/users/<user_id:int>')\nasync def delete_user(request, user_id: int):\n    deleted = await User.filter(id=user_id).delete()\n    if not deleted:\n        raise NotFound('User not found')\n    return text('', status=204)\n\n# External API call (async)\n@api.get('/external')\nasync def fetch_external(request):\n    async with aiohttp.ClientSession() as session:\n        async with session.get('https://api.example.com/data') as resp:\n            data = await resp.json()\n    return json(data)\n\napp.blueprint(api)\n\nif __name__ == '__main__':\n    app.run(host='0.0.0.0', port=8000, workers=4)", CreatedAt: now, UpdatedAt: now},

		// ── Go / Gin / Chi / Mux / GORM ──
		{ID: "def29", Title: "Go Gin REST API", Language: "go", Category: "Backend", Tags: []string{"go", "gin", "rest", "api"}, Description: "Gin router with route groups, middleware, JSON binding, and error handling.", Code: "package main\n\nimport (\n\t\"net/http\"\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tr := gin.Default()\n\n\t// Middleware\n\tr.Use(CORSMiddleware())\n\n\t// Route group\n\tapi := r.Group(\"/api\")\n\tapi.Use(AuthMiddleware())\n\t{\n\t\tapi.GET(\"/users\", getUsers)\n\t\tapi.GET(\"/users/:id\", getUserByID)\n\t\tapi.POST(\"/users\", createUser)\n\t\tapi.PUT(\"/users/:id\", updateUser)\n\t\tapi.DELETE(\"/users/:id\", deleteUser)\n\t}\n\n\tr.Run(\":8080\")\n}\n\ntype CreateUserInput struct {\n\tName  string `json:\"name\" binding:\"required,min=2\"`\n\tEmail string `json:\"email\" binding:\"required,email\"`\n}\n\nfunc getUsers(c *gin.Context) {\n\tpage := c.DefaultQuery(\"page\", \"1\")\n\tusers, err := userService.FindAll(page)\n\tif err != nil {\n\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": err.Error()})\n\t\treturn\n\t}\n\tc.JSON(http.StatusOK, gin.H{\"data\": users})\n}\n\nfunc getUserByID(c *gin.Context) {\n\tid := c.Param(\"id\")\n\tuser, err := userService.FindByID(id)\n\tif err != nil {\n\t\tc.JSON(http.StatusNotFound, gin.H{\"error\": \"User not found\"})\n\t\treturn\n\t}\n\tc.JSON(http.StatusOK, user)\n}\n\nfunc createUser(c *gin.Context) {\n\tvar input CreateUserInput\n\tif err := c.ShouldBindJSON(&input); err != nil {\n\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": err.Error()})\n\t\treturn\n\t}\n\tuser, err := userService.Create(input)\n\tif err != nil {\n\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": err.Error()})\n\t\treturn\n\t}\n\tc.JSON(http.StatusCreated, user)\n}\n\nfunc CORSMiddleware() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tc.Writer.Header().Set(\"Access-Control-Allow-Origin\", \"*\")\n\t\tc.Writer.Header().Set(\"Access-Control-Allow-Methods\", \"GET,POST,PUT,DELETE,OPTIONS\")\n\t\tc.Writer.Header().Set(\"Access-Control-Allow-Headers\", \"Content-Type,Authorization\")\n\t\tif c.Request.Method == \"OPTIONS\" {\n\t\t\tc.AbortWithStatus(204)\n\t\t\treturn\n\t\t}\n\t\tc.Next()\n\t}\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def30", Title: "Go Chi Router", Language: "go", Category: "Backend", Tags: []string{"go", "chi", "router", "rest"}, Description: "Chi router with middleware stack, route params, sub-routers, and context.", Code: "package main\n\nimport (\n\t\"encoding/json\"\n\t\"net/http\"\n\t\"github.com/go-chi/chi/v5\"\n\t\"github.com/go-chi/chi/v5/middleware\"\n)\n\nfunc main() {\n\tr := chi.NewRouter()\n\n\t// Middleware stack\n\tr.Use(middleware.Logger)\n\tr.Use(middleware.Recoverer)\n\tr.Use(middleware.RequestID)\n\tr.Use(middleware.RealIP)\n\tr.Use(middleware.Timeout(30 * time.Second))\n\n\t// Public routes\n\tr.Get(\"/health\", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Write([]byte(\"ok\"))\n\t})\n\n\t// Protected API routes\n\tr.Route(\"/api\", func(r chi.Router) {\n\t\tr.Use(AuthMiddleware)\n\n\t\tr.Route(\"/users\", func(r chi.Router) {\n\t\t\tr.Get(\"/\", listUsers)\n\t\t\tr.Post(\"/\", createUser)\n\n\t\t\tr.Route(\"/{userID}\", func(r chi.Router) {\n\t\t\t\tr.Get(\"/\", getUser)\n\t\t\t\tr.Put(\"/\", updateUser)\n\t\t\t\tr.Delete(\"/\", deleteUser)\n\t\t\t})\n\t\t})\n\t})\n\n\thttp.ListenAndServe(\":8080\", r)\n}\n\nfunc getUser(w http.ResponseWriter, r *http.Request) {\n\tuserID := chi.URLParam(r, \"userID\")\n\tuser, err := userRepo.FindByID(r.Context(), userID)\n\tif err != nil {\n\t\thttp.Error(w, `{\"error\":\"not found\"}`, http.StatusNotFound)\n\t\treturn\n\t}\n\tw.Header().Set(\"Content-Type\", \"application/json\")\n\tjson.NewEncoder(w).Encode(user)\n}\n\nfunc createUser(w http.ResponseWriter, r *http.Request) {\n\tvar input CreateUserRequest\n\tif err := json.NewDecoder(r.Body).Decode(&input); err != nil {\n\t\thttp.Error(w, `{\"error\":\"invalid json\"}`, http.StatusBadRequest)\n\t\treturn\n\t}\n\tuser, err := userRepo.Create(r.Context(), input)\n\tif err != nil {\n\t\thttp.Error(w, `{\"error\":\"`+err.Error()+`\"}`, http.StatusInternalServerError)\n\t\treturn\n\t}\n\tw.Header().Set(\"Content-Type\", \"application/json\")\n\tw.WriteHeader(http.StatusCreated)\n\tjson.NewEncoder(w).Encode(user)\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def31", Title: "Go Gorilla Mux Router", Language: "go", Category: "Backend", Tags: []string{"go", "mux", "gorilla", "router"}, Description: "Gorilla Mux with path variables, query params, method routing, and middleware.", Code: "package main\n\nimport (\n\t\"encoding/json\"\n\t\"log\"\n\t\"net/http\"\n\t\"github.com/gorilla/mux\"\n)\n\nfunc main() {\n\tr := mux.NewRouter()\n\n\t// Middleware\n\tr.Use(loggingMiddleware)\n\tr.Use(jsonContentType)\n\n\t// Subrouter with prefix\n\tapi := r.PathPrefix(\"/api/v1\").Subrouter()\n\tapi.HandleFunc(\"/users\", GetUsers).Methods(\"GET\")\n\tapi.HandleFunc(\"/users\", CreateUser).Methods(\"POST\")\n\tapi.HandleFunc(\"/users/{id:[0-9]+}\", GetUser).Methods(\"GET\")\n\tapi.HandleFunc(\"/users/{id:[0-9]+}\", UpdateUser).Methods(\"PUT\")\n\tapi.HandleFunc(\"/users/{id:[0-9]+}\", DeleteUser).Methods(\"DELETE\")\n\n\t// Static files\n\tr.PathPrefix(\"/static/\").Handler(http.StripPrefix(\"/static/\",\n\t\thttp.FileServer(http.Dir(\"./static\"))))\n\n\tlog.Println(\"Server running on :8080\")\n\tlog.Fatal(http.ListenAndServe(\":8080\", r))\n}\n\nfunc GetUser(w http.ResponseWriter, r *http.Request) {\n\tvars := mux.Vars(r)\n\tid := vars[\"id\"]\n\n\tuser, err := userRepo.FindByID(id)\n\tif err != nil {\n\t\tw.WriteHeader(http.StatusNotFound)\n\t\tjson.NewEncoder(w).Encode(map[string]string{\"error\": \"not found\"})\n\t\treturn\n\t}\n\tjson.NewEncoder(w).Encode(user)\n}\n\nfunc loggingMiddleware(next http.Handler) http.Handler {\n\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\n\t\tlog.Printf(\"%s %s\", r.Method, r.RequestURI)\n\t\tnext.ServeHTTP(w, r)\n\t})\n}\n\nfunc jsonContentType(next http.Handler) http.Handler {\n\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Header().Set(\"Content-Type\", \"application/json\")\n\t\tnext.ServeHTTP(w, r)\n\t})\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def32", Title: "GORM Model + CRUD", Language: "go", Category: "Backend", Tags: []string{"go", "gorm", "orm", "database"}, Description: "GORM model definition with CRUD operations, preloading, and transactions.", Code: "package main\n\nimport (\n\t\"gorm.io/driver/postgres\"\n\t\"gorm.io/gorm\"\n\t\"time\"\n)\n\n// Model\ntype User struct {\n\tID        uint           `gorm:\"primaryKey\" json:\"id\"`\n\tName      string         `gorm:\"size:100;not null\" json:\"name\"`\n\tEmail     string         `gorm:\"uniqueIndex;not null\" json:\"email\"`\n\tActive    bool           `gorm:\"default:true\" json:\"active\"`\n\tRole      string         `gorm:\"size:20;default:user\" json:\"role\"`\n\tOrders    []Order        `gorm:\"foreignKey:UserID\" json:\"orders,omitempty\"`\n\tCreatedAt time.Time      `json:\"created_at\"`\n\tUpdatedAt time.Time      `json:\"updated_at\"`\n\tDeletedAt gorm.DeletedAt `gorm:\"index\" json:\"-\"`\n}\n\ntype Order struct {\n\tID     uint    `gorm:\"primaryKey\" json:\"id\"`\n\tUserID uint    `json:\"user_id\"`\n\tAmount float64 `gorm:\"type:decimal(10,2)\" json:\"amount\"`\n\tStatus string  `gorm:\"size:20;default:pending\" json:\"status\"`\n}\n\n// Connect\nfunc connectDB() *gorm.DB {\n\tdsn := \"host=localhost user=postgres password=postgres dbname=myapp port=5432 sslmode=disable\"\n\tdb, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})\n\tif err != nil {\n\t\tpanic(\"failed to connect database\")\n\t}\n\tdb.AutoMigrate(&User{}, &Order{})\n\treturn db\n}\n\n// CRUD\nfunc CreateUser(db *gorm.DB, user *User) error {\n\treturn db.Create(user).Error\n}\n\nfunc GetUserByID(db *gorm.DB, id uint) (*User, error) {\n\tvar user User\n\terr := db.Preload(\"Orders\").First(&user, id).Error\n\treturn &user, err\n}\n\nfunc GetUsers(db *gorm.DB, page, limit int) ([]User, int64, error) {\n\tvar users []User\n\tvar total int64\n\tdb.Model(&User{}).Count(&total)\n\terr := db.Offset((page - 1) * limit).Limit(limit).Find(&users).Error\n\treturn users, total, err\n}\n\nfunc UpdateUser(db *gorm.DB, id uint, updates map[string]interface{}) error {\n\treturn db.Model(&User{}).Where(\"id = ?\", id).Updates(updates).Error\n}\n\nfunc DeleteUser(db *gorm.DB, id uint) error {\n\treturn db.Delete(&User{}, id).Error // soft delete\n}\n\n// Transaction\nfunc TransferOrder(db *gorm.DB, orderID, newUserID uint) error {\n\treturn db.Transaction(func(tx *gorm.DB) error {\n\t\tif err := tx.Model(&Order{}).Where(\"id = ?\", orderID).Update(\"user_id\", newUserID).Error; err != nil {\n\t\t\treturn err\n\t\t}\n\t\t// more operations...\n\t\treturn nil\n\t})\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def33", Title: "GORM Queries & Scopes", Language: "go", Category: "Backend", Tags: []string{"go", "gorm", "query", "scope"}, Description: "GORM advanced queries — Where, Joins, Scopes, Raw SQL, and batch operations.", Code: "package main\n\nimport \"gorm.io/gorm\"\n\n// Scopes (reusable query fragments)\nfunc Active(db *gorm.DB) *gorm.DB {\n\treturn db.Where(\"active = ?\", true)\n}\n\nfunc Paginate(page, limit int) func(db *gorm.DB) *gorm.DB {\n\treturn func(db *gorm.DB) *gorm.DB {\n\t\toffset := (page - 1) * limit\n\t\treturn db.Offset(offset).Limit(limit)\n\t}\n}\n\nfunc ByRole(role string) func(db *gorm.DB) *gorm.DB {\n\treturn func(db *gorm.DB) *gorm.DB {\n\t\treturn db.Where(\"role = ?\", role)\n\t}\n}\n\n// Usage with scopes\nvar users []User\ndb.Scopes(Active, ByRole(\"admin\"), Paginate(1, 20)).Find(&users)\n\n// Where conditions\ndb.Where(\"name LIKE ?\", \"%john%\").Find(&users)\ndb.Where(\"age BETWEEN ? AND ?\", 18, 65).Find(&users)\ndb.Where(\"role IN ?\", []string{\"admin\", \"moderator\"}).Find(&users)\ndb.Not(\"email = ?\", \"banned@example.com\").Find(&users)\n\n// Joins\ntype Result struct {\n\tUserName  string\n\tOrderCount int64\n\tTotalSpent float64\n}\nvar results []Result\ndb.Model(&User{}).\n\tSelect(\"users.name as user_name, COUNT(orders.id) as order_count, COALESCE(SUM(orders.amount), 0) as total_spent\").\n\tJoins(\"LEFT JOIN orders ON orders.user_id = users.id\").\n\tGroup(\"users.id\").\n\tHaving(\"COUNT(orders.id) > ?\", 0).\n\tScan(&results)\n\n// Upsert\ndb.Clauses(clause.OnConflict{\n\tColumns:   []clause.Column{{Name: \"email\"}},\n\tDoUpdates: clause.AssignmentColumns([]string{\"name\", \"updated_at\"}),\n}).Create(&users)\n\n// Batch insert\ndb.CreateInBatches(users, 100)", CreatedAt: now, UpdatedAt: now},

		// ── Angular ──
		{ID: "def34", Title: "Angular Component", Language: "typescript", Category: "Frontend", Tags: []string{"angular", "component", "lifecycle"}, Description: "Angular standalone component with input/output, lifecycle hooks, and template.", Code: "import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';\nimport { CommonModule } from '@angular/common';\n\ninterface User {\n  id: number;\n  name: string;\n  email: string;\n  active: boolean;\n}\n\n@Component({\n  selector: 'app-user-list',\n  standalone: true,\n  imports: [CommonModule],\n  template: `\n    <div class=\"user-list\">\n      <div *ngFor=\"let user of users; trackBy: trackById\"\n           class=\"user-card\"\n           [class.active]=\"user.id === selectedId\"\n           (click)=\"onSelect(user)\">\n        <h3>{{ user.name }}</h3>\n        <p>{{ user.email }}</p>\n        <span [class.badge-active]=\"user.active\">\n          {{ user.active ? 'Active' : 'Inactive' }}\n        </span>\n      </div>\n      <p *ngIf=\"users.length === 0\">No users found</p>\n    </div>\n  `,\n  styles: [`\n    .user-card { padding: 1rem; border: 1px solid #ddd; margin: 0.5rem 0; cursor: pointer; border-radius: 8px; }\n    .user-card.active { border-color: #0d6efd; background: #f0f7ff; }\n    .badge-active { color: green; font-weight: bold; }\n  `]\n})\nexport class UserListComponent implements OnInit, OnDestroy {\n  @Input() users: User[] = [];\n  @Input() selectedId: number | null = null;\n  @Output() userSelected = new EventEmitter<User>();\n\n  ngOnInit() {\n    console.log('Component initialized with', this.users.length, 'users');\n  }\n\n  ngOnDestroy() {\n    console.log('Component destroyed');\n  }\n\n  onSelect(user: User) {\n    this.userSelected.emit(user);\n  }\n\n  trackById(index: number, user: User): number {\n    return user.id;\n  }\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def35", Title: "Angular Service + HttpClient", Language: "typescript", Category: "Frontend", Tags: []string{"angular", "service", "http", "observable"}, Description: "Angular injectable service with HttpClient, error handling, and RxJS operators.", Code: "import { Injectable } from '@angular/core';\nimport { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';\nimport { Observable, throwError, BehaviorSubject } from 'rxjs';\nimport { map, catchError, retry, tap, shareReplay } from 'rxjs/operators';\n\nexport interface User {\n  id: number;\n  name: string;\n  email: string;\n}\n\nexport interface PaginatedResponse<T> {\n  data: T[];\n  total: number;\n  page: number;\n}\n\n@Injectable({ providedIn: 'root' })\nexport class UserService {\n  private readonly apiUrl = '/api/users';\n  private usersCache$ = new BehaviorSubject<User[]>([]);\n\n  constructor(private http: HttpClient) {}\n\n  getUsers(page = 1, limit = 20, search?: string): Observable<PaginatedResponse<User>> {\n    let params = new HttpParams()\n      .set('page', page.toString())\n      .set('limit', limit.toString());\n    if (search) params = params.set('search', search);\n\n    return this.http.get<PaginatedResponse<User>>(this.apiUrl, { params }).pipe(\n      tap(res => this.usersCache$.next(res.data)),\n      retry(1),\n      catchError(this.handleError)\n    );\n  }\n\n  getUserById(id: number): Observable<User> {\n    return this.http.get<User>(`${this.apiUrl}/${id}`).pipe(\n      catchError(this.handleError)\n    );\n  }\n\n  createUser(user: Partial<User>): Observable<User> {\n    return this.http.post<User>(this.apiUrl, user).pipe(\n      tap(newUser => {\n        const current = this.usersCache$.value;\n        this.usersCache$.next([newUser, ...current]);\n      }),\n      catchError(this.handleError)\n    );\n  }\n\n  updateUser(id: number, updates: Partial<User>): Observable<User> {\n    return this.http.put<User>(`${this.apiUrl}/${id}`, updates).pipe(\n      catchError(this.handleError)\n    );\n  }\n\n  deleteUser(id: number): Observable<void> {\n    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(\n      tap(() => {\n        const current = this.usersCache$.value.filter(u => u.id !== id);\n        this.usersCache$.next(current);\n      }),\n      catchError(this.handleError)\n    );\n  }\n\n  private handleError(error: HttpErrorResponse) {\n    let message = 'An error occurred';\n    if (error.error instanceof ErrorEvent) {\n      message = error.error.message;\n    } else {\n      message = `Error ${error.status}: ${error.error?.message || error.statusText}`;\n    }\n    console.error(message);\n    return throwError(() => new Error(message));\n  }\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def36", Title: "Angular Reactive Form", Language: "typescript", Category: "Frontend", Tags: []string{"angular", "form", "reactive", "validation"}, Description: "Angular reactive form with FormBuilder, validators, custom validation, and submit.", Code: "import { Component } from '@angular/core';\nimport { CommonModule } from '@angular/common';\nimport { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';\n\n@Component({\n  selector: 'app-user-form',\n  standalone: true,\n  imports: [CommonModule, ReactiveFormsModule],\n  template: `\n    <form [formGroup]=\"form\" (ngSubmit)=\"onSubmit()\">\n      <div class=\"mb-3\">\n        <label class=\"form-label\">Name</label>\n        <input formControlName=\"name\" class=\"form-control\"\n               [class.is-invalid]=\"isInvalid('name')\">\n        <div class=\"invalid-feedback\" *ngIf=\"isInvalid('name')\">\n          <span *ngIf=\"form.get('name')?.errors?.['required']\">Name is required</span>\n          <span *ngIf=\"form.get('name')?.errors?.['minlength']\">Min 2 characters</span>\n        </div>\n      </div>\n\n      <div class=\"mb-3\">\n        <label class=\"form-label\">Email</label>\n        <input formControlName=\"email\" type=\"email\" class=\"form-control\"\n               [class.is-invalid]=\"isInvalid('email')\">\n        <div class=\"invalid-feedback\" *ngIf=\"isInvalid('email')\">Enter a valid email</div>\n      </div>\n\n      <div class=\"mb-3\">\n        <label class=\"form-label\">Password</label>\n        <input formControlName=\"password\" type=\"password\" class=\"form-control\"\n               [class.is-invalid]=\"isInvalid('password')\">\n        <div class=\"invalid-feedback\" *ngIf=\"isInvalid('password')\">\n          <span *ngIf=\"form.get('password')?.errors?.['required']\">Password is required</span>\n          <span *ngIf=\"form.get('password')?.errors?.['minlength']\">Min 8 characters</span>\n        </div>\n      </div>\n\n      <div class=\"mb-3\">\n        <label class=\"form-label\">Confirm Password</label>\n        <input formControlName=\"confirmPassword\" type=\"password\" class=\"form-control\"\n               [class.is-invalid]=\"isInvalid('confirmPassword')\">\n        <div class=\"invalid-feedback\" *ngIf=\"form.errors?.['passwordMismatch']\">Passwords do not match</div>\n      </div>\n\n      <div class=\"mb-3\">\n        <label class=\"form-label\">Role</label>\n        <select formControlName=\"role\" class=\"form-select\">\n          <option value=\"user\">User</option>\n          <option value=\"admin\">Admin</option>\n          <option value=\"moderator\">Moderator</option>\n        </select>\n      </div>\n\n      <button type=\"submit\" class=\"btn btn-primary\" [disabled]=\"form.invalid || submitting\">\n        {{ submitting ? 'Saving...' : 'Save' }}\n      </button>\n    </form>\n  `\n})\nexport class UserFormComponent {\n  form: FormGroup;\n  submitting = false;\n\n  constructor(private fb: FormBuilder) {\n    this.form = this.fb.group({\n      name: ['', [Validators.required, Validators.minLength(2)]],\n      email: ['', [Validators.required, Validators.email]],\n      password: ['', [Validators.required, Validators.minLength(8)]],\n      confirmPassword: ['', Validators.required],\n      role: ['user'],\n    }, { validators: this.passwordMatchValidator });\n  }\n\n  passwordMatchValidator(g: AbstractControl) {\n    const pw = g.get('password')?.value;\n    const cpw = g.get('confirmPassword')?.value;\n    return pw === cpw ? null : { passwordMismatch: true };\n  }\n\n  isInvalid(field: string): boolean {\n    const control = this.form.get(field);\n    return !!(control?.invalid && (control.dirty || control.touched));\n  }\n\n  onSubmit() {\n    if (this.form.invalid) return;\n    this.submitting = true;\n    const { confirmPassword, ...data } = this.form.value;\n    console.log('Submit:', data);\n    // call API...\n  }\n}", CreatedAt: now, UpdatedAt: now},

		// ── React / Next.js ──
		{ID: "def37", Title: "React Custom Hook (useFetch)", Language: "typescript", Category: "Frontend", Tags: []string{"react", "hook", "custom", "fetch"}, Description: "Reusable custom hook for data fetching with loading, error, and refetch.", Code: "import { useState, useEffect, useCallback } from 'react';\n\ninterface UseFetchResult<T> {\n  data: T | null;\n  loading: boolean;\n  error: string | null;\n  refetch: () => void;\n}\n\nexport function useFetch<T>(url: string, options?: RequestInit): UseFetchResult<T> {\n  const [data, setData] = useState<T | null>(null);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState<string | null>(null);\n\n  const fetchData = useCallback(async () => {\n    setLoading(true);\n    setError(null);\n    try {\n      const res = await fetch(url, options);\n      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);\n      const json = await res.json();\n      setData(json);\n    } catch (err: any) {\n      setError(err.message);\n    } finally {\n      setLoading(false);\n    }\n  }, [url]);\n\n  useEffect(() => {\n    fetchData();\n  }, [fetchData]);\n\n  return { data, loading, error, refetch: fetchData };\n}\n\n// Usage:\n// function UserList() {\n//   const { data: users, loading, error, refetch } = useFetch<User[]>('/api/users');\n//   if (loading) return <Spinner />;\n//   if (error) return <Alert message={error} />;\n//   return <ul>{users?.map(u => <li key={u.id}>{u.name}</li>)}</ul>;\n// }", CreatedAt: now, UpdatedAt: now},
		{ID: "def38", Title: "Next.js App Router API Route", Language: "typescript", Category: "Backend", Tags: []string{"nextjs", "api", "route", "app router"}, Description: "Next.js App Router route handlers — GET, POST, dynamic params, middleware.", Code: "// app/api/users/route.ts\nimport { NextRequest, NextResponse } from 'next/server';\n\nexport async function GET(request: NextRequest) {\n  const { searchParams } = new URL(request.url);\n  const page = Number(searchParams.get('page') || '1');\n  const limit = Number(searchParams.get('limit') || '20');\n\n  try {\n    const users = await db.user.findMany({\n      skip: (page - 1) * limit,\n      take: limit,\n      orderBy: { createdAt: 'desc' },\n    });\n    const total = await db.user.count();\n    return NextResponse.json({ data: users, total, page });\n  } catch (error) {\n    return NextResponse.json({ error: 'Internal error' }, { status: 500 });\n  }\n}\n\nexport async function POST(request: NextRequest) {\n  try {\n    const body = await request.json();\n    const { name, email } = body;\n    if (!email) {\n      return NextResponse.json({ error: 'Email is required' }, { status: 400 });\n    }\n    const user = await db.user.create({ data: { name, email } });\n    return NextResponse.json(user, { status: 201 });\n  } catch (error: any) {\n    if (error.code === 'P2002') {\n      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });\n    }\n    return NextResponse.json({ error: 'Internal error' }, { status: 500 });\n  }\n}\n\n// app/api/users/[id]/route.ts\nexport async function GET(\n  request: NextRequest,\n  { params }: { params: { id: string } }\n) {\n  const user = await db.user.findUnique({ where: { id: params.id } });\n  if (!user) {\n    return NextResponse.json({ error: 'Not found' }, { status: 404 });\n  }\n  return NextResponse.json(user);\n}\n\nexport async function DELETE(\n  request: NextRequest,\n  { params }: { params: { id: string } }\n) {\n  await db.user.delete({ where: { id: params.id } });\n  return new NextResponse(null, { status: 204 });\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def39", Title: "Next.js Server Component", Language: "typescript", Category: "Frontend", Tags: []string{"nextjs", "server component", "rsc", "async"}, Description: "Next.js App Router server component with async data fetching, suspense, and error boundary.", Code: "// app/users/page.tsx — Server Component (default in App Router)\nimport { Suspense } from 'react';\nimport { notFound } from 'next/navigation';\n\ninterface User {\n  id: string;\n  name: string;\n  email: string;\n}\n\n// Runs on the server — no useState, no useEffect needed\nasync function getUsers(search?: string): Promise<User[]> {\n  const url = new URL('/api/users', process.env.API_URL);\n  if (search) url.searchParams.set('search', search);\n\n  const res = await fetch(url.toString(), {\n    next: { revalidate: 60 }, // ISR: revalidate every 60s\n  });\n  if (!res.ok) throw new Error('Failed to fetch users');\n  const { data } = await res.json();\n  return data;\n}\n\n// Page component\nexport default async function UsersPage({\n  searchParams,\n}: {\n  searchParams: { search?: string };\n}) {\n  const users = await getUsers(searchParams.search);\n\n  return (\n    <div>\n      <h1>Users</h1>\n      <Suspense fallback={<div>Loading...</div>}>\n        <UserList users={users} />\n      </Suspense>\n    </div>\n  );\n}\n\nfunction UserList({ users }: { users: User[] }) {\n  if (users.length === 0) return <p>No users found</p>;\n\n  return (\n    <ul>\n      {users.map(user => (\n        <li key={user.id}>\n          <a href={`/users/${user.id}`}>{user.name}</a>\n          <span className=\"text-muted\"> — {user.email}</span>\n        </li>\n      ))}\n    </ul>\n  );\n}\n\n// app/users/[id]/page.tsx\nexport default async function UserDetailPage({ params }: { params: { id: string } }) {\n  const res = await fetch(`${process.env.API_URL}/api/users/${params.id}`);\n  if (!res.ok) notFound();\n  const user: User = await res.json();\n\n  return (\n    <div>\n      <h1>{user.name}</h1>\n      <p>{user.email}</p>\n    </div>\n  );\n}\n\n// Metadata\nexport const metadata = { title: 'Users' };", CreatedAt: now, UpdatedAt: now},
		{ID: "def40", Title: "Next.js Middleware", Language: "typescript", Category: "Backend", Tags: []string{"nextjs", "middleware", "auth", "redirect"}, Description: "Next.js middleware for auth check, redirect, rewrite, and request headers.", Code: "// middleware.ts (root of project)\nimport { NextRequest, NextResponse } from 'next/server';\n\nconst publicPaths = ['/login', '/register', '/api/auth'];\n\nexport function middleware(request: NextRequest) {\n  const { pathname } = request.nextUrl;\n\n  // Skip public paths\n  if (publicPaths.some(p => pathname.startsWith(p))) {\n    return NextResponse.next();\n  }\n\n  // Skip static files\n  if (pathname.startsWith('/_next') || pathname.includes('.')) {\n    return NextResponse.next();\n  }\n\n  // Check auth token\n  const token = request.cookies.get('auth-token')?.value;\n  if (!token) {\n    const loginUrl = new URL('/login', request.url);\n    loginUrl.searchParams.set('redirect', pathname);\n    return NextResponse.redirect(loginUrl);\n  }\n\n  // Add custom headers\n  const response = NextResponse.next();\n  response.headers.set('X-Request-ID', crypto.randomUUID());\n\n  // Rewrite example: /blog/hello → /posts/hello\n  if (pathname.startsWith('/blog/')) {\n    return NextResponse.rewrite(new URL(pathname.replace('/blog/', '/posts/'), request.url));\n  }\n\n  return response;\n}\n\n// Only run on matching paths\nexport const config = {\n  matcher: [\n    // Match all paths except static files\n    '/((?!_next/static|_next/image|favicon.ico).*)',\n  ],\n};", CreatedAt: now, UpdatedAt: now},

		// ── HTML5 ──
		{ID: "def41", Title: "HTML5 Semantic Template", Language: "html", Category: "Frontend", Tags: []string{"html5", "semantic", "template", "responsive"}, Description: "HTML5 boilerplate with semantic tags, meta tags, responsive viewport, Open Graph.", Code: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <meta name=\"description\" content=\"Page description for SEO (150-160 chars)\">\n    <meta name=\"author\" content=\"Your Name\">\n\n    <!-- Open Graph -->\n    <meta property=\"og:title\" content=\"Page Title\">\n    <meta property=\"og:description\" content=\"Page description\">\n    <meta property=\"og:image\" content=\"https://example.com/image.png\">\n    <meta property=\"og:url\" content=\"https://example.com\">\n    <meta property=\"og:type\" content=\"website\">\n\n    <!-- Favicon -->\n    <link rel=\"icon\" type=\"image/svg+xml\" href=\"/favicon.svg\">\n    <link rel=\"apple-touch-icon\" href=\"/apple-touch-icon.png\">\n\n    <title>Page Title</title>\n    <link rel=\"stylesheet\" href=\"/css/style.css\">\n</head>\n<body>\n    <header>\n        <nav aria-label=\"Main navigation\">\n            <a href=\"/\" aria-label=\"Home\">Logo</a>\n            <ul>\n                <li><a href=\"/about\">About</a></li>\n                <li><a href=\"/contact\">Contact</a></li>\n            </ul>\n        </nav>\n    </header>\n\n    <main>\n        <article>\n            <h1>Main Heading</h1>\n            <p>Content goes here...</p>\n\n            <section>\n                <h2>Section Title</h2>\n                <figure>\n                    <img src=\"/img/photo.jpg\" alt=\"Descriptive alt text\"\n                         loading=\"lazy\" width=\"800\" height=\"600\">\n                    <figcaption>Image caption</figcaption>\n                </figure>\n            </section>\n        </article>\n\n        <aside>\n            <h2>Related</h2>\n            <nav aria-label=\"Related links\">\n                <ul>\n                    <li><a href=\"#\">Related Link 1</a></li>\n                </ul>\n            </nav>\n        </aside>\n    </main>\n\n    <footer>\n        <p>&copy; 2025 Your Name. All rights reserved.</p>\n    </footer>\n\n    <script src=\"/js/app.js\" defer></script>\n</body>\n</html>", CreatedAt: now, UpdatedAt: now},
		{ID: "def42", Title: "HTML5 Form with Validation", Language: "html", Category: "Frontend", Tags: []string{"html5", "form", "validation", "input"}, Description: "HTML5 form with native validation, input types, pattern, datalist, and accessibility.", Code: "<form id=\"userForm\" novalidate>\n    <fieldset>\n        <legend>User Registration</legend>\n\n        <div class=\"form-group\">\n            <label for=\"name\">Full Name *</label>\n            <input type=\"text\" id=\"name\" name=\"name\" required\n                   minlength=\"2\" maxlength=\"100\"\n                   placeholder=\"John Doe\"\n                   autocomplete=\"name\">\n        </div>\n\n        <div class=\"form-group\">\n            <label for=\"email\">Email *</label>\n            <input type=\"email\" id=\"email\" name=\"email\" required\n                   placeholder=\"john@example.com\"\n                   autocomplete=\"email\">\n        </div>\n\n        <div class=\"form-group\">\n            <label for=\"phone\">Phone</label>\n            <input type=\"tel\" id=\"phone\" name=\"phone\"\n                   pattern=\"[+]?[0-9]{10,15}\"\n                   placeholder=\"+1234567890\"\n                   autocomplete=\"tel\">\n        </div>\n\n        <div class=\"form-group\">\n            <label for=\"password\">Password *</label>\n            <input type=\"password\" id=\"password\" name=\"password\" required\n                   minlength=\"8\"\n                   pattern=\"(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}\"\n                   title=\"Min 8 chars with uppercase, lowercase, and number\"\n                   autocomplete=\"new-password\">\n        </div>\n\n        <div class=\"form-group\">\n            <label for=\"dob\">Date of Birth</label>\n            <input type=\"date\" id=\"dob\" name=\"dob\"\n                   min=\"1900-01-01\" max=\"2010-12-31\">\n        </div>\n\n        <div class=\"form-group\">\n            <label for=\"website\">Website</label>\n            <input type=\"url\" id=\"website\" name=\"website\"\n                   placeholder=\"https://example.com\">\n        </div>\n\n        <div class=\"form-group\">\n            <label for=\"role\">Role *</label>\n            <select id=\"role\" name=\"role\" required>\n                <option value=\"\">Select role...</option>\n                <option value=\"developer\">Developer</option>\n                <option value=\"designer\">Designer</option>\n                <option value=\"manager\">Manager</option>\n            </select>\n        </div>\n\n        <div class=\"form-group\">\n            <label for=\"framework\">Framework</label>\n            <input type=\"text\" id=\"framework\" name=\"framework\" list=\"frameworks\">\n            <datalist id=\"frameworks\">\n                <option value=\"Angular\">\n                <option value=\"React\">\n                <option value=\"Vue\">\n                <option value=\"Svelte\">\n                <option value=\"Next.js\">\n            </datalist>\n        </div>\n\n        <div class=\"form-group\">\n            <label for=\"bio\">Bio</label>\n            <textarea id=\"bio\" name=\"bio\" rows=\"4\" maxlength=\"500\"\n                      placeholder=\"Tell us about yourself...\"></textarea>\n        </div>\n\n        <div class=\"form-group\">\n            <label>\n                <input type=\"checkbox\" name=\"terms\" required>\n                I agree to the <a href=\"/terms\">Terms of Service</a>\n            </label>\n        </div>\n\n        <button type=\"submit\">Register</button>\n    </fieldset>\n</form>\n\n<script>\ndocument.getElementById('userForm').addEventListener('submit', (e) => {\n    e.preventDefault();\n    const form = e.target;\n    if (!form.checkValidity()) {\n        form.reportValidity();\n        return;\n    }\n    const data = Object.fromEntries(new FormData(form));\n    console.log('Submit:', data);\n});\n</script>", CreatedAt: now, UpdatedAt: now},
		{ID: "def43", Title: "React Form with Validation", Language: "typescript", Category: "Frontend", Tags: []string{"react", "form", "state", "validation"}, Description: "React controlled form with useState, validation, and submit handling.", Code: "import { useState, FormEvent, ChangeEvent } from 'react';\n\ninterface FormData {\n  name: string;\n  email: string;\n  role: string;\n  message: string;\n}\n\ninterface FormErrors {\n  name?: string;\n  email?: string;\n  role?: string;\n}\n\nexport function ContactForm() {\n  const [form, setForm] = useState<FormData>({\n    name: '', email: '', role: '', message: '',\n  });\n  const [errors, setErrors] = useState<FormErrors>({});\n  const [submitting, setSubmitting] = useState(false);\n  const [success, setSuccess] = useState(false);\n\n  function validate(): FormErrors {\n    const errs: FormErrors = {};\n    if (!form.name.trim()) errs.name = 'Name is required';\n    if (!form.email.match(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/)) errs.email = 'Invalid email';\n    if (!form.role) errs.role = 'Please select a role';\n    return errs;\n  }\n\n  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {\n    const { name, value } = e.target;\n    setForm(prev => ({ ...prev, [name]: value }));\n    if (errors[name as keyof FormErrors]) {\n      setErrors(prev => ({ ...prev, [name]: undefined }));\n    }\n  }\n\n  async function handleSubmit(e: FormEvent) {\n    e.preventDefault();\n    const errs = validate();\n    if (Object.keys(errs).length > 0) {\n      setErrors(errs);\n      return;\n    }\n    setSubmitting(true);\n    try {\n      const res = await fetch('/api/contact', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(form),\n      });\n      if (!res.ok) throw new Error('Submit failed');\n      setSuccess(true);\n      setForm({ name: '', email: '', role: '', message: '' });\n    } catch (err) {\n      setErrors({ name: 'Failed to submit. Please try again.' });\n    } finally {\n      setSubmitting(false);\n    }\n  }\n\n  if (success) return <p className=\"text-success\">Thank you! Message sent.</p>;\n\n  return (\n    <form onSubmit={handleSubmit} noValidate>\n      <div>\n        <label htmlFor=\"name\">Name *</label>\n        <input id=\"name\" name=\"name\" value={form.name} onChange={handleChange}\n               className={errors.name ? 'is-invalid' : ''} />\n        {errors.name && <span className=\"error\">{errors.name}</span>}\n      </div>\n      <div>\n        <label htmlFor=\"email\">Email *</label>\n        <input id=\"email\" name=\"email\" type=\"email\" value={form.email}\n               onChange={handleChange} className={errors.email ? 'is-invalid' : ''} />\n        {errors.email && <span className=\"error\">{errors.email}</span>}\n      </div>\n      <div>\n        <label htmlFor=\"role\">Role *</label>\n        <select id=\"role\" name=\"role\" value={form.role} onChange={handleChange}>\n          <option value=\"\">Select...</option>\n          <option value=\"developer\">Developer</option>\n          <option value=\"designer\">Designer</option>\n        </select>\n        {errors.role && <span className=\"error\">{errors.role}</span>}\n      </div>\n      <div>\n        <label htmlFor=\"message\">Message</label>\n        <textarea id=\"message\" name=\"message\" value={form.message}\n                  onChange={handleChange} rows={4} />\n      </div>\n      <button type=\"submit\" disabled={submitting}>\n        {submitting ? 'Sending...' : 'Send'}\n      </button>\n    </form>\n  );\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def44", Title: "Hibernate Criteria Query", Language: "java", Category: "Backend", Tags: []string{"java", "hibernate", "criteria", "query"}, Description: "Hibernate CriteriaBuilder — dynamic queries, joins, aggregates, and pagination.", Code: "import jakarta.persistence.*;\nimport jakarta.persistence.criteria.*;\nimport java.util.List;\n\npublic class UserRepository {\n\n    @PersistenceContext\n    private EntityManager em;\n\n    // Dynamic search with CriteriaBuilder\n    public List<User> search(String name, String role, Boolean active, int page, int size) {\n        CriteriaBuilder cb = em.getCriteriaBuilder();\n        CriteriaQuery<User> cq = cb.createQuery(User.class);\n        Root<User> root = cq.from(User.class);\n\n        // Dynamic predicates\n        List<Predicate> predicates = new ArrayList<>();\n        if (name != null && !name.isBlank()) {\n            predicates.add(cb.like(cb.lower(root.get(\"name\")), \"%\" + name.toLowerCase() + \"%\"));\n        }\n        if (role != null) {\n            predicates.add(cb.equal(root.get(\"role\"), role));\n        }\n        if (active != null) {\n            predicates.add(cb.equal(root.get(\"active\"), active));\n        }\n\n        cq.where(predicates.toArray(new Predicate[0]));\n        cq.orderBy(cb.desc(root.get(\"createdAt\")));\n\n        return em.createQuery(cq)\n                .setFirstResult((page - 1) * size)\n                .setMaxResults(size)\n                .getResultList();\n    }\n\n    // Count for pagination\n    public long count(String name, String role) {\n        CriteriaBuilder cb = em.getCriteriaBuilder();\n        CriteriaQuery<Long> cq = cb.createQuery(Long.class);\n        Root<User> root = cq.from(User.class);\n        cq.select(cb.count(root));\n\n        List<Predicate> predicates = new ArrayList<>();\n        if (name != null) predicates.add(cb.like(cb.lower(root.get(\"name\")), \"%\" + name.toLowerCase() + \"%\"));\n        if (role != null) predicates.add(cb.equal(root.get(\"role\"), role));\n        cq.where(predicates.toArray(new Predicate[0]));\n\n        return em.createQuery(cq).getSingleResult();\n    }\n\n    // Join + aggregate\n    public List<Object[]> getOrderSummaryPerUser() {\n        CriteriaBuilder cb = em.getCriteriaBuilder();\n        CriteriaQuery<Object[]> cq = cb.createQuery(Object[].class);\n        Root<User> user = cq.from(User.class);\n        Join<User, Order> orders = user.join(\"orders\", JoinType.LEFT);\n\n        cq.multiselect(\n            user.get(\"name\"),\n            cb.count(orders.get(\"id\")),\n            cb.coalesce(cb.sum(orders.get(\"amount\")), 0)\n        );\n        cq.groupBy(user.get(\"id\"), user.get(\"name\"));\n        cq.having(cb.gt(cb.count(orders.get(\"id\")), 0));\n        cq.orderBy(cb.desc(cb.sum(orders.get(\"amount\"))));\n\n        return em.createQuery(cq).getResultList();\n    }\n}", CreatedAt: now, UpdatedAt: now},
		{ID: "def45", Title: "Spring Boot Exception Handler", Language: "java", Category: "Backend", Tags: []string{"java", "spring", "exception", "error"}, Description: "Global exception handler with @ControllerAdvice, custom exceptions, and error response DTO.", Code: "import org.springframework.http.HttpStatus;\nimport org.springframework.http.ResponseEntity;\nimport org.springframework.web.bind.MethodArgumentNotValidException;\nimport org.springframework.web.bind.annotation.*;\nimport java.time.LocalDateTime;\nimport java.util.Map;\nimport java.util.stream.Collectors;\n\n// Error response DTO\npublic record ErrorResponse(\n    int status,\n    String error,\n    String message,\n    LocalDateTime timestamp\n) {\n    public static ErrorResponse of(HttpStatus status, String message) {\n        return new ErrorResponse(status.value(), status.getReasonPhrase(), message, LocalDateTime.now());\n    }\n}\n\n// Custom exceptions\npublic class ResourceNotFoundException extends RuntimeException {\n    public ResourceNotFoundException(String resource, Object id) {\n        super(resource + \" not found with id: \" + id);\n    }\n}\n\npublic class BusinessException extends RuntimeException {\n    private final HttpStatus status;\n    public BusinessException(String message, HttpStatus status) {\n        super(message);\n        this.status = status;\n    }\n    public HttpStatus getStatus() { return status; }\n}\n\n// Global handler\n@RestControllerAdvice\npublic class GlobalExceptionHandler {\n\n    @ExceptionHandler(ResourceNotFoundException.class)\n    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {\n        return ResponseEntity.status(HttpStatus.NOT_FOUND)\n                .body(ErrorResponse.of(HttpStatus.NOT_FOUND, ex.getMessage()));\n    }\n\n    @ExceptionHandler(BusinessException.class)\n    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException ex) {\n        return ResponseEntity.status(ex.getStatus())\n                .body(ErrorResponse.of(ex.getStatus(), ex.getMessage()));\n    }\n\n    @ExceptionHandler(MethodArgumentNotValidException.class)\n    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {\n        Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()\n                .collect(Collectors.toMap(\n                        e -> e.getField(),\n                        e -> e.getDefaultMessage() != null ? e.getDefaultMessage() : \"Invalid\",\n                        (a, b) -> a\n                ));\n        return ResponseEntity.badRequest().body(Map.of(\n                \"status\", 400,\n                \"error\", \"Validation Failed\",\n                \"fields\", fieldErrors,\n                \"timestamp\", LocalDateTime.now()\n        ));\n    }\n\n    @ExceptionHandler(Exception.class)\n    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {\n        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)\n                .body(ErrorResponse.of(HttpStatus.INTERNAL_SERVER_ERROR, \"An unexpected error occurred\"));\n    }\n}\n\n// Usage in controller:\n// throw new ResourceNotFoundException(\"User\", userId);\n// throw new BusinessException(\"Email already registered\", HttpStatus.CONFLICT);", CreatedAt: now, UpdatedAt: now},
	}

	saveSnippets(defaults)
}

// ── Hash Generator handler ──

func handleHashPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("hash")
	loadPage("hash.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Color Picker handler ──

func handleColorPickerPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("colorpicker")
	loadPage("colorpicker.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Cron Parser handler ──

func handleCronPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("cron")
	loadPage("cron.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Password Generator handler ──

func handlePasswordPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("password")
	loadPage("password.html").ExecuteTemplate(w, "layout.html", data)
}

// ── QR Code Generator handler ──

func handleQRCodePage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("qrcode")
	loadPage("qrcode.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Lorem Ipsum Generator handler ──

func handleLoremPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("lorem")
	loadPage("lorem.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Number Base Converter handler ──

func handleBaseConverterPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("baseconverter")
	loadPage("baseconverter.html").ExecuteTemplate(w, "layout.html", data)
}

// ── JSON ↔ YAML Converter handler ──

func handleJSON2YAMLPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("json2yaml")
	loadPage("json2yaml.html").ExecuteTemplate(w, "layout.html", data)
}

// ── HTTP Client handler ──

func handleHTTPClientPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("httpclient")
	loadPage("httpclient.html").ExecuteTemplate(w, "layout.html", data)
}

// ── String Utilities handler ──

func handleStringUtilsPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("stringutils")
	loadPage("stringutils.html").ExecuteTemplate(w, "layout.html", data)
}

// POST /api/httpclient — proxy HTTP requests (mini Postman backend)
func handleAPIHTTPClient(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Method  string            `json:"method"`
		URL     string            `json:"url"`
		Headers map[string]string `json:"headers"`
		Body    string            `json:"body"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	parsed, err := url.Parse(req.URL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		http.Error(w, "Only http/https URLs supported", http.StatusBadRequest)
		return
	}

	if req.Method == "" {
		req.Method = "GET"
	}

	httpReq, err := http.NewRequest(req.Method, req.URL, strings.NewReader(req.Body))
	if err != nil {
		http.Error(w, "Failed to create request: "+err.Error(), http.StatusBadRequest)
		return
	}

	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	start := time.Now()
	resp, err := client.Do(httpReq)
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":     err.Error(),
			"elapsedMs": elapsed,
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 10<<20))

	respHeaders := make(map[string]string)
	for k := range resp.Header {
		respHeaders[k] = resp.Header.Get(k)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     resp.StatusCode,
		"statusText": resp.Status,
		"headers":    respHeaders,
		"body":       string(body),
		"elapsedMs":  elapsed,
		"size":       len(body),
	})
}

// ── LAN Chat (SSE) ──

type ChatMessage struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	Message     string `json:"message"`
	Type        string `json:"type"` // "user" or "system"
	Timestamp   string `json:"timestamp"`
	FileURL     string `json:"fileUrl,omitempty"`
	FileName    string `json:"fileName,omitempty"`
	FileIsImage bool   `json:"fileIsImage,omitempty"`
}

type ChatClient struct {
	username string
	ch       chan ChatMessage
}

type ChatHub struct {
	mu       sync.Mutex
	messages []ChatMessage
	clients  map[*ChatClient]bool
	maxMsgs  int
	counter  int64
}

func newChatHub() *ChatHub {
	return &ChatHub{
		clients: make(map[*ChatClient]bool),
		maxMsgs: 200,
	}
}

func (h *ChatHub) addClient(username string) *ChatClient {
	h.mu.Lock()
	defer h.mu.Unlock()

	c := &ChatClient{
		username: username,
		ch:       make(chan ChatMessage, 32),
	}
	h.clients[c] = true

	// Broadcast system message
	h.broadcastLocked(ChatMessage{
		ID:        h.nextID(),
		Username:  username,
		Message:   username + " joined the chat",
		Type:      "system",
		Timestamp: time.Now().Format(time.RFC3339Nano),
	})

	return c
}

func (h *ChatHub) removeClient(c *ChatClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[c]; !ok {
		return
	}
	delete(h.clients, c)
	close(c.ch)

	h.broadcastLocked(ChatMessage{
		ID:        h.nextID(),
		Username:  c.username,
		Message:   c.username + " left the chat",
		Type:      "system",
		Timestamp: time.Now().Format(time.RFC3339Nano),
	})
}

func (h *ChatHub) broadcast(msg ChatMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.broadcastLocked(msg)
}

func (h *ChatHub) broadcastLocked(msg ChatMessage) {
	// Store in history
	h.messages = append(h.messages, msg)
	if len(h.messages) > h.maxMsgs {
		h.messages = h.messages[len(h.messages)-h.maxMsgs:]
	}

	// Send to all clients (non-blocking)
	for c := range h.clients {
		select {
		case c.ch <- msg:
		default:
			// Slow client, skip
		}
	}
}

func (h *ChatHub) getHistory() []ChatMessage {
	h.mu.Lock()
	defer h.mu.Unlock()
	cp := make([]ChatMessage, len(h.messages))
	copy(cp, h.messages)
	return cp
}

func (h *ChatHub) getOnlineUsers() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	seen := make(map[string]bool)
	var users []string
	for c := range h.clients {
		if !seen[c.username] {
			seen[c.username] = true
			users = append(users, c.username)
		}
	}
	if users == nil {
		users = []string{}
	}
	return users
}

func (h *ChatHub) nextID() string {
	h.counter++
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), h.counter)
}

var chatHub = newChatHub()

func handleChatPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("chat")
	loadPage("chat.html").ExecuteTemplate(w, "layout.html", data)
}

// GET /api/chat/stream?username=X — SSE endpoint
func handleAPIChatStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	username := r.URL.Query().Get("username")
	if username == "" {
		http.Error(w, "username required", http.StatusBadRequest)
		return
	}

	// Limit username length
	if len(username) > 30 {
		username = username[:30]
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	// Send history first
	history := chatHub.getHistory()
	for _, msg := range history {
		data, _ := json.Marshal(msg)
		fmt.Fprintf(w, "event: message\ndata: %s\n\n", data)
	}

	// Send online users
	users := chatHub.getOnlineUsers()
	usersJSON, _ := json.Marshal(users)
	fmt.Fprintf(w, "event: online\ndata: %s\n\n", usersJSON)
	flusher.Flush()

	// Register client
	client := chatHub.addClient(username)
	defer chatHub.removeClient(client)

	// Send updated online list to all (via a goroutine to avoid deadlock)
	go func() {
		time.Sleep(50 * time.Millisecond)
		broadcastOnlineUsers()
	}()

	// Keep-alive ticker
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	ctx := r.Context()

	for {
		select {
		case <-ctx.Done():
			go func() {
				time.Sleep(50 * time.Millisecond)
				broadcastOnlineUsers()
			}()
			return
		case msg, ok := <-client.ch:
			if !ok {
				return
			}
			if msg.Type == "_online" {
				fmt.Fprintf(w, "event: online\ndata: %s\n\n", msg.Message)
			} else {
				data, _ := json.Marshal(msg)
				fmt.Fprintf(w, "event: message\ndata: %s\n\n", data)
			}
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}

func broadcastOnlineUsers() {
	users := chatHub.getOnlineUsers()
	data, _ := json.Marshal(users)
	msg := ChatMessage{
		ID:        chatHub.nextID(),
		Type:      "_online",
		Message:   string(data),
		Timestamp: time.Now().Format(time.RFC3339Nano),
	}
	// Send as raw online event to all clients
	chatHub.mu.Lock()
	for c := range chatHub.clients {
		select {
		case c.ch <- msg:
		default:
		}
	}
	chatHub.mu.Unlock()
}

// POST /api/chat/send — send a message
func handleAPIChatSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username    string `json:"username"`
		Message     string `json:"message"`
		FileURL     string `json:"fileUrl"`
		FileName    string `json:"fileName"`
		FileIsImage bool   `json:"fileIsImage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Username == "" || (req.Message == "" && req.FileURL == "") {
		http.Error(w, "username and message (or file) required", http.StatusBadRequest)
		return
	}

	// Limit lengths
	if len(req.Username) > 30 {
		req.Username = req.Username[:30]
	}
	if len(req.Message) > 5000 {
		req.Message = req.Message[:5000]
	}

	msg := ChatMessage{
		ID:          chatHub.nextID(),
		Username:    req.Username,
		Message:     req.Message,
		Type:        "user",
		Timestamp:   time.Now().Format(time.RFC3339Nano),
		FileURL:     req.FileURL,
		FileName:    req.FileName,
		FileIsImage: req.FileIsImage,
	}
	chatHub.broadcast(msg)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// GET /api/chat/online — list online users
func handleAPIChatOnline(w http.ResponseWriter, r *http.Request) {
	users := chatHub.getOnlineUsers()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// ── Network Scanner ──

var knownServices = map[int]string{
	20: "FTP Data", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP",
	53: "DNS", 80: "HTTP", 110: "POP3", 111: "RPCBind", 119: "NNTP",
	135: "MSRPC", 139: "NetBIOS", 143: "IMAP", 389: "LDAP", 443: "HTTPS",
	445: "SMB", 465: "SMTPS", 514: "Syslog", 515: "LPD", 587: "SMTP/Sub",
	631: "IPP", 636: "LDAPS", 993: "IMAPS", 995: "POP3S",
	1080: "SOCKS", 1433: "MSSQL", 1521: "Oracle", 1883: "MQTT",
	2049: "NFS", 2181: "ZooKeeper", 2375: "Docker", 2376: "Docker TLS",
	3000: "Dev Server", 3306: "MySQL", 3389: "RDP", 4200: "Angular",
	4369: "EPMD", 5000: "Flask/Dev", 5432: "PostgreSQL", 5672: "RabbitMQ",
	5900: "VNC", 5984: "CouchDB", 6379: "Redis", 6443: "K8s API",
	7474: "Neo4j", 8000: "Dev Server", 8080: "HTTP Proxy", 8081: "HTTP Alt",
	8083: "HTTP Alt", 8088: "HTTP Alt", 8161: "ActiveMQ", 8200: "Vault",
	8443: "HTTPS Alt", 8500: "Consul", 8761: "Eureka", 8888: "Jupyter",
	9000: "SonarQube", 9042: "Cassandra", 9090: "Dev Helper", 9092: "Kafka",
	9200: "Elasticsearch", 9300: "ES Transport", 9418: "Git",
	10000: "Webmin", 11211: "Memcached", 15672: "RabbitMQ Mgmt",
	27017: "MongoDB", 27018: "MongoDB", 28017: "MongoDB Web",
	50000: "Jenkins", 61613: "STOMP", 61616: "ActiveMQ",
}

var quickScanPorts = []int{
	21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 587,
	993, 995, 1433, 1521, 1883, 2181, 2375, 3000, 3306, 3389,
	4200, 5000, 5432, 5672, 5900, 6379, 6443, 7474, 8000, 8080,
	8081, 8088, 8161, 8200, 8443, 8500, 8761, 8888, 9000, 9042,
	9090, 9092, 9200, 9418, 11211, 15672, 27017, 50000,
}

func handleNetScanPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("netscan")
	loadPage("netscan.html").ExecuteTemplate(w, "layout.html", data)
}

func handleWorldClockPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("worldclock")
	loadPage("worldclock.html").ExecuteTemplate(w, "layout.html", data)
}

func handleOCRPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("ocr")
	loadPage("ocr.html").ExecuteTemplate(w, "layout.html", data)
}

func handleYAML2PropsPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("yaml2props")
	loadPage("yaml2props.html").ExecuteTemplate(w, "layout.html", data)
}

// GET /api/netscan/interfaces — return server's network interfaces
func handleAPINetInterfaces(w http.ResponseWriter, r *http.Request) {
	ifaces, err := net.Interfaces()
	if err != nil {
		http.Error(w, "Failed to get interfaces", http.StatusInternalServerError)
		return
	}

	type ifaceInfo struct {
		Name   string `json:"name"`
		IP     string `json:"ip"`
		Subnet string `json:"subnet"`
	}

	var result []ifaceInfo
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip4 := ipNet.IP.To4()
			if ip4 == nil {
				continue
			}
			// Calculate network address for subnet
			network := ip4.Mask(ipNet.Mask)
			ones, _ := ipNet.Mask.Size()
			result = append(result, ifaceInfo{
				Name:   iface.Name,
				IP:     ip4.String(),
				Subnet: fmt.Sprintf("%s/%d", network.String(), ones),
			})
		}
	}
	if result == nil {
		result = []ifaceInfo{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// expandCIDR parses a CIDR notation or single IP and returns list of host IPs
func expandCIDR(target string) ([]string, error) {
	// Single IP?
	if net.ParseIP(target) != nil {
		return []string{target}, nil
	}

	_, ipNet, err := net.ParseCIDR(target)
	if err != nil {
		return nil, fmt.Errorf("invalid target: %s", target)
	}

	ones, bits := ipNet.Mask.Size()
	if ones < 16 {
		return nil, fmt.Errorf("subnet too large: /%d (max /16)", ones)
	}

	hostCount := int(math.Pow(2, float64(bits-ones))) - 2
	if hostCount <= 0 {
		// /31 or /32
		return []string{ipNet.IP.String()}, nil
	}

	var ips []string
	ip := make(net.IP, 4)
	copy(ip, ipNet.IP.To4())
	ipInt := binary.BigEndian.Uint32(ip)

	for i := 1; i <= hostCount; i++ {
		next := ipInt + uint32(i)
		binary.BigEndian.PutUint32(ip, next)
		ips = append(ips, net.IP(ip).String())
	}

	return ips, nil
}

// parsePorts parses port specification: "quick", "common", "full", or custom like "80,443,3000-3100"
func parsePorts(spec string) ([]int, error) {
	spec = strings.TrimSpace(strings.ToLower(spec))
	switch spec {
	case "quick":
		cp := make([]int, len(quickScanPorts))
		copy(cp, quickScanPorts)
		return cp, nil
	case "common":
		ports := make([]int, 1024)
		for i := range ports {
			ports[i] = i + 1
		}
		return ports, nil
	case "full":
		ports := make([]int, 65535)
		for i := range ports {
			ports[i] = i + 1
		}
		return ports, nil
	}

	// Custom: "80,443,3000-3100"
	portSet := make(map[int]bool)
	parts := strings.Split(spec, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if strings.Contains(part, "-") {
			rangeParts := strings.SplitN(part, "-", 2)
			start, err1 := strconv.Atoi(strings.TrimSpace(rangeParts[0]))
			end, err2 := strconv.Atoi(strings.TrimSpace(rangeParts[1]))
			if err1 != nil || err2 != nil || start < 1 || end > 65535 || start > end {
				return nil, fmt.Errorf("invalid port range: %s", part)
			}
			for p := start; p <= end; p++ {
				portSet[p] = true
			}
		} else {
			p, err := strconv.Atoi(part)
			if err != nil || p < 1 || p > 65535 {
				return nil, fmt.Errorf("invalid port: %s", part)
			}
			portSet[p] = true
		}
	}

	var ports []int
	for p := range portSet {
		ports = append(ports, p)
	}
	sort.Ints(ports)
	return ports, nil
}

type scanWork struct {
	IP   string
	Port int
}

type scanResult struct {
	IP      string  `json:"ip"`
	Port    int     `json:"port"`
	Service string  `json:"service"`
	Latency float64 `json:"latency"` // ms
}

// GET /api/netscan/scan?target=...&ports=...&timeout=...&concurrency=... — SSE scan stream
func handleAPINetScan(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	q := r.URL.Query()
	target := q.Get("target")
	portsSpec := q.Get("ports")
	if target == "" {
		http.Error(w, "target parameter required", http.StatusBadRequest)
		return
	}
	if portsSpec == "" {
		portsSpec = "quick"
	}

	timeoutMs, _ := strconv.Atoi(q.Get("timeout"))
	if timeoutMs < 100 {
		timeoutMs = 500
	}
	if timeoutMs > 5000 {
		timeoutMs = 5000
	}

	concurrency, _ := strconv.Atoi(q.Get("concurrency"))
	if concurrency < 10 {
		concurrency = 100
	}
	if concurrency > 500 {
		concurrency = 500
	}

	ips, err := expandCIDR(target)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ports, err := parsePorts(portsSpec)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	totalProbes := len(ips) * len(ports)
	if totalProbes > 5000000 {
		http.Error(w, fmt.Sprintf("Too many probes: %d (max 5,000,000)", totalProbes), http.StatusBadRequest)
		return
	}

	// SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	timeout := time.Duration(timeoutMs) * time.Millisecond
	startTime := time.Now()

	// Work channel
	workCh := make(chan scanWork, concurrency*2)
	resultCh := make(chan scanResult, concurrency)

	var scanned int64

	// Workers
	var wg sync.WaitGroup
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for work := range workCh {
				if ctx.Err() != nil {
					atomic.AddInt64(&scanned, 1)
					continue
				}
				addr := fmt.Sprintf("%s:%d", work.IP, work.Port)
				start := time.Now()
				conn, err := net.DialTimeout("tcp", addr, timeout)
				latency := time.Since(start).Seconds() * 1000

				atomic.AddInt64(&scanned, 1)

				if err == nil {
					conn.Close()
					svc := knownServices[work.Port]
					if svc == "" {
						svc = "Unknown"
					}
					resultCh <- scanResult{
						IP:      work.IP,
						Port:    work.Port,
						Service: svc,
						Latency: math.Round(latency*100) / 100,
					}
				}
			}
		}()
	}

	// Feed work
	go func() {
		for _, ip := range ips {
			for _, port := range ports {
				select {
				case workCh <- scanWork{IP: ip, Port: port}:
				case <-ctx.Done():
					close(workCh)
					return
				}
			}
		}
		close(workCh)
	}()

	// Close resultCh when all workers done
	go func() {
		wg.Wait()
		close(resultCh)
	}()

	// SSE writer
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()

	hostsFound := make(map[string]bool)
	openPorts := 0

	sendSSE := func(event string, data interface{}) {
		jsonData, _ := json.Marshal(data)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, jsonData)
		flusher.Flush()
	}

	// Send initial info
	sendSSE("info", map[string]interface{}{
		"totalProbes": totalProbes,
		"hosts":       len(ips),
		"ports":       len(ports),
	})

	for {
		select {
		case <-ctx.Done():
			return
		case result, ok := <-resultCh:
			if !ok {
				// All done
				elapsed := time.Since(startTime).Seconds()
				sendSSE("progress", map[string]interface{}{
					"scanned": totalProbes,
					"total":   totalProbes,
					"percent": 100,
				})
				sendSSE("done", map[string]interface{}{
					"hostsFound": len(hostsFound),
					"openPorts":  openPorts,
					"elapsed":    math.Round(elapsed*100) / 100,
				})
				return
			}
			hostsFound[result.IP] = true
			openPorts++
			sendSSE("result", result)

		case <-ticker.C:
			s := atomic.LoadInt64(&scanned)
			pct := 0
			if totalProbes > 0 {
				pct = int(s * 100 / int64(totalProbes))
			}
			sendSSE("progress", map[string]interface{}{
				"scanned": s,
				"total":   totalProbes,
				"percent": pct,
			})
		}
	}
}

// ── Network Inspector handlers ──

func handleNetInspectPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("netinspect")
	loadPage("netinspect.html").ExecuteTemplate(w, "layout.html", data)
}

// GET /api/netinspect/myip — detect public IP via ip-api.com
func handleAPINetInspectMyIP(w http.ResponseWriter, r *http.Request) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get("http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to detect IP: " + err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

// POST /api/netinspect/iplookup — IP geolocation via ip-api.com
func handleAPINetInspectIPLookup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		IP string `json:"ip"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if net.ParseIP(req.IP) == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid IP address"})
		return
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get("http://ip-api.com/json/" + req.IP + "?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Lookup failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

// POST /api/netinspect/dns — DNS lookup via Go net.Resolver
func handleAPINetInspectDNS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Domain string `json:"domain"`
		Type   string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if req.Domain == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Domain is required"})
		return
	}
	if req.Type == "" {
		req.Type = "A"
	}

	resolver := &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			d := net.Dialer{Timeout: 5 * time.Second}
			return d.DialContext(ctx, "udp", "8.8.8.8:53")
		},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	start := time.Now()
	records := make(map[string]interface{})

	lookupTypes := []string{req.Type}
	if req.Type == "ALL" {
		lookupTypes = []string{"A", "AAAA", "MX", "NS", "TXT", "CNAME"}
	}

	for _, lt := range lookupTypes {
		switch lt {
		case "A":
			addrs, err := resolver.LookupHost(ctx, req.Domain)
			if err == nil {
				var ipv4s []string
				for _, a := range addrs {
					if net.ParseIP(a).To4() != nil {
						ipv4s = append(ipv4s, a)
					}
				}
				if ipv4s == nil {
					ipv4s = []string{}
				}
				records["A"] = ipv4s
			}
		case "AAAA":
			addrs, err := resolver.LookupHost(ctx, req.Domain)
			if err == nil {
				var ipv6s []string
				for _, a := range addrs {
					if net.ParseIP(a).To4() == nil {
						ipv6s = append(ipv6s, a)
					}
				}
				if ipv6s == nil {
					ipv6s = []string{}
				}
				records["AAAA"] = ipv6s
			}
		case "MX":
			mxs, err := resolver.LookupMX(ctx, req.Domain)
			if err == nil {
				var mxList []map[string]interface{}
				for _, mx := range mxs {
					mxList = append(mxList, map[string]interface{}{
						"host":     strings.TrimSuffix(mx.Host, "."),
						"priority": mx.Pref,
					})
				}
				if mxList == nil {
					mxList = []map[string]interface{}{}
				}
				records["MX"] = mxList
			}
		case "NS":
			nss, err := resolver.LookupNS(ctx, req.Domain)
			if err == nil {
				var nsList []string
				for _, ns := range nss {
					nsList = append(nsList, strings.TrimSuffix(ns.Host, "."))
				}
				if nsList == nil {
					nsList = []string{}
				}
				records["NS"] = nsList
			}
		case "TXT":
			txts, err := resolver.LookupTXT(ctx, req.Domain)
			if err == nil {
				if txts == nil {
					txts = []string{}
				}
				records["TXT"] = txts
			}
		case "CNAME":
			cname, err := resolver.LookupCNAME(ctx, req.Domain)
			if err == nil {
				cname = strings.TrimSuffix(cname, ".")
				records["CNAME"] = []string{cname}
			}
		}
	}

	elapsed := time.Since(start).Milliseconds()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"records":    records,
		"elapsed_ms": elapsed,
	})
}

// POST /api/netinspect/headers — HTTP response headers check
func handleAPINetInspectHeaders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	parsed, err := url.Parse(req.URL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Only http/https URLs supported"})
		return
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	start := time.Now()
	resp, err := client.Get(req.URL)
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Request failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	respHeaders := make(map[string]string)
	for k := range resp.Header {
		respHeaders[k] = resp.Header.Get(k)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     resp.StatusCode,
		"statusText": resp.Status,
		"headers":    respHeaders,
		"elapsed_ms": elapsed,
	})
}

// POST /api/netinspect/ssl — TLS certificate check
func handleAPINetInspectSSL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Host string `json:"host"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if req.Host == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Host is required"})
		return
	}

	// Strip protocol/path if user pasted a URL
	host := strings.TrimPrefix(strings.TrimPrefix(req.Host, "https://"), "http://")
	host = strings.Split(host, "/")[0]
	host = strings.Split(host, ":")[0]

	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", host+":443", &tls.Config{
		InsecureSkipVerify: false,
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "TLS connection failed: " + err.Error()})
		return
	}
	defer conn.Close()

	state := conn.ConnectionState()
	if len(state.PeerCertificates) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "No certificates received"})
		return
	}

	cert := state.PeerCertificates[0]
	now := time.Now()
	daysUntilExpiry := int(cert.NotAfter.Sub(now).Hours() / 24)

	validity := "valid"
	if now.After(cert.NotAfter) {
		validity = "expired"
	} else if daysUntilExpiry <= 30 {
		validity = "expiring"
	}

	// TLS version string
	tlsVersion := "Unknown"
	switch state.Version {
	case tls.VersionTLS10:
		tlsVersion = "TLS 1.0"
	case tls.VersionTLS11:
		tlsVersion = "TLS 1.1"
	case tls.VersionTLS12:
		tlsVersion = "TLS 1.2"
	case tls.VersionTLS13:
		tlsVersion = "TLS 1.3"
	}

	// Certificate chain
	var chain []map[string]string
	for _, c := range state.PeerCertificates {
		chain = append(chain, map[string]string{
			"subject": c.Subject.String(),
			"issuer":  c.Issuer.String(),
		})
	}

	subjectOrg := ""
	if len(cert.Subject.Organization) > 0 {
		subjectOrg = cert.Subject.Organization[0]
	}
	issuerOrg := ""
	if len(cert.Issuer.Organization) > 0 {
		issuerOrg = cert.Issuer.Organization[0]
	}

	result := map[string]interface{}{
		"subject_cn":          cert.Subject.CommonName,
		"subject_org":         subjectOrg,
		"issuer_cn":           cert.Issuer.CommonName,
		"issuer_org":          issuerOrg,
		"not_before":          cert.NotBefore.Format(time.RFC3339),
		"not_after":           cert.NotAfter.Format(time.RFC3339),
		"serial":              cert.SerialNumber.Text(16),
		"signature_algorithm": cert.SignatureAlgorithm.String(),
		"dns_names":           cert.DNSNames,
		"days_until_expiry":   daysUntilExpiry,
		"validity":            validity,
		"tls_version":         tlsVersion,
		"chain":               chain,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ── AI Chat (Ollama proxy) ──

func handleAIChatPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("aichat")
	loadPage("aichat.html").ExecuteTemplate(w, "layout.html", data)
}

// GET /api/aichat/models?url=X — proxy to Ollama /api/tags
func handleAPIAIChatModels(w http.ResponseWriter, r *http.Request) {
	ollamaURL := r.URL.Query().Get("url")
	if ollamaURL == "" {
		ollamaURL = "http://localhost:11434"
	}

	parsed, err := url.Parse(ollamaURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		http.Error(w, "Only http/https URLs supported", http.StatusBadRequest)
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(strings.TrimRight(ollamaURL, "/") + "/api/tags")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to connect to Ollama: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

// GET /api/aichat/version?url=X — proxy to Ollama /api/version
func handleAPIAIChatVersion(w http.ResponseWriter, r *http.Request) {
	ollamaURL := r.URL.Query().Get("url")
	if ollamaURL == "" {
		ollamaURL = "http://localhost:11434"
	}

	parsed, err := url.Parse(ollamaURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		http.Error(w, "Only http/https URLs supported", http.StatusBadRequest)
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(strings.TrimRight(ollamaURL, "/") + "/api/version")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

// POST /api/aichat/chat — proxy streaming to Ollama /api/chat, forward as SSE
func handleAPIAIChatStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	var req struct {
		OllamaURL string                   `json:"ollamaUrl"`
		Model     string                   `json:"model"`
		Messages  []map[string]interface{} `json:"messages"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.OllamaURL == "" {
		req.OllamaURL = "http://localhost:11434"
	}

	parsed, err := url.Parse(req.OllamaURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		http.Error(w, "Only http/https URLs supported", http.StatusBadRequest)
		return
	}

	// Build Ollama request
	ollamaBody, _ := json.Marshal(map[string]interface{}{
		"model":    req.Model,
		"messages": req.Messages,
		"stream":   true,
	})

	ctx := r.Context()
	httpReq, err := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(req.OllamaURL, "/")+"/api/chat", bytes.NewReader(ollamaBody))
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Do(httpReq)
	if err != nil {
		// SSE headers not sent yet, can still use http.Error
		http.Error(w, "Failed to connect to Ollama: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 256*1024), 1024*1024)

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := scanner.Text()
		if line == "" {
			continue
		}

		// Forward as SSE
		fmt.Fprintf(w, "data: %s\n\n", line)
		flusher.Flush()

		// Check if done
		var chunk struct {
			Done bool `json:"done"`
		}
		if json.Unmarshal([]byte(line), &chunk) == nil && chunk.Done {
			fmt.Fprintf(w, "data: [DONE]\n\n")
			flusher.Flush()
			return
		}
	}
}

// GET /api/proxy?url=X — fetch remote file content (avoids CORS)
func handleAPIProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	targetURL := r.URL.Query().Get("url")
	if targetURL == "" {
		http.Error(w, "url parameter required", http.StatusBadRequest)
		return
	}

	parsed, err := url.Parse(targetURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		http.Error(w, "Only http:// and https:// URLs are supported", http.StatusBadRequest)
		return
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(targetURL)
	if err != nil {
		http.Error(w, "Failed to fetch URL: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("Remote server returned %d", resp.StatusCode), http.StatusBadGateway)
		return
	}

	// Limit response size (10 MB max)
	body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		http.Error(w, "Failed to read response", http.StatusInternalServerError)
		return
	}

	// Extract filename from URL path
	filename := path.Base(parsed.Path)
	if filename == "" || filename == "." || filename == "/" {
		filename = "untitled.txt"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"content":  string(body),
		"filename": filename,
	})
}

// ── Speed Test handlers ──

func handleSpeedTestPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("speedtest")
	loadPage("speedtest.html").ExecuteTemplate(w, "layout.html", data)
}

// GET /api/speedtest/ping — minimal JSON for latency measurement
func handleAPISpeedTestPing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache, no-store")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok": true,
		"ts": time.Now().UnixNano(),
	})
}

// GET /api/speedtest/download?size=10 — stream random bytes (size in MB)
func handleAPISpeedTestDownload(w http.ResponseWriter, r *http.Request) {
	sizeMB, _ := strconv.Atoi(r.URL.Query().Get("size"))
	if sizeMB <= 0 {
		sizeMB = 10
	}
	if sizeMB > 100 {
		sizeMB = 100
	}

	totalBytes := int64(sizeMB) * 1024 * 1024

	// Generate 1MB buffer of random data (reused for each chunk)
	buf := make([]byte, 1024*1024)
	crand.Read(buf)

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.FormatInt(totalBytes, 10))
	w.Header().Set("Cache-Control", "no-cache, no-store")

	ctx := r.Context()
	var written int64
	for written < totalBytes {
		select {
		case <-ctx.Done():
			return
		default:
		}
		chunk := buf
		remaining := totalBytes - written
		if remaining < int64(len(chunk)) {
			chunk = chunk[:remaining]
		}
		n, err := w.Write(chunk)
		if err != nil {
			return
		}
		written += int64(n)
	}
}

// POST /api/speedtest/upload — receive bytes, discard, measure speed
func handleAPISpeedTestUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 100*1024*1024)

	start := time.Now()
	n, _ := io.Copy(io.Discard, r.Body)
	duration := time.Since(start)

	speedMbps := 0.0
	if duration.Seconds() > 0 {
		speedMbps = float64(n*8) / duration.Seconds() / 1e6
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"bytes":      n,
		"durationMs": duration.Milliseconds(),
		"speedMbps":  math.Round(speedMbps*100) / 100,
	})
}

// POST /api/speedtest/disk — disk write/read speed test
func handleAPISpeedTestDisk(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path   string `json:"path"`
		SizeMB int    `json:"sizeMB"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.SizeMB <= 0 {
		req.SizeMB = 100
	}
	if req.SizeMB > 1000 {
		req.SizeMB = 1000
	}

	dir := req.Path
	if dir == "" {
		dir = os.TempDir()
	}

	// Security: reject path traversal
	if strings.Contains(dir, "..") {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Path traversal (..) not allowed"})
		return
	}

	// Validate directory exists
	info, err := os.Stat(dir)
	if err != nil || !info.IsDir() {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Directory does not exist: " + dir})
		return
	}

	tmpFile := filepath.Join(dir, fmt.Sprintf("speedtest_%d.tmp", time.Now().UnixNano()))

	// Generate 1MB buffer of random data
	buf := make([]byte, 1024*1024)
	crand.Read(buf)

	totalBytes := int64(req.SizeMB) * 1024 * 1024

	// ── Write test ──
	f, err := os.Create(tmpFile)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Cannot create file: " + err.Error()})
		return
	}

	writeStart := time.Now()
	var written int64
	for written < totalBytes {
		chunk := buf
		remaining := totalBytes - written
		if remaining < int64(len(chunk)) {
			chunk = chunk[:remaining]
		}
		n, err := f.Write(chunk)
		if err != nil {
			f.Close()
			os.Remove(tmpFile)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"error": "Write failed: " + err.Error()})
			return
		}
		written += int64(n)
	}
	f.Sync()
	f.Close()
	writeDuration := time.Since(writeStart)
	writeMBps := float64(totalBytes) / writeDuration.Seconds() / (1024 * 1024)

	// ── Read test ──
	f, err = os.Open(tmpFile)
	if err != nil {
		os.Remove(tmpFile)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Cannot open file for read: " + err.Error()})
		return
	}

	readBuf := make([]byte, 1024*1024)
	readStart := time.Now()
	var totalRead int64
	for {
		n, err := f.Read(readBuf)
		totalRead += int64(n)
		if err != nil {
			break
		}
	}
	f.Close()
	readDuration := time.Since(readStart)
	readMBps := float64(totalRead) / readDuration.Seconds() / (1024 * 1024)

	// Cleanup
	os.Remove(tmpFile)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"path": dir,
		"write": map[string]interface{}{
			"sizeMB":     req.SizeMB,
			"durationMs": writeDuration.Milliseconds(),
			"speedMBps":  math.Round(writeMBps*100) / 100,
		},
		"read": map[string]interface{}{
			"sizeMB":     req.SizeMB,
			"durationMs": readDuration.Milliseconds(),
			"speedMBps":  math.Round(readMBps*100) / 100,
		},
	})
}

// ══════════════════════════════════════════════════════════════
// System Monitor
// ══════════════════════════════════════════════════════════════

type SysMonHost struct {
	Hostname      string `json:"hostname"`
	OS            string `json:"os"`
	Platform      string `json:"platform"`
	PlatformVer   string `json:"platformVersion"`
	Arch          string `json:"arch"`
	UptimeSec     uint64 `json:"uptimeSec"`
	NumCPU        int    `json:"numCpu"`
	GoVersion     string `json:"goVersion"`
	ProcessCount  int    `json:"processCount"`
}

type SysMonCPU struct {
	ModelName    string    `json:"modelName"`
	Cores        int       `json:"cores"`
	TotalPercent float64   `json:"totalPercent"`
	PerCore      []float64 `json:"perCore"`
}

type SysMonMemory struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Available   uint64  `json:"available"`
	UsedPercent float64 `json:"usedPercent"`
	SwapTotal   uint64  `json:"swapTotal"`
	SwapUsed    uint64  `json:"swapUsed"`
}

type SysMonDisk struct {
	Device     string  `json:"device"`
	Mountpoint string  `json:"mountpoint"`
	Fstype     string  `json:"fstype"`
	Total      uint64  `json:"total"`
	Used       uint64  `json:"used"`
	Free       uint64  `json:"free"`
	Percent    float64 `json:"percent"`
}

type SysMonNet struct {
	Name      string `json:"name"`
	BytesSent uint64 `json:"bytesSent"`
	BytesRecv uint64 `json:"bytesRecv"`
	SendRate  uint64 `json:"sendRate"`
	RecvRate  uint64 `json:"recvRate"`
}

type SysMonProcess struct {
	PID        int32   `json:"pid"`
	Name       string  `json:"name"`
	MemoryRSS  uint64  `json:"memoryRss"`
	MemoryPct  float32 `json:"memoryPct"`
	CPUPercent float64 `json:"cpuPercent"`
}

type SysMonSnapshot struct {
	Host    SysMonHost      `json:"host"`
	CPU     SysMonCPU       `json:"cpu"`
	Memory  SysMonMemory    `json:"memory"`
	Disks   []SysMonDisk    `json:"disks"`
	Network []SysMonNet     `json:"network"`
	Procs   []SysMonProcess `json:"procs"`
}

// Previous network counters for bandwidth delta
var (
	prevNetCounters map[string]gopsnet.IOCountersStat
	prevNetTime     time.Time
	prevNetMu       sync.Mutex
)

func collectSnapshot(cpuInterval time.Duration) SysMonSnapshot {
	var snap SysMonSnapshot

	// Host info
	if hi, err := gopshost.Info(); err == nil {
		snap.Host = SysMonHost{
			Hostname:    hi.Hostname,
			OS:          hi.OS,
			Platform:    hi.Platform,
			PlatformVer: hi.PlatformVersion,
			Arch:        hi.KernelArch,
			UptimeSec:   hi.Uptime,
		}
	}
	snap.Host.NumCPU = runtime.NumCPU()
	snap.Host.GoVersion = runtime.Version()

	// Process count
	if pids, err := process.Pids(); err == nil {
		snap.Host.ProcessCount = len(pids)
	}

	// CPU
	if infos, err := cpu.Info(); err == nil && len(infos) > 0 {
		snap.CPU.ModelName = infos[0].ModelName
	}
	snap.CPU.Cores = runtime.NumCPU()
	if pcts, err := cpu.Percent(cpuInterval, false); err == nil && len(pcts) > 0 {
		snap.CPU.TotalPercent = math.Round(pcts[0]*10) / 10
	}
	if pcts, err := cpu.Percent(0, true); err == nil {
		snap.CPU.PerCore = make([]float64, len(pcts))
		for i, p := range pcts {
			snap.CPU.PerCore[i] = math.Round(p*10) / 10
		}
	}

	// Memory
	if vm, err := mem.VirtualMemory(); err == nil {
		snap.Memory = SysMonMemory{
			Total:       vm.Total,
			Used:        vm.Used,
			Available:   vm.Available,
			UsedPercent: math.Round(vm.UsedPercent*10) / 10,
		}
	}
	if sw, err := mem.SwapMemory(); err == nil {
		snap.Memory.SwapTotal = sw.Total
		snap.Memory.SwapUsed = sw.Used
	}

	// Disks
	skipFstype := map[string]bool{
		"tmpfs": true, "devtmpfs": true, "squashfs": true,
		"overlay": true, "nsfs": true,
	}
	if parts, err := disk.Partitions(false); err == nil {
		for _, p := range parts {
			if skipFstype[p.Fstype] {
				continue
			}
			if usage, err := disk.Usage(p.Mountpoint); err == nil && usage.Total > 0 {
				label := p.Device
				if label == "" {
					label = p.Mountpoint
				}
				snap.Disks = append(snap.Disks, SysMonDisk{
					Device:     label,
					Mountpoint: p.Mountpoint,
					Fstype:     p.Fstype,
					Total:      usage.Total,
					Used:       usage.Used,
					Free:       usage.Free,
					Percent:    math.Round(usage.UsedPercent*10) / 10,
				})
			}
		}
	}

	// Network
	now := time.Now()
	if counters, err := gopsnet.IOCounters(true); err == nil {
		prevNetMu.Lock()
		elapsed := now.Sub(prevNetTime).Seconds()
		if elapsed < 0.1 {
			elapsed = 1
		}
		for _, c := range counters {
			if c.BytesSent == 0 && c.BytesRecv == 0 {
				continue
			}
			ni := SysMonNet{
				Name:      c.Name,
				BytesSent: c.BytesSent,
				BytesRecv: c.BytesRecv,
			}
			if prev, ok := prevNetCounters[c.Name]; ok {
				ni.SendRate = uint64(float64(c.BytesSent-prev.BytesSent) / elapsed)
				ni.RecvRate = uint64(float64(c.BytesRecv-prev.BytesRecv) / elapsed)
			}
			snap.Network = append(snap.Network, ni)
		}
		// Store current for next delta
		m := make(map[string]gopsnet.IOCountersStat, len(counters))
		for _, c := range counters {
			m[c.Name] = c
		}
		prevNetCounters = m
		prevNetTime = now
		prevNetMu.Unlock()
	}

	// Top 10 processes by memory
	if procs, err := process.Processes(); err == nil {
		type procInfo struct {
			pid    int32
			name   string
			rss    uint64
			memPct float32
		}
		var plist []procInfo
		for _, p := range procs {
			mi, err := p.MemoryInfo()
			if err != nil || mi == nil {
				continue
			}
			n, _ := p.Name()
			mp, _ := p.MemoryPercent()
			plist = append(plist, procInfo{pid: p.Pid, name: n, rss: mi.RSS, memPct: mp})
		}
		sort.Slice(plist, func(i, j int) bool { return plist[i].rss > plist[j].rss })
		if len(plist) > 10 {
			plist = plist[:10]
		}
		for _, p := range plist {
			snap.Procs = append(snap.Procs, SysMonProcess{
				PID:       p.pid,
				Name:      p.name,
				MemoryRSS: p.rss,
				MemoryPct: float32(math.Round(float64(p.memPct)*10) / 10),
			})
		}
	}

	return snap
}

func handleSysMonPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("sysmon")
	loadPage("sysmon.html").ExecuteTemplate(w, "layout.html", data)
}

func handleIconsPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("icons")
	loadPage("icons.html").ExecuteTemplate(w, "layout.html", data)
}

func handleTranslatorPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("translator")
	loadPage("translator.html").ExecuteTemplate(w, "layout.html", data)
}

func handleImageBase64Page(w http.ResponseWriter, r *http.Request) {
	data := newPageData("imagebase64")
	loadPage("imagebase64.html").ExecuteTemplate(w, "layout.html", data)
}

func handleImageEditorPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("imageeditor")
	loadPage("imageeditor.html").ExecuteTemplate(w, "layout.html", data)
}

func handleImageConvertPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("imageconvert")
	loadPage("imageconvert.html").ExecuteTemplate(w, "layout.html", data)
}

func handleCSVPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("csv")
	loadPage("csv.html").ExecuteTemplate(w, "layout.html", data)
}

func handleJSONSchemaPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("jsonschema")
	loadPage("jsonschema.html").ExecuteTemplate(w, "layout.html", data)
}

func handleJSONPathPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("jsonpath")
	loadPage("jsonpath.html").ExecuteTemplate(w, "layout.html", data)
}

func handleSubnetPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("subnet")
	loadPage("subnet.html").ExecuteTemplate(w, "layout.html", data)
}

func handleEnvFilePage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("envfile")
	loadPage("envfile.html").ExecuteTemplate(w, "layout.html", data)
}

func handleMDTablePage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("mdtable")
	loadPage("mdtable.html").ExecuteTemplate(w, "layout.html", data)
}

func handleChmodPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("chmod")
	loadPage("chmod.html").ExecuteTemplate(w, "layout.html", data)
}

// ── API Mock Server ──

type MockEndpoint struct {
	ID          int               `json:"id"`
	Method      string            `json:"method"`
	Path        string            `json:"path"`
	Status      int               `json:"status"`
	ContentType string            `json:"contentType"`
	Headers     map[string]string `json:"headers"`
	Delay       int               `json:"delay"`
	Body        string            `json:"body"`
}

type MockLogEntry struct {
	Method string `json:"method"`
	Path   string `json:"path"`
	Status int    `json:"status"`
	Time   string `json:"time"`
}

func handleAPIMockPage(w http.ResponseWriter, r *http.Request) {
	data := newPageData("apimock")
	loadPage("apimock.html").ExecuteTemplate(w, "layout.html", data)
}

func handleAPIMockEndpoints(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var eps []MockEndpoint
		if err := json.NewDecoder(r.Body).Decode(&eps); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		mockMu.Lock()
		mockEndpoints = eps
		mockMu.Unlock()
		w.WriteHeader(204)
		return
	}
	// GET
	mockMu.RLock()
	defer mockMu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mockEndpoints)
}

func handleAPIMockLog(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", 500)
		return
	}

	ch := make(chan MockLogEntry, 10)
	mockLogMu.Lock()
	mockLogChs = append(mockLogChs, ch)
	mockLogMu.Unlock()

	defer func() {
		mockLogMu.Lock()
		for i, c := range mockLogChs {
			if c == ch {
				mockLogChs = append(mockLogChs[:i], mockLogChs[i+1:]...)
				break
			}
		}
		mockLogMu.Unlock()
		close(ch)
	}()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case entry := <-ch:
			data, _ := json.Marshal(entry)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

func handleMockRequest(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/mock/")

	mockMu.RLock()
	var matched *MockEndpoint
	for i := range mockEndpoints {
		ep := &mockEndpoints[i]
		if ep.Method == r.Method && ep.Path == path {
			matched = ep
			break
		}
	}
	mockMu.RUnlock()

	logEntry := MockLogEntry{
		Method: r.Method,
		Path:   "/mock/" + path,
		Time:   time.Now().Format("15:04:05"),
	}

	if matched == nil {
		logEntry.Status = 404
		broadcastMockLog(logEntry)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(404)
		json.NewEncoder(w).Encode(map[string]string{"error": "No matching mock endpoint"})
		return
	}

	if matched.Delay > 0 {
		time.Sleep(time.Duration(matched.Delay) * time.Millisecond)
	}

	// Set CORS headers for mock endpoints
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")

	if r.Method == "OPTIONS" {
		w.WriteHeader(204)
		return
	}

	w.Header().Set("Content-Type", matched.ContentType)
	for k, v := range matched.Headers {
		w.Header().Set(k, v)
	}
	w.WriteHeader(matched.Status)
	w.Write([]byte(matched.Body))

	logEntry.Status = matched.Status
	broadcastMockLog(logEntry)
}

func broadcastMockLog(entry MockLogEntry) {
	mockLogMu.Lock()
	defer mockLogMu.Unlock()
	for _, ch := range mockLogChs {
		select {
		case ch <- entry:
		default:
		}
	}
}

// ── Medium & Lower Priority Tool Pages ──

func handlePlaceholderPage(w http.ResponseWriter, r *http.Request) {
	loadPage("placeholder.html").ExecuteTemplate(w, "layout.html", newPageData("placeholder"))
}
func handleASCIIArtPage(w http.ResponseWriter, r *http.Request) {
	loadPage("asciiart.html").ExecuteTemplate(w, "layout.html", newPageData("asciiart"))
}
func handleFavicoGenPage(w http.ResponseWriter, r *http.Request) {
	loadPage("favicogen.html").ExecuteTemplate(w, "layout.html", newPageData("favicogen"))
}
func handleEncodingPage(w http.ResponseWriter, r *http.Request) {
	loadPage("encoding.html").ExecuteTemplate(w, "layout.html", newPageData("encoding"))
}
func handleGitHelpPage(w http.ResponseWriter, r *http.Request) {
	loadPage("githelp.html").ExecuteTemplate(w, "layout.html", newPageData("githelp"))
}
func handleKanbanPage(w http.ResponseWriter, r *http.Request) {
	loadPage("kanban.html").ExecuteTemplate(w, "layout.html", newPageData("kanban"))
}
func handlePomodoroPage(w http.ResponseWriter, r *http.Request) {
	loadPage("pomodoro.html").ExecuteTemplate(w, "layout.html", newPageData("pomodoro"))
}
func handleBookmarksPage(w http.ResponseWriter, r *http.Request) {
	loadPage("bookmarks.html").ExecuteTemplate(w, "layout.html", newPageData("bookmarks"))
}
func handleSQLPlayPage(w http.ResponseWriter, r *http.Request) {
	loadPage("sqlplay.html").ExecuteTemplate(w, "layout.html", newPageData("sqlplay"))
}
func handleTimestampPage(w http.ResponseWriter, r *http.Request) {
	loadPage("timestamp.html").ExecuteTemplate(w, "layout.html", newPageData("timestamp"))
}
func handleTextDiffPage(w http.ResponseWriter, r *http.Request) {
	loadPage("textdiff.html").ExecuteTemplate(w, "layout.html", newPageData("textdiff"))
}
func handlePalettePage(w http.ResponseWriter, r *http.Request) {
	loadPage("palette.html").ExecuteTemplate(w, "layout.html", newPageData("palette"))
}
func handleKeycodePage(w http.ResponseWriter, r *http.Request) {
	loadPage("keycode.html").ExecuteTemplate(w, "layout.html", newPageData("keycode"))
}
func handleFontPreviewPage(w http.ResponseWriter, r *http.Request) {
	loadPage("fontpreview.html").ExecuteTemplate(w, "layout.html", newPageData("fontpreview"))
}
func handlePromptsPage(w http.ResponseWriter, r *http.Request) {
	loadPage("prompts.html").ExecuteTemplate(w, "layout.html", newPageData("prompts"))
}
func handleScaffoldPage(w http.ResponseWriter, r *http.Request) {
	loadPage("scaffold.html").ExecuteTemplate(w, "layout.html", newPageData("scaffold"))
}

// GET/POST /api/prompts — read/write prompts data to disk
func handleAPIPrompts(w http.ResponseWriter, r *http.Request) {
	dataFile := filepath.Join(promptsDir, "prompts.json")

	if r.Method == http.MethodGet {
		promptsMu.Lock()
		data, err := os.ReadFile(dataFile)
		promptsMu.Unlock()
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte("{}"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
		return
	}

	if r.Method == http.MethodPost {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read body", 400)
			return
		}
		promptsMu.Lock()
		err = os.WriteFile(dataFile, body, 0644)
		promptsMu.Unlock()
		if err != nil {
			http.Error(w, "Failed to write file", 500)
			return
		}
		w.WriteHeader(204)
		return
	}

	http.Error(w, "Method not allowed", 405)
}

// GET /api/sysmon/snapshot — single JSON snapshot (500ms CPU sample)
func handleAPISysMonSnapshot(w http.ResponseWriter, r *http.Request) {
	snap := collectSnapshot(500 * time.Millisecond)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snap)
}

// GET /api/sysmon/stream — SSE, sends snapshot every 2s
func handleAPISysMonStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	ctx := r.Context()
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	// Send initial snapshot immediately
	snap := collectSnapshot(0)
	data, _ := json.Marshal(snap)
	fmt.Fprintf(w, "event: snapshot\ndata: %s\n\n", data)
	flusher.Flush()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			snap := collectSnapshot(0)
			data, _ := json.Marshal(snap)
			fmt.Fprintf(w, "event: snapshot\ndata: %s\n\n", data)
			flusher.Flush()
		}
	}
}
