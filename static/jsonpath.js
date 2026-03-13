// ── JSONPath Playground ──
(function () {
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const theme = isDark ? 'vs-dark' : 'vs';

    const jsonEditor = monaco.editor.create(document.getElementById('jsonEditor'), {
        language: 'json', theme, minimap: { enabled: false }, fontSize: 13,
        lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true,
        tabSize: 2, wordWrap: 'on',
    });

    const resultEditor = monaco.editor.create(document.getElementById('resultEditor'), {
        language: 'json', theme, minimap: { enabled: false }, fontSize: 13,
        lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true,
        tabSize: 2, wordWrap: 'on', readOnly: true,
    });

    document.addEventListener('devhelper-theme', function (e) {
        monaco.editor.setTheme(e.detail === 'dark' ? 'vs-dark' : 'vs');
    });

    const pathInput = document.getElementById('pathInput');
    const matchCount = document.getElementById('matchCount');

    // ── JSONPath Engine (pure JS, no CDN) ──
    function queryJSONPath(obj, path) {
        if (!path || path === '$') return [obj];

        const tokens = tokenize(path);
        let current = [{ val: obj, path: '$' }];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const next = [];

            for (const item of current) {
                if (token.type === 'child') {
                    if (item.val != null && typeof item.val === 'object') {
                        if (token.key in item.val) {
                            next.push({ val: item.val[token.key], path: item.path + '.' + token.key });
                        }
                    }
                } else if (token.type === 'index') {
                    if (Array.isArray(item.val)) {
                        const idx = token.index < 0 ? item.val.length + token.index : token.index;
                        if (idx >= 0 && idx < item.val.length) {
                            next.push({ val: item.val[idx], path: item.path + '[' + idx + ']' });
                        }
                    }
                } else if (token.type === 'wildcard') {
                    if (Array.isArray(item.val)) {
                        item.val.forEach((v, idx) => next.push({ val: v, path: item.path + '[' + idx + ']' }));
                    } else if (item.val != null && typeof item.val === 'object') {
                        Object.entries(item.val).forEach(([k, v]) => next.push({ val: v, path: item.path + '.' + k }));
                    }
                } else if (token.type === 'recursive') {
                    const key = token.key;
                    // Collect all descendants
                    const collect = (val, p) => {
                        if (val == null || typeof val !== 'object') return;
                        if (Array.isArray(val)) {
                            val.forEach((v, idx) => {
                                if (key === '*') next.push({ val: v, path: p + '[' + idx + ']' });
                                collect(v, p + '[' + idx + ']');
                            });
                        } else {
                            for (const [k, v] of Object.entries(val)) {
                                if (key === '*' || k === key) {
                                    next.push({ val: v, path: p + '.' + k });
                                }
                                collect(v, p + '.' + k);
                            }
                        }
                    };
                    collect(item.val, item.path);
                } else if (token.type === 'slice') {
                    if (Array.isArray(item.val)) {
                        const len = item.val.length;
                        let start = token.start ?? 0;
                        let end = token.end ?? len;
                        let step = token.step ?? 1;
                        if (start < 0) start = len + start;
                        if (end < 0) end = len + end;
                        start = Math.max(0, start);
                        end = Math.min(len, end);
                        for (let idx = start; idx < end; idx += step) {
                            next.push({ val: item.val[idx], path: item.path + '[' + idx + ']' });
                        }
                    }
                } else if (token.type === 'filter') {
                    if (Array.isArray(item.val)) {
                        item.val.forEach((v, idx) => {
                            if (evalFilter(v, token.expr)) {
                                next.push({ val: v, path: item.path + '[' + idx + ']' });
                            }
                        });
                    }
                } else if (token.type === 'prop') {
                    // .length special
                    if (token.key === 'length' && Array.isArray(item.val)) {
                        next.push({ val: item.val.length, path: item.path + '.length' });
                    } else if (item.val != null && typeof item.val === 'object' && token.key in item.val) {
                        next.push({ val: item.val[token.key], path: item.path + '.' + token.key });
                    }
                }
            }
            current = next;
        }

        return current.map(c => c.val);
    }

    function tokenize(path) {
        const tokens = [];
        let i = 0;
        if (path[0] === '$') i = 1;
        if (path[i] === '.') i++;

        while (i < path.length) {
            if (path[i] === '.' && path[i + 1] === '.') {
                // Recursive descent
                i += 2;
                let key = '';
                while (i < path.length && path[i] !== '.' && path[i] !== '[') {
                    key += path[i++];
                }
                tokens.push({ type: 'recursive', key: key || '*' });
            } else if (path[i] === '.') {
                i++;
                let key = '';
                while (i < path.length && path[i] !== '.' && path[i] !== '[') {
                    key += path[i++];
                }
                if (key === '*') tokens.push({ type: 'wildcard' });
                else if (key) tokens.push({ type: 'child', key });
            } else if (path[i] === '[') {
                i++;
                // Check what's inside brackets
                let content = '';
                let depth = 1;
                while (i < path.length && depth > 0) {
                    if (path[i] === '[') depth++;
                    else if (path[i] === ']') { depth--; if (depth === 0) break; }
                    content += path[i++];
                }
                i++; // skip ]

                content = content.trim();
                if (content === '*') {
                    tokens.push({ type: 'wildcard' });
                } else if (content.startsWith('?')) {
                    // Filter expression
                    let expr = content.substring(1).trim();
                    if (expr.startsWith('(') && expr.endsWith(')')) {
                        expr = expr.slice(1, -1).trim();
                    }
                    tokens.push({ type: 'filter', expr });
                } else if (content.includes(':')) {
                    // Slice
                    const parts = content.split(':');
                    tokens.push({
                        type: 'slice',
                        start: parts[0] ? parseInt(parts[0]) : undefined,
                        end: parts[1] ? parseInt(parts[1]) : undefined,
                        step: parts[2] ? parseInt(parts[2]) : undefined,
                    });
                } else if (/^-?\d+$/.test(content)) {
                    tokens.push({ type: 'index', index: parseInt(content) });
                } else {
                    // Quoted key
                    const key = content.replace(/^['"]|['"]$/g, '');
                    tokens.push({ type: 'child', key });
                }
            } else {
                // Bare property
                let key = '';
                while (i < path.length && path[i] !== '.' && path[i] !== '[') {
                    key += path[i++];
                }
                if (key === '*') tokens.push({ type: 'wildcard' });
                else if (key) tokens.push({ type: 'child', key });
            }
        }
        return tokens;
    }

    function evalFilter(item, expr) {
        // Simple filter evaluator for patterns like:
        // @.price < 10, @.isbn, @.price >= 20, @.category == "fiction"
        try {
            // Replace @ with item reference
            const code = expr.replace(/@/g, '__item__');
            const fn = new Function('__item__', `try { return !!(${code}); } catch(e) { return false; }`);
            return fn(item);
        } catch {
            return false;
        }
    }

    // ── Query execution ──
    function runQuery() {
        const jsonText = jsonEditor.getValue().trim();
        const path = pathInput.value.trim();

        if (!jsonText) {
            resultEditor.setValue('// Enter JSON data first');
            matchCount.textContent = '';
            return;
        }

        let data;
        try {
            data = JSON.parse(jsonText);
        } catch (e) {
            resultEditor.setValue('// JSON parse error: ' + e.message);
            matchCount.textContent = '';
            return;
        }

        if (!path) {
            resultEditor.setValue('// Enter a JSONPath expression');
            matchCount.textContent = '';
            return;
        }

        try {
            const results = queryJSONPath(data, path);
            if (results.length === 0) {
                resultEditor.setValue('// No matches found');
                matchCount.textContent = '(0 matches)';
            } else if (results.length === 1) {
                resultEditor.setValue(JSON.stringify(results[0], null, 2));
                matchCount.textContent = '(1 match)';
            } else {
                resultEditor.setValue(JSON.stringify(results, null, 2));
                matchCount.textContent = `(${results.length} matches)`;
            }
        } catch (e) {
            resultEditor.setValue('// Query error: ' + e.message);
            matchCount.textContent = '';
        }
    }

    // ── Auto-query on input ──
    let queryTimer;
    pathInput.addEventListener('input', function () {
        clearTimeout(queryTimer);
        queryTimer = setTimeout(runQuery, 300);
    });

    jsonEditor.onDidChangeModelContent(function () {
        clearTimeout(queryTimer);
        queryTimer = setTimeout(runQuery, 500);
    });

    document.getElementById('queryBtn').addEventListener('click', runQuery);

    // ── Samples ──
    const samples = {
        store: {
            json: {
                store: {
                    book: [
                        { category: "reference", author: "Nigel Rees", title: "Sayings of the Century", price: 8.95 },
                        { category: "fiction", author: "Evelyn Waugh", title: "Sword of Honour", price: 12.99 },
                        { category: "fiction", author: "Herman Melville", title: "Moby Dick", isbn: "0-553-21311-3", price: 8.99 },
                        { category: "fiction", author: "J. R. R. Tolkien", title: "The Lord of the Rings", isbn: "0-395-19395-8", price: 22.99 }
                    ],
                    bicycle: { color: "red", price: 19.95 }
                }
            },
            path: '$.store.book[*].author'
        },
        users: {
            json: {
                users: [
                    { id: 1, name: "Alice", age: 30, role: "admin", active: true },
                    { id: 2, name: "Bob", age: 25, role: "user", active: true },
                    { id: 3, name: "Charlie", age: 35, role: "user", active: false },
                    { id: 4, name: "Diana", age: 28, role: "editor", active: true }
                ],
                total: 4,
                page: 1
            },
            path: '$.users[?(@.active == true)]'
        },
        config: {
            json: {
                app: {
                    name: "MyService",
                    version: "3.2.1",
                    modules: {
                        auth: { enabled: true, provider: "oauth2", timeout: 30 },
                        cache: { enabled: true, driver: "redis", ttl: 3600 },
                        logging: { enabled: false, level: "info", output: "stdout" }
                    }
                },
                database: { host: "db.example.com", port: 5432, name: "production" }
            },
            path: '$..enabled'
        }
    };

    document.getElementById('samplesMenu').addEventListener('click', function (e) {
        const item = e.target.closest('[data-sample]');
        if (!item) return;
        e.preventDefault();
        const sample = samples[item.dataset.sample];
        if (sample) {
            jsonEditor.setValue(JSON.stringify(sample.json, null, 2));
            pathInput.value = sample.path;
            runQuery();
        }
    });

    // ── Buttons ──
    document.getElementById('clearBtn').addEventListener('click', function () {
        jsonEditor.setValue('');
        resultEditor.setValue('');
        pathInput.value = '$';
        matchCount.textContent = '';
    });

    document.getElementById('pasteBtn').addEventListener('click', async function () {
        try { const t = await navigator.clipboard.readText(); if (t) jsonEditor.setValue(t); } catch {}
    });

    document.getElementById('prettifyBtn').addEventListener('click', function () {
        try { jsonEditor.setValue(JSON.stringify(JSON.parse(jsonEditor.getValue()), null, 2)); } catch {}
    });

    document.getElementById('copyResultBtn').addEventListener('click', function () {
        navigator.clipboard.writeText(resultEditor.getValue()).then(() => {
            const btn = this;
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
        });
    });

    document.getElementById('loadFile').addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = e => { jsonEditor.setValue(e.target.result); runQuery(); };
        reader.readAsText(f); this.value = '';
    });

    // Ctrl+Enter to query
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery(); }
    });

    // Load sample on start
    jsonEditor.setValue(JSON.stringify(samples.store.json, null, 2));
    pathInput.value = samples.store.path;
    setTimeout(runQuery, 200);
})();
