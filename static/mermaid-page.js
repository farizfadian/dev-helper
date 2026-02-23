document.addEventListener('DOMContentLoaded', function () {
    const previewPanel = document.getElementById('previewPanel');
    const statusMsg = document.getElementById('statusMsg');

    let monacoEditor = null;
    let renderTimeout = null;
    let currentZoom = 1;
    var LS_KEY_MERMAID = 'devhelper_mermaid_content';

    // ── Sample Diagrams ──
    const samples = {
        flowchart: `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> E[Check logs]
    E --> F[Fix the bug]
    F --> B
    C --> G[Deploy to production]
    G --> H[Monitor]
    H --> I{Any issues?}
    I -->|Yes| D
    I -->|No| J[Celebrate! 🎉]`,

        sequence: `sequenceDiagram
    actor User
    participant Frontend
    participant API
    participant DB
    participant Cache

    User->>Frontend: Click Login
    Frontend->>API: POST /auth/login
    API->>DB: SELECT user WHERE email=?
    DB-->>API: User record
    API->>API: Verify password (bcrypt)
    alt Valid credentials
        API->>Cache: Store session
        API-->>Frontend: 200 OK + JWT token
        Frontend-->>User: Redirect to dashboard
    else Invalid credentials
        API-->>Frontend: 401 Unauthorized
        Frontend-->>User: Show error message
    end`,

        class: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
        +move() void
    }
    class Dog {
        +String breed
        +fetch() void
        +bark() void
    }
    class Cat {
        +bool isIndoor
        +purr() void
        +scratch() void
    }
    class Bird {
        +double wingspan
        +fly() void
        +sing() void
    }
    class Veterinarian {
        +String license
        +examine(Animal) Report
        +vaccinate(Animal) void
    }

    Animal <|-- Dog
    Animal <|-- Cat
    Animal <|-- Bird
    Veterinarian --> Animal : treats`,

        state: `stateDiagram-v2
    [*] --> Draft
    Draft --> Review : Submit
    Review --> Approved : Approve
    Review --> Draft : Request Changes
    Approved --> Published : Publish
    Published --> Archived : Archive
    Archived --> Draft : Restore
    Published --> Draft : Unpublish

    state Review {
        [*] --> PeerReview
        PeerReview --> ManagerReview : Peer Approved
        PeerReview --> [*] : Peer Rejected
        ManagerReview --> [*] : Decision Made
    }`,

        er: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        int id PK
        string name
        string email UK
        string phone
        date created_at
    }
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        int id PK
        int customer_id FK
        date order_date
        string status
        decimal total
    }
    ORDER_ITEM }o--|| PRODUCT : references
    ORDER_ITEM {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
        decimal price
    }
    PRODUCT {
        int id PK
        string name
        string category
        decimal price
        int stock
    }`,

        gantt: `gantt
    title Project Development Timeline
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Planning
        Requirements gathering  :done, req, 2025-01-01, 7d
        System design           :done, design, after req, 5d
        Architecture review     :done, review, after design, 2d

    section Development
        Backend API             :active, api, after review, 14d
        Frontend UI             :active, ui, after review, 14d
        Database setup          :done, db, after review, 3d
        Integration             :integ, after api, 5d

    section Testing
        Unit tests              :test1, after api, 5d
        Integration tests       :test2, after integ, 4d
        UAT                     :uat, after test2, 5d

    section Deployment
        Staging deploy          :stage, after uat, 2d
        Production deploy       :prod, after stage, 1d
        Monitoring              :monitor, after prod, 3d`,

        pie: `pie title Technology Stack Usage
    "JavaScript" : 35
    "Python" : 25
    "Java" : 15
    "Go" : 10
    "TypeScript" : 10
    "Other" : 5`,

        mindmap: `mindmap
    root((Web Development))
        Frontend
            HTML
            CSS
                Flexbox
                Grid
                Animations
            JavaScript
                React
                Vue
                Angular
            Build Tools
                Webpack
                Vite
        Backend
            Node.js
                Express
                Fastify
            Python
                Django
                FastAPI
            Go
                Gin
                Echo
        Database
            SQL
                PostgreSQL
                MySQL
            NoSQL
                MongoDB
                Redis
        DevOps
            Docker
            Kubernetes
            CI/CD`,

        gitgraph: `gitGraph
    commit id: "Initial commit"
    commit id: "Add README"
    branch feature/auth
    checkout feature/auth
    commit id: "Add login page"
    commit id: "Add JWT middleware"
    commit id: "Add user model"
    checkout main
    branch feature/dashboard
    checkout feature/dashboard
    commit id: "Add dashboard layout"
    commit id: "Add charts"
    checkout main
    merge feature/auth id: "Merge auth" tag: "v1.0"
    checkout feature/dashboard
    commit id: "Add notifications"
    checkout main
    merge feature/dashboard id: "Merge dashboard" tag: "v1.1"
    commit id: "Hotfix: security patch" tag: "v1.1.1"`,

        journey: `journey
    title My Working Day
    section Morning
        Wake up: 3: Me
        Breakfast: 4: Me
        Commute to work: 2: Me, Bus
        Check emails: 3: Me
    section Work
        Daily standup: 4: Me, Team
        Code review: 4: Me, Colleague
        Write code: 5: Me
        Lunch break: 4: Me, Colleague
    section Afternoon
        Meeting with PM: 3: Me, PM
        Deploy to staging: 4: Me
        Fix bugs: 3: Me
        Commute home: 2: Me, Bus
    section Evening
        Dinner: 5: Me, Family
        Side project: 4: Me
        Sleep: 5: Me`,

        quadrant: `quadrantChart
    title Feature Prioritization Matrix
    x-axis Low Effort --> High Effort
    y-axis Low Impact --> High Impact
    quadrant-1 Plan carefully
    quadrant-2 Do first!
    quadrant-3 Delegate or drop
    quadrant-4 Quick wins

    Dark mode: [0.3, 0.8]
    Search feature: [0.5, 0.9]
    User profiles: [0.7, 0.7]
    Export PDF: [0.4, 0.5]
    Animations: [0.2, 0.3]
    Tooltips: [0.15, 0.4]
    Mobile app: [0.9, 0.85]
    API docs: [0.6, 0.6]
    Logo redesign: [0.25, 0.15]`,

        timeline: `timeline
    title History of Web Development
    section 1990s
        1991 : First website by Tim Berners-Lee
        1995 : JavaScript created by Brendan Eich
             : PHP released
        1996 : CSS Level 1 published
        1999 : AJAX concept introduced
    section 2000s
        2004 : Facebook launched
             : Gmail introduces AJAX-heavy app
        2006 : jQuery released
        2008 : Google Chrome launched
             : GitHub founded
        2009 : Node.js released
             : AngularJS by Google
    section 2010s
        2013 : React by Facebook
        2014 : Vue.js by Evan You
        2015 : ES6/ES2015 released
        2017 : WebAssembly MVP
    section 2020s
        2020 : Deno 1.0 released
        2022 : Bun released
        2023 : AI-assisted coding becomes mainstream
        2025 : Claude Code released`,
    };

    // ── Init Mermaid ──
    function isDark() {
        return document.documentElement.getAttribute('data-bs-theme') === 'dark';
    }

    function initMermaid() {
        mermaid.initialize({
            startOnLoad: false,
            theme: isDark() ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        });
    }
    initMermaid();

    // ── Init Monaco ──
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
        monacoEditor = monaco.editor.create(document.getElementById('monacoEditor'), {
            value: '',
            language: 'markdown',
            theme: isDark() ? 'vs-dark' : 'vs',
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            tabSize: 4,
        });

        // Live preview on change + auto-save
        var mermaidSaveTimeout;
        monacoEditor.onDidChangeModelContent(function () {
            clearTimeout(renderTimeout);
            renderTimeout = setTimeout(renderDiagram, 400);
            clearTimeout(mermaidSaveTimeout);
            mermaidSaveTimeout = setTimeout(function () {
                localStorage.setItem(LS_KEY_MERMAID, monacoEditor.getValue());
            }, 500);
        });

        // Check for shared diagram in URL hash, then localStorage, then default
        if (window.location.hash) {
            try {
                const code = decodeURIComponent(atob(window.location.hash.substring(1)));
                monacoEditor.setValue(code);
            } catch (e) {
                monacoEditor.setValue(samples.flowchart);
            }
        } else {
            var savedMermaid = localStorage.getItem(LS_KEY_MERMAID);
            monacoEditor.setValue(savedMermaid || samples.flowchart);
        }
    });

    // ── Render Diagram ──
    async function renderDiagram() {
        const code = monacoEditor ? monacoEditor.getValue().trim() : '';
        if (!code) {
            previewPanel.innerHTML = '<div class="preview-placeholder"><i class="bi bi-diagram-3" style="font-size: 3rem;"></i><p class="mt-2 mb-0">Write Mermaid code to see preview</p></div>';
            statusMsg.innerHTML = '<i class="bi bi-info-circle"></i> Editor is empty';
            return;
        }

        try {
            // Validate syntax first
            const valid = await mermaid.parse(code);

            const id = 'mermaid-' + Date.now();
            const { svg } = await mermaid.render(id, code);

            previewPanel.innerHTML = svg;
            applyZoom();

            // Add zoom controls
            addZoomControls();

            statusMsg.innerHTML = '<i class="bi bi-check-circle text-success"></i> Diagram rendered successfully';
        } catch (e) {
            const msg = e.message || String(e);
            // Clean up mermaid error message
            const cleanMsg = msg.replace(/\n*Syntax error.*$/s, '').trim() || msg;
            previewPanel.innerHTML = `<div class="error-msg"><i class="bi bi-exclamation-triangle"></i> ${escapeHtml(cleanMsg)}</div>`;
            statusMsg.innerHTML = '<i class="bi bi-exclamation-circle text-danger"></i> Syntax error — check your Mermaid code';
        }
    }

    function addZoomControls() {
        // Remove existing zoom controls
        const existing = previewPanel.querySelector('.zoom-controls');
        if (existing) existing.remove();

        const controls = document.createElement('div');
        controls.className = 'zoom-controls';
        controls.innerHTML = `
            <button class="btn btn-sm btn-outline-secondary" id="zoomOut" title="Zoom out"><i class="bi bi-dash"></i></button>
            <button class="btn btn-sm btn-outline-secondary" id="zoomReset" title="Reset zoom">${Math.round(currentZoom * 100)}%</button>
            <button class="btn btn-sm btn-outline-secondary" id="zoomIn" title="Zoom in"><i class="bi bi-plus"></i></button>
        `;
        previewPanel.appendChild(controls);

        controls.querySelector('#zoomIn').addEventListener('click', () => { currentZoom = Math.min(3, currentZoom + 0.25); applyZoom(); updateZoomLabel(); });
        controls.querySelector('#zoomOut').addEventListener('click', () => { currentZoom = Math.max(0.25, currentZoom - 0.25); applyZoom(); updateZoomLabel(); });
        controls.querySelector('#zoomReset').addEventListener('click', () => { currentZoom = 1; applyZoom(); updateZoomLabel(); });
    }

    function applyZoom() {
        const svg = previewPanel.querySelector('svg');
        if (!svg) return;
        if (currentZoom === 1) {
            svg.style.transform = '';
            svg.style.transformOrigin = 'center center';
            previewPanel.classList.remove('zoom');
        } else {
            svg.style.transform = `scale(${currentZoom})`;
            svg.style.transformOrigin = 'top left';
            previewPanel.classList.add('zoom');
        }
    }

    function updateZoomLabel() {
        const label = previewPanel.querySelector('#zoomReset');
        if (label) label.textContent = Math.round(currentZoom * 100) + '%';
    }

    // ── Sample Diagrams ──
    document.querySelectorAll('[data-sample]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            const key = this.dataset.sample;
            if (samples[key] && monacoEditor) {
                monacoEditor.setValue(samples[key]);
                currentZoom = 1;
            }
        });
    });

    // ── Copy Code ──
    document.getElementById('copyCodeBtn').addEventListener('click', function () {
        if (!monacoEditor) return;
        const code = monacoEditor.getValue();
        if (!code) return;
        navigator.clipboard.writeText(code).then(() => {
            const btn = this;
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
            setTimeout(() => btn.innerHTML = orig, 1500);
        });
    });

    // ── Copy Image ──
    document.getElementById('copyImageBtn').addEventListener('click', async function () {
        const svg = previewPanel.querySelector('svg');
        if (!svg) return;

        try {
            const blob = await svgToBlob(svg, 2);
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            const btn = this;
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
            setTimeout(() => btn.innerHTML = orig, 1500);
        } catch (e) {
            alert('Failed to copy image: ' + e.message);
        }
    });

    // ── Download SVG ──
    document.getElementById('downloadSvg').addEventListener('click', function (e) {
        e.preventDefault();
        const svg = previewPanel.querySelector('svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        downloadBlob(blob, 'diagram.svg');
    });

    // ── Download PNG ──
    document.getElementById('downloadPng').addEventListener('click', async function (e) {
        e.preventDefault();
        await downloadPng(1);
    });

    document.getElementById('downloadPng2x').addEventListener('click', async function (e) {
        e.preventDefault();
        await downloadPng(2);
    });

    async function downloadPng(scale) {
        const svg = previewPanel.querySelector('svg');
        if (!svg) return;
        try {
            const blob = await svgToBlob(svg, scale);
            downloadBlob(blob, `diagram@${scale}x.png`);
        } catch (e) {
            alert('Failed to export PNG: ' + e.message);
        }
    }

    // ── Share ──
    document.getElementById('shareBtn').addEventListener('click', function () {
        if (!monacoEditor) return;
        const code = monacoEditor.getValue();
        if (!code) return;

        const encoded = btoa(encodeURIComponent(code));
        const url = window.location.origin + '/mermaid#' + encoded;

        navigator.clipboard.writeText(url).then(() => {
            // Update URL without reload
            history.replaceState(null, '', '/mermaid#' + encoded);
            const btn = this;
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> URL Copied';
            setTimeout(() => btn.innerHTML = orig, 2000);
        });
    });

    // ── Preview Fullscreen ──
    document.getElementById('previewFsBtn').addEventListener('click', function () {
        const svg = previewPanel.querySelector('svg');
        if (!svg) return;

        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-overlay';
        overlay.innerHTML = `
            <button class="btn btn-outline-secondary close-fs"><i class="bi bi-fullscreen-exit"></i> Close</button>
            ${svg.outerHTML}
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        function close() {
            overlay.remove();
            document.body.style.overflow = '';
        }

        overlay.querySelector('.close-fs').addEventListener('click', close);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', handler);
            }
        });
    });

    // ── Clear ──
    document.getElementById('clearBtn').addEventListener('click', function () {
        if (monacoEditor) monacoEditor.setValue('');
        previewPanel.innerHTML = '<div class="preview-placeholder"><i class="bi bi-diagram-3" style="font-size: 3rem;"></i><p class="mt-2 mb-0">Write Mermaid code to see preview</p></div>';
        currentZoom = 1;
        localStorage.removeItem(LS_KEY_MERMAID);
        history.replaceState(null, '', '/mermaid');
    });

    // ── Focus mode ──
    var LS_KEY_FOCUS = 'devhelper_mermaid_fullscreen';
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
        setTimeout(function () { if (monacoEditor) monacoEditor.layout(); }, 50);
    }

    if (localStorage.getItem(LS_KEY_FOCUS) === '1') applyFocusMode(true);
    focusModeBtn.addEventListener('click', function () { applyFocusMode(!isFocusMode); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isFocusMode) { e.preventDefault(); applyFocusMode(false); }
        if (e.key === 'F11') { e.preventDefault(); applyFocusMode(!isFocusMode); }
    });

    // ── Theme Change ──
    window.addEventListener('devhelper-theme', function (e) {
        initMermaid();
        if (monacoEditor && typeof monaco !== 'undefined') {
            monaco.editor.setTheme(e.detail.theme === 'dark' ? 'vs-dark' : 'vs');
        }
        // Re-render with new theme
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(renderDiagram, 100);
    });

    // ── Helpers ──

    function svgToBlob(svgEl, scale) {
        return new Promise(function (resolve, reject) {
            const svgData = new XMLSerializer().serializeToString(svgEl);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = isDark() ? '#212529' : '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                canvas.toBlob(function (blob) {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas toBlob failed'));
                }, 'image/png');
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load SVG'));
            };
            img.src = url;
        });
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
