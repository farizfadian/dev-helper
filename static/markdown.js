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

    // ── Create Monaco editor for Markdown ──
    editor = monaco.editor.create(document.getElementById('markdownEditor'), {
        value: getDefaultContent(),
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

    // Re-render on change (debounced)
    let renderTimeout;
    editor.onDidChangeModelContent(() => {
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(renderPreview, 150);
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

    // ── Clear ──
    document.getElementById('clearBtn').addEventListener('click', () => {
        editor.setValue('');
        editor.focus();
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
