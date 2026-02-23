// ── Language detection map ──
const langMap = {
    '.js': 'javascript', '.mjs': 'javascript', '.jsx': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript',
    '.json': 'json', '.jsonc': 'json',
    '.html': 'html', '.htm': 'html',
    '.css': 'css', '.scss': 'scss', '.less': 'less',
    '.xml': 'xml', '.svg': 'xml', '.xsl': 'xml', '.xslt': 'xml',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.md': 'markdown', '.mdx': 'markdown',
    '.py': 'python', '.pyw': 'python',
    '.java': 'java',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
    '.c': 'c', '.h': 'c',
    '.rb': 'ruby',
    '.php': 'php',
    '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
    '.sql': 'sql',
    '.r': 'r',
    '.swift': 'swift',
    '.kt': 'kotlin', '.kts': 'kotlin',
    '.dart': 'dart',
    '.lua': 'lua',
    '.pl': 'perl', '.pm': 'perl',
    '.scala': 'scala',
    '.txt': 'plaintext', '.log': 'plaintext', '.csv': 'plaintext',
    '.ini': 'ini', '.toml': 'ini', '.cfg': 'ini', '.conf': 'ini',
    '.dockerfile': 'dockerfile',
    '.bat': 'bat', '.cmd': 'bat',
    '.ps1': 'powershell', '.psm1': 'powershell',
    '.graphql': 'graphql', '.gql': 'graphql',
    '.vue': 'html',
    '.properties': 'ini',
};

// ── Language display names ──
const langNames = {
    'plaintext': 'Plain Text', 'javascript': 'JavaScript', 'typescript': 'TypeScript',
    'json': 'JSON', 'html': 'HTML', 'css': 'CSS', 'scss': 'SCSS', 'less': 'LESS',
    'xml': 'XML', 'yaml': 'YAML', 'markdown': 'Markdown', 'python': 'Python',
    'java': 'Java', 'csharp': 'C#', 'go': 'Go', 'rust': 'Rust', 'cpp': 'C++',
    'c': 'C', 'ruby': 'Ruby', 'php': 'PHP', 'shell': 'Shell', 'sql': 'SQL',
    'r': 'R', 'swift': 'Swift', 'kotlin': 'Kotlin', 'dart': 'Dart', 'lua': 'Lua',
    'perl': 'Perl', 'scala': 'Scala', 'ini': 'INI / TOML', 'dockerfile': 'Dockerfile',
    'bat': 'Batch', 'powershell': 'PowerShell', 'graphql': 'GraphQL',
};

