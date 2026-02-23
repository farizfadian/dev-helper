document.addEventListener('DOMContentLoaded', function () {
    const CONFIG_KEY = 'devhelper_netscan_config';

    // Elements
    const targetInput = document.getElementById('targetInput');
    const portPreset = document.getElementById('portPreset');
    const customPortsWrap = document.getElementById('customPortsWrap');
    const customPorts = document.getElementById('customPorts');
    const timeoutSlider = document.getElementById('timeoutSlider');
    const timeoutLabel = document.getElementById('timeoutLabel');
    const workersSlider = document.getElementById('workersSlider');
    const workersLabel = document.getElementById('workersLabel');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const ifaceDropdown = document.getElementById('ifaceDropdown');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressStats = document.getElementById('progressStats');
    const progressOpen = document.getElementById('progressOpen');
    const summarySection = document.getElementById('summarySection');
    const resultsSection = document.getElementById('resultsSection');
    const resultsBody = document.getElementById('resultsBody');
    const resultCount = document.getElementById('resultCount');
    const filterInput = document.getElementById('filterInput');
    const groupByHost = document.getElementById('groupByHost');

    let eventSource = null;
    let results = [];
    let scanning = false;
    let sortCol = 'ip';
    let sortAsc = true;
    let scanStartTime = null;

    // ── Load config from localStorage ──
    function loadConfig() {
        try {
            const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY));
            if (!cfg) return;
            if (cfg.target) targetInput.value = cfg.target;
            if (cfg.ports) portPreset.value = cfg.ports;
            if (cfg.customPorts) customPorts.value = cfg.customPorts;
            if (cfg.timeout) {
                timeoutSlider.value = cfg.timeout;
                timeoutLabel.textContent = cfg.timeout;
            }
            if (cfg.workers) {
                workersSlider.value = cfg.workers;
                workersLabel.textContent = cfg.workers;
            }
            toggleCustomPorts();
        } catch (e) {}
    }

    function saveConfig() {
        localStorage.setItem(CONFIG_KEY, JSON.stringify({
            target: targetInput.value,
            ports: portPreset.value,
            customPorts: customPorts.value,
            timeout: timeoutSlider.value,
            workers: workersSlider.value,
        }));
    }

    // ── Sliders ──
    timeoutSlider.addEventListener('input', function () {
        timeoutLabel.textContent = this.value;
    });
    workersSlider.addEventListener('input', function () {
        workersLabel.textContent = this.value;
    });

    // ── Port preset toggle ──
    function toggleCustomPorts() {
        customPortsWrap.style.display = portPreset.value === 'custom' ? '' : 'none';
    }
    portPreset.addEventListener('change', toggleCustomPorts);

    // ── Load interfaces ──
    function loadInterfaces() {
        fetch('/api/netscan/interfaces')
            .then(r => r.json())
            .then(ifaces => {
                ifaceDropdown.innerHTML = '';
                if (ifaces.length === 0) {
                    ifaceDropdown.innerHTML = '<li><span class="dropdown-item text-muted">No interfaces found</span></li>';
                    return;
                }
                ifaces.forEach(iface => {
                    const li = document.createElement('li');
                    li.innerHTML = '<a class="dropdown-item" href="#">' +
                        '<strong>' + escapeHtml(iface.name) + '</strong> &mdash; ' +
                        escapeHtml(iface.ip) + ' <span class="text-muted">(' + escapeHtml(iface.subnet) + ')</span></a>';
                    li.querySelector('a').addEventListener('click', function (e) {
                        e.preventDefault();
                        targetInput.value = iface.subnet;
                        saveConfig();
                    });
                    ifaceDropdown.appendChild(li);
                });

                // Auto-fill if empty
                if (!targetInput.value && ifaces.length > 0) {
                    targetInput.value = ifaces[0].subnet;
                }
            })
            .catch(() => {
                ifaceDropdown.innerHTML = '<li><span class="dropdown-item text-danger">Failed to load</span></li>';
            });
    }

    // ── Start scan ──
    function startScan() {
        const target = targetInput.value.trim();
        if (!target) {
            targetInput.focus();
            return;
        }

        saveConfig();
        results = [];
        scanning = true;
        scanStartTime = Date.now();
        renderResults();

        // UI state
        startBtn.classList.add('d-none');
        stopBtn.classList.remove('d-none');
        progressSection.classList.remove('d-none');
        summarySection.classList.add('d-none');
        resultsSection.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressBar.classList.remove('bg-success', 'bg-danger');
        progressBar.classList.add('progress-bar-animated');
        progressStats.textContent = 'Starting scan...';
        progressOpen.textContent = '0 open ports';
        resultsBody.innerHTML = '';
        resultCount.textContent = '0';

        let portsParam = portPreset.value;
        if (portsParam === 'custom') {
            portsParam = customPorts.value.trim();
        }

        const params = new URLSearchParams({
            target: target,
            ports: portsParam,
            timeout: timeoutSlider.value,
            concurrency: workersSlider.value,
        });

        eventSource = new EventSource('/api/netscan/scan?' + params.toString());

        eventSource.addEventListener('info', function (e) {
            const data = JSON.parse(e.data);
            progressStats.textContent = 'Scanning ' + data.hosts + ' hosts, ' + data.ports + ' ports (' + data.totalProbes.toLocaleString() + ' probes)...';
        });

        eventSource.addEventListener('result', function (e) {
            const data = JSON.parse(e.data);
            results.push(data);
            progressOpen.textContent = results.length + ' open port' + (results.length !== 1 ? 's' : '');
            addResultRow(data);
            resultCount.textContent = results.length;
        });

        eventSource.addEventListener('progress', function (e) {
            const data = JSON.parse(e.data);
            const pct = Math.min(data.percent, 100);
            progressBar.style.width = pct + '%';
            progressBar.textContent = pct + '%';
            const elapsed = ((Date.now() - scanStartTime) / 1000).toFixed(1);
            progressStats.textContent = 'Scanned ' + data.scanned.toLocaleString() + '/' + data.total.toLocaleString() + ' | ' + elapsed + 's';
        });

        eventSource.addEventListener('done', function (e) {
            const data = JSON.parse(e.data);
            stopScan(false);

            // Summary
            summarySection.classList.remove('d-none');
            document.getElementById('sumHosts').textContent = data.hostsFound;
            document.getElementById('sumPorts').textContent = data.openPorts;
            document.getElementById('sumTime').textContent = data.elapsed + 's';

            progressBar.classList.remove('progress-bar-animated');
            progressBar.classList.add('bg-success');
            progressBar.style.width = '100%';
            progressBar.textContent = 'Complete';
        });

        eventSource.onerror = function () {
            if (scanning) {
                stopScan(true);
            }
        };
    }

    // ── Stop scan ──
    function stopScan(isError) {
        scanning = false;
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        startBtn.classList.remove('d-none');
        stopBtn.classList.add('d-none');
        progressBar.classList.remove('progress-bar-animated');

        if (isError) {
            progressBar.classList.add('bg-danger');
            progressBar.textContent = 'Stopped';
        }
    }

    // ── Buttons ──
    startBtn.addEventListener('click', startScan);
    stopBtn.addEventListener('click', function () { stopScan(false); });

    // Keyboard: Ctrl+Enter to start/stop
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (scanning) {
                stopScan(false);
            } else {
                startScan();
            }
        }
    });

    // ── Results table ──
    function ipToNum(ip) {
        const parts = ip.split('.');
        return ((+parts[0]) << 24) + ((+parts[1]) << 16) + ((+parts[2]) << 8) + (+parts[3]);
    }

    function addResultRow(r) {
        const filter = filterInput.value.toLowerCase();
        if (filter && !matchesFilter(r, filter)) return;

        if (groupByHost.checked) {
            renderResults();
            return;
        }

        const tr = createResultRow(r);
        // Insert sorted
        const rows = resultsBody.querySelectorAll('tr:not(.group-header)');
        let inserted = false;
        for (let i = 0; i < rows.length; i++) {
            if (compareResults(r, getRowData(rows[i])) < 0) {
                resultsBody.insertBefore(tr, rows[i]);
                inserted = true;
                break;
            }
        }
        if (!inserted) resultsBody.appendChild(tr);
    }

    function getRowData(tr) {
        return {
            ip: tr.dataset.ip,
            port: parseInt(tr.dataset.port),
            service: tr.dataset.service,
            latency: parseFloat(tr.dataset.latency),
        };
    }

    function compareResults(a, b) {
        let va, vb;
        switch (sortCol) {
            case 'ip':
                va = ipToNum(a.ip); vb = ipToNum(b.ip);
                if (va !== vb) return sortAsc ? va - vb : vb - va;
                return sortAsc ? a.port - b.port : b.port - a.port;
            case 'port':
                va = a.port; vb = b.port;
                break;
            case 'service':
                va = a.service.toLowerCase(); vb = b.service.toLowerCase();
                if (va < vb) return sortAsc ? -1 : 1;
                if (va > vb) return sortAsc ? 1 : -1;
                return 0;
            case 'latency':
                va = a.latency; vb = b.latency;
                break;
            default:
                return 0;
        }
        return sortAsc ? va - vb : vb - va;
    }

    function matchesFilter(r, filter) {
        return r.ip.includes(filter) ||
            String(r.port).includes(filter) ||
            r.service.toLowerCase().includes(filter);
    }

    function createResultRow(r) {
        const tr = document.createElement('tr');
        tr.dataset.ip = r.ip;
        tr.dataset.port = r.port;
        tr.dataset.service = r.service;
        tr.dataset.latency = r.latency;
        tr.innerHTML =
            '<td><code>' + escapeHtml(r.ip) + '</code></td>' +
            '<td><span class="badge bg-primary">' + r.port + '</span></td>' +
            '<td>' + escapeHtml(r.service) + '</td>' +
            '<td>' + r.latency + 'ms</td>';
        return tr;
    }

    function renderResults() {
        resultsBody.innerHTML = '';
        const filter = filterInput.value.toLowerCase();
        let filtered = results;
        if (filter) {
            filtered = results.filter(r => matchesFilter(r, filter));
        }

        filtered.sort(compareResults);
        resultCount.textContent = filtered.length;

        if (groupByHost.checked) {
            // Group by IP
            const groups = {};
            filtered.forEach(r => {
                if (!groups[r.ip]) groups[r.ip] = [];
                groups[r.ip].push(r);
            });

            // Sort IPs
            const ips = Object.keys(groups).sort((a, b) => {
                const diff = ipToNum(a) - ipToNum(b);
                return sortAsc ? diff : -diff;
            });

            ips.forEach(ip => {
                const headerTr = document.createElement('tr');
                headerTr.className = 'group-header table-secondary';
                headerTr.innerHTML = '<td colspan="4" class="fw-semibold"><i class="bi bi-pc-display"></i> ' +
                    escapeHtml(ip) + ' <span class="badge bg-secondary">' + groups[ip].length + ' port' + (groups[ip].length !== 1 ? 's' : '') + '</span></td>';
                resultsBody.appendChild(headerTr);

                groups[ip].forEach(r => {
                    resultsBody.appendChild(createResultRow(r));
                });
            });
        } else {
            filtered.forEach(r => {
                resultsBody.appendChild(createResultRow(r));
            });
        }
    }

    // ── Sort ──
    document.querySelectorAll('#resultsTable th[data-sort]').forEach(th => {
        th.addEventListener('click', function () {
            const col = this.dataset.sort;
            if (sortCol === col) {
                sortAsc = !sortAsc;
            } else {
                sortCol = col;
                sortAsc = true;
            }
            // Update sort icons
            document.querySelectorAll('#resultsTable th[data-sort] i').forEach(icon => {
                icon.className = 'bi bi-arrow-down-up text-muted small';
            });
            const icon = this.querySelector('i');
            icon.className = 'bi ' + (sortAsc ? 'bi-arrow-up' : 'bi-arrow-down') + ' text-primary small';
            renderResults();
        });
    });

    // ── Filter ──
    filterInput.addEventListener('input', function () {
        renderResults();
    });

    // ── Group by host ──
    groupByHost.addEventListener('change', renderResults);

    // ── Copy / Export ──
    document.getElementById('copyTextBtn').addEventListener('click', function () {
        if (results.length === 0) return;
        const text = results.map(r => r.ip + ':' + r.port + ' (' + r.service + ') ' + r.latency + 'ms').join('\n');
        copyToClipboard(text, 'Copied as text');
    });

    document.getElementById('copyJsonBtn').addEventListener('click', function () {
        if (results.length === 0) return;
        copyToClipboard(JSON.stringify(results, null, 2), 'Copied as JSON');
    });

    document.getElementById('exportCsvBtn').addEventListener('click', function () {
        if (results.length === 0) return;
        let csv = 'IP,Port,Service,Latency(ms)\n';
        results.forEach(r => {
            csv += r.ip + ',' + r.port + ',"' + r.service + '",' + r.latency + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'netscan-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-') + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToastLocal('Exported CSV');
    });

    document.getElementById('clearBtn').addEventListener('click', function () {
        results = [];
        resultsBody.innerHTML = '';
        resultCount.textContent = '0';
        summarySection.classList.add('d-none');
        progressSection.classList.add('d-none');
    });

    // ── Helpers ──
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function copyToClipboard(text, msg) {
        navigator.clipboard.writeText(text).then(function () {
            showToastLocal(msg || 'Copied!');
        }).catch(function () {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToastLocal(msg || 'Copied!');
        });
    }

    function showToastLocal(msg) {
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-dark py-2 px-3 small shadow-sm';
        toast.style.zIndex = '9999';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 1500);
    }

    // ── Init ──
    loadConfig();
    loadInterfaces();
});
