document.addEventListener('DOMContentLoaded', function () {
    // ── Elements ──
    const connStatus = document.getElementById('connStatus');
    const hostName = document.getElementById('hostName');
    const hostOS = document.getElementById('hostOS');
    const hostArch = document.getElementById('hostArch');
    const hostUptime = document.getElementById('hostUptime');
    const hostProcs = document.getElementById('hostProcs');
    const hostCores = document.getElementById('hostCores');
    const hostGo = document.getElementById('hostGo');
    const cpuGaugeArc = document.getElementById('cpuGaugeArc');
    const cpuGaugeValue = document.getElementById('cpuGaugeValue');
    const cpuGaugeLabel = document.getElementById('cpuGaugeLabel');
    const memGaugeArc = document.getElementById('memGaugeArc');
    const memGaugeValue = document.getElementById('memGaugeValue');
    const memGaugeLabel = document.getElementById('memGaugeLabel');
    const memSwapInfo = document.getElementById('memSwapInfo');
    const perCoreBars = document.getElementById('perCoreBars');
    const diskPartitions = document.getElementById('diskPartitions');
    const netTableBody = document.getElementById('netTableBody');
    const procTableBody = document.getElementById('procTableBody');

    const ARC_LENGTH = 251.33;
    let eventSource = null;
    let reconnectTimer = null;
    let baseUptime = 0;
    let baseUptimeTime = 0;

    // ── Formatters ──
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const val = bytes / Math.pow(1024, i);
        return val.toFixed(i > 1 ? 1 : 0) + ' ' + units[i];
    }

    function formatRate(bytesPerSec) {
        if (bytesPerSec === 0) return '0 B/s';
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
        const val = bytesPerSec / Math.pow(1024, i);
        return val.toFixed(i > 1 ? 1 : 0) + ' ' + units[Math.min(i, units.length - 1)];
    }

    function formatUptime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const parts = [];
        if (d > 0) parts.push(d + 'd');
        if (h > 0) parts.push(h + 'h');
        parts.push(m + 'm');
        return parts.join(' ');
    }

    function setGauge(arc, pct) {
        const offset = ARC_LENGTH * (1 - pct / 100);
        arc.style.strokeDashoffset = offset;
    }

    function getBarColor(pct) {
        if (pct < 50) return 'bg-success';
        if (pct < 80) return 'bg-warning';
        return 'bg-danger';
    }

    function setConnected(connected) {
        if (connected) {
            connStatus.className = 'badge rounded-pill ms-2 text-bg-success';
            connStatus.innerHTML = '<i class="bi bi-circle-fill" style="font-size: 0.5rem;"></i> Live';
        } else {
            connStatus.className = 'badge rounded-pill ms-2 text-bg-danger';
            connStatus.innerHTML = '<i class="bi bi-circle-fill" style="font-size: 0.5rem;"></i> Disconnected';
        }
    }

    // ── Update UI ──
    function updateUI(snap) {
        // Host info
        hostName.textContent = snap.host.hostname || '-';
        const osText = snap.host.platform || snap.host.os || '-';
        hostOS.textContent = snap.host.platformVersion ? osText + ' ' + snap.host.platformVersion : osText;
        hostArch.textContent = snap.host.arch || '-';
        baseUptime = snap.host.uptimeSec;
        baseUptimeTime = Date.now();
        hostUptime.textContent = formatUptime(snap.host.uptimeSec);
        hostProcs.textContent = snap.host.processCount.toLocaleString();
        hostCores.textContent = snap.host.numCpu;
        hostGo.textContent = snap.host.goVersion;

        // CPU gauge
        setGauge(cpuGaugeArc, snap.cpu.totalPercent);
        cpuGaugeValue.textContent = snap.cpu.totalPercent.toFixed(1) + '%';
        cpuGaugeLabel.textContent = snap.cpu.modelName || snap.cpu.cores + ' cores';

        // Memory gauge
        setGauge(memGaugeArc, snap.memory.usedPercent);
        memGaugeValue.textContent = snap.memory.usedPercent.toFixed(1) + '%';
        memGaugeLabel.textContent = formatBytes(snap.memory.used) + ' / ' + formatBytes(snap.memory.total);
        if (snap.memory.swapTotal > 0) {
            memSwapInfo.textContent = 'Swap: ' + formatBytes(snap.memory.swapUsed) + ' / ' + formatBytes(snap.memory.swapTotal);
        } else {
            memSwapInfo.textContent = '';
        }

        // Per-core CPU bars
        if (snap.cpu.perCore && snap.cpu.perCore.length > 0) {
            let html = '';
            snap.cpu.perCore.forEach(function (pct, i) {
                html += '<div class="d-flex align-items-center mb-1">' +
                    '<span class="text-muted me-2" style="width:55px;font-size:0.78rem;">Core ' + i + '</span>' +
                    '<div class="progress flex-grow-1" style="height:16px;">' +
                    '<div class="progress-bar ' + getBarColor(pct) + '" style="width:' + pct + '%;transition:width 0.5s ease;">' +
                    (pct >= 15 ? pct.toFixed(0) + '%' : '') +
                    '</div></div>' +
                    '<span class="ms-2 text-end" style="width:42px;font-size:0.78rem;">' + pct.toFixed(1) + '%</span>' +
                    '</div>';
            });
            perCoreBars.innerHTML = html;
        }

        // Disk partitions
        if (snap.disks && snap.disks.length > 0) {
            let html = '';
            snap.disks.forEach(function (d) {
                html += '<div class="mb-3">' +
                    '<div class="d-flex justify-content-between mb-1" style="font-size:0.82rem;">' +
                    '<span class="fw-semibold">' + escapeHtml(d.mountpoint) + '</span>' +
                    '<span class="text-muted">' + escapeHtml(d.fstype) + '</span>' +
                    '</div>' +
                    '<div class="progress mb-1" style="height:18px;">' +
                    '<div class="progress-bar ' + getBarColor(d.percent) + '" style="width:' + d.percent + '%;">' +
                    d.percent.toFixed(1) + '%' +
                    '</div></div>' +
                    '<div class="d-flex justify-content-between text-muted" style="font-size:0.75rem;">' +
                    '<span>Used: ' + formatBytes(d.used) + '</span>' +
                    '<span>Free: ' + formatBytes(d.free) + '</span>' +
                    '<span>Total: ' + formatBytes(d.total) + '</span>' +
                    '</div></div>';
            });
            diskPartitions.innerHTML = html;
        }

        // Network table
        if (snap.network && snap.network.length > 0) {
            let html = '';
            snap.network.forEach(function (n) {
                html += '<tr>' +
                    '<td class="fw-semibold">' + escapeHtml(n.name) + '</td>' +
                    '<td class="text-end text-success">' + formatRate(n.sendRate) + '</td>' +
                    '<td class="text-end text-primary">' + formatRate(n.recvRate) + '</td>' +
                    '<td class="text-end">' + formatBytes(n.bytesSent) + '</td>' +
                    '<td class="text-end">' + formatBytes(n.bytesRecv) + '</td>' +
                    '</tr>';
            });
            netTableBody.innerHTML = html;
        }

        // Process table
        if (snap.procs && snap.procs.length > 0) {
            let html = '';
            snap.procs.forEach(function (p) {
                html += '<tr>' +
                    '<td class="text-muted">' + p.pid + '</td>' +
                    '<td class="fw-semibold">' + escapeHtml(p.name) + '</td>' +
                    '<td class="text-end">' + formatBytes(p.memoryRss) + '</td>' +
                    '<td class="text-end">' + p.memoryPct.toFixed(1) + '%</td>' +
                    '</tr>';
            });
            procTableBody.innerHTML = html;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ── Live uptime ticker (updates between SSE ticks) ──
    setInterval(function () {
        if (baseUptime > 0 && baseUptimeTime > 0) {
            const elapsed = Math.floor((Date.now() - baseUptimeTime) / 1000);
            hostUptime.textContent = formatUptime(baseUptime + elapsed);
        }
    }, 1000);

    // ── SSE Connection ──
    function connect() {
        if (eventSource) {
            eventSource.close();
        }

        connStatus.className = 'badge rounded-pill ms-2 text-bg-warning';
        connStatus.innerHTML = '<i class="bi bi-circle-fill" style="font-size: 0.5rem;"></i> Connecting...';

        eventSource = new EventSource('/api/sysmon/stream');

        eventSource.addEventListener('snapshot', function (e) {
            try {
                const snap = JSON.parse(e.data);
                setConnected(true);
                updateUI(snap);
            } catch (err) {
                console.error('Failed to parse snapshot:', err);
            }
        });

        eventSource.onerror = function () {
            setConnected(false);
            eventSource.close();
            eventSource = null;
            // Auto-reconnect after 5s
            reconnectTimer = setTimeout(connect, 5000);
        };
    }

    connect();

    // Cleanup on page leave
    window.addEventListener('beforeunload', function () {
        if (eventSource) eventSource.close();
        if (reconnectTimer) clearTimeout(reconnectTimer);
    });
});
