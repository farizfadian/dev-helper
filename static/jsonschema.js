// ── JSON Schema Validator ──
(function () {
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const theme = isDark ? 'vs-dark' : 'vs';

    // ── Monaco Editors ──
    const jsonEditor = monaco.editor.create(document.getElementById('jsonEditor'), {
        language: 'json',
        theme: theme,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        placeholder: '// Paste or type JSON data here...',
    });

    const schemaEditor = monaco.editor.create(document.getElementById('schemaEditor'), {
        language: 'json',
        theme: theme,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        placeholder: '// Paste or type JSON Schema here...',
    });

    // Theme sync
    document.addEventListener('devhelper-theme', function (e) {
        const t = e.detail === 'dark' ? 'vs-dark' : 'vs';
        monaco.editor.setTheme(t);
    });

    const resultsBody = document.getElementById('resultsBody');
    const resultsBadge = document.getElementById('resultsBadge');
    let decorations = [];

    // ── Validate ──
    function validate() {
        const jsonText = jsonEditor.getValue().trim();
        const schemaText = schemaEditor.getValue().trim();

        if (!jsonText) {
            showMessage('warning', 'Enter JSON data to validate.');
            return;
        }
        if (!schemaText) {
            showMessage('warning', 'Enter a JSON Schema to validate against.');
            return;
        }

        let data, schema;
        try {
            data = JSON.parse(jsonText);
        } catch (e) {
            showMessage('danger', 'Invalid JSON data: ' + e.message);
            highlightJsonError(e);
            return;
        }
        try {
            schema = JSON.parse(schemaText);
        } catch (e) {
            showMessage('danger', 'Invalid JSON Schema: ' + e.message);
            return;
        }

        try {
            // Use Ajv2020 if available (supports draft 2020-12), fallback to Ajv
            const AjvClass = window.ajv2020 || window.Ajv2020 || window.Ajv;
            const ajv = new AjvClass({
                allErrors: true,
                verbose: true,
                strict: false,
            });

            // Add formats if available
            if (window.ajvFormats) {
                window.ajvFormats(ajv);
            }

            const valid = ajv.validate(schema, data);

            if (valid) {
                showValid();
                clearDecorations();
            } else {
                showErrors(ajv.errors);
            }
        } catch (e) {
            showMessage('danger', 'Schema compilation error: ' + e.message);
        }
    }

    function showValid() {
        resultsBadge.innerHTML = '<span class="badge bg-success">Valid</span>';
        resultsBody.innerHTML = '<div class="text-center py-3 valid-badge text-success"><i class="bi bi-check-circle-fill" style="font-size:1.5rem;"></i><p class="mt-1 mb-0 fw-semibold">JSON is valid against the schema</p></div>';
    }

    function showErrors(errors) {
        resultsBadge.innerHTML = `<span class="badge bg-danger">${errors.length} error${errors.length > 1 ? 's' : ''}</span>`;
        const decos = [];

        resultsBody.innerHTML = errors.map((err, i) => {
            const path = err.instancePath || '/';
            const keyword = err.keyword || '';
            const msg = err.message || 'unknown error';
            const params = err.params ? ` (${formatParams(err.params)})` : '';

            // Try to find the line in JSON editor for the error path
            const line = findLineForPath(err.instancePath);
            if (line > 0) {
                decos.push({
                    range: new monaco.Range(line, 1, line, 1),
                    options: {
                        isWholeLine: true,
                        className: 'errorLineDecoration',
                        glyphMarginClassName: 'errorGlyphMargin',
                        overviewRuler: { color: '#e53935', position: monaco.editor.OverviewRulerLane.Full },
                    }
                });
            }

            return `<div class="error-item" data-line="${line}" onclick="window._goToLine(${line})">
                <span class="error-path">${escapeHtml(path)}</span>
                <span class="error-keyword">${escapeHtml(keyword)}</span>
                <br><span class="error-msg">${escapeHtml(msg)}${escapeHtml(params)}</span>
            </div>`;
        }).join('');

        // Apply decorations
        decorations = jsonEditor.deltaDecorations(decorations, decos);

        // Inject decoration styles
        injectErrorStyles();
    }

    function showMessage(type, msg) {
        resultsBadge.innerHTML = '';
        resultsBody.innerHTML = `<div class="p-3 text-${type}" style="font-size:0.85rem;"><i class="bi bi-exclamation-triangle"></i> ${escapeHtml(msg)}</div>`;
    }

    function formatParams(params) {
        const parts = [];
        for (const [k, v] of Object.entries(params)) {
            if (k === 'type') parts.push('expected: ' + v);
            else if (k === 'limit') parts.push('limit: ' + v);
            else if (k === 'allowedValues') parts.push('allowed: ' + JSON.stringify(v));
            else if (k === 'additionalProperty') parts.push('property: ' + v);
            else if (k === 'missingProperty') parts.push('missing: ' + v);
            else if (k === 'pattern') parts.push('pattern: ' + v);
            else if (k === 'format') parts.push('format: ' + v);
            else parts.push(k + ': ' + JSON.stringify(v));
        }
        return parts.join(', ');
    }

    // Find approximate line in JSON for a given JSONPath
    function findLineForPath(instancePath) {
        if (!instancePath) return 0;
        const parts = instancePath.split('/').filter(Boolean);
        const lines = jsonEditor.getValue().split('\n');
        let depth = 0;
        let partIdx = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (partIdx >= parts.length) return i; // found

            const part = parts[partIdx];
            // Look for key match
            const keyPattern = new RegExp('"' + escapeRegex(part) + '"\\s*:');
            if (keyPattern.test(line)) {
                partIdx++;
                if (partIdx >= parts.length) return i + 1; // 1-based
            }
            // Array index — harder, just advance
            if (/^\d+$/.test(part)) {
                // Count array elements at current depth
                partIdx++;
            }
        }
        return 0;
    }

    function highlightJsonError(parseError) {
        // Try to extract line/column from parse error
        const match = parseError.message.match(/position (\d+)/);
        if (match) {
            const pos = parseInt(match[1]);
            const text = jsonEditor.getValue();
            let line = 1;
            for (let i = 0; i < pos && i < text.length; i++) {
                if (text[i] === '\n') line++;
            }
            decorations = jsonEditor.deltaDecorations(decorations, [{
                range: new monaco.Range(line, 1, line, 1),
                options: { isWholeLine: true, className: 'errorLineDecoration' }
            }]);
            injectErrorStyles();
            jsonEditor.revealLineInCenter(line);
        }
    }

    function clearDecorations() {
        decorations = jsonEditor.deltaDecorations(decorations, []);
    }

    let stylesInjected = false;
    function injectErrorStyles() {
        if (stylesInjected) return;
        const style = document.createElement('style');
        style.textContent = `
            .errorLineDecoration { background: rgba(229, 57, 53, 0.15) !important; }
            .errorGlyphMargin { background: #e53935; border-radius: 50%; margin: 2px; }
        `;
        document.head.appendChild(style);
        stylesInjected = true;
    }

    window._goToLine = function (line) {
        if (line > 0) {
            jsonEditor.revealLineInCenter(line);
            jsonEditor.setPosition({ lineNumber: line, column: 1 });
            jsonEditor.focus();
        }
    };

    // ── Generate Schema from JSON ──
    function generateSchema() {
        const jsonText = jsonEditor.getValue().trim();
        if (!jsonText) {
            showMessage('warning', 'Enter JSON data first to generate a schema.');
            return;
        }
        let data;
        try {
            data = JSON.parse(jsonText);
        } catch (e) {
            showMessage('danger', 'Invalid JSON: ' + e.message);
            return;
        }

        const schema = inferSchema(data);
        schema['$schema'] = 'https://json-schema.org/draft/2020-12/schema';
        schemaEditor.setValue(JSON.stringify(schema, null, 2));
        showMessage('info', 'Schema generated from JSON data. Review and refine as needed.');
    }

    function inferSchema(value) {
        if (value === null) return { type: 'null' };
        if (Array.isArray(value)) {
            const schema = { type: 'array' };
            if (value.length > 0) {
                // Infer items schema from first element (simplified)
                const itemSchemas = value.map(v => inferSchema(v));
                // If all same type, use that; otherwise anyOf
                const types = new Set(itemSchemas.map(s => JSON.stringify(s)));
                if (types.size === 1) {
                    schema.items = itemSchemas[0];
                } else {
                    // Merge object schemas if all objects
                    if (itemSchemas.every(s => s.type === 'object')) {
                        schema.items = mergeObjectSchemas(itemSchemas);
                    } else {
                        schema.items = { anyOf: [...types].map(t => JSON.parse(t)) };
                    }
                }
            }
            return schema;
        }
        if (typeof value === 'object') {
            const schema = { type: 'object', properties: {}, required: [] };
            for (const [k, v] of Object.entries(value)) {
                schema.properties[k] = inferSchema(v);
                schema.required.push(k);
            }
            if (schema.required.length === 0) delete schema.required;
            return schema;
        }
        if (typeof value === 'string') {
            const s = { type: 'string' };
            // Detect common formats
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) s.format = 'date-time';
            else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) s.format = 'date';
            else if (/^[^@]+@[^@]+\.[^@]+$/.test(value)) s.format = 'email';
            else if (/^https?:\/\//.test(value)) s.format = 'uri';
            else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) s.format = 'uuid';
            return s;
        }
        if (typeof value === 'number') {
            return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
        }
        if (typeof value === 'boolean') return { type: 'boolean' };
        return {};
    }

    function mergeObjectSchemas(schemas) {
        const merged = { type: 'object', properties: {} };
        const allKeys = new Set();
        const keyCounts = {};
        schemas.forEach(s => {
            if (s.properties) {
                for (const k of Object.keys(s.properties)) {
                    allKeys.add(k);
                    keyCounts[k] = (keyCounts[k] || 0) + 1;
                    if (!merged.properties[k]) merged.properties[k] = s.properties[k];
                }
            }
        });
        // Required = keys present in ALL items
        const required = [...allKeys].filter(k => keyCounts[k] === schemas.length);
        if (required.length > 0) merged.required = required;
        return merged;
    }

    // ── Samples ──
    const samples = {
        user: {
            json: {
                id: 1,
                name: "John Doe",
                email: "john@example.com",
                age: 30,
                active: true,
                roles: ["admin", "user"],
                address: {
                    street: "123 Main St",
                    city: "Springfield",
                    zip: "62701"
                }
            },
            schema: {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                type: "object",
                properties: {
                    id: { type: "integer", minimum: 1 },
                    name: { type: "string", minLength: 1 },
                    email: { type: "string", format: "email" },
                    age: { type: "integer", minimum: 0, maximum: 150 },
                    active: { type: "boolean" },
                    roles: { type: "array", items: { type: "string", enum: ["admin", "user", "editor"] }, minItems: 1 },
                    address: {
                        type: "object",
                        properties: {
                            street: { type: "string" },
                            city: { type: "string" },
                            zip: { type: "string", pattern: "^\\d{5}$" }
                        },
                        required: ["street", "city"]
                    }
                },
                required: ["id", "name", "email"]
            }
        },
        product: {
            json: {
                sku: "WIDGET-001",
                name: "Super Widget",
                price: 29.99,
                currency: "USD",
                inStock: true,
                tags: ["electronics", "gadgets"],
                dimensions: { width: 10.5, height: 5.2, depth: 3.0, unit: "cm" }
            },
            schema: {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                type: "object",
                properties: {
                    sku: { type: "string", pattern: "^[A-Z]+-\\d{3}$" },
                    name: { type: "string", minLength: 1, maxLength: 200 },
                    price: { type: "number", exclusiveMinimum: 0 },
                    currency: { type: "string", enum: ["USD", "EUR", "GBP", "JPY"] },
                    inStock: { type: "boolean" },
                    tags: { type: "array", items: { type: "string" }, uniqueItems: true },
                    dimensions: {
                        type: "object",
                        properties: {
                            width: { type: "number", minimum: 0 },
                            height: { type: "number", minimum: 0 },
                            depth: { type: "number", minimum: 0 },
                            unit: { type: "string", enum: ["cm", "in", "mm"] }
                        },
                        required: ["width", "height", "unit"]
                    }
                },
                required: ["sku", "name", "price"]
            }
        },
        address: {
            json: {
                shipping: { street: "456 Oak Ave", city: "Portland", state: "OR", zip: "97201" },
                billing: { street: "789 Pine Rd", city: "Seattle", state: "WA", zip: "98101" }
            },
            schema: {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                type: "object",
                properties: {
                    shipping: { "$ref": "#/$defs/address" },
                    billing: { "$ref": "#/$defs/address" }
                },
                required: ["shipping"],
                "$defs": {
                    address: {
                        type: "object",
                        properties: {
                            street: { type: "string" },
                            city: { type: "string" },
                            state: { type: "string", pattern: "^[A-Z]{2}$" },
                            zip: { type: "string", pattern: "^\\d{5}$" }
                        },
                        required: ["street", "city", "state", "zip"]
                    }
                }
            }
        },
        api: {
            json: {
                status: 200,
                message: "OK",
                data: [
                    { id: 1, title: "First Post", createdAt: "2025-01-15T10:30:00Z" },
                    { id: 2, title: "Second Post", createdAt: "2025-02-20T14:00:00Z" }
                ],
                pagination: { page: 1, perPage: 20, total: 42 }
            },
            schema: {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                type: "object",
                properties: {
                    status: { type: "integer", enum: [200, 201, 400, 401, 403, 404, 500] },
                    message: { type: "string" },
                    data: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "integer" },
                                title: { type: "string", minLength: 1 },
                                createdAt: { type: "string", format: "date-time" }
                            },
                            required: ["id", "title"]
                        }
                    },
                    pagination: {
                        type: "object",
                        properties: {
                            page: { type: "integer", minimum: 1 },
                            perPage: { type: "integer", minimum: 1, maximum: 100 },
                            total: { type: "integer", minimum: 0 }
                        },
                        required: ["page", "total"]
                    }
                },
                required: ["status", "data"]
            }
        },
        config: {
            json: {
                appName: "MyApp",
                version: "2.1.0",
                port: 8080,
                debug: false,
                database: { host: "localhost", port: 5432, name: "mydb", ssl: true },
                cors: { origins: ["https://example.com"], methods: ["GET", "POST"] },
                logLevel: "info"
            },
            schema: {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                type: "object",
                properties: {
                    appName: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]*$" },
                    version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
                    port: { type: "integer", minimum: 1, maximum: 65535 },
                    debug: { type: "boolean" },
                    database: {
                        type: "object",
                        properties: {
                            host: { type: "string" },
                            port: { type: "integer", minimum: 1, maximum: 65535 },
                            name: { type: "string" },
                            ssl: { type: "boolean", default: false }
                        },
                        required: ["host", "port", "name"]
                    },
                    cors: {
                        type: "object",
                        properties: {
                            origins: { type: "array", items: { type: "string", format: "uri" } },
                            methods: { type: "array", items: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] } }
                        }
                    },
                    logLevel: { type: "string", enum: ["debug", "info", "warn", "error"] }
                },
                required: ["appName", "version", "port"]
            }
        }
    };

    // ── Event Bindings ──
    document.getElementById('validateBtn').addEventListener('click', validate);
    document.getElementById('generateBtn').addEventListener('click', generateSchema);
    document.getElementById('clearBtn').addEventListener('click', function () {
        jsonEditor.setValue('');
        schemaEditor.setValue('');
        clearDecorations();
        resultsBody.innerHTML = '<div class="text-center py-4 text-muted" style="font-size:0.85rem;"><i class="bi bi-arrow-up-circle" style="font-size:1.2rem;"></i><p class="mt-1 mb-0">Enter JSON and Schema, then click <strong>Validate</strong> or press <kbd>Ctrl+Enter</kbd></p></div>';
        resultsBadge.innerHTML = '';
    });

    // Samples
    document.getElementById('samplesMenu').addEventListener('click', function (e) {
        const item = e.target.closest('[data-sample]');
        if (!item) return;
        e.preventDefault();
        const sample = samples[item.dataset.sample];
        if (sample) {
            jsonEditor.setValue(JSON.stringify(sample.json, null, 2));
            schemaEditor.setValue(JSON.stringify(sample.schema, null, 2));
            clearDecorations();
            validate();
        }
    });

    // Paste buttons
    document.getElementById('pasteJsonBtn').addEventListener('click', async function () {
        try { const t = await navigator.clipboard.readText(); if (t) jsonEditor.setValue(t); } catch {}
    });
    document.getElementById('pasteSchemaBtn').addEventListener('click', async function () {
        try { const t = await navigator.clipboard.readText(); if (t) schemaEditor.setValue(t); } catch {}
    });

    // Prettify buttons
    document.getElementById('prettifyJsonBtn').addEventListener('click', function () {
        try {
            const parsed = JSON.parse(jsonEditor.getValue());
            jsonEditor.setValue(JSON.stringify(parsed, null, 2));
        } catch {}
    });
    document.getElementById('prettifySchemaBtn').addEventListener('click', function () {
        try {
            const parsed = JSON.parse(schemaEditor.getValue());
            schemaEditor.setValue(JSON.stringify(parsed, null, 2));
        } catch {}
    });

    // Copy schema
    document.getElementById('copySchemaBtn').addEventListener('click', function () {
        navigator.clipboard.writeText(schemaEditor.getValue()).then(() => {
            const btn = this;
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
        });
    });

    // File load
    document.getElementById('loadJsonFile').addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = e => jsonEditor.setValue(e.target.result);
        reader.readAsText(f); this.value = '';
    });
    document.getElementById('loadSchemaFile').addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = e => schemaEditor.setValue(e.target.result);
        reader.readAsText(f); this.value = '';
    });

    // Ctrl+Enter to validate
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            validate();
        }
    });

    // ── Helpers ──
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
})();
