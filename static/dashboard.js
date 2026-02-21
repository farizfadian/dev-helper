// ── Tools Registry ──
// Tool ID must match data-tool attribute in layout.html navbar and page headers.
// Pinned state is read from localStorage (managed by layout.html's togglePin).
const tools = [
    {
        id: 'upload',
        name: 'Upload',
        icon: 'bi-upload',
        iconColor: '#0d6efd',
        desc: 'Drag & drop, paste, or browse files to upload. Image preview with lightbox.',
        url: '/upload',
        tags: ['upload', 'file', 'image', 'paste', 'drag drop'],
    },
    {
        id: 'files',
        name: 'File Explorer',
        icon: 'bi-folder2-open',
        iconColor: '#fd7e14',
        desc: 'Browse, search, and manage uploaded files in a Google Drive-like grid view.',
        url: '/explorer',
        tags: ['files', 'explorer', 'browse', 'manage', 'delete'],
    },
    {
        id: 'prettify',
        name: 'Prettify',
        icon: 'bi-braces',
        iconColor: '#198754',
        desc: 'Format & beautify JSON, XML, HTML, CSS, JavaScript, and SQL code.',
        url: '/prettify',
        tags: ['prettify', 'format', 'beautify', 'json', 'xml', 'html', 'css', 'javascript', 'sql', 'minify'],
    },
    {
        id: 'logs',
        name: 'Log Aggregator',
        icon: 'bi-terminal',
        iconColor: '#6f42c1',
        desc: 'Lightweight log collector. Receive logs from any app via HTTP POST, filter by app and level.',
        url: '/logs',
        tags: ['log', 'aggregator', 'terminal', 'debug', 'http', 'post'],
    },
    {
        id: 'logviewer',
        name: 'Log Viewer',
        icon: 'bi-file-earmark-text',
        iconColor: '#20c997',
        desc: 'Upload and search large log files with keyword filtering, regex, and context lines.',
        url: '/logviewer',
        tags: ['log', 'viewer', 'search', 'filter', 'regex', 'large file'],
    },
    {
        id: 'editor',
        name: 'Code Editor',
        icon: 'bi-code-slash',
        iconColor: '#0dcaf0',
        desc: 'Full-featured code editor powered by Monaco (VS Code). Syntax highlighting for 40+ languages.',
        url: '/editor',
        tags: ['editor', 'code', 'monaco', 'vscode', 'syntax', 'highlight', 'javascript', 'python', 'java'],
    },
    {
        id: 'markdown',
        name: 'Markdown Viewer',
        icon: 'bi-markdown',
        iconColor: '#6c757d',
        desc: 'Write Markdown with live preview, syntax-highlighted code blocks, and GFM support.',
        url: '/markdown',
        tags: ['markdown', 'preview', 'viewer', 'md', 'github', 'gfm'],
    },
    {
        id: 'diff',
        name: 'Code Diff',
        icon: 'bi-file-diff',
        iconColor: '#dc3545',
        desc: 'Compare two code files side-by-side or inline with syntax-highlighted diff view.',
        url: '/diff',
        tags: ['diff', 'compare', 'merge', 'difference', 'code', 'comparison'],
    },
    {
        id: 'jwt',
        name: 'JWT Tool',
        icon: 'bi-shield-lock',
        iconColor: '#e6a817',
        desc: 'Encode, decode, and verify JSON Web Tokens. Supports HS256/384/512 with color-coded display.',
        url: '/jwt',
        tags: ['jwt', 'json web token', 'encode', 'decode', 'verify', 'hmac', 'token', 'auth'],
    },
    {
        id: 'base64',
        name: 'Base64',
        icon: 'bi-file-earmark-binary',
        iconColor: '#0d6efd',
        desc: 'Encode and decode Base64 strings. Supports text and binary files with URL-safe option.',
        url: '/base64',
        tags: ['base64', 'encode', 'decode', 'binary', 'convert'],
    },
    {
        id: 'urlencoder',
        name: 'URL Encoder',
        icon: 'bi-link-45deg',
        iconColor: '#198754',
        desc: 'Encode and decode URLs and query parameters. URL parser shows protocol, host, path, and params.',
        url: '/urlencoder',
        tags: ['url', 'encode', 'decode', 'uri', 'query', 'parameter', 'percent'],
    },
    {
        id: 'htmleditor',
        name: 'HTML Editor',
        icon: 'bi-filetype-html',
        iconColor: '#e44d26',
        desc: 'Rich text WYSIWYG editor powered by TinyMCE with HTML source code view toggle.',
        url: '/htmleditor',
        tags: ['html', 'wysiwyg', 'editor', 'rich text', 'tinymce', 'web'],
    },
    {
        id: 'uuid',
        name: 'UUID Generator',
        icon: 'bi-upc-scan',
        iconColor: '#6f42c1',
        desc: 'Generate UUID v1, v4, and v7. Bulk generate, validate, parse, and copy with format options.',
        url: '/uuid',
        tags: ['uuid', 'guid', 'generate', 'random', 'unique', 'identifier', 'v4', 'v7'],
    },
    {
        id: 'mermaid',
        name: 'Mermaid Diagram',
        icon: 'bi-diagram-3',
        iconColor: '#ff3670',
        desc: 'Create flowcharts, sequence diagrams, ER diagrams, Gantt charts, and more with Mermaid.js live preview.',
        url: '/mermaid',
        tags: ['mermaid', 'diagram', 'flowchart', 'sequence', 'chart', 'gantt', 'pie', 'er', 'uml', 'mindmap'],
    },
    {
        id: 'notes',
        name: 'Notes',
        icon: 'bi-journal-text',
        iconColor: '#20c997',
        desc: 'Markdown notes with live preview, tags, categories, color labels, attachments, and auto-save.',
        url: '/notes',
        tags: ['notes', 'markdown', 'journal', 'memo', 'write', 'notebook'],
    },
    {
        id: 'regex',
        name: 'Regex Tester',
        icon: 'bi-regex',
        iconColor: '#e35d6a',
        desc: 'Test regex patterns with real-time match highlighting, capture groups, replace, and cheat sheet.',
        url: '/regex',
        tags: ['regex', 'regular expression', 'pattern', 'test', 'match', 'replace', 'validate'],
    },
    {
        id: 'epoch',
        name: 'Epoch Converter',
        icon: 'bi-clock-history',
        iconColor: '#6610f2',
        desc: 'Convert Unix epoch timestamps to human-readable dates and vice versa. Live clock, presets, and time diff calculator.',
        url: '/epoch',
        tags: ['epoch', 'timestamp', 'unix', 'date', 'time', 'converter', 'utc'],
    },
    {
        id: 'charmap',
        name: 'Emoji & CharMap',
        icon: 'bi-emoji-smile',
        iconColor: '#f0ad4e',
        desc: 'Search and copy emojis, symbols, and special characters. Unicode details, HTML entities, and recently used.',
        url: '/charmap',
        tags: ['emoji', 'charmap', 'symbol', 'unicode', 'character', 'arrow', 'currency', 'special'],
    },
    {
        id: 'askai',
        name: 'Ask AI',
        icon: 'bi-robot',
        iconColor: '#d4a574',
        desc: 'Open Claude AI chat in a side panel. Ask questions, get help with code, or brainstorm ideas.',
        url: '#askai',
        tags: ['ai', 'claude', 'chat', 'assistant', 'help', 'copilot'],
    },
];

