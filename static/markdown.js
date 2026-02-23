// ── Configure marked with highlight.js ──
marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try { return hljs.highlight(code, { language: lang }).value; } catch (e) {}
        }
        try { return hljs.highlightAuto(code).value; } catch (e) {}
        return code;
    },
});

// ── State ──
let editor = null;
var LS_KEY_MD = 'devhelper_markdown_content';

// ── Sample Templates ──
var samples = {
    readme: `# Project Name

> A brief description of what this project does and who it's for.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

## Features

- Feature 1 — Description of the first feature
- Feature 2 — Description of the second feature
- Feature 3 — Description of the third feature

## Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/username/project-name.git

# Navigate to the project directory
cd project-name

# Install dependencies
npm install

# Start the development server
npm run dev
\`\`\`

## Usage

\`\`\`javascript
import { something } from 'project-name';

const result = something({
    option1: true,
    option2: 'value',
});

console.log(result);
\`\`\`

## API Reference

### \`functionName(params)\`

| Parameter | Type     | Description                |
|-----------|----------|----------------------------|
| \`param1\` | \`string\` | **Required**. Your API key |
| \`param2\` | \`number\` | Optional. Default is \`10\` |

**Returns:** \`Promise<Object>\`

## Contributing

1. Fork the project
2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [Your Name](https://github.com/username)`,

    api: `# API Documentation

Base URL: \`https://api.example.com/v1\`

## Authentication

All API requests require an \`Authorization\` header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Endpoints

### Users

#### Get All Users

\`\`\`http
GET /users?page=1&limit=20
\`\`\`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| \`page\` | integer | 1 | Page number |
| \`limit\` | integer | 20 | Items per page (max 100) |
| \`sort\` | string | \`created_at\` | Sort field |
| \`order\` | string | \`desc\` | Sort order (\`asc\` or \`desc\`) |

**Response:** \`200 OK\`

\`\`\`json
{
  "data": [
    {
      "id": "usr_123",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
\`\`\`

#### Create User

\`\`\`http
POST /users
Content-Type: application/json
\`\`\`

**Request Body:**

\`\`\`json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword123",
  "role": "user"
}
\`\`\`

**Response:** \`201 Created\`

### Error Codes

| Code | Description |
|------|-------------|
| \`400\` | Bad Request — Invalid parameters |
| \`401\` | Unauthorized — Invalid or missing API key |
| \`403\` | Forbidden — Insufficient permissions |
| \`404\` | Not Found — Resource doesn't exist |
| \`429\` | Too Many Requests — Rate limit exceeded |
| \`500\` | Internal Server Error |

## Rate Limiting

- **100 requests** per minute per API key
- Headers: \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\``,

    changelog: `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Dark mode support with system preference detection
- Export to PDF functionality

### Changed
- Improved search performance by 3x

---

## [2.1.0] — 2025-02-15

### Added
- New dashboard with analytics charts
- Bulk export feature for all data types
- Keyboard shortcuts for common actions (\`Ctrl+K\` for search)

### Fixed
- Fixed memory leak in WebSocket connections
- Resolved timezone display issue for UTC-negative zones

### Changed
- Updated dependencies to latest versions
- Migrated from REST to GraphQL for user queries

---

## [2.0.0] — 2025-01-01

### Added
- Complete UI redesign with new component library
- Multi-language support (EN, ID, JP, KR)
- Real-time collaboration features
- Two-factor authentication (TOTP)

### Changed
- **BREAKING:** API v1 endpoints deprecated, use v2
- **BREAKING:** Minimum Node.js version is now 20
- Database migration from MySQL to PostgreSQL

### Removed
- Legacy XML export format
- Support for IE11

### Security
- Patched XSS vulnerability in rich text editor
- Updated bcrypt to v5 for improved hashing

---

## [1.0.0] — 2024-06-01

### Added
- Initial release
- User authentication and authorization
- CRUD operations for all resources
- File upload with image processing
- Email notifications`,

    blog: `# Building Offline-First Developer Tools

*Published: February 2025 · 5 min read*

---

## Why Offline-First?

As developers, we rely on dozens of online tools daily — JSON formatters, Base64 encoders, diff viewers, regex testers. But what happens when:

- You're on a plane with no WiFi ✈️
- Your office internet goes down 🔌
- You're working in a restricted network 🔒
- The online tool's server is experiencing downtime ⚠️

> **"The best tool is the one that's always available."**

## The Solution

I built **Dev Helper** — a single portable binary that runs locally and provides all essential developer tools:

### Core Features

1. **Code Prettify** — Format JSON, XML, HTML, CSS, JS, SQL
2. **Code Editor** — Monaco-powered (same engine as VS Code)
3. **Markdown Viewer** — Live preview with syntax highlighting
4. **File Upload** — Drag & drop with instant URL generation

### Tech Stack

\`\`\`
Backend:  Go (standard library only)
Frontend: Bootstrap 5 + Vanilla JS
Editor:   Monaco Editor v0.52.2
Port:     9090
Size:     ~15MB binary
\`\`\`

## Key Design Decisions

### Why Go?

Go compiles to a **single static binary** — no runtime dependencies, no Docker, no Node.js. Just download and run:

\`\`\`bash
./dev-helper
# Server running at http://localhost:9090
\`\`\`

### Why No Framework?

Frameworks add complexity and build steps. With vanilla JS:

- **Zero build time** — edit and refresh
- **No node_modules** — no 500MB dependency black hole
- **Simple debugging** — what you see is what runs

## Lessons Learned

| Challenge | Solution |
|-----------|----------|
| Monaco worker loading | Self-host AMD modules, careful \`baseUrl\` config |
| Dark mode consistency | Bootstrap CSS variables everywhere |
| Template collisions | \`ParseFiles\` instead of \`ParseGlob\` |

## Try It

The project is open source. Give it a star if you find it useful!

\`\`\`bash
go install github.com/farizfadian/dev-helper@latest
\`\`\`

---

*What tools do you wish were available offline? Let me know in the comments!*`,

    cheatsheet: `# Markdown Cheatsheet

## Headings

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

---

## Text Formatting

**Bold text** or __Bold text__

*Italic text* or _Italic text_

~~Strikethrough~~

**_Bold and italic_**

\`Inline code\`

> Blockquote
>
> > Nested blockquote

---

## Lists

### Unordered
- Item 1
- Item 2
  - Nested item
  - Another nested
- Item 3

### Ordered
1. First item
2. Second item
   1. Sub item
   2. Sub item
3. Third item

### Task List
- [x] Completed task
- [x] Another completed
- [ ] Incomplete task
- [ ] Future task

---

## Links & Images

[Link text](https://example.com)

[Link with title](https://example.com "Hover title")

![Alt text](https://via.placeholder.com/200x100)

---

## Code Blocks

Inline: \`const x = 42;\`

Fenced:

\`\`\`javascript
function hello(name) {
    return \`Hello, \${name}!\`;
}
\`\`\`

\`\`\`python
def hello(name):
    return f"Hello, {name}!"
\`\`\`

\`\`\`sql
SELECT u.name, COUNT(o.id) as orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.name
HAVING COUNT(o.id) > 5
ORDER BY orders DESC;
\`\`\`

---

## Tables

| Left | Center | Right |
|:-----|:------:|------:|
| L1   | C1     | R1    |
| L2   | C2     | R2    |
| L3   | C3     | R3    |

---

## Horizontal Rule

Three or more dashes, asterisks, or underscores:

---
***
___

---

## Escaping

Use backslash to escape: \\*not italic\\* \\# not heading

---

## Footnotes

Here's a sentence with a footnote[^1].

[^1]: This is the footnote content.

## Emoji (GitHub)

:smile: :rocket: :tada: :heart:

---

*This cheatsheet covers GitHub Flavored Markdown (GFM)*`,

    meeting: `# Meeting Notes — Sprint Review

**Date:** February 21, 2025
**Time:** 10:00 — 11:30 AM (WIB)
**Location:** Conference Room A / Zoom
**Facilitator:** Fariz Fadian

## Attendees

| Name | Role | Status |
|------|------|--------|
| Fariz | Tech Lead | ✅ Present |
| Sarah | Frontend Dev | ✅ Present |
| Budi | Backend Dev | ✅ Present |
| Diana | QA Engineer | ⏰ Late (10:15) |
| Reza | Product Owner | 🔴 Absent |

---

## Agenda

1. Sprint 14 Demo
2. Blockers & Issues
3. Sprint 15 Planning
4. Action Items

---

## 1. Sprint 14 Demo

### Completed Stories

- [x] **AUTH-123** — Implement OAuth2 login flow (Sarah)
- [x] **API-456** — Refactor payment gateway integration (Budi)
- [x] **UI-789** — Responsive dashboard redesign (Sarah)
- [ ] **BUG-321** — Fix timezone display issue (Budi) — *moved to Sprint 15*

### Demo Feedback

> "The new dashboard looks great! Can we add a date range filter?"
> — Reza (via Slack)

---

## 2. Blockers & Issues

| Issue | Owner | Priority | Status |
|-------|-------|----------|--------|
| Staging server disk full | Budi | 🔴 High | In progress |
| Third-party API rate limit | Sarah | 🟡 Medium | Investigating |
| Flaky E2E tests | Diana | 🟢 Low | Scheduled |

---

## 3. Sprint 15 Planning

**Sprint Goal:** Complete user notification system

### Stories

1. **NOTIF-001** — Email notification service (Budi, 5pts)
2. **NOTIF-002** — In-app notification UI (Sarah, 3pts)
3. **NOTIF-003** — Push notification integration (Budi, 8pts)
4. **BUG-321** — Fix timezone display (Budi, 2pts)

**Total Points:** 18 | **Capacity:** 20

---

## 4. Action Items

- [ ] **Fariz** — Schedule 1-on-1 with Reza about Q2 roadmap (by Feb 24)
- [ ] **Budi** — Clean up staging server, set up disk monitoring (by Feb 22)
- [ ] **Sarah** — Create design mockup for notification bell UI (by Feb 23)
- [ ] **Diana** — Update E2E test suite, fix flaky tests (by Feb 25)

---

**Next Meeting:** February 28, 2025 at 10:00 AM`,

    todo: `# Project TODO

## 🚀 In Progress

- [ ] Implement user authentication
  - [x] Login page UI
  - [x] JWT token generation
  - [ ] Refresh token mechanism
  - [ ] Password reset flow

- [ ] Dashboard analytics
  - [x] Chart components
  - [ ] Real-time data updates
  - [ ] Export to CSV

## 📋 Backlog

### High Priority
- [ ] Performance optimization
  - [ ] Implement lazy loading for images
  - [ ] Add Redis caching layer
  - [ ] Optimize database queries (N+1 problem)

- [ ] Security audit
  - [ ] Input sanitization review
  - [ ] CORS configuration
  - [ ] Rate limiting implementation

### Medium Priority
- [ ] Multi-language support (i18n)
- [ ] Dark mode refinements
- [ ] Email notification system
- [ ] File compression for uploads

### Low Priority
- [ ] Keyboard shortcuts documentation
- [ ] Onboarding tour for new users
- [ ] API versioning strategy
- [ ] Load testing with k6

## ✅ Completed

- [x] Project scaffolding and setup
- [x] Database schema design
- [x] CI/CD pipeline configuration
- [x] Unit test framework setup
- [x] REST API — CRUD endpoints
- [x] File upload with drag & drop
- [x] Responsive layout (mobile-first)

## 📝 Notes

- **Deployment target:** March 15, 2025
- **Stack:** Go + Bootstrap 5 + Vanilla JS
- **Minimum browser support:** Chrome 90+, Firefox 88+, Safari 14+

---

*Last updated: February 21, 2025*`,
};

