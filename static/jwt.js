// ── Base64URL helpers ──
function base64urlEncode(data) {
    // data can be string or Uint8Array
    if (typeof data === 'string') {
        data = new TextEncoder().encode(data);
    }
    let binary = '';
    for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
    // Add padding
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = str.length % 4;
    if (pad === 2) str += '==';
    else if (pad === 3) str += '=';
    return atob(str);
}

function base64urlDecodeToUint8Array(str) {
    const decoded = base64urlDecode(str);
    const arr = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
        arr[i] = decoded.charCodeAt(i);
    }
    return arr;
}

// ── HMAC signing via Web Crypto API ──
const ALGO_MAP = {
    'HS256': { name: 'HMAC', hash: 'SHA-256' },
    'HS384': { name: 'HMAC', hash: 'SHA-384' },
    'HS512': { name: 'HMAC', hash: 'SHA-512' },
};

async function hmacSign(algorithm, secret, data) {
    const algo = ALGO_MAP[algorithm];
    if (!algo) throw new Error('Unsupported algorithm: ' + algorithm);

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        algo,
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return base64urlEncode(new Uint8Array(signature));
}

// ── JWT decode (no verification) ──
function decodeJWT(token) {
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;

    try {
        const header = JSON.parse(base64urlDecode(parts[0]));
        const payload = JSON.parse(base64urlDecode(parts[1]));
        return { header, payload, signature: parts[2] };
    } catch {
        return null;
    }
}

// ── Sample JWT data ──
const SAMPLE_HEADER = {
    alg: 'HS256',
    typ: 'JWT'
};

const SAMPLE_PAYLOAD = {
    sub: '1234567890',
    name: 'John Doe',
    iat: 1516239022
};

const SAMPLE_SECRET = 'your-256-bit-secret';

// ── Clipboard helper ──
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
    });
}

// showToast is defined in layout.html — fallback just in case
if (typeof showToast === 'undefined') {
    function showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-dark py-2 px-3 small shadow-sm';
        toast.style.zIndex = '9999';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    }
}

// ── State ──
let headerEditor = null;
let payloadEditor = null;

