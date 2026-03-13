// ── SQL Playground ──
(function () {
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const editor = monaco.editor.create(document.getElementById('sqlEditor'), {
        language: 'sql', theme: isDark ? 'vs-dark' : 'vs', minimap: { enabled: false },
        fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true,
        tabSize: 2, wordWrap: 'on',
        value: '-- Write SQL here. Use "Import CSV" to create tables.\nSELECT 1 + 1 AS result;',
    });
    document.addEventListener('devhelper-theme', e => monaco.editor.setTheme(e.detail === 'dark' ? 'vs-dark' : 'vs'));

    const resultArea = document.getElementById('resultArea');
    const statBar = document.getElementById('statBar');
    const tableList = document.getElementById('tableList');
    let db = null;

    // Init sql.js
    async function initDB() {
        try {
            const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}` });
            db = new SQL.Database();
            updateTableList();
        } catch (e) {
            resultArea.innerHTML = `<div class="p-3 text-danger">Failed to load SQL.js: ${e.message}</div>`;
        }
    }

    function runSQL() {
        if (!db) { resultArea.innerHTML = '<div class="p-3 text-warning">Database not ready. Please wait...</div>'; return; }
        const sql = editor.getValue().trim();
        if (!sql) return;

        const start = performance.now();
        try {
            const results = db.exec(sql);
            const elapsed = ((performance.now() - start) / 1000).toFixed(3);

            if (results.length === 0) {
                statBar.textContent = `Query executed in ${elapsed}s — no results returned.`;
                resultArea.innerHTML = '<div class="p-3 text-muted">Query executed successfully (no results)</div>';
                updateTableList();
                return;
            }

            const res = results[results.length - 1];
            statBar.textContent = `${res.values.length} row${res.values.length !== 1 ? 's' : ''} in ${elapsed}s`;

            let html = '<table class="table table-sm table-striped mb-0"><thead><tr>';
            res.columns.forEach(c => { html += `<th>${esc(c)}</th>`; });
            html += '</tr></thead><tbody>';
            res.values.forEach(row => {
                html += '<tr>';
                row.forEach(v => { html += `<td>${v === null ? '<em class="text-muted">NULL</em>' : esc(String(v))}</td>`; });
                html += '</tr>';
            });
            html += '</tbody></table>';
            resultArea.innerHTML = html;
            updateTableList();
        } catch (e) {
            statBar.textContent = '';
            resultArea.innerHTML = `<div class="p-3 text-danger"><i class="bi bi-exclamation-triangle"></i> ${esc(e.message)}</div>`;
        }
    }

    function updateTableList() {
        if (!db) return;
        try {
            const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
            if (res.length > 0) {
                tableList.innerHTML = res[0].values.map(r => `<span class="badge bg-secondary" style="cursor:pointer;" onclick="document.querySelector('#sqlEditor').__editor.setValue('SELECT * FROM ${r[0]} LIMIT 100;')">${r[0]}</span>`).join('');
            } else {
                tableList.innerHTML = '<span class="text-muted">No tables</span>';
            }
        } catch {}
    }

    // Import CSV
    document.getElementById('importCsv').addEventListener('change', function () {
        const f = this.files[0]; if (!f || !db) return;
        const tableName = f.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
        const reader = new FileReader();
        reader.onload = function (e) {
            const lines = e.target.result.split('\n').filter(l => l.trim());
            if (lines.length < 2) return;
            const delim = lines[0].includes('\t') ? '\t' : ',';
            const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ''));
            const cols = headers.map(h => `"${h}" TEXT`).join(', ');
            try {
                db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${cols});`);
                const placeholders = headers.map(() => '?').join(',');
                const stmt = db.prepare(`INSERT INTO "${tableName}" VALUES (${placeholders})`);
                for (let i = 1; i < lines.length; i++) {
                    const vals = lines[i].split(delim).map(v => v.trim().replace(/^"|"$/g, ''));
                    if (vals.length === headers.length) stmt.run(vals);
                }
                stmt.free();
                updateTableList();
                editor.setValue(`SELECT * FROM "${tableName}" LIMIT 100;`);
                runSQL();
            } catch (err) {
                resultArea.innerHTML = `<div class="p-3 text-danger">${esc(err.message)}</div>`;
            }
        };
        reader.readAsText(f); this.value = '';
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', function () {
        if (!db) return;
        const data = db.export();
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const a = document.createElement('a'); a.download = 'database.sqlite'; a.href = URL.createObjectURL(blob); a.click();
    });

    // Samples
    const samples = {
        basic: `-- Create a sample table
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, age INTEGER);
INSERT INTO users VALUES (1, 'Alice', 'alice@example.com', 30);
INSERT INTO users VALUES (2, 'Bob', 'bob@example.com', 25);
INSERT INTO users VALUES (3, 'Charlie', 'charlie@example.com', 35);
INSERT INTO users VALUES (4, 'Diana', 'diana@example.com', 28);
SELECT * FROM users;`,
        join: `-- Create tables for JOIN example
CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);
INSERT INTO departments VALUES (1, 'Engineering'), (2, 'Marketing'), (3, 'Sales');
INSERT INTO employees VALUES (1, 'Alice', 1, 95000), (2, 'Bob', 2, 72000), (3, 'Charlie', 1, 88000), (4, 'Diana', 3, 65000);
SELECT e.name, d.name AS department, e.salary FROM employees e JOIN departments d ON e.dept_id = d.id ORDER BY e.salary DESC;`,
        agg: `-- Aggregation example (run "Basic" or "JOIN" first)
SELECT dept_id, COUNT(*) as count, AVG(salary) as avg_salary, MAX(salary) as max_salary FROM employees GROUP BY dept_id;`,
    };

    document.getElementById('samplesMenu').addEventListener('click', function (e) {
        const item = e.target.closest('[data-sample]');
        if (item) { e.preventDefault(); editor.setValue(samples[item.dataset.sample]); }
    });

    document.getElementById('runBtn').addEventListener('click', runSQL);
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSQL(); }
    });

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    initDB();
})();
