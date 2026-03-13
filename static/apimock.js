// ── API Mock Server ──
(function () {
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const theme = isDark ? 'vs-dark' : 'vs';

    const bodyEditor = monaco.editor.create(document.getElementById('bodyEditor'), {
        language: 'json', theme, minimap: { enabled: false }, fontSize: 13,
        lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true,
        tabSize: 2, wordWrap: 'on',
    });

    document.addEventListener('devhelper-theme', e => {
        monaco.editor.setTheme(e.detail === 'dark' ? 'vs-dark' : 'vs');
    });

    let endpoints = []; // { id, method, path, status, contentType, headers:{}, delay, body }
    let activeId = null;
    let customHeaders = {};
    let nextId = 1;
    let requestLogs = [];

    const endpointList = document.getElementById('endpointList');
    const requestLog = document.getElementById('requestLog');
    const baseUrl = document.getElementById('baseUrl');
    const endpointCount = document.getElementById('endpointCount');

    baseUrl.textContent = window.location.origin + '/mock/';
    document.getElementById('serverStatus').classList.remove('d-none');

    // ── Render endpoints ──
    function renderList() {
        endpointCount.textContent = endpoints.length + ' endpoint' + (endpoints.length !== 1 ? 's' : '');

        if (endpoints.length === 0) {
            endpointList.innerHTML = '<div class="text-center text-muted py-4" style="font-size:0.85rem;"><i class="bi bi-server" style="font-size:1.5rem;"></i><p class="mt-1 mb-0">Click "Add Endpoint" to create mock APIs</p></div>';
            return;
        }

        endpointList.innerHTML = endpoints.map(ep => {
            const active = ep.id === activeId ? ' active' : '';
            return `<div class="endpoint-card${active}" data-id="${ep.id}" onclick="window._selectEndpoint(${ep.id})">
                <div class="d-flex align-items-center gap-2">
                    <span class="badge method-badge method-${ep.method}">${ep.method}</span>
                    <span class="endpoint-path">/mock/${escapeHtml(ep.path)}</span>
                </div>
                <div class="endpoint-status mt-1">${ep.status} · ${ep.contentType.split('/')[1]} · ${ep.delay}ms delay</div>
            </div>`;
        }).join('');
    }

    // ── Select endpoint ──
    window._selectEndpoint = function (id) {
        activeId = id;
        const ep = endpoints.find(e => e.id === id);
        if (!ep) return;

        document.getElementById('editMethod').value = ep.method;
        document.getElementById('editPath').value = ep.path;
        document.getElementById('editStatus').value = ep.status;
        document.getElementById('editContentType').value = ep.contentType;
        document.getElementById('editDelay').value = ep.delay;
        bodyEditor.setValue(ep.body);
        customHeaders = { ...ep.headers };
        renderCustomHeaders();
        renderList();
    };

    // ── Save endpoint ──
    function saveEndpoint() {
        const method = document.getElementById('editMethod').value;
        const path = document.getElementById('editPath').value.trim().replace(/^\//, '');
        const status = parseInt(document.getElementById('editStatus').value);
        const contentType = document.getElementById('editContentType').value;
        const delay = parseInt(document.getElementById('editDelay').value) || 0;
        const body = bodyEditor.getValue();

        if (!path) return;

        if (activeId) {
            const ep = endpoints.find(e => e.id === activeId);
            if (ep) {
                Object.assign(ep, { method, path, status, contentType, headers: { ...customHeaders }, delay, body });
            }
        } else {
            endpoints.push({ id: nextId++, method, path, status, contentType, headers: { ...customHeaders }, delay, body });
            activeId = nextId - 1;
        }

        renderList();
        syncToServer();
    }

    // ── Delete endpoint ──
    function deleteEndpoint() {
        if (!activeId) return;
        endpoints = endpoints.filter(e => e.id !== activeId);
        activeId = endpoints.length > 0 ? endpoints[0].id : null;
        if (activeId) window._selectEndpoint(activeId);
        else clearEditor();
        renderList();
        syncToServer();
    }

    function clearEditor() {
        document.getElementById('editMethod').value = 'GET';
        document.getElementById('editPath').value = '';
        document.getElementById('editStatus').value = '200';
        document.getElementById('editContentType').value = 'application/json';
        document.getElementById('editDelay').value = '0';
        bodyEditor.setValue('');
        customHeaders = {};
        renderCustomHeaders();
        activeId = null;
    }

    // ── Custom headers ──
    function renderCustomHeaders() {
        const el = document.getElementById('customHeaders');
        const entries = Object.entries(customHeaders);
        if (entries.length === 0) { el.innerHTML = ''; return; }
        el.innerHTML = entries.map(([k, v]) =>
            `<span class="badge bg-secondary me-1 mb-1">${escapeHtml(k)}: ${escapeHtml(v)} <i class="bi bi-x" style="cursor:pointer;" onclick="window._removeHeader('${escapeHtml(k)}')"></i></span>`
        ).join('');
    }

    document.getElementById('addHeaderBtn').addEventListener('click', function () {
        const k = document.getElementById('editHeaderKey').value.trim();
        const v = document.getElementById('editHeaderVal').value.trim();
        if (k) {
            customHeaders[k] = v;
            renderCustomHeaders();
            document.getElementById('editHeaderKey').value = '';
            document.getElementById('editHeaderVal').value = '';
        }
    });

    window._removeHeader = function (key) {
        delete customHeaders[key];
        renderCustomHeaders();
    };

    // ── Sync to server ──
    function syncToServer() {
        fetch('/api/apimock/endpoints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(endpoints),
        });
    }

    // ── Request log via SSE ──
    function startLogStream() {
        const evtSource = new EventSource('/api/apimock/log');
        evtSource.onmessage = function (e) {
            try {
                const log = JSON.parse(e.data);
                requestLogs.unshift(log);
                if (requestLogs.length > 50) requestLogs.pop();
                renderLog();
            } catch {}
        };
    }

    function renderLog() {
        if (requestLogs.length === 0) {
            requestLog.innerHTML = '<div class="text-center text-muted py-3" style="font-size:0.8rem;">No requests yet</div>';
            return;
        }
        requestLog.innerHTML = requestLogs.map(log =>
            `<div class="log-entry">
                <span class="badge method-badge method-${log.method}">${log.method}</span>
                <span>${escapeHtml(log.path)}</span>
                <span class="text-muted ms-1">${log.status} · ${log.time}</span>
            </div>`
        ).join('');
    }

    // ── Templates ──
    const templates = {
        crud: [
            { method: 'GET', path: 'users', status: 200, contentType: 'application/json', headers: {}, delay: 0, body: JSON.stringify([{ id: 1, name: "Alice", email: "alice@example.com" }, { id: 2, name: "Bob", email: "bob@example.com" }], null, 2) },
            { method: 'GET', path: 'users/1', status: 200, contentType: 'application/json', headers: {}, delay: 0, body: JSON.stringify({ id: 1, name: "Alice", email: "alice@example.com", createdAt: "2025-01-15T10:30:00Z" }, null, 2) },
            { method: 'POST', path: 'users', status: 201, contentType: 'application/json', headers: {}, delay: 0, body: JSON.stringify({ id: 3, name: "Charlie", email: "charlie@example.com", createdAt: "2025-03-10T12:00:00Z" }, null, 2) },
            { method: 'PUT', path: 'users/1', status: 200, contentType: 'application/json', headers: {}, delay: 0, body: JSON.stringify({ id: 1, name: "Alice Updated", email: "alice@example.com" }, null, 2) },
            { method: 'DELETE', path: 'users/1', status: 204, contentType: 'application/json', headers: {}, delay: 0, body: '' },
        ],
        auth: [
            { method: 'POST', path: 'auth/login', status: 200, contentType: 'application/json', headers: {}, delay: 200, body: JSON.stringify({ token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", expiresIn: 3600, user: { id: 1, name: "Admin" } }, null, 2) },
            { method: 'POST', path: 'auth/register', status: 201, contentType: 'application/json', headers: {}, delay: 300, body: JSON.stringify({ id: 5, email: "new@example.com", message: "Registration successful" }, null, 2) },
            { method: 'POST', path: 'auth/refresh', status: 200, contentType: 'application/json', headers: {}, delay: 100, body: JSON.stringify({ token: "new-jwt-token...", expiresIn: 3600 }, null, 2) },
            { method: 'GET', path: 'auth/me', status: 200, contentType: 'application/json', headers: {}, delay: 0, body: JSON.stringify({ id: 1, name: "Admin", email: "admin@example.com", role: "admin" }, null, 2) },
        ],
        paginated: [
            { method: 'GET', path: 'products', status: 200, contentType: 'application/json', headers: {}, delay: 100, body: JSON.stringify({ data: [{ id: 1, name: "Widget", price: 29.99 }, { id: 2, name: "Gadget", price: 49.99 }, { id: 3, name: "Gizmo", price: 19.99 }], pagination: { page: 1, perPage: 10, total: 42, totalPages: 5 }, links: { next: "/mock/products?page=2", prev: null } }, null, 2) },
        ]
    };

    document.getElementById('templatesMenu').addEventListener('click', function (e) {
        const item = e.target.closest('[data-tmpl]');
        if (!item) return;
        e.preventDefault();
        const tmpl = templates[item.dataset.tmpl];
        if (tmpl) {
            tmpl.forEach(ep => endpoints.push({ ...ep, id: nextId++ }));
            renderList();
            syncToServer();
            if (endpoints.length > 0) window._selectEndpoint(endpoints[endpoints.length - 1].id);
        }
    });

    // ── Button events ──
    document.getElementById('addEndpointBtn').addEventListener('click', function () {
        clearEditor();
        bodyEditor.setValue('{\n  "message": "Hello World"\n}');
    });
    document.getElementById('saveEndpointBtn').addEventListener('click', saveEndpoint);
    document.getElementById('deleteEndpointBtn').addEventListener('click', deleteEndpoint);
    document.getElementById('clearAllBtn').addEventListener('click', function () {
        endpoints = [];
        activeId = null;
        clearEditor();
        renderList();
        syncToServer();
    });
    document.getElementById('clearLogBtn').addEventListener('click', function () {
        requestLogs = [];
        renderLog();
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', function () {
        const blob = new Blob([JSON.stringify(endpoints, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'mock-endpoints.json'; a.click();
        URL.revokeObjectURL(url);
    });

    // Import
    document.getElementById('importFile').addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    imported.forEach(ep => { ep.id = nextId++; endpoints.push(ep); });
                    renderList();
                    syncToServer();
                }
            } catch {}
        };
        reader.readAsText(f); this.value = '';
    });

    // Keyboard
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveEndpoint(); }
    });

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // Init
    renderList();
    startLogStream();
})();

function copyText(text) {
    navigator.clipboard.writeText(text);
}
