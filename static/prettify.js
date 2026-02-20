// ── Monaco format mapping ──
const formatToMonacoLang = {
    'json': 'json',
    'xml': 'xml',
    'html': 'html',
    'css': 'css',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'sql': 'sql',
    'yaml': 'yaml',
    'scss': 'scss',
    'less': 'less',
};

// ── State ──
let inputEditor = null;
let outputEditor = null;

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
    const formatSelect = document.getElementById('formatSelect');
    const indentSelect = document.getElementById('indentSelect');
    const errorBar = document.getElementById('errorBar');
    const prettifyBtn = document.getElementById('prettifyBtn');
    const minifyBtn = document.getElementById('minifyBtn');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const swapBtn = document.getElementById('swapBtn');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    const formatExtMap = {
        '.json': 'json', '.jsonc': 'json',
        '.xml': 'xml', '.svg': 'xml', '.xsl': 'xml',
        '.html': 'html', '.htm': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.less': 'less',
        '.js': 'javascript', '.mjs': 'javascript', '.jsx': 'javascript',
        '.ts': 'typescript', '.tsx': 'typescript',
        '.sql': 'sql',
        '.yaml': 'yaml', '.yml': 'yaml',
    };

    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const editorOptions = {
        fontSize: 13,
        minimap: { enabled: false },
        lineNumbers: 'on',
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
        folding: true,
        bracketPairColorization: { enabled: true },
        renderWhitespace: 'selection',
        theme: isDark ? 'vs-dark' : 'vs',
    };

    // ── Create input editor ──
    inputEditor = monaco.editor.create(document.getElementById('inputEditor'), {
        ...editorOptions,
        value: '',
        language: 'json',
    });

    // ── Create output editor (readonly) ──
    outputEditor = monaco.editor.create(document.getElementById('outputEditor'), {
        ...editorOptions,
        value: '',
        language: 'json',
        readOnly: true,
    });

    function getIndent() {
        const val = indentSelect.value;
        return val === 'tab' ? '\t' : parseInt(val);
    }

    function showError(msg) {
        errorBar.textContent = msg;
        errorBar.classList.remove('d-none');
    }

    function hideError() {
        errorBar.classList.add('d-none');
    }

    function setMonacoLanguage(lang) {
        const monacoLang = formatToMonacoLang[lang] || 'plaintext';
        monaco.editor.setModelLanguage(inputEditor.getModel(), monacoLang);
        monaco.editor.setModelLanguage(outputEditor.getModel(), monacoLang);
    }

    // ── Prettify ──
    prettifyBtn.addEventListener('click', () => {
        hideError();
        const input = inputEditor.getValue().trim();
        if (!input) return;

        try {
            const result = prettify(input, formatSelect.value, getIndent());
            outputEditor.setValue(result);
        } catch (e) {
            showError(e.message);
        }
    });

    // ── Minify ──
    minifyBtn.addEventListener('click', () => {
        hideError();
        const input = inputEditor.getValue().trim();
        if (!input) return;

        try {
            const result = minify(input, formatSelect.value);
            outputEditor.setValue(result);
        } catch (e) {
            showError(e.message);
        }
    });

    // ── Copy output ──
    copyBtn.addEventListener('click', () => {
        const text = outputEditor.getValue();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            const toast = document.createElement('div');
            toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-success py-2 px-3 small';
            toast.style.zIndex = '9999';
            toast.textContent = 'Copied!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 1500);
        });
    });

    // ── Clear ──
    clearBtn.addEventListener('click', () => {
        inputEditor.setValue('');
        outputEditor.setValue('');
        hideError();
    });

    // ── Swap: copy output to input ──
    swapBtn.addEventListener('click', () => {
        const output = outputEditor.getValue();
        if (output) {
            inputEditor.setValue(output);
            outputEditor.setValue('');
        }
    });

    // ── Ctrl+Enter to prettify ──
    inputEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        prettifyBtn.click();
    });

    // ── Auto-detect format on content change (debounced) ──
    let detectTimeout;
    inputEditor.onDidChangeModelContent(() => {
        clearTimeout(detectTimeout);
        detectTimeout = setTimeout(() => {
            const text = inputEditor.getValue().trim();
            const detected = detectFormat(text);
            if (detected && detected !== formatSelect.value) {
                formatSelect.value = detected;
                setMonacoLanguage(detected);
            }
        }, 500);
    });

    // ── Format selector change → update Monaco language ──
    formatSelect.addEventListener('change', () => {
        setMonacoLanguage(formatSelect.value);
    });

    // ── File upload: click ──
    document.getElementById('openFileBtn').addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) loadFile(e.target.files[0]);
        fileInput.value = '';
    });

    // ── File upload: drag & drop ──
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drop-active'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-active'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-active');
        if (e.dataTransfer.files.length > 0) loadFile(e.dataTransfer.files[0]);
    });

    function loadFile(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            inputEditor.setValue(ev.target.result);
            outputEditor.setValue('');
            hideError();
            // Auto-detect format from extension
            const dot = file.name.lastIndexOf('.');
            if (dot !== -1) {
                const ext = file.name.substring(dot).toLowerCase();
                const fmt = formatExtMap[ext];
                if (fmt) {
                    formatSelect.value = fmt;
                    setMonacoLanguage(fmt);
                }
            }
            inputEditor.revealLine(1);
            inputEditor.focus();
        };
        reader.readAsText(file);
    }

    // ── Focus input editor ──
    inputEditor.focus();

    // ── Format detection ──
    function detectFormat(text) {
        if (!text) return null;
        const first = text.charAt(0);
        if (first === '{' || first === '[') return 'json';
        if (first === '<') {
            if (text.match(/<!DOCTYPE\s+html/i) || text.match(/<html/i)) return 'html';
            return 'xml';
        }
        if (text.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\s/i)) return 'sql';
        if (text.match(/^---\s*\n/) || text.match(/^\w[\w\s]*:\s/)) return 'yaml';
        if (text.match(/^\s*\$[\w-]+\s*:/) || text.match(/@mixin\s/) || text.match(/@include\s/)) return 'scss';
        if (text.match(/^\s*@[\w-]+\s*:/) || text.match(/\.[\w-]+\s*\(/) && text.includes('{')) return 'less';
        if (text.match(/^\s*[\.\#\@a-z\*\:]/i) && text.includes('{') && text.includes('}') && text.includes(':')) return 'css';
        return null;
    }

    // ── Prettify dispatchers ──
    function prettify(input, format, indent) {
        switch (format) {
            case 'json': return prettifyJSON(input, indent);
            case 'xml': return prettifyXML(input, indent);
            case 'html': return prettifyHTML(input, indent);
            case 'css': return prettifyCSS(input, indent);
            case 'javascript': return prettifyJS(input, indent);
            case 'typescript': return prettifyTS(input, indent);
            case 'sql': return prettifySQL(input, indent);
            case 'yaml': return prettifyYAML(input, indent);
            case 'scss': return prettifySCSS(input, indent);
            case 'less': return prettifyLESS(input, indent);
            default: throw new Error('Unknown format: ' + format);
        }
    }

    function minify(input, format) {
        switch (format) {
            case 'json': return JSON.stringify(JSON.parse(input));
            case 'xml':
            case 'html': return input.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
            case 'css':
            case 'scss':
            case 'less': return input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s*\{\s*/g, '{').replace(/\s*\}\s*/g, '}').replace(/\s*:\s*/g, ':').replace(/\s*;\s*/g, ';').replace(/\s*,\s*/g, ',').replace(/\n/g, '').trim();
            case 'javascript':
            case 'typescript': return typeof js_beautify !== 'undefined' ? js_beautify(input, { indent_size: 0 }).replace(/\n\s*/g, ' ').trim() : input.replace(/\s+/g, ' ').trim();
            case 'sql': return input.replace(/\s+/g, ' ').trim();
            case 'yaml': return prettifyYAML(input, 0);
            default: throw new Error('Unknown format: ' + format);
        }
    }

    // ── Format-specific prettifiers ──

    function prettifyJSON(input, indent) {
        const parsed = JSON.parse(input);
        return JSON.stringify(parsed, null, indent);
    }

    function prettifyXML(input, indent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(input, 'application/xml');
        const errorNode = doc.querySelector('parsererror');
        if (errorNode) throw new Error('Invalid XML: ' + errorNode.textContent.split('\n')[0]);

        const tab = typeof indent === 'number' ? ' '.repeat(indent) : '\t';
        return formatXMLNode(doc.documentElement, '', tab);
    }

    function formatXMLNode(node, pad, tab) {
        let out = '';

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            return text ? pad + text : '';
        }

        if (node.nodeType === Node.COMMENT_NODE) {
            return pad + '<!--' + node.textContent + '-->';
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        let tag = pad + '<' + node.tagName;
        for (const attr of node.attributes) {
            tag += ' ' + attr.name + '="' + attr.value + '"';
        }

        const children = Array.from(node.childNodes).filter(n =>
            n.nodeType === Node.ELEMENT_NODE ||
            n.nodeType === Node.COMMENT_NODE ||
            (n.nodeType === Node.TEXT_NODE && n.textContent.trim())
        );

        if (children.length === 0) {
            return tag + '/>';
        }

        if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
            return tag + '>' + children[0].textContent.trim() + '</' + node.tagName + '>';
        }

        out = tag + '>\n';
        for (const child of children) {
            const line = formatXMLNode(child, pad + tab, tab);
            if (line) out += line + '\n';
        }
        out += pad + '</' + node.tagName + '>';
        return out;
    }

    function prettifyHTML(input, indent) {
        if (typeof html_beautify === 'undefined') throw new Error('HTML beautifier not loaded');
        const opts = typeof indent === 'number'
            ? { indent_size: indent, indent_char: ' ', wrap_line_length: 120 }
            : { indent_size: 1, indent_char: '\t', wrap_line_length: 120 };
        return html_beautify(input, opts);
    }

    function prettifyCSS(input, indent) {
        if (typeof css_beautify === 'undefined') throw new Error('CSS beautifier not loaded');
        const opts = typeof indent === 'number'
            ? { indent_size: indent, indent_char: ' ' }
            : { indent_size: 1, indent_char: '\t' };
        return css_beautify(input, opts);
    }

    function prettifyJS(input, indent) {
        if (typeof js_beautify === 'undefined') throw new Error('JS beautifier not loaded');
        const opts = typeof indent === 'number'
            ? { indent_size: indent, indent_char: ' ' }
            : { indent_size: 1, indent_char: '\t' };
        return js_beautify(input, opts);
    }

    function prettifySQL(input, indent) {
        if (typeof sqlFormatter === 'undefined' && typeof window.sqlFormatter === 'undefined') {
            throw new Error('SQL formatter not loaded');
        }
        const fmt = window.sqlFormatter || sqlFormatter;
        const opts = typeof indent === 'number'
            ? { tabWidth: indent, useTabs: false }
            : { tabWidth: 1, useTabs: true };
        return fmt.format(input, opts);
    }

    function prettifyYAML(input, indent) {
        if (typeof jsyaml === 'undefined') throw new Error('js-yaml library not loaded');
        const parsed = jsyaml.load(input);
        const indentNum = (typeof indent === 'number' && indent > 0) ? indent : 2;
        return jsyaml.dump(parsed, { indent: indentNum, lineWidth: 120, noRefs: true });
    }

    function prettifyTS(input, indent) {
        if (typeof js_beautify === 'undefined') throw new Error('JS beautifier not loaded');
        const opts = typeof indent === 'number'
            ? { indent_size: indent, indent_char: ' ', e4x: true }
            : { indent_size: 1, indent_char: '\t', e4x: true };
        return js_beautify(input, opts);
    }

    function prettifySCSS(input, indent) {
        if (typeof css_beautify === 'undefined') throw new Error('CSS beautifier not loaded');
        const opts = typeof indent === 'number'
            ? { indent_size: indent, indent_char: ' ' }
            : { indent_size: 1, indent_char: '\t' };
        return css_beautify(input, opts);
    }

    function prettifyLESS(input, indent) {
        if (typeof css_beautify === 'undefined') throw new Error('CSS beautifier not loaded');
        const opts = typeof indent === 'number'
            ? { indent_size: indent, indent_char: ' ' }
            : { indent_size: 1, indent_char: '\t' };
        return css_beautify(input, opts);
    }
});
