document.addEventListener('DOMContentLoaded', function () {
    const inputText = document.getElementById('inputText');
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const resultsContainer = document.getElementById('resultsContainer');
    const inputStats = document.getElementById('inputStats');
    const compareInput = document.getElementById('compareInput');
    const compareResult = document.getElementById('compareResult');

    let fileBuffer = null; // ArrayBuffer when file is loaded
    let currentHashes = {}; // { 'MD5': 'abc...', 'SHA-256': '...' }
    let debounceTimer = null;

    const STORAGE_KEY = 'devhelper_hash_content';

    // ── MD5 Implementation ──
    // Compact pure-JS MD5 (RFC 1321)
    function md5(buffer) {
        // Convert string to Uint8Array if needed
        let bytes;
        if (typeof buffer === 'string') {
            bytes = new TextEncoder().encode(buffer);
        } else if (buffer instanceof ArrayBuffer) {
            bytes = new Uint8Array(buffer);
        } else {
            bytes = new Uint8Array(buffer);
        }

        function leftRotate(x, c) {
            return (x << c) | (x >>> (32 - c));
        }

        // Per-round shift amounts
        const s = [
            7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
            5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
            4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
            6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
        ];

        // Pre-computed K table: floor(2^32 * abs(sin(i + 1)))
        const K = [
            0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
            0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
            0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
            0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
            0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
            0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
            0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
            0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
            0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
            0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
            0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
            0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
            0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
            0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
            0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
            0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
        ];

        // Pre-processing: add padding bits
        const origLen = bytes.length;
        const bitLen = origLen * 8;

        // Append 0x80, then pad to 56 mod 64, then append original length as 64-bit LE
        let padLen = (56 - (origLen + 1) % 64 + 64) % 64;
        const padded = new Uint8Array(origLen + 1 + padLen + 8);
        padded.set(bytes);
        padded[origLen] = 0x80;

        // Append original length in bits as 64-bit little-endian
        const view = new DataView(padded.buffer);
        view.setUint32(padded.length - 8, bitLen >>> 0, true);
        view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000) >>> 0, true);

        // Initialize hash values
        let a0 = 0x67452301;
        let b0 = 0xefcdab89;
        let c0 = 0x98badcfe;
        let d0 = 0x10325476;

        // Process each 512-bit (64-byte) chunk
        for (let offset = 0; offset < padded.length; offset += 64) {
            const M = new Uint32Array(16);
            for (let j = 0; j < 16; j++) {
                M[j] = view.getUint32(offset + j * 4, true);
            }

            let A = a0, B = b0, C = c0, D = d0;

            for (let i = 0; i < 64; i++) {
                let F, g;
                if (i < 16) {
                    F = (B & C) | (~B & D);
                    g = i;
                } else if (i < 32) {
                    F = (D & B) | (~D & C);
                    g = (5 * i + 1) % 16;
                } else if (i < 48) {
                    F = B ^ C ^ D;
                    g = (3 * i + 5) % 16;
                } else {
                    F = C ^ (B | ~D);
                    g = (7 * i) % 16;
                }

                F = (F + A + K[i] + M[g]) >>> 0;
                A = D;
                D = C;
                C = B;
                B = (B + leftRotate(F, s[i])) >>> 0;
            }

            a0 = (a0 + A) >>> 0;
            b0 = (b0 + B) >>> 0;
            c0 = (c0 + C) >>> 0;
            d0 = (d0 + D) >>> 0;
        }

        // Produce the final hash (little-endian)
        function toLEHex(val) {
            return ((val & 0xff).toString(16).padStart(2, '0') +
                    ((val >> 8) & 0xff).toString(16).padStart(2, '0') +
                    ((val >> 16) & 0xff).toString(16).padStart(2, '0') +
                    ((val >> 24) & 0xff).toString(16).padStart(2, '0'));
        }

        return toLEHex(a0) + toLEHex(b0) + toLEHex(c0) + toLEHex(d0);
    }

    // ── SHA Hashing (Web Crypto API) ──
    async function sha(algorithm, data) {
        let buffer;
        if (typeof data === 'string') {
            buffer = new TextEncoder().encode(data);
        } else if (data instanceof ArrayBuffer) {
            buffer = data;
        } else {
            buffer = data.buffer || data;
        }
        const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
        const hashArray = new Uint8Array(hashBuffer);
        return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ── Get selected algorithms ──
    function getSelectedAlgorithms() {
        const checks = document.querySelectorAll('.algo-check:checked');
        return Array.from(checks).map(c => c.value);
    }

    // ── Format hash based on options ──
    function formatHash(hash) {
        if (document.getElementById('optUppercase').checked) {
            hash = hash.toUpperCase();
        }
        return hash;
    }

    // ── Compute all hashes ──
    async function computeHashes(data) {
        const algos = getSelectedAlgorithms();
        if (algos.length === 0) {
            resultsContainer.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-exclamation-circle"></i> Select at least one algorithm</div>';
            currentHashes = {};
            document.getElementById('copyAllBtn').disabled = true;
            return;
        }

        // Show computing state
        resultsContainer.innerHTML = algos.map(algo =>
            `<div class="card mb-2">
                <div class="card-body py-2 px-3">
                    <div class="d-flex align-items-center gap-2">
                        <span class="algo-badge bg-secondary-subtle text-secondary-emphasis">${algo}</span>
                        <span class="text-muted small"><i class="bi bi-hourglass-split"></i> Computing...</span>
                    </div>
                </div>
            </div>`
        ).join('');

        currentHashes = {};
        const results = [];

        for (const algo of algos) {
            try {
                let hash;
                if (algo === 'MD5') {
                    hash = md5(data);
                } else {
                    hash = await sha(algo, data);
                }
                hash = formatHash(hash);
                currentHashes[algo] = hash;
                results.push({ algo, hash, error: null });
            } catch (e) {
                results.push({ algo, hash: null, error: e.message });
            }
        }

        renderResults(results);
        document.getElementById('copyAllBtn').disabled = results.length === 0;

        // Re-run compare if there's a value
        if (compareInput.value.trim()) {
            doCompare();
        }
    }

    // ── Render hash results ──
    function renderResults(results) {
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-hash" style="font-size: 3rem; opacity: 0.2;"></i><div class="mt-2">Enter text or drop a file to generate hashes</div></div>';
            return;
        }

        const algoColors = {
            'MD5': 'warning',
            'SHA-1': 'info',
            'SHA-256': 'primary',
            'SHA-512': 'success'
        };

        resultsContainer.innerHTML = results.map(r => {
            const color = algoColors[r.algo] || 'secondary';
            if (r.error) {
                return `<div class="card mb-2">
                    <div class="card-body py-2 px-3">
                        <div class="d-flex align-items-center gap-2">
                            <span class="algo-badge bg-${color}-subtle text-${color}-emphasis">${r.algo}</span>
                            <span class="text-danger small"><i class="bi bi-exclamation-triangle"></i> ${r.error}</span>
                        </div>
                    </div>
                </div>`;
            }
            const charCount = r.hash.length;
            return `<div class="card mb-2" data-algo="${r.algo}">
                <div class="card-body py-2 px-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="d-flex align-items-center gap-2">
                            <span class="algo-badge bg-${color}-subtle text-${color}-emphasis">${r.algo}</span>
                            <span class="char-count">${charCount} chars</span>
                        </div>
                        <button class="btn btn-sm btn-outline-secondary py-0 px-2 copy-hash-btn" data-hash="${r.hash}" title="Copy ${r.algo} hash">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </div>
                    <div class="hash-value" data-hash="${r.hash}" title="Click to copy">${r.hash}</div>
                </div>
            </div>`;
        }).join('');

        // Bind copy events
        resultsContainer.querySelectorAll('.copy-hash-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                copyToClipboard(this.dataset.hash, this);
            });
        });

        resultsContainer.querySelectorAll('.hash-value').forEach(el => {
            el.addEventListener('click', function () {
                const btn = this.closest('.card-body').querySelector('.copy-hash-btn');
                copyToClipboard(this.dataset.hash, btn);
            });
        });
    }

    // ── Copy to clipboard ──
    function copyToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
                setTimeout(() => btn.innerHTML = orig, 1500);
            }
        });
    }

    // ── Update input stats ──
    function updateInputStats() {
        const text = inputText.value;
        const bytes = new TextEncoder().encode(text).length;
        inputStats.textContent = `${text.length} characters, ${formatSize(bytes)}`;
    }

    function formatSize(bytes) {
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return bytes + ' bytes';
    }

    // ── Trigger hash ──
    function triggerHash() {
        if (fileBuffer) {
            computeHashes(fileBuffer);
        } else {
            const text = inputText.value;
            if (!text) {
                resultsContainer.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-hash" style="font-size: 3rem; opacity: 0.2;"></i><div class="mt-2">Enter text or drop a file to generate hashes</div></div>';
                currentHashes = {};
                document.getElementById('copyAllBtn').disabled = true;
                return;
            }
            computeHashes(text);
        }
    }

    // ── Debounced auto-hash ──
    function debouncedHash() {
        if (!document.getElementById('autoHash').checked) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(triggerHash, 300);
    }

    // ── Event Listeners ──

    // Text input
    inputText.addEventListener('input', function () {
        updateInputStats();
        saveToStorage();
        // Clear file mode when typing
        if (fileBuffer) {
            fileBuffer = null;
            fileInfo.classList.add('d-none');
            document.getElementById('clearFileBtn').disabled = true;
        }
        debouncedHash();
    });

    // Hash button
    document.getElementById('hashBtn').addEventListener('click', triggerHash);

    // Algorithm checkboxes change → re-hash
    document.querySelectorAll('.algo-check').forEach(check => {
        check.addEventListener('change', function () {
            if (inputText.value || fileBuffer) {
                triggerHash();
            }
        });
    });

    // Options change → re-hash
    document.getElementById('optUppercase').addEventListener('change', function () {
        if (inputText.value || fileBuffer) {
            triggerHash();
        }
    });

    // Select all / none algorithms
    document.getElementById('selectAllAlgo').addEventListener('click', function () {
        document.querySelectorAll('.algo-check').forEach(c => c.checked = true);
        if (inputText.value || fileBuffer) triggerHash();
    });

    document.getElementById('selectNoneAlgo').addEventListener('click', function () {
        document.querySelectorAll('.algo-check').forEach(c => c.checked = false);
        resultsContainer.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-exclamation-circle"></i> Select at least one algorithm</div>';
        currentHashes = {};
        document.getElementById('copyAllBtn').disabled = true;
    });

    // Paste
    document.getElementById('pasteBtn').addEventListener('click', function () {
        navigator.clipboard.readText().then(text => {
            inputText.value = text;
            fileBuffer = null;
            fileInfo.classList.add('d-none');
            document.getElementById('clearFileBtn').disabled = true;
            updateInputStats();
            saveToStorage();
            debouncedHash();
        });
    });

    // Clear text
    document.getElementById('clearBtn').addEventListener('click', function () {
        inputText.value = '';
        fileBuffer = null;
        fileInfo.classList.add('d-none');
        document.getElementById('clearFileBtn').disabled = true;
        updateInputStats();
        saveToStorage();
        resultsContainer.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-hash" style="font-size: 3rem; opacity: 0.2;"></i><div class="mt-2">Enter text or drop a file to generate hashes</div></div>';
        currentHashes = {};
        document.getElementById('copyAllBtn').disabled = true;
        compareInput.value = '';
        compareResult.innerHTML = '';
    });

    // Clear file
    document.getElementById('clearFileBtn').addEventListener('click', function () {
        fileBuffer = null;
        fileInfo.classList.add('d-none');
        this.disabled = true;
        inputText.value = '';
        inputText.readOnly = false;
        updateInputStats();
        resultsContainer.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-hash" style="font-size: 3rem; opacity: 0.2;"></i><div class="mt-2">Enter text or drop a file to generate hashes</div></div>';
        currentHashes = {};
        document.getElementById('copyAllBtn').disabled = true;
    });

    // File input
    fileInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file) loadFile(file);
        this.value = '';
    });

    // Drag & drop
    dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', function () {
        this.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) loadFile(file);
    });

    function loadFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            fileBuffer = e.target.result;
            inputText.value = `[File: ${file.name}]`;
            inputText.readOnly = true;
            fileName.textContent = file.name;
            fileSize.textContent = `(${formatSize(file.size)})`;
            fileInfo.classList.remove('d-none');
            document.getElementById('clearFileBtn').disabled = false;
            inputStats.textContent = `File: ${formatSize(file.size)}`;
            triggerHash();
        };
        reader.readAsArrayBuffer(file);
    }

    // Allow typing again if user focuses input while file is loaded
    inputText.addEventListener('focus', function () {
        if (fileBuffer && inputText.readOnly) {
            inputText.readOnly = false;
            inputText.value = '';
            fileBuffer = null;
            fileInfo.classList.add('d-none');
            document.getElementById('clearFileBtn').disabled = true;
            updateInputStats();
        }
    });

    // Copy all hashes
    document.getElementById('copyAllBtn').addEventListener('click', function () {
        if (Object.keys(currentHashes).length === 0) return;
        const text = Object.entries(currentHashes)
            .map(([algo, hash]) => `${algo}: ${hash}`)
            .join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const btn = this;
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg text-success"></i> Copied';
            setTimeout(() => btn.innerHTML = orig, 1500);
        });
    });

    // ── Compare ──
    document.getElementById('compareBtn').addEventListener('click', doCompare);
    compareInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doCompare();
    });

    document.getElementById('clearCompareBtn').addEventListener('click', function () {
        compareInput.value = '';
        compareResult.innerHTML = '';
        // Remove highlight classes
        resultsContainer.querySelectorAll('.card').forEach(card => {
            card.classList.remove('hash-compare-match', 'hash-compare-mismatch');
        });
    });

    function doCompare() {
        const target = compareInput.value.trim().toLowerCase();
        if (!target) {
            compareResult.innerHTML = '';
            resultsContainer.querySelectorAll('.card').forEach(card => {
                card.classList.remove('hash-compare-match', 'hash-compare-mismatch');
            });
            return;
        }

        let found = false;
        resultsContainer.querySelectorAll('.card[data-algo]').forEach(card => {
            const algo = card.dataset.algo;
            const hash = currentHashes[algo];
            if (!hash) return;

            if (hash.toLowerCase() === target) {
                card.classList.add('hash-compare-match');
                card.classList.remove('hash-compare-mismatch');
                found = true;
            } else {
                card.classList.add('hash-compare-mismatch');
                card.classList.remove('hash-compare-match');
            }
        });

        if (found) {
            compareResult.innerHTML = '<span class="text-success small"><i class="bi bi-check-circle-fill"></i> Match found!</span>';
        } else if (Object.keys(currentHashes).length > 0) {
            compareResult.innerHTML = '<span class="text-danger small"><i class="bi bi-x-circle-fill"></i> No match found</span>';
        }
    }

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', function (e) {
        // Ctrl+Enter: hash now
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            triggerHash();
        }
        // Ctrl+Shift+C: copy all hashes
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            document.getElementById('copyAllBtn').click();
        }
    });

    // ── localStorage persistence ──
    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, inputText.value);
        } catch (e) { /* quota exceeded — ignore */ }
    }

    function restoreFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && !saved.startsWith('[File:')) {
                inputText.value = saved;
                updateInputStats();
                if (saved && document.getElementById('autoHash').checked) {
                    triggerHash();
                }
            }
        } catch (e) { /* ignore */ }
    }

    // ── Init ──
    restoreFromStorage();
    updateInputStats();
});
