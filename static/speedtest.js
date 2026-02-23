document.addEventListener('DOMContentLoaded', function () {
    // ── Constants ──
    const HISTORY_KEY = 'devhelper_speedtest_history';
    const SETTINGS_KEY = 'devhelper_speedtest_settings';
    const MAX_HISTORY = 50;
    const ARC_LENGTH = 251.33; // π × 80

    // ── State ──
    let isRunning = false;
    let abortController = null;
    let xhrUpload = null;

    // ── DOM refs ──
    const netGaugeArc = document.getElementById('netGaugeArc');
    const netGaugeValue = document.getElementById('netGaugeValue');
    const netGaugeUnit = document.getElementById('netGaugeUnit');
    const netGaugeLabel = document.getElementById('netGaugeLabel');
    const netProgress = document.getElementById('netProgress');
    const netProgressBar = document.getElementById('netProgressBar');
    const netStartBtn = document.getElementById('netStartBtn');
    const netStopBtn = document.getElementById('netStopBtn');
    const downloadResult = document.getElementById('downloadResult');
    const uploadResult = document.getElementById('uploadResult');
    const pingResult = document.getElementById('pingResult');
    const pingJitter = document.getElementById('pingJitter');
    const downloadSize = document.getElementById('downloadSize');
    const uploadSize = document.getElementById('uploadSize');
    const pingCount = document.getElementById('pingCount');

    const diskGaugeArc = document.getElementById('diskGaugeArc');
    const diskGaugeValue = document.getElementById('diskGaugeValue');
    const diskGaugeUnit = document.getElementById('diskGaugeUnit');
    const diskGaugeLabel = document.getElementById('diskGaugeLabel');
    const diskProgress = document.getElementById('diskProgress');
    const diskProgressBar = document.getElementById('diskProgressBar');
    const diskStartBtn = document.getElementById('diskStartBtn');
    const diskStopBtn = document.getElementById('diskStopBtn');
    const writeResult = document.getElementById('writeResult');
    const readResult = document.getElementById('readResult');
    const writeDuration = document.getElementById('writeDuration');
    const readDuration = document.getElementById('readDuration');
    const diskPath = document.getElementById('diskPath');
    const diskSize = document.getElementById('diskSize');
    const diskPathInfo = document.getElementById('diskPathInfo');

    const historyBody = document.getElementById('historyBody');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // ── Settings ──
    function loadSettings() {
        try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
        catch { return {}; }
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            downloadSizeMB: parseInt(downloadSize.value),
            uploadSizeMB: parseInt(uploadSize.value),
            pingCount: parseInt(pingCount.value),
            diskPath: diskPath.value,
            diskSizeMB: parseInt(diskSize.value),
        }));
    }

    const saved = loadSettings();
    if (saved.downloadSizeMB) downloadSize.value = saved.downloadSizeMB;
    if (saved.uploadSizeMB) uploadSize.value = saved.uploadSizeMB;
    if (saved.pingCount) pingCount.value = saved.pingCount;
    if (saved.diskPath) diskPath.value = saved.diskPath;
    if (saved.diskSizeMB) diskSize.value = saved.diskSizeMB;

    // ── Gauge helpers ──
    function formatSpeed(val) {
        if (val >= 10000) return (val / 1000).toFixed(0) + 'k';
        if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
        if (val >= 100) return val.toFixed(0);
        if (val >= 10) return val.toFixed(1);
        return val.toFixed(2);
    }

    function updateGauge(arc, valueEl, unitEl, labelEl, value, unit, label, maxValue) {
        const pct = Math.min(value / maxValue, 1);
        arc.style.strokeDashoffset = ARC_LENGTH * (1 - pct);
        valueEl.textContent = value > 0 ? formatSpeed(value) : '0';
        unitEl.textContent = unit;
        if (labelEl) labelEl.textContent = label;
    }

    function resetGauge(arc, valueEl, unitEl, labelEl) {
        arc.style.strokeDashoffset = ARC_LENGTH;
        valueEl.textContent = '0';
        unitEl.textContent = 'Mbps';
        if (labelEl) labelEl.textContent = 'Ready';
    }

    // ── Network test ──
    async function runNetworkTest() {
        if (isRunning) return;
        isRunning = true;
        abortController = new AbortController();
        const signal = abortController.signal;

        netStartBtn.classList.add('d-none');
        netStopBtn.classList.remove('d-none');
        netProgress.classList.remove('d-none');
        downloadResult.textContent = '-';
        uploadResult.textContent = '-';
        pingResult.textContent = '-';
        pingJitter.textContent = '';

        const dlSize = parseInt(downloadSize.value) || 10;
        const ulSize = parseInt(uploadSize.value) || 10;
        const pCount = parseInt(pingCount.value) || 20;
        saveSettings();

        let pingMs = 0, jitterMs = 0, dlMbps = 0, ulMbps = 0;

        try {
            // ── Phase 1: Ping ──
            resetGauge(netGaugeArc, netGaugeValue, netGaugeUnit, netGaugeLabel);
            netGaugeLabel.textContent = 'Pinging...';
            netGaugeUnit.textContent = 'ms';
            netProgressBar.style.width = '5%';
            netProgressBar.textContent = 'Ping test...';

            const pingData = await runPingTest(pCount, signal);
            pingMs = pingData.avg;
            jitterMs = pingData.jitter;

            pingResult.textContent = pingMs.toFixed(1) + ' ms';
            pingJitter.textContent = 'Min ' + pingData.min.toFixed(1) + ' / Max ' + pingData.max.toFixed(1) + ' / Jitter ' + jitterMs.toFixed(1) + ' ms';
            updateGauge(netGaugeArc, netGaugeValue, netGaugeUnit, netGaugeLabel, pingMs, 'ms', 'Ping: ' + pingMs.toFixed(1) + ' ms', 200);

            // ── Phase 2: Download ──
            netProgressBar.style.width = '15%';
            netProgressBar.textContent = 'Download test...';
            resetGauge(netGaugeArc, netGaugeValue, netGaugeUnit, netGaugeLabel);
            netGaugeLabel.textContent = 'Downloading...';
            netGaugeUnit.textContent = 'Mbps';

            dlMbps = await runDownloadTest(dlSize, signal, function (speed, pct) {
                updateGauge(netGaugeArc, netGaugeValue, netGaugeUnit, netGaugeLabel, speed, 'Mbps', 'Downloading...', 1000);
                netProgressBar.style.width = (15 + pct * 0.50) + '%';
            });

            downloadResult.textContent = formatSpeed(dlMbps) + ' Mbps';
            updateGauge(netGaugeArc, netGaugeValue, netGaugeUnit, netGaugeLabel, dlMbps, 'Mbps', 'Download: ' + formatSpeed(dlMbps) + ' Mbps', 1000);

            // ── Phase 3: Upload ──
            netProgressBar.style.width = '65%';
            netProgressBar.textContent = 'Upload test...';
            resetGauge(netGaugeArc, netGaugeValue, netGaugeUnit, netGaugeLabel);
            netGaugeLabel.textContent = 'Uploading...';
            netGaugeUnit.textContent = 'Mbps';

            ulMbps = await runUploadTest(ulSize, signal, function (speed, pct) {
                updateGauge(netGaugeArc, netGaugeValue, netGaugeUnit, netGaugeLabel, speed, 'Mbps', 'Uploading...', 1000);
                netProgressBar.style.width = (65 + pct * 0.35) + '%';
            });

            uploadResult.textContent = formatSpeed(ulMbps) + ' Mbps';

            // Final display
            netProgressBar.style.width = '100%';
            netProgressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
            netProgressBar.textContent = 'Complete';
            updateGauge(netGaugeArc, netGaugeValue, netGaugeUnit, netGaugeLabel, dlMbps, 'Mbps',
                '↓ ' + formatSpeed(dlMbps) + '  ↑ ' + formatSpeed(ulMbps) + '  Ping ' + pingMs.toFixed(0) + 'ms', 1000);

            // Save to history
            addHistory({
                type: 'Network',
                download: formatSpeed(dlMbps) + ' Mbps',
                upload: formatSpeed(ulMbps) + ' Mbps',
                ping: pingMs.toFixed(1) + ' ms',
            });

        } catch (e) {
            if (e.name === 'AbortError') {
                netGaugeLabel.textContent = 'Cancelled';
                netProgressBar.textContent = 'Cancelled';
                netProgressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
            } else {
                netGaugeLabel.textContent = 'Error';
                netProgressBar.textContent = 'Error: ' + e.message;
                netProgressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
            }
        } finally {
            isRunning = false;
            abortController = null;
            netStartBtn.classList.remove('d-none');
            netStopBtn.classList.add('d-none');
        }
    }

    // ── Ping test ──
    async function runPingTest(count, signal) {
        const times = [];
        for (let i = 0; i < count; i++) {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            const start = performance.now();
            await fetch('/api/speedtest/ping?t=' + Date.now() + '_' + i, { signal: signal, cache: 'no-store' });
            times.push(performance.now() - start);
        }

        const avg = times.reduce(function (a, b) { return a + b; }, 0) / times.length;
        const min = Math.min.apply(null, times);
        const max = Math.max.apply(null, times);

        var jitterSum = 0;
        for (var i = 1; i < times.length; i++) {
            jitterSum += Math.abs(times[i] - times[i - 1]);
        }
        var jitter = times.length > 1 ? jitterSum / (times.length - 1) : 0;

        return { avg: avg, min: min, max: max, jitter: jitter };
    }

    // ── Download test ──
    async function runDownloadTest(sizeMB, signal, onProgress) {
        const resp = await fetch('/api/speedtest/download?size=' + sizeMB + '&t=' + Date.now(), { signal: signal, cache: 'no-store' });
        const reader = resp.body.getReader();
        const totalBytes = sizeMB * 1024 * 1024;

        let received = 0;
        const startTime = performance.now();
        let lastUpdate = startTime;

        while (true) {
            var chunk = await reader.read();
            if (chunk.done) break;
            received += chunk.value.length;

            var now = performance.now();
            if (now - lastUpdate > 150) {
                var elapsed = (now - startTime) / 1000;
                var speed = (received * 8) / elapsed / 1e6;
                var pct = Math.min(received / totalBytes, 1);
                onProgress(speed, pct);
                lastUpdate = now;
            }
        }

        var totalElapsed = (performance.now() - startTime) / 1000;
        return (received * 8) / totalElapsed / 1e6;
    }

    // ── Upload test ──
    function runUploadTest(sizeMB, signal, onProgress) {
        return new Promise(function (resolve, reject) {
            var totalBytes = sizeMB * 1024 * 1024;

            // Generate random data in 64KB chunks
            var data = new Uint8Array(totalBytes);
            var chunkSize = 65536;
            for (var i = 0; i < totalBytes; i += chunkSize) {
                var end = Math.min(i + chunkSize, totalBytes);
                crypto.getRandomValues(data.subarray(i, end));
            }

            var blob = new Blob([data]);
            var xhr = new XMLHttpRequest();
            xhrUpload = xhr;
            var startTime = performance.now();
            var lastUpdate = startTime;

            xhr.upload.onprogress = function (e) {
                if (!e.lengthComputable) return;
                var now = performance.now();
                if (now - lastUpdate > 150) {
                    var elapsed = (now - startTime) / 1000;
                    var speed = (e.loaded * 8) / elapsed / 1e6;
                    var pct = e.loaded / e.total;
                    onProgress(speed, pct);
                    lastUpdate = now;
                }
            };

            xhr.onload = function () {
                xhrUpload = null;
                var elapsed = (performance.now() - startTime) / 1000;
                resolve((totalBytes * 8) / elapsed / 1e6);
            };

            xhr.onerror = function () {
                xhrUpload = null;
                reject(new Error('Upload failed'));
            };

            xhr.onabort = function () {
                xhrUpload = null;
                reject(new DOMException('Aborted', 'AbortError'));
            };

            signal.addEventListener('abort', function () { xhr.abort(); });

            xhr.open('POST', '/api/speedtest/upload');
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.send(blob);
        });
    }

    // ── Disk test ──
    async function runDiskTest() {
        if (isRunning) return;
        isRunning = true;

        diskStartBtn.classList.add('d-none');
        diskStopBtn.classList.remove('d-none');
        diskProgress.classList.remove('d-none');
        writeResult.textContent = '-';
        readResult.textContent = '-';
        writeDuration.textContent = '';
        readDuration.textContent = '';
        diskPathInfo.textContent = '';

        var path = diskPath.value.trim();
        var sizeMB = parseInt(diskSize.value) || 100;
        saveSettings();

        // Indeterminate progress
        diskProgressBar.classList.add('progress-bar-striped', 'progress-bar-animated');
        diskProgressBar.style.width = '100%';
        diskProgressBar.textContent = 'Writing ' + sizeMB + ' MB...';
        resetGauge(diskGaugeArc, diskGaugeValue, diskGaugeUnit, diskGaugeLabel);
        diskGaugeLabel.textContent = 'Writing...';
        diskGaugeUnit.textContent = 'MB/s';

        try {
            var resp = await fetch('/api/speedtest/disk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path, sizeMB: sizeMB }),
            });

            var result = await resp.json();

            if (result.error) {
                diskGaugeLabel.textContent = 'Error';
                diskProgressBar.textContent = result.error;
                diskProgressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
                diskProgressBar.classList.add('bg-danger');
                return;
            }

            var ws = result.write.speedMBps;
            var rs = result.read.speedMBps;

            writeResult.textContent = formatSpeed(ws) + ' MB/s';
            readResult.textContent = formatSpeed(rs) + ' MB/s';
            writeDuration.textContent = (result.write.durationMs / 1000).toFixed(2) + 's (' + result.write.sizeMB + ' MB)';
            readDuration.textContent = (result.read.durationMs / 1000).toFixed(2) + 's (' + result.read.sizeMB + ' MB)';

            if (result.path) {
                diskPathInfo.textContent = 'Tested path: ' + result.path;
                if (!diskPath.value.trim()) diskPath.value = result.path;
            }

            var maxGauge = Math.max(ws, rs, 500);
            maxGauge = Math.ceil(maxGauge / 500) * 500;
            updateGauge(diskGaugeArc, diskGaugeValue, diskGaugeUnit, diskGaugeLabel,
                Math.max(ws, rs), 'MB/s',
                'Write ' + formatSpeed(ws) + ' / Read ' + formatSpeed(rs) + ' MB/s',
                maxGauge);

            diskProgressBar.textContent = 'Complete';
            diskProgressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');

            // Save to history
            var pathLabel = result.path || 'temp';
            if (pathLabel.length > 30) pathLabel = '...' + pathLabel.slice(-27);
            addHistory({
                type: 'Disk',
                download: formatSpeed(ws) + ' MB/s',
                upload: formatSpeed(rs) + ' MB/s',
                ping: '-',
            });

        } catch (e) {
            diskGaugeLabel.textContent = 'Error';
            diskProgressBar.textContent = 'Error: ' + e.message;
            diskProgressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
        } finally {
            isRunning = false;
            diskStartBtn.classList.remove('d-none');
            diskStopBtn.classList.add('d-none');
        }
    }

    // ── Stop ──
    function stopTests() {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        if (xhrUpload) {
            xhrUpload.abort();
            xhrUpload = null;
        }
        isRunning = false;
        netStartBtn.classList.remove('d-none');
        netStopBtn.classList.add('d-none');
        diskStartBtn.classList.remove('d-none');
        diskStopBtn.classList.add('d-none');
    }

    // ── History ──
    function loadHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
        catch { return []; }
    }

    function addHistory(entry) {
        var now = new Date();
        entry.time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        entry.date = now.toLocaleDateString();
        var history = loadHistory();
        history.unshift(entry);
        if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        renderHistory();
    }

    function renderHistory() {
        var history = loadHistory();
        if (history.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No test results yet</td></tr>';
            return;
        }
        historyBody.innerHTML = history.map(function (h, i) {
            var badge = h.type === 'Network' ? 'bg-primary' : 'bg-success';
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td title="' + (h.date || '') + '">' + h.time + '</td>' +
                '<td><span class="badge ' + badge + '">' + h.type + '</span></td>' +
                '<td>' + h.download + '</td>' +
                '<td>' + h.upload + '</td>' +
                '<td>' + h.ping + '</td>' +
                '</tr>';
        }).join('');
    }

    // ── Event listeners ──
    netStartBtn.addEventListener('click', runNetworkTest);
    netStopBtn.addEventListener('click', stopTests);
    diskStartBtn.addEventListener('click', runDiskTest);
    diskStopBtn.addEventListener('click', stopTests);
    clearHistoryBtn.addEventListener('click', function () {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
    });

    // Save settings on change
    [downloadSize, uploadSize, pingCount, diskSize].forEach(function (el) {
        el.addEventListener('change', saveSettings);
    });
    diskPath.addEventListener('blur', saveSettings);

    // Initial render
    renderHistory();
});