// ── State ──
let editor = null;
let currentFilename = 'untitled.txt';
let isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
let isWordWrap = false;
const LS_KEY_EDITOR = 'devhelper_editor_content';
const LS_KEY_EDITOR_LANG = 'devhelper_editor_lang';

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
    // ── Create editor ──
    var savedContent = localStorage.getItem(LS_KEY_EDITOR) || '';
    var savedLang = localStorage.getItem(LS_KEY_EDITOR_LANG) || 'plaintext';
    editor = monaco.editor.create(document.getElementById('editorContainer'), {
        value: savedContent,
        language: savedLang,
        theme: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: true },
        lineNumbers: 'on',
        wordWrap: 'off',
        fontSize: 14,
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        tabSize: 4,
        insertSpaces: true,
        folding: true,
        bracketPairColorization: { enabled: true },
        smoothScrolling: true,
    });

    // ── DOM refs ──
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const urlInput = document.getElementById('urlInput');
    const languageSelect = document.getElementById('languageSelect');
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    const statusLeft = document.getElementById('statusLeft');
    const statusCenter = document.getElementById('statusCenter');
    const statusRight = document.getElementById('statusRight');

    // ── Restore saved language in selector ──
    if (savedLang !== 'plaintext') languageSelect.value = savedLang;

    // ── Auto-save to localStorage ──
    var editorSaveTimeout;
    editor.onDidChangeModelContent(function () {
        clearTimeout(editorSaveTimeout);
        editorSaveTimeout = setTimeout(function () {
            localStorage.setItem(LS_KEY_EDITOR, editor.getValue());
        }, 500);
    });

    // ── File Upload: Click ──
    document.getElementById('openFileBtn').addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) loadLocalFile(e.target.files[0]);
        fileInput.value = '';
    });

    // ── File Upload: Drag & Drop ──
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

    // ── Also support drop on editor container ──
    const editorContainer = document.getElementById('editorContainer');
    editorContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    editorContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files.length > 0) loadLocalFile(e.dataTransfer.files[0]);
    });

    // ── Load local file with FileReader ──
    function loadLocalFile(file) {
        currentFilename = file.name;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target.result;
            const lang = detectLanguage(file.name);
            setEditorContent(content, lang);
            statusCenter.textContent = file.name;
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
            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(errText);
            }
            const data = await resp.json();
            currentFilename = data.filename;
            const lang = detectLanguage(data.filename);
            setEditorContent(data.content, lang);
            statusCenter.textContent = data.filename;
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

    // ── Set editor content & language ──
    function setEditorContent(content, lang) {
        monaco.editor.setModelLanguage(editor.getModel(), lang);
        editor.setValue(content);
        editor.revealLine(1);
        editor.focus();
        languageSelect.value = lang;
        updateStatusRight();
    }

    // ── Language detection ──
    function detectLanguage(filename) {
        if (!filename) return 'plaintext';
        // Handle Dockerfile (no extension)
        const base = filename.split('/').pop().split('\\').pop().toLowerCase();
        if (base === 'dockerfile' || base.startsWith('dockerfile.')) return 'dockerfile';
        if (base === 'makefile') return 'plaintext';

        const dotIdx = base.lastIndexOf('.');
        if (dotIdx === -1) return 'plaintext';
        const ext = base.substring(dotIdx);
        return langMap[ext] || 'plaintext';
    }

    // ── Language selector ──
    languageSelect.addEventListener('change', () => {
        monaco.editor.setModelLanguage(editor.getModel(), languageSelect.value);
        localStorage.setItem(LS_KEY_EDITOR_LANG, languageSelect.value);
        updateStatusRight();
    });

    // ── Font size ──
    fontSizeSelect.addEventListener('change', () => {
        editor.updateOptions({ fontSize: parseInt(fontSizeSelect.value) });
    });

    // ── Word wrap toggle ──
    document.getElementById('wrapBtn').addEventListener('click', () => {
        isWordWrap = !isWordWrap;
        editor.updateOptions({ wordWrap: isWordWrap ? 'on' : 'off' });
        const btn = document.getElementById('wrapBtn');
        btn.classList.toggle('btn-outline-secondary', !isWordWrap);
        btn.classList.toggle('btn-secondary', isWordWrap);
    });

    // ── Theme toggle (editor-local, syncs with global) ──
    function syncEditorThemeBtn() {
        const btn = document.getElementById('themeBtn');
        btn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
    }
    syncEditorThemeBtn();

    document.getElementById('themeBtn').addEventListener('click', () => {
        isDark = !isDark;
        monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
        syncEditorThemeBtn();
        // Sync global theme
        localStorage.setItem('devhelper_theme', isDark ? 'dark' : 'light');
        if (typeof applyTheme === 'function') applyTheme(isDark ? 'dark' : 'light');
    });

    // Listen for global theme changes
    window.addEventListener('devhelper-theme', (e) => {
        isDark = e.detail.theme === 'dark';
        monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
        syncEditorThemeBtn();
    });

    // ── Download ──
    document.getElementById('downloadBtn').addEventListener('click', () => {
        const content = editor.getValue();
        if (!content) return;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFilename || 'untitled.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // ── Status bar: cursor position ──
    editor.onDidChangeCursorPosition((e) => {
        statusLeft.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    });

    function updateStatusRight() {
        const lang = editor.getModel().getLanguageId();
        const name = langNames[lang] || lang;
        statusRight.textContent = `${name} | UTF-8`;
    }

    // ── Keyboard shortcuts ──
    // Ctrl+S to download
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        document.getElementById('downloadBtn').click();
    });

    // ── Focus mode ──
    var LS_KEY_FOCUS = 'devhelper_editor_fullscreen';
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

    // ── Initial focus ──
    editor.focus();
});

// ── Copy utilities (project pattern) ──
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-success py-2 px-3 shadow-sm';
        toast.style.zIndex = '9999';
        toast.textContent = 'Copied!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    });
}
