document.addEventListener('DOMContentLoaded', function () {
    const uuidDisplay = document.getElementById('uuidDisplay');
    const uuidText = document.getElementById('uuidText');
    const bulkOutput = document.getElementById('bulkOutput');
    const historyList = document.getElementById('historyList');
    const validateInput = document.getElementById('validateInput');
    const validateResult = document.getElementById('validateResult');

    let currentVersion = 4;
    let history = [];
    const MAX_HISTORY = 50;

    // ── UUID Generators ──

    function uuidv4() {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
        return bytesToUuid(bytes);
    }

    function uuidv1() {
        // Timestamp: 100-nanosecond intervals since 1582-10-15
        const epoch = Date.UTC(1582, 9, 15);
        const now = Date.now();
        const timestamp = BigInt(now - epoch) * 10000n;

        const timeLow = Number(timestamp & 0xffffffffn);
        const timeMid = Number((timestamp >> 32n) & 0xffffn);
        const timeHi = Number((timestamp >> 48n) & 0x0fffn) | 0x1000; // version 1

        const clockSeq = crypto.getRandomValues(new Uint8Array(2));
        clockSeq[0] = (clockSeq[0] & 0x3f) | 0x80; // variant 10

        const node = crypto.getRandomValues(new Uint8Array(6));
        node[0] |= 0x01; // multicast bit (random node)

        const hex = [
            pad(timeLow.toString(16), 8),
            pad(timeMid.toString(16), 4),
            pad(timeHi.toString(16), 4),
            pad(clockSeq[0].toString(16), 2) + pad(clockSeq[1].toString(16), 2),
            Array.from(node).map(b => pad(b.toString(16), 2)).join('')
        ];
        return hex.join('-');
    }

    function uuidv7() {
        const now = Date.now();
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);

        // 48-bit timestamp (ms since epoch)
        bytes[0] = (now / 2**40) & 0xff;
        bytes[1] = (now / 2**32) & 0xff;
        bytes[2] = (now / 2**24) & 0xff;
        bytes[3] = (now / 2**16) & 0xff;
        bytes[4] = (now / 2**8) & 0xff;
        bytes[5] = now & 0xff;

        bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

        return bytesToUuid(bytes);
    }

    function bytesToUuid(bytes) {
        const hex = Array.from(bytes).map(b => pad(b.toString(16), 2)).join('');
        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20, 32)
        ].join('-');
    }

    function pad(str, len) {
        return str.padStart(len, '0');
    }

    // ── Generate ──

    function generateUuid() {
        let uuid;
        switch (currentVersion) {
            case 1: uuid = uuidv1(); break;
            case 7: uuid = uuidv7(); break;
            default: uuid = uuidv4(); break;
        }
        return uuid;
    }

    function formatUuid(uuid) {
        let result = uuid;
        if (document.getElementById('optNoDashes').checked) {
            result = result.replace(/-/g, '');
        }
        if (document.getElementById('optUppercase').checked) {
            result = result.toUpperCase();
        }
        if (document.getElementById('optBraces').checked) {
            result = '{' + result + '}';
        }
        return result;
    }

    function generateAndDisplay() {
        const raw = generateUuid();
        const formatted = formatUuid(raw);
        uuidText.textContent = formatted;

        // Add to history
        addToHistory(raw);
    }

    // ── History ──

    function addToHistory(uuid) {
        history.unshift({
            uuid: uuid,
            version: currentVersion,
            time: new Date().toLocaleTimeString()
        });
        if (history.length > MAX_HISTORY) history.pop();
        renderHistory();
    }

    function renderHistory() {
        if (history.length === 0) {
            historyList.innerHTML = '<div class="text-center text-muted py-4 small">No UUIDs generated yet</div>';
            return;
        }

        historyList.innerHTML = history.map(function (item, i) {
            const badgeClass = item.version === 4 ? 'text-bg-primary' : item.version === 1 ? 'text-bg-info' : 'text-bg-warning';
            return '<div class="history-item">' +
                '<span class="uuid-text" data-uuid="' + item.uuid + '" title="Click to copy">' + formatUuid(item.uuid) + '</span>' +
                '<span class="uuid-meta">' +
                    '<span class="badge version-badge ' + badgeClass + '">v' + item.version + '</span> ' +
                    item.time +
                '</span>' +
                '<button class="btn btn-sm p-0 border-0" data-copy="' + item.uuid + '" title="Copy" style="color: var(--bs-secondary-color);"><i class="bi bi-clipboard"></i></button>' +
            '</div>';
        }).join('');

        // Click to copy on uuid text
        historyList.querySelectorAll('.uuid-text').forEach(function (el) {
            el.addEventListener('click', function () {
                copyText(formatUuid(this.dataset.uuid));
            });
        });

        // Copy button
        historyList.querySelectorAll('[data-copy]').forEach(function (el) {
            el.addEventListener('click', function () {
                copyText(formatUuid(this.dataset.copy));
            });
        });
    }

    // ── Event Listeners ──

    // Generate button
    document.getElementById('generateBtn').addEventListener('click', generateAndDisplay);

    // Keyboard shortcut: Space or Enter to generate
    document.addEventListener('keydown', function (e) {
        // Don't trigger if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault();
            generateAndDisplay();
        }
    });

    // Version buttons
    document.querySelectorAll('[data-version]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            currentVersion = parseInt(this.dataset.version);
            document.querySelectorAll('[data-version]').forEach(function (b) {
                b.className = 'btn btn-outline-primary';
            });
            this.className = 'btn btn-primary active';
            generateAndDisplay();
        });
    });

    // Format options — re-format display + history
    ['optUppercase', 'optNoDashes', 'optBraces'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', function () {
            // Re-format current display
            if (history.length > 0) {
                uuidText.textContent = formatUuid(history[0].uuid);
            }
            renderHistory();
        });
    });

    // Copy main UUID
    document.getElementById('copyBtn').addEventListener('click', function () {
        const text = uuidText.textContent;
        if (!text || text === '—') return;
        copyText(text, this);
    });

    // Click on display to copy
    uuidDisplay.addEventListener('click', function () {
        const text = uuidText.textContent;
        if (!text || text === '—') return;
        copyText(text, document.getElementById('copyBtn'));
    });

    // ── Bulk Generate ──
    document.getElementById('bulkGenerateBtn').addEventListener('click', function () {
        const count = Math.min(1000, Math.max(1, parseInt(document.getElementById('bulkCount').value) || 10));
        const uuids = [];
        for (let i = 0; i < count; i++) {
            uuids.push(formatUuid(generateUuid()));
        }
        bulkOutput.value = uuids.join('\n');
        bulkOutput.style.height = 'auto';
        bulkOutput.style.height = bulkOutput.scrollHeight + 'px';
    });

    document.getElementById('bulkCopyBtn').addEventListener('click', function () {
        if (!bulkOutput.value) return;
        copyText(bulkOutput.value, this);
    });

    // ── Validate & Parse ──
    document.getElementById('validateBtn').addEventListener('click', validateUuid);
    validateInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') validateUuid();
    });

    function validateUuid() {
        const input = validateInput.value.trim().replace(/^\{|\}$/g, '');
        if (!input) {
            validateResult.innerHTML = '';
            return;
        }

        // Standard UUID regex (with or without dashes)
        const withDashes = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const withoutDashes = /^[0-9a-f]{32}$/i;

        let normalized = input;
        if (withoutDashes.test(input)) {
            // Add dashes
            normalized = input.slice(0, 8) + '-' + input.slice(8, 12) + '-' + input.slice(12, 16) + '-' + input.slice(16, 20) + '-' + input.slice(20);
        }

        if (!withDashes.test(normalized)) {
            validateResult.innerHTML = '<div class="alert alert-danger py-2 mb-0 small"><i class="bi bi-x-circle"></i> Invalid UUID format</div>';
            return;
        }

        // Parse UUID
        const hex = normalized.replace(/-/g, '').toLowerCase();

        // Version: high nibble of byte 6 (chars 12-13)
        const version = parseInt(hex[12], 16);

        // Variant: high bits of byte 8 (chars 16-17)
        const variantByte = parseInt(hex.slice(16, 18), 16);
        let variant;
        if ((variantByte & 0x80) === 0) variant = 'NCS (reserved)';
        else if ((variantByte & 0xc0) === 0x80) variant = 'RFC 4122 / RFC 9562';
        else if ((variantByte & 0xe0) === 0xc0) variant = 'Microsoft (reserved)';
        else variant = 'Future (reserved)';

        // Nil / Max check
        const isNil = hex === '00000000000000000000000000000000';
        const isMax = hex === 'ffffffffffffffffffffffffffffffff';

        let info = '';

        if (isNil) {
            info = '<tr><td>Type</td><td>Nil UUID (all zeros)</td></tr>';
        } else if (isMax) {
            info = '<tr><td>Type</td><td>Max UUID (all ones)</td></tr>';
        } else {
            info = '<tr><td>Version</td><td>' + version + ' — ' + getVersionName(version) + '</td></tr>';
            info += '<tr><td>Variant</td><td>' + variant + '</td></tr>';

            // v1: extract timestamp
            if (version === 1) {
                try {
                    const timeLow = hex.slice(0, 8);
                    const timeMid = hex.slice(8, 12);
                    const timeHi = hex.slice(13, 16); // skip version nibble
                    const timestamp = BigInt('0x' + timeHi + timeMid + timeLow);
                    // Convert from 100ns intervals since 1582-10-15 to ms since Unix epoch
                    const unixMs = Number(timestamp / 10000n) - 12219292800000;
                    const date = new Date(unixMs);
                    if (!isNaN(date.getTime())) {
                        info += '<tr><td>Timestamp</td><td>' + date.toISOString() + '</td></tr>';
                    }
                } catch (e) { /* ignore parse errors */ }
            }

            // v7: extract timestamp
            if (version === 7) {
                try {
                    const tsHex = hex.slice(0, 12);
                    const unixMs = parseInt(tsHex, 16);
                    const date = new Date(unixMs);
                    if (!isNaN(date.getTime())) {
                        info += '<tr><td>Timestamp</td><td>' + date.toISOString() + '</td></tr>';
                    }
                } catch (e) { /* ignore parse errors */ }
            }
        }

        info += '<tr><td>Canonical</td><td>' + normalized.toLowerCase() + '</td></tr>';

        validateResult.innerHTML = '<div class="alert alert-success py-2 mb-2 small"><i class="bi bi-check-circle"></i> Valid UUID</div>' +
            '<table class="table table-sm parse-table mb-0"><tbody>' + info + '</tbody></table>';
    }

    function getVersionName(v) {
        const names = {
            1: 'Timestamp + node (RFC 4122)',
            2: 'DCE Security',
            3: 'MD5 hash (name-based)',
            4: 'Random (RFC 4122)',
            5: 'SHA-1 hash (name-based)',
            6: 'Reordered timestamp (RFC 9562)',
            7: 'Unix timestamp + random (RFC 9562)',
            8: 'Custom (RFC 9562)',
        };
        return names[v] || 'Unknown';
    }

    // ── History Controls ──
    document.getElementById('clearHistoryBtn').addEventListener('click', function () {
        history = [];
        renderHistory();
    });

    document.getElementById('copyHistoryBtn').addEventListener('click', function () {
        if (history.length === 0) return;
        const text = history.map(function (h) { return formatUuid(h.uuid); }).join('\n');
        copyText(text, this);
    });

    // ── Copy Helper ──
    function copyText(text, btn) {
        navigator.clipboard.writeText(text).then(function () {
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
                setTimeout(function () { btn.innerHTML = orig; }, 1500);
            }
        });
    }

    // ── Initial generate ──
    generateAndDisplay();
});