// ── Monaco AMD Setup ──
require.config({ paths: { 'vs': '/static/monaco-editor/min/vs' } });

window.MonacoEnvironment = {
    getWorkerUrl: function (workerId, label) {
        const base = window.location.origin + '/static/monaco-editor/min';
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(
            `self.MonacoEnvironment = { baseUrl: '${base}/' }; importScripts('${base}/vs/base/worker/workerMain.js');`
        )}`;
    }
};

require(['vs/editor/editor.main'], function () {
    const previewPane = document.getElementById('previewPane');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const urlInput = document.getElementById('urlInput');

    // ── Determine initial content: localStorage > URL param > default ──
    var savedContent = localStorage.getItem(LS_KEY_MD);
    var initialContent = savedContent !== null ? savedContent : getDefaultContent();

    // ── Create Monaco editor for Markdown ──
    editor = monaco.editor.create(document.getElementById('markdownEditor'), {
        value: initialContent,
        language: 'markdown',
        theme: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        lineNumbers: 'on',
        wordWrap: 'on',
        fontSize: 14,
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        renderWhitespace: 'selection',
    });

    // ── Live preview ──
    function renderPreview() {
        const md = editor.getValue();
        previewPane.innerHTML = marked.parse(md);
    }

    // Initial render
    renderPreview();

    // Re-render on change (debounced) + auto-save
    let renderTimeout;
    var mdSaveTimeout;
    editor.onDidChangeModelContent(() => {
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(renderPreview, 150);
        clearTimeout(mdSaveTimeout);
        mdSaveTimeout = setTimeout(function () {
            localStorage.setItem(LS_KEY_MD, editor.getValue());
        }, 500);
    });

    // ── Sample Templates ──
    document.querySelectorAll('[data-sample]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            var key = this.dataset.sample;
            if (samples[key] && editor) {
                editor.setValue(samples[key]);
                editor.revealLine(1);
                editor.focus();
            }
        });
    });

    // ── File upload: Click ──
    document.getElementById('openFileBtn').addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) loadLocalFile(e.target.files[0]);
        fileInput.value = '';
    });

    // ── File upload: Drag & Drop ──
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drop-active');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-active'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-active');
        if (e.dataTransfer.files.length > 0) loadLocalFile(e.dataTransfer.files[0]);
    });

    // ── Also support drop on editor ──
    const editorContainer = document.getElementById('markdownEditor');
    editorContainer.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    editorContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files.length > 0) loadLocalFile(e.dataTransfer.files[0]);
    });

    function loadLocalFile(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            editor.setValue(ev.target.result);
            editor.revealLine(1);
            editor.focus();
        };
        reader.readAsText(file);
    }

    // ── URL Fetch ──
    document.getElementById('fetchUrlBtn').addEventListener('click', fetchFromUrl);
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') fetchFromUrl();
    });

    async function fetchFromUrl() {
        const url = urlInput.value.trim();
        if (!url) return;

        const btn = document.getElementById('fetchUrlBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Fetching...';

        try {
            const resp = await fetch('/api/proxy?url=' + encodeURIComponent(url));
            if (!resp.ok) throw new Error(await resp.text());
            const data = await resp.json();
            editor.setValue(data.content);
            editor.revealLine(1);
            editor.focus();
        } catch (err) {
            alert('Failed to fetch: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-cloud-download"></i> Fetch';
        }
    }

    // ── Check ?url= query param on load ──
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    if (urlParam) {
        urlInput.value = urlParam;
        fetchFromUrl();
    }

    // ── Copy rendered HTML ──
    document.getElementById('copyHtmlBtn').addEventListener('click', () => {
        const html = previewPane.innerHTML;
        if (!html) return;
        navigator.clipboard.writeText(html).then(() => {
            const toast = document.createElement('div');
            toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-success py-2 px-3 small';
            toast.style.zIndex = '9999';
            toast.textContent = 'HTML copied!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 1500);
        });
    });

    // ── Export to PDF ──
    document.getElementById('exportPdfBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const html = previewPane.innerHTML;
        if (!html.trim()) return;
        const printContainer = document.getElementById('printContainer');
        printContainer.innerHTML = html;
        printContainer.style.display = 'block';
        window.print();
        setTimeout(() => { printContainer.style.display = 'none'; }, 500);
    });

    // ── Export to Markdown ──
    document.getElementById('exportMdBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const md = editor.getValue();
        if (!md.trim()) return;
        downloadFile(md, 'document.md', 'text/markdown');
    });

    // ── Export to HTML ──
    document.getElementById('exportHtmlBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const html = previewPane.innerHTML;
        if (!html.trim()) return;
        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Markdown Export</title>
<style>
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 860px;
    margin: 0 auto;
    padding: 2rem;
    line-height: 1.6;
    color: ${isDark ? '#e0e0e0' : '#24292f'};
    background: ${isDark ? '#1e1e1e' : '#fff'};
}
h1, h2 { border-bottom: 1px solid ${isDark ? '#444' : '#d1d9e0'}; padding-bottom: 0.3em; }
pre { background: ${isDark ? '#2d2d2d' : '#f6f8fa'}; border-radius: 6px; padding: 1rem; overflow-x: auto; }
code { font-size: 0.875em; font-family: 'Consolas', 'Monaco', monospace; }
table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
th, td { border: 1px solid ${isDark ? '#444' : '#d1d9e0'}; padding: 0.5rem; }
th { background: ${isDark ? '#2d2d2d' : '#f6f8fa'}; }
blockquote { border-left: 4px solid ${isDark ? '#444' : '#d1d9e0'}; padding-left: 1rem; color: ${isDark ? '#999' : '#656d76'}; margin-left: 0; }
img { max-width: 100%; }
a { color: ${isDark ? '#58a6ff' : '#0969da'}; }
input[type="checkbox"] { margin-right: 0.3rem; }
</style>
</head>
<body>
${html}
</body>
</html>`;
        downloadFile(fullHtml, 'document.html', 'text/html');
    });

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    }

    // ── Clear ──
    document.getElementById('clearBtn').addEventListener('click', () => {
        editor.setValue('');
        localStorage.removeItem(LS_KEY_MD);
        editor.focus();
    });

    // ── Focus mode ──
    var LS_KEY_FOCUS = 'devhelper_markdown_fullscreen';
    var focusWrapper = document.getElementById('focusWrapper');
    var focusModeBtn = document.getElementById('focusModeBtn');
    var isFocusMode = false;

    function applyFocusMode(on) {
        isFocusMode = on;
        focusWrapper.classList.toggle('focus-active', on);
        document.body.style.overflow = on ? 'hidden' : '';
        focusModeBtn.innerHTML = on ? '<i class="bi bi-fullscreen-exit"></i> Exit' : '<i class="bi bi-arrows-fullscreen"></i> Expand';
        focusModeBtn.title = on ? 'Exit expanded mode (Esc)' : 'Expand (F11)';
        focusModeBtn.classList.toggle('btn-outline-warning', on);
        focusModeBtn.classList.toggle('btn-outline-primary', !on);
        localStorage.setItem(LS_KEY_FOCUS, on ? '1' : '0');
        setTimeout(function () { editor.layout(); }, 50);
    }

    if (localStorage.getItem(LS_KEY_FOCUS) === '1') applyFocusMode(true);

    focusModeBtn.addEventListener('click', function () { applyFocusMode(!isFocusMode); });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isFocusMode) { e.preventDefault(); applyFocusMode(false); }
        if (e.key === 'F11') { e.preventDefault(); applyFocusMode(!isFocusMode); }
    });

    // ── Focus editor ──
    editor.focus();
});

function getDefaultContent() {
    return `# Markdown Viewer

Write or paste your **Markdown** here and see the live preview on the right.

## Features

- **Live preview** as you type
- GitHub Flavored Markdown (tables, task lists, strikethrough)
- Syntax highlighted code blocks
- Drag & drop or fetch \`.md\` files

## Example

### Code Block

\`\`\`javascript
function greet(name) {
    console.log(\`Hello, \${name}!\`);
}
greet('World');
\`\`\`

### Table

| Feature | Status |
|---------|--------|
| Live Preview | Done |
| Code Highlight | Done |
| File Upload | Done |

### Task List

- [x] Create markdown viewer
- [x] Add syntax highlighting
- [ ] Add more features

> This is a blockquote. You can use it for notes or quotes.

---

*Made with Love by Fariz & Claude*
`;
}
