document.addEventListener('DOMContentLoaded', function () {
    const appSelect = document.getElementById('appSelect');
    const levelFilter = document.getElementById('levelFilter');
    const searchBox = document.getElementById('searchBox');
    const autoRefresh = document.getElementById('autoRefresh');
    const clearBtn = document.getElementById('clearBtn');
    const logTableBody = document.getElementById('logTableBody');
    const pathBar = document.getElementById('pathBar');
    const logFilePath = document.getElementById('logFilePath');
    const logCount = document.getElementById('logCount');

    let currentLevel = 'all';
    let refreshInterval = null;

    const levelBadge = {
        debug: 'bg-secondary',
        info: 'bg-primary',
        warn: 'bg-warning text-dark',
        warning: 'bg-warning text-dark',
        error: 'bg-danger',
        fatal: 'bg-danger'
    };

    // Load app list on page load, then restore selection from URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialApp = urlParams.get('app') || '';
    loadApps(initialApp);

    // App selection — update URL and fetch logs
    appSelect.addEventListener('change', () => {
        const app = appSelect.value;
        clearBtn.disabled = !app;

        // Update URL without reload
        const url = app ? `/logs?app=${encodeURIComponent(app)}` : '/logs';
        history.replaceState(null, '', url);

        if (app) {
            fetchLogs();
        } else {
            pathBar.classList.add('d-none');
            logTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">Select an app to view logs</td></tr>';
        }
    });

    // Level filter buttons
    levelFilter.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-level]');
        if (!btn) return;
        levelFilter.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLevel = btn.dataset.level;
        if (appSelect.value) fetchLogs();
    });

    // Search with debounce
    let searchTimeout;
    searchBox.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (appSelect.value) fetchLogs();
        }, 300);
    });

    // Auto-refresh toggle
    autoRefresh.addEventListener('change', () => {
        if (autoRefresh.checked && appSelect.value) {
            refreshInterval = setInterval(() => {
                loadApps();
                fetchLogs();
            }, 2000);
        } else {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    });

    // Clear logs
    clearBtn.addEventListener('click', () => {
        if (!appSelect.value) return;
        if (!confirm(`Clear all logs for "${appSelect.value}"?`)) return;

        fetch(`/api/logs?app=${encodeURIComponent(appSelect.value)}`, { method: 'DELETE' })
            .then(() => {
                fetchLogs();
                loadApps();
            });
    });

    function loadApps(selectApp) {
        const currentApp = selectApp || appSelect.value;
        fetch('/api/logs/apps')
            .then(res => res.json())
            .then(apps => {
                const opts = '<option value="">-- select app --</option>' +
                    apps.map(a => `<option value="${a}" ${a === currentApp ? 'selected' : ''}>${a}</option>`).join('');
                appSelect.innerHTML = opts;

                // Auto-fetch if app is selected (e.g. from URL param)
                if (currentApp && apps.includes(currentApp)) {
                    clearBtn.disabled = false;
                    fetchLogs();
                }
            });
    }

    function fetchLogs() {
        const app = appSelect.value;
        if (!app) return;

        const params = new URLSearchParams({ app });
        if (currentLevel && currentLevel !== 'all') params.set('level', currentLevel);
        if (searchBox.value.trim()) params.set('search', searchBox.value.trim());

        fetch(`/api/logs?${params}`)
            .then(res => res.json())
            .then(data => {
                // Show path bar
                pathBar.classList.remove('d-none');
                document.getElementById('logUrl').value = `http://localhost:9090/api/logs?app=${encodeURIComponent(app)}`;
                logFilePath.value = data.path;
                logCount.textContent = data.count + ' entries';

                renderLogs(data.entries);
            });
    }

    function renderLogs(entries) {
        if (!entries || entries.length === 0) {
            logTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No logs found</td></tr>';
            return;
        }

        const search = searchBox.value.trim().toLowerCase();

        // Show newest first
        const rows = entries.reverse().map(e => {
            const badge = levelBadge[e.level] || 'bg-secondary';
            const ts = formatTimestamp(e.timestamp);
            let msg = escapeHtml(e.message);

            // Highlight search term
            if (search) {
                const regex = new RegExp(`(${escapeRegex(search)})`, 'gi');
                msg = msg.replace(regex, '<mark>$1</mark>');
            }

            return `<tr>
                <td class="text-nowrap text-muted">${ts}</td>
                <td><span class="badge ${badge}">${e.level.toUpperCase()}</span></td>
                <td style="word-break: break-all;">${msg}</td>
            </tr>`;
        }).join('');

        logTableBody.innerHTML = rows;
    }

    function formatTimestamp(ts) {
        const d = new Date(ts);
        return d.toLocaleString('sv-SE').replace(',', '');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
});

function copyField(fieldId) {
    const input = document.getElementById(fieldId);
    copyText(input.value);
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-success py-2 px-3 small';
        toast.style.zIndex = '9999';
        toast.textContent = 'Copied!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    });
}
