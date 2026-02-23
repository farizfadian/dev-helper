document.addEventListener('DOMContentLoaded', function () {
    const jsonInput = document.getElementById('jsonInput');
    const yamlInput = document.getElementById('yamlInput');
    const autoConvert = document.getElementById('autoConvert');
    const yamlIndent = document.getElementById('yamlIndent');
    const jsonIndent = document.getElementById('jsonIndent');
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');
    const jsonStats = document.getElementById('jsonStats');
    const yamlStats = document.getElementById('yamlStats');
    const jsonValid = document.getElementById('jsonValid');
    const yamlValid = document.getElementById('yamlValid');

    const JSON_STORAGE_KEY = 'devhelper_json2yaml_json';
    const YAML_STORAGE_KEY = 'devhelper_json2yaml_yaml';

    let debounceTimer = null;
    let lastEditedSide = 'json'; // Track which side was last edited

    // ── Sample Data ──

    const sampleJson = {
        "project": {
            "name": "dev-helper",
            "version": "1.0.0",
            "description": "Offline-first developer toolkit",
            "license": "MIT"
        },
        "server": {
            "host": "localhost",
            "port": 9090,
            "debug": true,
            "cors": {
                "enabled": true,
                "origins": ["http://localhost:3000", "http://localhost:8080"]
            }
        },
        "database": {
            "driver": "sqlite",
            "path": "./data/app.db",
            "maxConnections": 10,
            "timeout": 30
        },
        "features": [
            {
                "name": "upload",
                "enabled": true,
                "maxFileSize": "50MB"
            },
            {
                "name": "logs",
                "enabled": true,
                "retentionDays": 30
            },
            {
                "name": "editor",
                "enabled": true,
                "languages": ["javascript", "python", "go", "java", "csharp"]
            }
        ],
        "tags": ["developer-tools", "offline-first", "go", "web"],
        "metadata": {
            "createdAt": "2025-01-01T00:00:00Z",
            "author": "Fariz Fadian",
            "repository": "https://github.com/farizfadian/dev-helper"
        }
    };

    // ── Conversion Functions ──

    function jsonToYaml() {
        const jsonStr = jsonInput.value.trim();
        if (!jsonStr) {
            yamlInput.value = '';
            clearError();
            updateStats();
            return;
        }

        try {
            const parsed = JSON.parse(jsonStr);
            const indent = parseInt(yamlIndent.value);
            const yamlStr = jsyaml.dump(parsed, {
                indent: indent,
                lineWidth: -1,  // Don't wrap lines
                noRefs: true,   // Don't use YAML references
                sortKeys: false // Keep original key order
            });
            yamlInput.value = yamlStr;
            clearError();
            showJsonValid(true);
        } catch (e) {
            showError('JSON Parse Error: ' + e.message);
            showJsonValid(false);
        }

        updateStats();
        saveToStorage();
    }

    function yamlToJson() {
        const yamlStr = yamlInput.value.trim();
        if (!yamlStr) {
            jsonInput.value = '';
            clearError();
            updateStats();
            return;
        }

        try {
            const parsed = jsyaml.load(yamlStr);
            const indent = parseInt(jsonIndent.value);
            const jsonStr = JSON.stringify(parsed, null, indent);
            jsonInput.value = jsonStr;
            clearError();
            showYamlValid(true);
        } catch (e) {
            showError('YAML Parse Error: ' + e.message);
            showYamlValid(false);
        }

        updateStats();
        saveToStorage();
    }

    // ── Error Display ──

    function showError(msg) {
        errorText.textContent = msg;
        errorMsg.classList.remove('d-none');
    }

    function clearError() {
        errorMsg.classList.add('d-none');
    }

    function showJsonValid(valid) {
        if (jsonInput.value.trim()) {
            jsonValid.innerHTML = valid
                ? '<span class="text-success"><i class="bi bi-check-circle"></i> Valid JSON</span>'
                : '<span class="text-danger"><i class="bi bi-x-circle"></i> Invalid JSON</span>';
        } else {
            jsonValid.innerHTML = '';
        }
    }

    function showYamlValid(valid) {
        if (yamlInput.value.trim()) {
            yamlValid.innerHTML = valid
                ? '<span class="text-success"><i class="bi bi-check-circle"></i> Valid YAML</span>'
                : '<span class="text-danger"><i class="bi bi-x-circle"></i> Invalid YAML</span>';
        } else {
            yamlValid.innerHTML = '';
        }
    }

    // ── Stats ──

    function updateStats() {
        const jsonStr = jsonInput.value;
        const yamlStr = yamlInput.value;

        if (jsonStr) {
            const lines = jsonStr.split('\n').length;
            const chars = jsonStr.length;
            jsonStats.textContent = lines + ' lines · ' + chars + ' chars';
        } else {
            jsonStats.textContent = '';
        }

        if (yamlStr) {
            const lines = yamlStr.split('\n').length;
            const chars = yamlStr.length;
            yamlStats.textContent = lines + ' lines · ' + chars + ' chars';
        } else {
            yamlStats.textContent = '';
        }
    }

    // ── Event Listeners ──

    // JSON → YAML button
    document.getElementById('jsonToYamlBtn').addEventListener('click', function () {
        jsonToYaml();
    });

    // YAML → JSON button
    document.getElementById('yamlToJsonBtn').addEventListener('click', function () {
        yamlToJson();
    });

    // Auto-convert on JSON input
    jsonInput.addEventListener('input', function () {
        lastEditedSide = 'json';
        if (autoConvert.checked) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(jsonToYaml, 300);
        } else {
            updateStats();
            // Validate inline
            try {
                if (jsonInput.value.trim()) {
                    JSON.parse(jsonInput.value);
                    showJsonValid(true);
                } else {
                    jsonValid.innerHTML = '';
                }
                clearError();
            } catch (e) {
                showJsonValid(false);
            }
        }
    });

    // Auto-convert on YAML input
    yamlInput.addEventListener('input', function () {
        lastEditedSide = 'yaml';
        if (autoConvert.checked) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(yamlToJson, 300);
        } else {
            updateStats();
            // Validate inline
            try {
                if (yamlInput.value.trim()) {
                    jsyaml.load(yamlInput.value);
                    showYamlValid(true);
                } else {
                    yamlValid.innerHTML = '';
                }
                clearError();
            } catch (e) {
                showYamlValid(false);
            }
        }
    });

    // Swap
    document.getElementById('swapBtn').addEventListener('click', function () {
        const temp = jsonInput.value;
        jsonInput.value = yamlInput.value;
        yamlInput.value = temp;
        updateStats();
        saveToStorage();
    });

    // Sample data
    document.getElementById('sampleBtn').addEventListener('click', function () {
        const indent = parseInt(jsonIndent.value);
        jsonInput.value = JSON.stringify(sampleJson, null, indent);
        lastEditedSide = 'json';
        jsonToYaml();
    });

    // Prettify JSON
    document.getElementById('prettifyJsonBtn').addEventListener('click', function () {
        try {
            const indent = parseInt(jsonIndent.value);
            const parsed = JSON.parse(jsonInput.value);
            jsonInput.value = JSON.stringify(parsed, null, indent);
            clearError();
            showJsonValid(true);
            updateStats();
            saveToStorage();
        } catch (e) {
            showError('Cannot prettify: ' + e.message);
            showJsonValid(false);
        }
    });

    // Minify JSON
    document.getElementById('minifyJsonBtn').addEventListener('click', function () {
        try {
            const parsed = JSON.parse(jsonInput.value);
            jsonInput.value = JSON.stringify(parsed);
            clearError();
            showJsonValid(true);
            updateStats();
            saveToStorage();
        } catch (e) {
            showError('Cannot minify: ' + e.message);
            showJsonValid(false);
        }
    });

    // Clear JSON
    document.getElementById('clearJsonBtn').addEventListener('click', function () {
        jsonInput.value = '';
        jsonValid.innerHTML = '';
        jsonStats.textContent = '';
        clearError();
        saveToStorage();
    });

    // Clear YAML
    document.getElementById('clearYamlBtn').addEventListener('click', function () {
        yamlInput.value = '';
        yamlValid.innerHTML = '';
        yamlStats.textContent = '';
        clearError();
        saveToStorage();
    });

    // Clear All
    document.getElementById('clearAllBtn').addEventListener('click', function () {
        jsonInput.value = '';
        yamlInput.value = '';
        jsonValid.innerHTML = '';
        yamlValid.innerHTML = '';
        jsonStats.textContent = '';
        yamlStats.textContent = '';
        clearError();
        saveToStorage();
    });

    // Copy JSON
    document.getElementById('copyJsonBtn').addEventListener('click', function () {
        if (!jsonInput.value) return;
        copyText(jsonInput.value, this);
    });

    // Copy YAML
    document.getElementById('copyYamlBtn').addEventListener('click', function () {
        if (!yamlInput.value) return;
        copyText(yamlInput.value, this);
    });

    // Paste JSON
    document.getElementById('pasteJsonBtn').addEventListener('click', function () {
        navigator.clipboard.readText().then(function (text) {
            jsonInput.value = text;
            lastEditedSide = 'json';
            if (autoConvert.checked) jsonToYaml();
            else updateStats();
        });
    });

    // Paste YAML
    document.getElementById('pasteYamlBtn').addEventListener('click', function () {
        navigator.clipboard.readText().then(function (text) {
            yamlInput.value = text;
            lastEditedSide = 'yaml';
            if (autoConvert.checked) yamlToJson();
            else updateStats();
        });
    });

    // Import JSON file
    document.getElementById('jsonFileInput').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            jsonInput.value = e.target.result;
            lastEditedSide = 'json';
            if (autoConvert.checked) jsonToYaml();
            else updateStats();
        };
        reader.readAsText(file);
        this.value = '';
    });

    // Import YAML file
    document.getElementById('yamlFileInput').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            yamlInput.value = e.target.result;
            lastEditedSide = 'yaml';
            if (autoConvert.checked) yamlToJson();
            else updateStats();
        };
        reader.readAsText(file);
        this.value = '';
    });

    // YAML indent change → re-convert if auto
    yamlIndent.addEventListener('change', function () {
        if (autoConvert.checked && jsonInput.value.trim()) {
            jsonToYaml();
        }
    });

    // JSON indent change → re-prettify if auto
    jsonIndent.addEventListener('change', function () {
        if (autoConvert.checked && yamlInput.value.trim() && lastEditedSide === 'yaml') {
            yamlToJson();
        } else if (jsonInput.value.trim()) {
            // Re-prettify existing JSON
            try {
                const indent = parseInt(jsonIndent.value);
                const parsed = JSON.parse(jsonInput.value);
                jsonInput.value = JSON.stringify(parsed, null, indent);
                updateStats();
                saveToStorage();
            } catch (e) { /* ignore if invalid */ }
        }
    });

    // ── Keyboard Shortcuts ──

    document.addEventListener('keydown', function (e) {
        // Ctrl+Enter → convert based on last edited side
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (lastEditedSide === 'json') jsonToYaml();
            else yamlToJson();
        }
    });

    // Tab key inserts spaces in textareas
    [jsonInput, yamlInput].forEach(function (textarea) {
        textarea.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                const spaces = '  ';
                this.value = this.value.substring(0, start) + spaces + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + spaces.length;
            }
        });
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

    // ── localStorage Persistence ──

    function saveToStorage() {
        try {
            localStorage.setItem(JSON_STORAGE_KEY, jsonInput.value);
            localStorage.setItem(YAML_STORAGE_KEY, yamlInput.value);
        } catch (e) { /* ignore */ }
    }

    function loadFromStorage() {
        try {
            const jsonVal = localStorage.getItem(JSON_STORAGE_KEY);
            const yamlVal = localStorage.getItem(YAML_STORAGE_KEY);
            if (jsonVal) jsonInput.value = jsonVal;
            if (yamlVal) yamlInput.value = yamlVal;
            updateStats();
            // Validate loaded content
            if (jsonInput.value.trim()) {
                try { JSON.parse(jsonInput.value); showJsonValid(true); } catch (e) { showJsonValid(false); }
            }
            if (yamlInput.value.trim()) {
                try { jsyaml.load(yamlInput.value); showYamlValid(true); } catch (e) { showYamlValid(false); }
            }
        } catch (e) { /* ignore */ }
    }

    // ── Init ──
    loadFromStorage();
});
