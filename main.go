package main

import (
	"bufio"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

//go:embed all:templates
var templatesFS embed.FS

//go:embed all:static
var staticFS embed.FS

var (
	version = "dev"
	baseDir string
	filesDir string
	logsDir  string
	devMode  bool
)

type PageData struct {
	ActivePage string
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
	os.MkdirAll(filesDir, 0755)
	os.MkdirAll(logsDir, 0755)

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

	// Uploaded files — always served from disk
	mux.Handle("/files/", http.StripPrefix("/files/", http.FileServer(http.Dir(filesDir))))

	// Static files — disk in dev mode, embedded in production
	if devMode {
		mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(filepath.Join(baseDir, "static")))))
	} else {
		staticSub, _ := fs.Sub(staticFS, "static")
		mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticSub))))
	}

	addr := ":9090"
	mode := "embedded"
	if devMode {
		mode = "dev (disk)"
	}
	fmt.Printf("Dev Helper %s (%s) running at http://localhost%s\n", version, mode, addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	data := PageData{ActivePage: "home"}
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
	data := PageData{ActivePage: "upload"}
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
	data := PageData{ActivePage: "prettify"}
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
	data := PageData{ActivePage: "files"}
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
	data := PageData{ActivePage: "logs"}
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
	data := PageData{ActivePage: "logviewer"}
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

// POST /api/logviewer — upload log file and filter
func handleAPILogViewer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	start := time.Now()

	r.ParseMultipartForm(500 << 20) // 500 MB max

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	keyword := r.FormValue("keyword")
	mode := r.FormValue("mode")           // "and" or "or"
	caseSensitive := r.FormValue("caseSensitive") == "true"
	useRegex := r.FormValue("regex") == "true"
	contextLines, _ := strconv.Atoi(r.FormValue("contextLines"))
	if contextLines < 0 {
		contextLines = 0
	}
	if contextLines > 10 {
		contextLines = 10
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
	scanner := bufio.NewScanner(file)
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
		FileSize:     formatFileSize(header.Size),
		FileName:     header.Filename,
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
	data := PageData{ActivePage: "markdown"}
	loadPage("markdown.html").ExecuteTemplate(w, "layout.html", data)
}

func handleDiffPage(w http.ResponseWriter, r *http.Request) {
	data := PageData{ActivePage: "diff"}
	loadPage("diff.html").ExecuteTemplate(w, "layout.html", data)
}

// ── Code Editor handlers ──

func handleEditorPage(w http.ResponseWriter, r *http.Request) {
	data := PageData{ActivePage: "editor"}
	loadPage("editor.html").ExecuteTemplate(w, "layout.html", data)
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