// ── Render ──
document.addEventListener('DOMContentLoaded', function () {
    const pinnedGrid = document.getElementById('pinnedGrid');
    const allGrid = document.getElementById('allGrid');
    const pinnedSection = document.getElementById('pinnedSection');
    const allSection = document.getElementById('allSection');
    const noResults = document.getElementById('noResults');
    const searchInput = document.getElementById('searchInput');

    function createCard(tool, showStar) {
        const col = document.createElement('div');
        col.className = 'col-sm-6 col-md-4 col-lg-3';
        const pinned = isPinned(tool.id);
        const starClass = pinned ? 'bi-star-fill text-warning' : 'bi-star text-muted';
        const starTitle = pinned ? 'Unpin from navbar' : 'Pin to navbar';
        col.innerHTML = `
            <a href="${tool.url}" class="tool-card">
                <div class="d-flex align-items-center justify-content-between mb-1">
                    <span class="tool-icon" style="color: ${tool.iconColor};">
                        <i class="bi ${tool.icon}"></i>
                    </span>
                    ${showStar ? `<i class="bi ${starClass} pin-star dashboard-pin" data-tool="${tool.id}" title="${starTitle}"></i>` : ''}
                </div>
                <div class="tool-name">${tool.name}</div>
                <div class="tool-desc">${tool.desc}</div>
            </a>
        `;
        // Prevent star click from navigating
        const star = col.querySelector('.dashboard-pin');
        if (star) {
            star.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePin(tool.id);
                render(searchInput.value);
            });
        }
        // Handle Ask AI card — trigger navbar dropdown
        if (tool.id === 'askai') {
            const link = col.querySelector('.tool-card');
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const btn = document.getElementById('askAiBtn');
                bootstrap.Dropdown.getOrCreateInstance(btn).toggle();
            });
        }
        return col;
    }

    function render(query) {
        const q = (query || '').toLowerCase().trim();
        pinnedGrid.innerHTML = '';
        allGrid.innerHTML = '';

        const filtered = tools.filter(t => {
            if (!q) return true;
            return t.name.toLowerCase().includes(q)
                || t.desc.toLowerCase().includes(q)
                || t.tags.some(tag => tag.includes(q));
        });

        const pinnedTools = filtered.filter(t => isPinned(t.id));
        const all = filtered;

        // Show/hide sections
        pinnedSection.classList.toggle('d-none', pinnedTools.length === 0 || !!q);
        allSection.classList.toggle('d-none', all.length === 0);
        noResults.classList.toggle('d-none', all.length > 0);

        // When searching, show all in one grid
        if (q) {
            all.forEach(t => allGrid.appendChild(createCard(t, true)));
        } else {
            pinnedTools.forEach(t => pinnedGrid.appendChild(createCard(t, true)));
            all.forEach(t => allGrid.appendChild(createCard(t, true)));
        }
    }

    // Initial render
    render('');

    // Search with debounce
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => render(searchInput.value), 200);
    });
});
