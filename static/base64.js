document.addEventListener('DOMContentLoaded', function () {
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const stats = document.getElementById('stats');
    const downloadBtn = document.getElementById('downloadBtn');
    const urlSafe = document.getElementById('urlSafe');
    const lineBreaks = document.getElementById('lineBreaks');

    let fileBytes = null; // Uint8Array when file is loaded

    // ── Encode ──
    document.getElementById('encodeBtn').addEventListener('click', function () {
        if (fileBytes) {
            // Binary file → base64
            let b64 = uint8ToBase64(fileBytes);
            b64 = applyOptions(b64);
            outputText.value = b64;
            updateStats(fileBytes.length, b64.length);
        } else {
            const text = inputText.value;
            if (!text) return;
            try {
                // Text → base64 (supports Unicode via UTF-8)
                let b64 = btoa(unescape(encodeURIComponent(text)));
                b64 = applyOptions(b64);
                outputText.value = b64;
                updateStats(new TextEncoder().encode(text).length, b64.length);
            } catch (e) {
                outputText.value = 'Error: ' + e.message;
            }
        }
        downloadBtn.disabled = true;
    });

    // ── Decode ──
    document.getElementById('decodeBtn').addEventListener('click', function () {
        const text = inputText.value.trim();
        if (!text) return;
        try {
            // Remove line breaks and whitespace, restore URL-safe chars
            let clean = text.replace(/[\s\n\r]/g, '');
            if (urlSafe.checked) {
                clean = clean.replace(/-/g, '+').replace(/_/g, '/');
            }
            // Add padding if needed
            while (clean.length % 4 !== 0) clean += '=';

            const binary = atob(clean);
            // Try to decode as UTF-8 text
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            try {
                const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                outputText.value = decoded;
                downloadBtn.disabled = true;
                updateStats(text.length, bytes.length);
            } catch {
                // Binary data — can't display as text
                outputText.value = `[Binary data: ${formatSize(bytes.length)}]\nUse the Download button to save the file.`;
                fileBytes = bytes;
                downloadBtn.disabled = false;
                updateStats(text.length, bytes.length);
            }
        } catch (e) {
            outputText.value = 'Error: Invalid base64 string — ' + e.message;
            downloadBtn.disabled = true;
        }
    });

    // ── Swap ──
    document.getElementById('swapBtn').addEventListener('click', function () {
        const temp = inputText.value;
        inputText.value = outputText.value;
        outputText.value = temp;
        fileBytes = null;
        fileInfo.classList.add('d-none');
        downloadBtn.disabled = true;
        stats.textContent = '';
    });

    // ── Clear ──
    document.getElementById('clearInputBtn').addEventListener('click', function () {
        inputText.value = '';
        fileBytes = null;
        fileInfo.classList.add('d-none');
        stats.textContent = '';
    });

    document.getElementById('clearAllBtn').addEventListener('click', function () {
        inputText.value = '';
        outputText.value = '';
        fileBytes = null;
        fileInfo.classList.add('d-none');
        downloadBtn.disabled = true;
        stats.textContent = '';
    });

    // ── Copy ──
    document.getElementById('copyBtn').addEventListener('click', function () {
        if (!outputText.value) return;
        navigator.clipboard.writeText(outputText.value).then(() => {
            const btn = document.getElementById('copyBtn');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
            setTimeout(() => btn.innerHTML = orig, 1500);
        });
    });

    // ── Paste ──
    document.getElementById('pasteBtn').addEventListener('click', function () {
        navigator.clipboard.readText().then(text => {
            inputText.value = text;
            fileBytes = null;
            fileInfo.classList.add('d-none');
        });
    });

    // ── File Upload ──
    fileInput.addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            fileBytes = new Uint8Array(e.target.result);
            inputText.value = `[File: ${file.name} — ${formatSize(file.size)}]`;
            inputText.readOnly = true;
            fileInfo.textContent = `File loaded: ${file.name} (${formatSize(file.size)}) — click Encode to convert to base64`;
            fileInfo.classList.remove('d-none');
        };
        reader.readAsArrayBuffer(file);

        // Reset so same file can be re-selected
        this.value = '';
    });

    // Allow typing again when input is clicked
    inputText.addEventListener('focus', function () {
        if (fileBytes && inputText.readOnly) {
            // User wants to type — clear file mode
            inputText.readOnly = false;
            inputText.value = '';
            fileBytes = null;
            fileInfo.classList.add('d-none');
        }
    });

    // ── Download decoded binary ──
    downloadBtn.addEventListener('click', function () {
        if (!fileBytes) return;
        const blob = new Blob([fileBytes]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'decoded-file';
        a.click();
        URL.revokeObjectURL(url);
    });

    // ── Helper Functions ──

    function uint8ToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function applyOptions(b64) {
        if (urlSafe.checked) {
            b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
        if (lineBreaks.checked) {
            b64 = b64.match(/.{1,76}/g).join('\n');
        }
        return b64;
    }

    function updateStats(inputSize, outputSize) {
        stats.textContent = `Input: ${formatSize(inputSize)} → Output: ${formatSize(outputSize)} (ratio: ${(outputSize / inputSize * 100).toFixed(1)}%)`;
    }

    function formatSize(bytes) {
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return bytes + ' B';
    }
});
