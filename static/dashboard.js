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
        id: 'hash',
        name: 'Hash Generator',
        icon: 'bi-hash',
        iconColor: '#0d6efd',
        desc: 'Generate MD5, SHA-1, SHA-256, SHA-512 hashes from text or files. Verify checksums instantly.',
        url: '/hash',
        tags: ['hash', 'md5', 'sha', 'sha256', 'sha512', 'checksum', 'digest', 'crypto'],
    },
    {
        id: 'colorpicker',
        name: 'Color Picker',
        icon: 'bi-palette',
        iconColor: '#e91e63',
        desc: 'Pick colors and convert between HEX, RGB, HSL formats. Color palette and contrast checker.',
        url: '/colorpicker',
        tags: ['color', 'picker', 'hex', 'rgb', 'hsl', 'palette', 'converter', 'css'],
    },
    {
        id: 'cron',
        name: 'Cron Parser',
        icon: 'bi-calendar-event',
        iconColor: '#ff9800',
        desc: 'Parse and generate cron expressions with human-readable descriptions and next run times.',
        url: '/cron',
        tags: ['cron', 'schedule', 'parser', 'crontab', 'job', 'timer'],
    },
    {
        id: 'password',
        name: 'Password Generator',
        icon: 'bi-key',
        iconColor: '#4caf50',
        desc: 'Generate cryptographically secure random passwords and memorable passphrases.',
        url: '/password',
        tags: ['password', 'generator', 'random', 'secure', 'passphrase', 'strong'],
    },
    {
        id: 'qrcode',
        name: 'QR Code Generator',
        icon: 'bi-qr-code',
        iconColor: '#7c4dff',
        desc: 'Generate QR codes from text, URLs, WiFi credentials, or contact info. Download as PNG.',
        url: '/qrcode',
        tags: ['qr', 'qrcode', 'barcode', 'generate', 'scan', 'png'],
    },
    {
        id: 'lorem',
        name: 'Lorem Ipsum',
        icon: 'bi-text-paragraph',
        iconColor: '#795548',
        desc: 'Generate placeholder text — paragraphs, sentences, or words. Multiple styles available.',
        url: '/lorem',
        tags: ['lorem', 'ipsum', 'placeholder', 'text', 'dummy', 'filler', 'sample'],
    },
    {
        id: 'baseconverter',
        name: 'Base Converter',
        icon: 'bi-123',
        iconColor: '#009688',
        desc: 'Convert numbers between Binary, Octal, Decimal, and Hexadecimal bases in real-time.',
        url: '/baseconverter',
        tags: ['base', 'converter', 'binary', 'octal', 'decimal', 'hex', 'number', 'radix'],
    },
    {
        id: 'json2yaml',
        name: 'JSON ↔ YAML',
        icon: 'bi-arrow-left-right',
        iconColor: '#673ab7',
        desc: 'Convert between JSON and YAML formats with syntax validation and formatting.',
        url: '/json2yaml',
        tags: ['json', 'yaml', 'convert', 'transform', 'format', 'config'],
    },
    {
        id: 'httpclient',
        name: 'HTTP Client',
        icon: 'bi-send',
        iconColor: '#ff5722',
        desc: 'Test API endpoints like a mini Postman. Custom methods, headers, body, and response viewer.',
        url: '/httpclient',
        tags: ['http', 'client', 'api', 'rest', 'postman', 'request', 'fetch', 'curl'],
    },
    {
        id: 'stringutils',
        name: 'String Utilities',
        icon: 'bi-fonts',
        iconColor: '#607d8b',
        desc: 'Case converter, trim, count, reverse, slug generator, and more string operations.',
        url: '/stringutils',
        tags: ['string', 'text', 'case', 'convert', 'trim', 'reverse', 'slug', 'count', 'camel'],
    },
    {
        id: 'chat',
        name: 'LAN Chat',
        icon: 'bi-chat-dots',
        iconColor: '#2196f3',
        desc: 'Real-time chat for your local network. No internet needed — just Dev Helper on LAN.',
        url: '/chat',
        tags: ['chat', 'lan', 'message', 'team', 'talk', 'real-time', 'sse'],
    },
    {
        id: 'netscan',
        name: 'Network Scanner',
        icon: 'bi-router',
        iconColor: '#00bfa5',
        desc: 'Scan LAN hosts and ports. Discover devices, services, and open ports on your network.',
        url: '/netscan',
        tags: ['network', 'scanner', 'lan', 'port', 'host', 'ip', 'subnet', 'tcp', 'discovery'],
    },
    {
        id: 'worldclock',
        name: 'World Clock',
        icon: 'bi-globe-americas',
        iconColor: '#00bcd4',
        desc: 'Multi-timezone clocks with analog display, meeting planner, and drag reorder.',
        url: '/worldclock',
        tags: ['world', 'clock', 'timezone', 'time', 'meeting', 'planner', 'utc', 'gmt'],
    },
    {
        id: 'ocr',
        name: 'OCR',
        icon: 'bi-eye',
        iconColor: '#4caf50',
        desc: 'Extract text from images and screenshots. Drag, paste, or upload — powered by Tesseract.js.',
        url: '/ocr',
        tags: ['ocr', 'text', 'recognition', 'image', 'screenshot', 'extract', 'scan', 'tesseract'],
    },
    {
        id: 'yaml2props',
        name: 'YAML ↔ Properties',
        icon: 'bi-filetype-yml',
        iconColor: '#ff9800',
        desc: 'Convert between application.yml and application.properties for Java/Spring Boot projects.',
        url: '/yaml2props',
        tags: ['yaml', 'properties', 'spring', 'boot', 'java', 'config', 'yml', 'convert'],
    },
    {
        id: 'netinspect',
        name: 'Network Inspector',
        icon: 'bi-globe-europe-africa',
        iconColor: '#3f51b5',
        desc: 'IP geolocation, DNS lookup, HTTP response headers, and SSL certificate checker.',
        url: '/netinspect',
        tags: ['network', 'inspector', 'ip', 'dns', 'ssl', 'headers', 'certificate', 'geolocation', 'tls'],
    },
    {
        id: 'aichat',
        name: 'AI Chat',
        icon: 'bi-robot',
        iconColor: '#8b5cf6',
        desc: 'Chat with local Ollama AI models. Streaming responses, markdown rendering, conversation history.',
        url: '/aichat',
        tags: ['ai', 'chat', 'ollama', 'llm', 'assistant', 'model', 'local', 'offline'],
    },
    {
        id: 'speedtest',
        name: 'Speed Test',
        icon: 'bi-speedometer2',
        iconColor: '#ff5722',
        desc: 'Test network download/upload speed, ping latency, and disk read/write performance.',
        url: '/speedtest',
        tags: ['speed', 'test', 'download', 'upload', 'bandwidth', 'network', 'ping', 'latency', 'disk', 'io'],
    },
    {
        id: 'snippets',
        name: 'Code Snippets',
        icon: 'bi-code-square',
        iconColor: '#e83e8c',
        desc: 'Save and organize frequently used code snippets with syntax highlighting and quick copy.',
        url: '/snippets',
        tags: ['snippet', 'code', 'template', 'save', 'collection', 'copy', 'paste', 'boilerplate'],
    },
    {
        id: 'sysmon',
        name: 'System Monitor',
        icon: 'bi-cpu',
        iconColor: '#e91e63',
        desc: 'Real-time CPU, memory, disk, network, and process monitoring with live gauges.',
        url: '/sysmon',
        tags: ['system', 'monitor', 'cpu', 'memory', 'disk', 'network', 'process', 'ram', 'htop'],
    },
    {
        id: 'icons',
        name: 'Icon Explorer',
        icon: 'bi-collection',
        iconColor: '#7c4dff',
        desc: 'Browse and search Bootstrap Icons, Font Awesome, and Tabler Icons. Click to copy CSS class or HTML.',
        url: '/icons',
        tags: ['icon', 'icons', 'bootstrap', 'font awesome', 'tabler', 'collection', 'browse', 'css', 'class'],
    },
    {
        id: 'translator',
        name: 'Translator',
        icon: 'bi-translate',
        iconColor: '#00897b',
        desc: 'Translate text between languages using local Ollama AI models. Like Google Translate, offline.',
        url: '/translator',
        tags: ['translate', 'translator', 'language', 'ollama', 'ai', 'google translate', 'bing', 'terjemahan'],
    },
    {
        id: 'askai',
        name: 'Ask AI',
        icon: 'bi-robot',
        iconColor: '#d4a574',
        desc: 'Quick access to 9 cloud AIs (Claude, ChatGPT, Gemini, etc.) and Ollama from the navbar.',
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

    function getToolName(tool) {
        if (window.t) {
            var n = window.t('tools.' + tool.id + '.name');
            if (n !== 'tools.' + tool.id + '.name') return n;
        }
        return tool.name;
    }
    function getToolDesc(tool) {
        if (window.t) {
            var d = window.t('tools.' + tool.id + '.desc');
            if (d !== 'tools.' + tool.id + '.desc') return d;
        }
        return tool.desc;
    }

    function createCard(tool, showStar) {
        const col = document.createElement('div');
        col.className = 'col-sm-6 col-md-4 col-lg-3';
        const pinned = isPinned(tool.id);
        const starClass = pinned ? 'bi-star-fill text-warning' : 'bi-star text-muted';
        const starTitle = pinned ? (window.t ? window.t('nav.unpin_from_navbar') : 'Unpin from navbar') : (window.t ? window.t('nav.pin_to_navbar') : 'Pin to navbar');
        const toolName = getToolName(tool);
        const toolDesc = getToolDesc(tool);
        col.innerHTML = `
            <a href="${tool.url}" class="tool-card">
                <div class="d-flex align-items-center justify-content-between mb-1">
                    <span class="tool-icon" style="color: ${tool.iconColor};">
                        <i class="bi ${tool.icon}"></i>
                    </span>
                    ${showStar ? `<i class="bi ${starClass} pin-star dashboard-pin" data-tool="${tool.id}" title="${starTitle}"></i>` : ''}
                </div>
                <div class="tool-name">${toolName}</div>
                <div class="tool-desc">${toolDesc}</div>
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

        const filtered = tools.filter(tool => {
            if (!q) return true;
            var tName = getToolName(tool);
            var tDesc = getToolDesc(tool);
            return tName.toLowerCase().includes(q)
                || tDesc.toLowerCase().includes(q)
                || tool.name.toLowerCase().includes(q)
                || tool.desc.toLowerCase().includes(q)
                || tool.tags.some(tag => tag.includes(q));
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

    // Re-render on language change
    window.addEventListener('devhelper-lang-change', () => render(searchInput.value));
    window.addEventListener('devhelper-i18n-ready', () => render(searchInput.value));
});
