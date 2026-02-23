document.addEventListener('DOMContentLoaded', function () {
    const HISTORY_KEY = 'devhelper_httpclient_history';
    const STATE_KEY = 'devhelper_httpclient_state';
    const MAX_HISTORY = 20;

    const methodSelect = document.getElementById('methodSelect');
    const urlInput = document.getElementById('urlInput');
    const sendBtn = document.getElementById('sendBtn');
    const sendIcon = document.getElementById('sendIcon');
    const sendSpinner = document.getElementById('sendSpinner');
    const requestBody = document.getElementById('requestBody');
    const contentTypeSelect = document.getElementById('contentTypeSelect');
    const bearerToken = document.getElementById('bearerToken');
    const headersContainer = document.getElementById('headersContainer');
    const headerCount = document.getElementById('headerCount');
    const responseSection = document.getElementById('responseSection');
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    const responseStatus = document.getElementById('responseStatus');
    const responseTime = document.getElementById('responseTime');
    const responseSize = document.getElementById('responseSize');
    const responseBody = document.getElementById('responseBody');
    const respHeadersBody = document.getElementById('respHeadersBody');
    const respHeaderCount = document.getElementById('respHeaderCount');
    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');

    // ── Header Rows ──
    function createHeaderRow(key, value) {
        const row = document.createElement('div');
        row.className = 'header-row d-flex gap-2 mb-2 align-items-center';
        row.innerHTML =
            '<input type="text" class="form-control form-control-sm mono header-key" placeholder="Header name" value="' + escapeAttr(key || '') + '">' +
            '<input type="text" class="form-control form-control-sm mono header-value" placeholder="Value" value="' + escapeAttr(value || '') + '">' +
            '<button class="btn btn-sm btn-outline-danger btn-remove" title="Remove"><i class="bi bi-x-lg"></i></button>';
        row.querySelector('.btn-remove').addEventListener('click', function () {
            row.remove();
            updateHeaderCount();
            saveState();
        });
        row.querySelectorAll('input').forEach(function (inp) {
            inp.addEventListener('input', function () {
                updateHeaderCount();
                saveState();
            });
        });
        headersContainer.appendChild(row);
        updateHeaderCount();
        return row;
    }

    function updateHeaderCount() {
        const rows = headersContainer.querySelectorAll('.header-row');
        let count = 0;
        rows.forEach(function (r) {
            if (r.querySelector('.header-key').value.trim()) count++;
        });
        headerCount.textContent = count;
    }

    function getHeaders() {
        const headers = {};
        headersContainer.querySelectorAll('.header-row').forEach(function (row) {
            const key = row.querySelector('.header-key').value.trim();
            const value = row.querySelector('.header-value').value;
            if (key) headers[key] = value;
        });
        return headers;
    }

    function getHeaderRows() {
        const rows = [];
        headersContainer.querySelectorAll('.header-row').forEach(function (row) {
            rows.push({
                key: row.querySelector('.header-key').value,
                value: row.querySelector('.header-value').value
            });
        });
        return rows;
    }

    document.getElementById('addHeaderBtn').addEventListener('click', function () {
        createHeaderRow('', '');
        saveState();
    });

    // Add one empty row by default
    createHeaderRow('', '');

    // ── Format Body ──
    document.getElementById('formatBodyBtn').addEventListener('click', function () {
        const body = requestBody.value.trim();
        if (!body) return;
        try {
            const obj = JSON.parse(body);
            requestBody.value = JSON.stringify(obj, null, 2);
        } catch (e) {
            // Not JSON, ignore
        }
    });

    document.getElementById('clearBodyBtn').addEventListener('click', function () {
        requestBody.value = '';
        saveState();
    });

    // ── Send Request ──
    function sendRequest() {
        const url = urlInput.value.trim();
        if (!url) {
            urlInput.focus();
            urlInput.classList.add('is-invalid');
            setTimeout(function () { urlInput.classList.remove('is-invalid'); }, 1500);
            return;
        }

        const method = methodSelect.value;
        const headers = getHeaders();

        // Add Content-Type for methods with body
        if (['POST', 'PUT', 'PATCH'].includes(method) && requestBody.value.trim()) {
            if (!headers['Content-Type'] && !headers['content-type']) {
                headers['Content-Type'] = contentTypeSelect.value;
            }
        }

        // Add Bearer token
        const token = bearerToken.value.trim();
        if (token && !headers['Authorization'] && !headers['authorization']) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        const body = ['POST', 'PUT', 'PATCH'].includes(method) ? requestBody.value : '';

        // UI: loading state
        sendBtn.disabled = true;
        sendIcon.classList.add('d-none');
        sendSpinner.classList.remove('d-none');
        responseSection.classList.add('d-none');
        errorSection.classList.add('d-none');

        const payload = {
            method: method,
            url: url,
            headers: headers,
            body: body
        };

        fetch('/api/httpclient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function (resp) { return resp.json(); })
        .then(function (data) {
            sendBtn.disabled = false;
            sendIcon.classList.remove('d-none');
            sendSpinner.classList.add('d-none');

            if (data.error) {
                errorSection.classList.remove('d-none');
                errorMessage.textContent = data.error + (data.elapsedMs ? ' (' + data.elapsedMs + 'ms)' : '');
                addHistory(method, url, 0, data.error);
                return;
            }

            displayResponse(data);
            addHistory(method, url, data.status, null);
            saveState();
        })
        .catch(function (err) {
            sendBtn.disabled = false;
            sendIcon.classList.remove('d-none');
            sendSpinner.classList.add('d-none');
            errorSection.classList.remove('d-none');
            errorMessage.textContent = 'Network error: ' + err.message;
            addHistory(method, url, 0, err.message);
        });
    }

    sendBtn.addEventListener('click', sendRequest);

    // Ctrl+Enter to send
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            sendRequest();
        }
    });

    // ── Display Response ──
    function displayResponse(data) {
        responseSection.classList.remove('d-none');

        // Status badge
        const status = data.status || 0;
        const statusText = data.statusText || '';
        responseStatus.textContent = statusText;
        responseStatus.className = 'status-badge';
        if (status >= 200 && status < 300) {
            responseStatus.classList.add('text-success');
        } else if (status >= 300 && status < 400) {
            responseStatus.classList.add('text-warning');
        } else {
            responseStatus.classList.add('text-danger');
        }

        // Time & size
        responseTime.textContent = data.elapsedMs != null ? data.elapsedMs + ' ms' : '';
        responseSize.textContent = data.size != null ? formatSize(data.size) : '';

        // Body
        let bodyText = data.body || '';
        // Try to pretty-print JSON
        try {
            const parsed = JSON.parse(bodyText);
            bodyText = JSON.stringify(parsed, null, 2);
        } catch (e) {
            // Not JSON, show as-is
        }
        responseBody.textContent = bodyText;

        // Response headers
        const respHeaders = data.headers || {};
        const headerKeys = Object.keys(respHeaders);
        respHeaderCount.textContent = headerKeys.length;
        respHeadersBody.innerHTML = headerKeys.map(function (key) {
            return '<tr><td>' + escapeHtml(key) + '</td><td>' + escapeHtml(respHeaders[key]) + '</td></tr>';
        }).join('');
    }

    // ── Copy Response ──
    document.getElementById('copyResponseBtn').addEventListener('click', function () {
        const text = responseBody.textContent;
        if (!text) return;
        navigator.clipboard.writeText(text).then(function () {
            const btn = document.getElementById('copyResponseBtn');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
            setTimeout(function () { btn.innerHTML = orig; }, 1500);
        });
    });

    // ── History ──
    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveHistory(history) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function addHistory(method, url, status, error) {
        const history = getHistory();
        history.unshift({
            method: method,
            url: url,
            status: status,
            error: error || null,
            timestamp: Date.now()
        });
        // Keep max
        while (history.length > MAX_HISTORY) history.pop();
        saveHistory(history);
        renderHistory();
    }

    function renderHistory() {
        const history = getHistory();
        if (history.length === 0) {
            historyEmpty.classList.remove('d-none');
            // Remove all history-item divs
            historyList.querySelectorAll('.history-item').forEach(function (el) { el.remove(); });
            return;
        }
        historyEmpty.classList.add('d-none');

        // Clear existing items
        historyList.querySelectorAll('.history-item').forEach(function (el) { el.remove(); });

        history.forEach(function (item, idx) {
            const div = document.createElement('div');
            div.className = 'history-item d-flex align-items-center gap-2';
            div.title = item.method + ' ' + item.url + '\n' + new Date(item.timestamp).toLocaleString();

            let statusHtml = '';
            if (item.error) {
                statusHtml = '<span class="history-status text-danger">ERR</span>';
            } else if (item.status) {
                const statusClass = item.status >= 200 && item.status < 300 ? 'text-success' :
                                    item.status >= 300 && item.status < 400 ? 'text-warning' : 'text-danger';
                statusHtml = '<span class="history-status ' + statusClass + '">' + item.status + '</span>';
            }

            div.innerHTML =
                '<span class="history-method method-' + item.method + '">' + item.method + '</span>' +
                '<span class="history-url flex-grow-1">' + escapeHtml(item.url) + '</span>' +
                statusHtml;

            div.addEventListener('click', function () {
                loadHistoryItem(item);
            });

            historyList.appendChild(div);
        });
    }

    function loadHistoryItem(item) {
        methodSelect.value = item.method;
        urlInput.value = item.url;
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        urlInput.focus();
    }

    document.getElementById('clearHistoryBtn').addEventListener('click', function () {
        if (!confirm('Clear all request history?')) return;
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
    });

    // ── State Persistence ──
    function saveState() {
        const state = {
            method: methodSelect.value,
            url: urlInput.value,
            headers: getHeaderRows(),
            body: requestBody.value,
            contentType: contentTypeSelect.value,
            bearerToken: bearerToken.value
        };
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }

    function loadState() {
        try {
            const state = JSON.parse(localStorage.getItem(STATE_KEY));
            if (!state) return;
            methodSelect.value = state.method || 'GET';
            urlInput.value = state.url || '';
            contentTypeSelect.value = state.contentType || 'application/json';
            bearerToken.value = state.bearerToken || '';
            requestBody.value = state.body || '';

            // Restore headers
            if (state.headers && state.headers.length > 0) {
                headersContainer.innerHTML = '';
                state.headers.forEach(function (h) {
                    createHeaderRow(h.key || '', h.value || '');
                });
            }
        } catch (e) {
            // ignore
        }
    }

    // Save state on changes
    methodSelect.addEventListener('change', saveState);
    urlInput.addEventListener('input', saveState);
    requestBody.addEventListener('input', saveState);
    contentTypeSelect.addEventListener('change', saveState);
    bearerToken.addEventListener('input', saveState);

    // ── Helpers ──
    function formatSize(bytes) {
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return bytes + ' B';
    }

    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Init ──
    loadState();
    renderHistory();
});
