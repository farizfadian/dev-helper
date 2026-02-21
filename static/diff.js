// ── Language detection map ──
const langMap = {
    '.js': 'javascript', '.mjs': 'javascript', '.jsx': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript',
    '.json': 'json', '.jsonc': 'json',
    '.html': 'html', '.htm': 'html',
    '.css': 'css', '.scss': 'scss', '.less': 'less',
    '.xml': 'xml', '.svg': 'xml',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.md': 'markdown',
    '.py': 'python',
    '.java': 'java',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
    '.c': 'c', '.h': 'c',
    '.rb': 'ruby',
    '.php': 'php',
    '.sh': 'shell', '.bash': 'shell',
    '.sql': 'sql',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.dart': 'dart',
    '.lua': 'lua',
    '.bat': 'bat', '.cmd': 'bat',
    '.ps1': 'powershell',
    '.txt': 'plaintext', '.log': 'plaintext',
    '.ini': 'ini', '.toml': 'ini',
};

const langNames = {
    'plaintext': 'Plain Text', 'javascript': 'JavaScript', 'typescript': 'TypeScript',
    'json': 'JSON', 'html': 'HTML', 'css': 'CSS', 'xml': 'XML', 'yaml': 'YAML',
    'markdown': 'Markdown', 'python': 'Python', 'java': 'Java', 'csharp': 'C#',
    'go': 'Go', 'rust': 'Rust', 'cpp': 'C++', 'c': 'C', 'ruby': 'Ruby',
    'php': 'PHP', 'shell': 'Shell', 'sql': 'SQL', 'swift': 'Swift', 'kotlin': 'Kotlin',
    'dart': 'Dart', 'lua': 'Lua', 'bat': 'Batch', 'powershell': 'PowerShell',
    'scss': 'SCSS', 'less': 'LESS', 'ini': 'INI / TOML',
};

// ── State ──
let diffEditor = null;
let originalModel = null;
let modifiedModel = null;
let isSideBySide = true;
let currentLang = 'plaintext';
const LS_KEY_DIFF_ORIG = 'devhelper_diff_original';
const LS_KEY_DIFF_MOD = 'devhelper_diff_modified';
const LS_KEY_DIFF_LANG = 'devhelper_diff_lang';

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
    const languageSelect = document.getElementById('languageSelect');
    const statusLeft = document.getElementById('statusLeft');
    const statusRight = document.getElementById('statusRight');

    // ── Create models (restore from localStorage) ──
    var savedLang = localStorage.getItem(LS_KEY_DIFF_LANG) || 'plaintext';
    currentLang = savedLang;
    originalModel = monaco.editor.createModel(localStorage.getItem(LS_KEY_DIFF_ORIG) || '', savedLang);
    modifiedModel = monaco.editor.createModel(localStorage.getItem(LS_KEY_DIFF_MOD) || '', savedLang);

    // ── Create diff editor ──
    diffEditor = monaco.editor.createDiffEditor(document.getElementById('diffContainer'), {
        automaticLayout: true,
        renderSideBySide: true,
        originalEditable: true,
        fontSize: 14,
        scrollBeyondLastLine: false,
        theme: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'vs-dark' : 'vs',
        minimap: { enabled: false },
        renderWhitespace: 'selection',
        tabSize: 4,
        insertSpaces: true,
    });

    diffEditor.setModel({
        original: originalModel,
        modified: modifiedModel,
    });

    // ── Restore saved language in selector ──
    if (savedLang !== 'plaintext') languageSelect.value = savedLang;

    // ── Auto-save to localStorage ──
    var diffSaveTimeout;
    function saveDiffToLS() {
        clearTimeout(diffSaveTimeout);
        diffSaveTimeout = setTimeout(function () {
            localStorage.setItem(LS_KEY_DIFF_ORIG, originalModel.getValue());
            localStorage.setItem(LS_KEY_DIFF_MOD, modifiedModel.getValue());
            localStorage.setItem(LS_KEY_DIFF_LANG, currentLang);
        }, 500);
    }
    originalModel.onDidChangeContent(saveDiffToLS);
    modifiedModel.onDidChangeContent(saveDiffToLS);

    // ── Update status on changes ──
    function updateStatus() {
        const origLines = originalModel.getLineCount();
        const modLines = modifiedModel.getLineCount();
        statusLeft.textContent = `Original: ${origLines} lines | Modified: ${modLines} lines`;
        statusRight.textContent = langNames[currentLang] || currentLang;
    }

    originalModel.onDidChangeContent(updateStatus);
    modifiedModel.onDidChangeContent(updateStatus);

    // ── Language selector ──
    languageSelect.addEventListener('change', () => {
        currentLang = languageSelect.value;
        monaco.editor.setModelLanguage(originalModel, currentLang);
        monaco.editor.setModelLanguage(modifiedModel, currentLang);
        localStorage.setItem(LS_KEY_DIFF_LANG, currentLang);
        updateStatus();
    });

    // ── Inline / Side-by-Side toggle ──
    document.getElementById('inlineToggle').addEventListener('click', () => {
        isSideBySide = !isSideBySide;
        diffEditor.updateOptions({ renderSideBySide: isSideBySide });
        const btn = document.getElementById('inlineToggle');
        btn.innerHTML = isSideBySide
            ? '<i class="bi bi-layout-split"></i> Side by Side'
            : '<i class="bi bi-layout-text-sidebar"></i> Inline';
    });

    // ── Swap ──
    document.getElementById('swapBtn').addEventListener('click', () => {
        const origVal = originalModel.getValue();
        const modVal = modifiedModel.getValue();
        originalModel.setValue(modVal);
        modifiedModel.setValue(origVal);
    });

    // ── Clear ──
    document.getElementById('clearBtn').addEventListener('click', () => {
        originalModel.setValue('');
        modifiedModel.setValue('');
        localStorage.removeItem(LS_KEY_DIFF_ORIG);
        localStorage.removeItem(LS_KEY_DIFF_MOD);
    });

    // ── File drop: Original ──
    setupFileDrop('dropOriginal', 'fileOriginal', (content, filename) => {
        originalModel.setValue(content);
        autoDetectLanguage(filename);
    });

    // ── File drop: Modified ──
    setupFileDrop('dropModified', 'fileModified', (content, filename) => {
        modifiedModel.setValue(content);
        autoDetectLanguage(filename);
    });

    function setupFileDrop(dropId, inputId, onLoad) {
        const dropZone = document.getElementById(dropId);
        const fileInput = document.getElementById(inputId);

        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) readFile(e.target.files[0], onLoad);
            fileInput.value = '';
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drop-active');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-active'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drop-active');
            if (e.dataTransfer.files.length > 0) readFile(e.dataTransfer.files[0], onLoad);
        });
    }

    function readFile(file, onLoad) {
        const reader = new FileReader();
        reader.onload = (ev) => onLoad(ev.target.result, file.name);
        reader.readAsText(file);
    }

    function autoDetectLanguage(filename) {
        if (!filename) return;
        const dotIdx = filename.lastIndexOf('.');
        if (dotIdx === -1) return;
        const ext = filename.substring(dotIdx).toLowerCase();
        const lang = langMap[ext];
        if (lang && lang !== currentLang) {
            currentLang = lang;
            languageSelect.value = lang;
            monaco.editor.setModelLanguage(originalModel, lang);
            monaco.editor.setModelLanguage(modifiedModel, lang);
            updateStatus();
        }
    }

    // ── Initial status ──
    updateStatus();
});
