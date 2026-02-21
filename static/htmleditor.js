document.addEventListener('DOMContentLoaded', function () {
    const tinymceContainer = document.getElementById('tinymceContainer');
    const monacoContainer = document.getElementById('monacoContainer');
    const wysiwygBtn = document.getElementById('wysiwygBtn');
    const sourceBtn = document.getElementById('sourceBtn');
    const stats = document.getElementById('stats');

    let monacoEditor = null;
    let currentMode = 'wysiwyg'; // 'wysiwyg' or 'source'
    var LS_KEY = 'devhelper_htmleditor_content';
    let htmlContent = localStorage.getItem(LS_KEY) || '<p>Start writing here...</p>';

    function saveToLS() {
        var html;
        if (currentMode === 'wysiwyg') {
            var ed = tinymce.activeEditor;
            html = ed ? ed.getContent() : '';
        } else {
            html = monacoEditor ? monacoEditor.getValue() : '';
        }
        localStorage.setItem(LS_KEY, html);
    }
    var saveTimeout;

    // ── Detect theme ──
    function isDark() {
        return document.documentElement.getAttribute('data-bs-theme') === 'dark';
    }

    // ── TinyMCE Init ──
    function initTinyMCE() {
        const dark = isDark();
        tinymce.init({
            selector: '#wysiwygEditor',
            base_url: 'https://cdn.jsdelivr.net/npm/tinymce@7',
            suffix: '.min',
            height: 500,
            menubar: true,
            skin: dark ? 'oxide-dark' : 'oxide',
            content_css: dark ? 'dark' : 'default',
            plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'help', 'wordcount', 'emoticons'
            ],
            toolbar: 'undo redo | blocks | bold italic underline strikethrough | ' +
                'forecolor backcolor | alignleft aligncenter alignright alignjustify | ' +
                'bullist numlist outdent indent | link image media table | ' +
                'emoticons charmap | removeformat | code fullscreen help',
            content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; }',
            promotion: false,
            branding: false,
            setup: function (editor) {
                editor.on('init', function () {
                    editor.setContent(htmlContent);
                    updateStats();
                });
                editor.on('input change', function () {
                    updateStats();
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(saveToLS, 500);
                });
            }
        });
    }

    initTinyMCE();

    // ── Monaco Setup ──
    require.config({ paths: { 'vs': '/static/monaco-editor/min/vs' } });
    window.MonacoEnvironment = {
        getWorkerUrl: function (workerId, label) {
            const base = window.location.origin + '/static/monaco-editor/min';
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(
                `self.MonacoEnvironment = { baseUrl: '${base}/' }; importScripts('${base}/vs/base/worker/workerMain.js');`
            )}`;
        }
    };

    function initMonaco(content) {
        if (monacoEditor) {
            monacoEditor.setValue(content);
            return;
        }
        require(['vs/editor/editor.main'], function () {
            monacoEditor = monaco.editor.create(monacoContainer, {
                value: content,
                language: 'html',
                theme: isDark() ? 'vs-dark' : 'vs',
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                tabSize: 2,
            });
        });
    }

    // ── Mode Toggle ──
    wysiwygBtn.addEventListener('click', function () {
        if (currentMode === 'wysiwyg') return;
        switchToWysiwyg();
    });

    sourceBtn.addEventListener('click', function () {
        if (currentMode === 'source') return;
        switchToSource();
    });

    function switchToSource() {
        // Get HTML from TinyMCE
        const editor = tinymce.activeEditor;
        if (editor) {
            htmlContent = editor.getContent();
        }

        // Format HTML for better readability
        const formatted = formatHtml(htmlContent);

        tinymceContainer.classList.add('d-none');
        monacoContainer.classList.remove('d-none');

        initMonaco(formatted);

        currentMode = 'source';
        wysiwygBtn.className = 'btn btn-outline-secondary';
        sourceBtn.className = 'btn btn-primary active';
        updateStats();
    }

    function switchToWysiwyg() {
        // Get HTML from Monaco
        if (monacoEditor) {
            htmlContent = monacoEditor.getValue();
        }

        monacoContainer.classList.add('d-none');
        tinymceContainer.classList.remove('d-none');

        // Set content to TinyMCE
        const editor = tinymce.activeEditor;
        if (editor) {
            editor.setContent(htmlContent);
        }

        currentMode = 'wysiwyg';
        wysiwygBtn.className = 'btn btn-primary active';
        sourceBtn.className = 'btn btn-outline-secondary';
        updateStats();
    }

    // ── Copy HTML ──
    document.getElementById('copyHtmlBtn').addEventListener('click', function () {
        let html;
        if (currentMode === 'wysiwyg') {
            const editor = tinymce.activeEditor;
            html = editor ? editor.getContent() : '';
        } else {
            html = monacoEditor ? monacoEditor.getValue() : '';
        }

        navigator.clipboard.writeText(html).then(() => {
            const btn = document.getElementById('copyHtmlBtn');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
            setTimeout(() => btn.innerHTML = orig, 1500);
        });
    });

    // ── Clear ──
    document.getElementById('clearBtn').addEventListener('click', function () {
        htmlContent = '';
        if (currentMode === 'wysiwyg') {
            const editor = tinymce.activeEditor;
            if (editor) editor.setContent('');
        } else {
            if (monacoEditor) monacoEditor.setValue('');
        }
        localStorage.removeItem(LS_KEY);
        updateStats();
    });

    // ── Import File ──
    document.getElementById('importFile').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            htmlContent = e.target.result;
            if (currentMode === 'wysiwyg') {
                const editor = tinymce.activeEditor;
                if (editor) editor.setContent(htmlContent);
            } else {
                if (monacoEditor) monacoEditor.setValue(htmlContent);
            }
            updateStats();
        };
        reader.readAsText(file);
        this.value = '';
    });

    // ── Theme Change ──
    window.addEventListener('devhelper-theme', function (e) {
        const dark = e.detail.theme === 'dark';

        // Reinit TinyMCE with new skin
        if (tinymce.activeEditor) {
            htmlContent = tinymce.activeEditor.getContent();
            tinymce.activeEditor.destroy();
            initTinyMCE();
        }

        // Update Monaco theme
        if (monacoEditor && typeof monaco !== 'undefined') {
            monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
        }
    });

    // ── Stats ──
    function updateStats() {
        let html;
        if (currentMode === 'wysiwyg') {
            const editor = tinymce.activeEditor;
            html = editor ? editor.getContent() : '';
        } else {
            html = monacoEditor ? monacoEditor.getValue() : '';
        }
        const charCount = html.length;
        const textOnly = html.replace(/<[^>]*>/g, '');
        const wordCount = textOnly.trim() ? textOnly.trim().split(/\s+/).length : 0;
        stats.textContent = `${wordCount} words | ${charCount} chars (HTML)`;
    }

    // ── Simple HTML Formatter ──
    function formatHtml(html) {
        // Basic indentation for readability
        let formatted = '';
        let indent = 0;
        const tab = '  ';

        // Split on tags
        const tokens = html.replace(/>\s*</g, '>\n<').split('\n');

        tokens.forEach(function (token) {
            const trimmed = token.trim();
            if (!trimmed) return;

            // Closing tag
            if (trimmed.match(/^<\/\w/)) {
                indent = Math.max(0, indent - 1);
            }

            formatted += tab.repeat(indent) + trimmed + '\n';

            // Opening tag (not self-closing, not void elements)
            if (trimmed.match(/^<\w[^>]*[^\/]>$/) && !trimmed.match(/^<(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)\b/i)) {
                indent++;
            }
        });

        return formatted.trim();
    }
});
