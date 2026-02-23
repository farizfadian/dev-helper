// YAML ↔ Properties Converter
// Uses js-yaml CDN for YAML parsing/dumping
document.addEventListener('DOMContentLoaded', function() {
    var yamlInput = document.getElementById('yamlInput');
    var propsInput = document.getElementById('propsInput');
    var yamlError = document.getElementById('yamlError');
    var propsError = document.getElementById('propsError');
    var btnYaml2Props = document.getElementById('btnYaml2Props');
    var btnProps2Yaml = document.getElementById('btnProps2Yaml');
    var btnSwap = document.getElementById('btnSwap');
    var btnSample = document.getElementById('btnSample');
    var btnClearAll = document.getElementById('btnClearAll');
    var btnCopyYaml = document.getElementById('btnCopyYaml');
    var btnCopyProps = document.getElementById('btnCopyProps');
    var btnDownloadYaml = document.getElementById('btnDownloadYaml');
    var btnDownloadProps = document.getElementById('btnDownloadProps');
    var btnImportYaml = document.getElementById('btnImportYaml');
    var btnImportProps = document.getElementById('btnImportProps');
    var yamlFileInput = document.getElementById('yamlFileInput');
    var propsFileInput = document.getElementById('propsFileInput');

    var SAMPLE_YAML = 'server:\n  port: 8080\n  servlet:\n    context-path: /api\n  compression:\n    enabled: true\n    min-response-size: 1024\n\nspring:\n  application:\n    name: my-service\n  datasource:\n    url: jdbc:mysql://localhost:3306/mydb\n    username: root\n    password: secret\n    driver-class-name: com.mysql.cj.jdbc.Driver\n    hikari:\n      maximum-pool-size: 10\n      minimum-idle: 5\n      idle-timeout: 30000\n  jpa:\n    hibernate:\n      ddl-auto: update\n    show-sql: true\n    properties:\n      hibernate:\n        format_sql: true\n        dialect: org.hibernate.dialect.MySQL8Dialect\n  redis:\n    host: localhost\n    port: 6379\n    timeout: 5000\n\nlogging:\n  level:\n    root: INFO\n    com.example: DEBUG\n    org.springframework.web: WARN\n  file:\n    name: logs/app.log\n\napp:\n  jwt:\n    secret: mySecretKey123\n    expiration: 86400000\n  cors:\n    allowed-origins:\n      - http://localhost:3000\n      - http://localhost:4200\n  features:\n    enable-cache: true\n    enable-swagger: true';

    // ── YAML → Properties ──
    btnYaml2Props.addEventListener('click', function() {
        yamlError.classList.add('d-none');
        propsError.classList.add('d-none');
        var yaml = yamlInput.value.trim();
        if (!yaml) return;

        try {
            var obj = jsyaml.load(yaml);
            if (obj === null || obj === undefined) {
                propsInput.value = '';
                return;
            }
            if (typeof obj !== 'object') {
                propsInput.value = String(obj);
                return;
            }
            var lines = [];
            flatten(obj, '', lines);
            propsInput.value = lines.join('\n');
        } catch(e) {
            yamlError.textContent = 'YAML Error: ' + e.message;
            yamlError.classList.remove('d-none');
        }
    });

    // Flatten nested object to dot-separated properties
    function flatten(obj, prefix, lines) {
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var fullKey = prefix ? prefix + '.' + key : key;
            var val = obj[key];

            if (val === null || val === undefined) {
                lines.push(fullKey + '=');
            } else if (Array.isArray(val)) {
                // Spring Boot list syntax: key[0]=val, key[1]=val...
                for (var j = 0; j < val.length; j++) {
                    if (typeof val[j] === 'object' && val[j] !== null) {
                        flatten(val[j], fullKey + '[' + j + ']', lines);
                    } else {
                        lines.push(fullKey + '[' + j + ']=' + formatValue(val[j]));
                    }
                }
            } else if (typeof val === 'object') {
                flatten(val, fullKey, lines);
            } else {
                lines.push(fullKey + '=' + formatValue(val));
            }
        }
    }

    function formatValue(val) {
        if (val === null || val === undefined) return '';
        if (val === true) return 'true';
        if (val === false) return 'false';
        return String(val);
    }

    // ── Properties → YAML ──
    btnProps2Yaml.addEventListener('click', function() {
        yamlError.classList.add('d-none');
        propsError.classList.add('d-none');
        var props = propsInput.value.trim();
        if (!props) return;

        try {
            var obj = parseProperties(props);
            yamlInput.value = jsyaml.dump(obj, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                sortKeys: false,
                quotingType: '"',
                forceQuotes: false
            });
        } catch(e) {
            propsError.textContent = 'Properties Error: ' + e.message;
            propsError.classList.remove('d-none');
        }
    });

    // Parse properties text to nested object
    function parseProperties(text) {
        var obj = {};
        var lines = text.split('\n');

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            // Skip empty lines and comments
            if (!line || line.charAt(0) === '#' || line.charAt(0) === '!') continue;

            // Handle line continuations (trailing backslash)
            while (line.charAt(line.length - 1) === '\\' && i + 1 < lines.length) {
                line = line.slice(0, -1) + lines[++i].trim();
            }

            // Split on first = or :
            var sepIdx = -1;
            for (var j = 0; j < line.length; j++) {
                var c = line.charAt(j);
                if (c === '\\') { j++; continue; } // skip escaped chars
                if (c === '=' || c === ':') { sepIdx = j; break; }
            }

            if (sepIdx === -1) continue;

            var key = line.substring(0, sepIdx).trim();
            var val = line.substring(sepIdx + 1).trim();

            // Set nested value
            setNestedValue(obj, key, smartParseValue(val));
        }

        return obj;
    }

    // Set value in nested object using dot/bracket notation
    // e.g., "spring.datasource.url" → { spring: { datasource: { url: ... } } }
    // e.g., "app.cors.allowed-origins[0]" → { app: { cors: { allowed-origins: [...] } } }
    function setNestedValue(obj, keyPath, value) {
        var parts = [];
        // Split by dots but not inside brackets
        var current = '';
        for (var i = 0; i < keyPath.length; i++) {
            var c = keyPath.charAt(i);
            if (c === '.' && !isInsideBracket(keyPath, i)) {
                if (current) parts.push(current);
                current = '';
            } else {
                current += c;
            }
        }
        if (current) parts.push(current);

        var target = obj;
        for (var p = 0; p < parts.length; p++) {
            var part = parts[p];
            var bracketMatch = part.match(/^(.+?)\[(\d+)\]$/);
            var isLast = p === parts.length - 1;

            if (bracketMatch) {
                var arrKey = bracketMatch[1];
                var arrIdx = parseInt(bracketMatch[2]);

                if (!target[arrKey]) target[arrKey] = [];
                if (!Array.isArray(target[arrKey])) target[arrKey] = [target[arrKey]];

                if (isLast) {
                    target[arrKey][arrIdx] = value;
                } else {
                    if (!target[arrKey][arrIdx] || typeof target[arrKey][arrIdx] !== 'object') {
                        target[arrKey][arrIdx] = {};
                    }
                    target = target[arrKey][arrIdx];
                }
            } else {
                if (isLast) {
                    target[part] = value;
                } else {
                    if (!target[part] || typeof target[part] !== 'object' || Array.isArray(target[part])) {
                        target[part] = {};
                    }
                    target = target[part];
                }
            }
        }
    }

    function isInsideBracket(str, dotIdx) {
        var openCount = 0;
        for (var i = 0; i < dotIdx; i++) {
            if (str.charAt(i) === '[') openCount++;
            if (str.charAt(i) === ']') openCount--;
        }
        return openCount > 0;
    }

    // Smart parse: booleans, numbers, or string
    function smartParseValue(val) {
        if (val === '') return '';
        if (val === 'true') return true;
        if (val === 'false') return false;
        if (val === 'null') return null;
        // Check if it's a number (but not something like port 08080 or version strings)
        if (/^-?\d+$/.test(val)) {
            var n = parseInt(val, 10);
            if (n >= Number.MIN_SAFE_INTEGER && n <= Number.MAX_SAFE_INTEGER) return n;
        }
        if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
        return val;
    }

    // ── Actions ──
    btnSwap.addEventListener('click', function() {
        var tmp = yamlInput.value;
        yamlInput.value = propsInput.value;
        propsInput.value = tmp;
        yamlError.classList.add('d-none');
        propsError.classList.add('d-none');
    });

    btnSample.addEventListener('click', function() {
        yamlInput.value = SAMPLE_YAML;
        propsInput.value = '';
        yamlError.classList.add('d-none');
        propsError.classList.add('d-none');
        // Auto convert
        btnYaml2Props.click();
    });

    btnClearAll.addEventListener('click', function() {
        yamlInput.value = '';
        propsInput.value = '';
        yamlError.classList.add('d-none');
        propsError.classList.add('d-none');
    });

    // Copy
    btnCopyYaml.addEventListener('click', function() { copyText(yamlInput.value, btnCopyYaml); });
    btnCopyProps.addEventListener('click', function() { copyText(propsInput.value, btnCopyProps); });

    function copyText(text, btn) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(function() {
            var orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check2"></i>';
            setTimeout(function() { btn.innerHTML = orig; }, 1500);
        });
    }

    // Download
    btnDownloadYaml.addEventListener('click', function() {
        downloadFile(yamlInput.value, 'application.yml', 'text/yaml');
    });
    btnDownloadProps.addEventListener('click', function() {
        downloadFile(propsInput.value, 'application.properties', 'text/plain');
    });

    function downloadFile(text, filename, type) {
        if (!text) return;
        var blob = new Blob([text], { type: type });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // Import
    btnImportYaml.addEventListener('click', function() { yamlFileInput.click(); });
    btnImportProps.addEventListener('click', function() { propsFileInput.click(); });

    yamlFileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            readFileText(this.files[0], function(text) { yamlInput.value = text; });
            this.value = '';
        }
    });
    propsFileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            readFileText(this.files[0], function(text) { propsInput.value = text; });
            this.value = '';
        }
    });

    function readFileText(file, callback) {
        var reader = new FileReader();
        reader.onload = function(e) { callback(e.target.result); };
        reader.readAsText(file);
    }

    // ── Pin star ──
    document.querySelectorAll('.pin-star').forEach(function(btn) {
        var toolId = btn.dataset.tool;
        var pinned = JSON.parse(localStorage.getItem('devhelper_pinned_tools') || '[]');
        var icon = btn.querySelector('i');
        if (pinned.indexOf(toolId) !== -1) {
            icon.className = 'bi bi-star-fill text-warning';
        }
        btn.addEventListener('click', function() {
            var pinned = JSON.parse(localStorage.getItem('devhelper_pinned_tools') || '[]');
            var idx = pinned.indexOf(toolId);
            if (idx !== -1) {
                pinned.splice(idx, 1);
                icon.className = 'bi bi-star';
            } else {
                pinned.push(toolId);
                icon.className = 'bi bi-star-fill text-warning';
            }
            localStorage.setItem('devhelper_pinned_tools', JSON.stringify(pinned));
        });
    });

    // Keyboard shortcut: Ctrl+Enter to convert
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            if (document.activeElement === yamlInput) {
                btnYaml2Props.click();
            } else if (document.activeElement === propsInput) {
                btnProps2Yaml.click();
            }
        }
    });
});