// ── Monaco AMD Setup ──
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
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const theme = isDark ? 'vs-dark' : 'vs';

    // ── Create editors ──
    headerEditor = monaco.editor.create(document.getElementById('headerEditor'), {
        value: '',
        language: 'json',
        theme: theme,
        automaticLayout: true,
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: 'off',
        glyphMargin: false,
        folding: false,
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { vertical: 'auto', horizontal: 'auto' },
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
    });

    payloadEditor = monaco.editor.create(document.getElementById('payloadEditor'), {
        value: '',
        language: 'json',
        theme: theme,
        automaticLayout: true,
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: 'off',
        glyphMargin: false,
        folding: false,
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { vertical: 'auto', horizontal: 'auto' },
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
    });

    // ── DOM refs ──
    const tokenInput = document.getElementById('tokenInput');
    const tokenColored = document.getElementById('tokenColored');
    const algorithmSelect = document.getElementById('algorithmSelect');
    const secretInput = document.getElementById('secretInput');
    const statusMsg = document.getElementById('statusMsg');
    const sampleBtn = document.getElementById('sampleBtn');
    const copyTokenBtn = document.getElementById('copyTokenBtn');
    const copyHeaderBtn = document.getElementById('copyHeaderBtn');
    const copyPayloadBtn = document.getElementById('copyPayloadBtn');
    const encodeBtn = document.getElementById('encodeBtn');
    const verifyBtn = document.getElementById('verifyBtn');
    const clearBtn = document.getElementById('clearBtn');

    // ── Color-coded display ──
    function showColoredToken(token) {
        const parts = token.trim().split('.');
        if (parts.length !== 3) {
            tokenColored.classList.add('d-none');
            tokenInput.classList.remove('d-none');
            return;
        }
        tokenColored.innerHTML =
            '<span class="jwt-header">' + escapeHtml(parts[0]) + '</span>' +
            '<span class="jwt-dot">.</span>' +
            '<span class="jwt-payload">' + escapeHtml(parts[1]) + '</span>' +
            '<span class="jwt-dot">.</span>' +
            '<span class="jwt-signature">' + escapeHtml(parts[2]) + '</span>';
        tokenColored.classList.remove('d-none');
        tokenInput.classList.add('d-none');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showTokenInput() {
        tokenColored.classList.add('d-none');
        tokenInput.classList.remove('d-none');
    }

    // Click colored display to edit
    tokenColored.addEventListener('click', function () {
        tokenInput.value = getTokenFromDisplay();
        showTokenInput();
        tokenInput.focus();
    });

    function getTokenFromDisplay() {
        // Reconstruct token from colored display or input
        if (!tokenInput.classList.contains('d-none')) {
            return tokenInput.value.trim();
        }
        return tokenColored.textContent.trim();
    }

    // ── Live decode on input ──
    let decodeTimeout;
    tokenInput.addEventListener('input', function () {
        clearTimeout(decodeTimeout);
        decodeTimeout = setTimeout(() => {
            const token = tokenInput.value.trim();
            if (!token) {
                headerEditor.setValue('');
                payloadEditor.setValue('');
                setStatus('neutral', '<i class="bi bi-info-circle"></i> Paste a JWT to decode');
                return;
            }
            const decoded = decodeJWT(token);
            if (decoded) {
                headerEditor.setValue(JSON.stringify(decoded.header, null, 2));
                payloadEditor.setValue(JSON.stringify(decoded.payload, null, 2));
                // Sync algorithm from header
                if (decoded.header.alg && ALGO_MAP[decoded.header.alg]) {
                    algorithmSelect.value = decoded.header.alg;
                }
                showColoredToken(token);
                setStatus('neutral', '<i class="bi bi-check2"></i> Decoded successfully. Click Verify to check signature.');
            } else {
                setStatus('invalid', '<i class="bi bi-exclamation-triangle"></i> Invalid JWT format');
            }
        }, 300);
    });

    // ── Paste handler for instant decode ──
    tokenInput.addEventListener('paste', function () {
        setTimeout(() => tokenInput.dispatchEvent(new Event('input')), 50);
    });

    // ── Sample button ──
    sampleBtn.addEventListener('click', async function () {
        headerEditor.setValue(JSON.stringify(SAMPLE_HEADER, null, 2));
        payloadEditor.setValue(JSON.stringify(SAMPLE_PAYLOAD, null, 2));
        algorithmSelect.value = 'HS256';
        secretInput.value = SAMPLE_SECRET;

        // Generate the sample token
        await doEncode();
    });

    // ── Encode button ──
    encodeBtn.addEventListener('click', doEncode);

    async function doEncode() {
        const headerText = headerEditor.getValue().trim();
        const payloadText = payloadEditor.getValue().trim();
        const secret = secretInput.value;
        const algorithm = algorithmSelect.value;

        if (!headerText || !payloadText) {
            setStatus('invalid', '<i class="bi bi-exclamation-triangle"></i> Header and Payload cannot be empty');
            return;
        }

        // Validate JSON
        let headerObj, payloadObj;
        try {
            headerObj = JSON.parse(headerText);
        } catch {
            setStatus('invalid', '<i class="bi bi-exclamation-triangle"></i> Header is not valid JSON');
            return;
        }
        try {
            payloadObj = JSON.parse(payloadText);
        } catch {
            setStatus('invalid', '<i class="bi bi-exclamation-triangle"></i> Payload is not valid JSON');
            return;
        }

        // Update header alg
        headerObj.alg = algorithm;
        if (!headerObj.typ) headerObj.typ = 'JWT';
        headerEditor.setValue(JSON.stringify(headerObj, null, 2));

        // Encode
        const headerB64 = base64urlEncode(JSON.stringify(headerObj));
        const payloadB64 = base64urlEncode(JSON.stringify(payloadObj));
        const signingInput = headerB64 + '.' + payloadB64;

        try {
            const signature = await hmacSign(algorithm, secret, signingInput);
            const token = signingInput + '.' + signature;

            tokenInput.value = token;
            showColoredToken(token);
            setStatus('verified', '<i class="bi bi-check-circle-fill"></i> JWT encoded with ' + algorithm);
        } catch (e) {
            setStatus('invalid', '<i class="bi bi-exclamation-triangle"></i> Encoding failed: ' + e.message);
        }
    }

    // ── Verify button ──
    verifyBtn.addEventListener('click', async function () {
        const token = getTokenFromDisplay();
        const secret = secretInput.value;

        if (!token) {
            setStatus('invalid', '<i class="bi bi-exclamation-triangle"></i> No token to verify');
            return;
        }

        const parts = token.split('.');
        if (parts.length !== 3) {
            setStatus('invalid', '<i class="bi bi-exclamation-triangle"></i> Invalid JWT format');
            return;
        }

        let headerObj;
        try {
            headerObj = JSON.parse(base64urlDecode(parts[0]));
        } catch {
            setStatus('invalid', '<i class="bi bi-exclamation-triangle"></i> Cannot decode header');
            return;
        }

        const algorithm = headerObj.alg;
        if (!ALGO_MAP[algorithm]) {
            setStatus('invalid', '<i class="bi bi-exclamation-triangle"></i> Unsupported algorithm: ' + algorithm);
            return;
        }

        try {
            const signingInput = parts[0] + '.' + parts[1];
            const expectedSig = await hmacSign(algorithm, secret, signingInput);

            if (expectedSig === parts[2]) {
                setStatus('verified', '<i class="bi bi-check-circle-fill"></i> Signature Verified');
            } else {
                setStatus('invalid', '<i class="bi bi-x-circle-fill"></i> Invalid Signature');
            }
        } catch (e) {
            setStatus('invalid', '<i class="bi bi-exclamation-triangle"></i> Verification failed: ' + e.message);
        }
    });

    // ── Copy buttons ──
    copyTokenBtn.addEventListener('click', function () {
        const token = getTokenFromDisplay();
        if (token) copyText(token);
    });

    copyHeaderBtn.addEventListener('click', function () {
        copyText(headerEditor.getValue());
    });

    copyPayloadBtn.addEventListener('click', function () {
        copyText(payloadEditor.getValue());
    });

    // ── Clear button ──
    clearBtn.addEventListener('click', function () {
        tokenInput.value = '';
        showTokenInput();
        headerEditor.setValue('');
        payloadEditor.setValue('');
        setStatus('neutral', '<i class="bi bi-info-circle"></i> Paste a JWT or click Sample to get started');
    });

    // ── Status helper ──
    function setStatus(type, html) {
        statusMsg.className = type === 'verified' ? 'status-verified'
            : type === 'invalid' ? 'status-invalid'
            : 'status-neutral';
        statusMsg.innerHTML = html;
    }
});
