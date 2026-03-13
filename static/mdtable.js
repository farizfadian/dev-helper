// ── Markdown Table Generator ──
document.addEventListener('DOMContentLoaded', function () {
    const editTable = document.getElementById('editTable');
    const mdOutput = document.getElementById('mdOutput');
    const altOutput = document.getElementById('altOutput');
    const altFormat = document.getElementById('altFormat');

    let cols = 3;
    let rows = 3;
    let data = []; // data[row][col] = string
    let headers = [];
    let aligns = []; // 'left' | 'center' | 'right'

    function init(c, r) {
        cols = c;
        rows = r;
        headers = Array.from({ length: cols }, (_, i) => 'Header ' + (i + 1));
        aligns = Array(cols).fill('left');
        data = Array.from({ length: rows }, () => Array(cols).fill(''));
        render();
    }

    function render() {
        let html = '<thead><tr><th class="row-num"></th>';
        for (let c = 0; c < cols; c++) {
            const alignIcon = aligns[c] === 'center' ? 'bi-text-center' : aligns[c] === 'right' ? 'bi-text-right' : 'bi-text-left';
            html += `<th>
                <input class="cell-input fw-semibold" data-type="header" data-col="${c}" value="${escapeHtml(headers[c])}">
                <div class="text-center mt-1">
                    <button class="btn btn-sm align-btn ${aligns[c] === 'left' ? 'active' : ''}" data-align="left" data-col="${c}" title="Left"><i class="bi bi-text-left"></i></button>
                    <button class="btn btn-sm align-btn ${aligns[c] === 'center' ? 'active' : ''}" data-align="center" data-col="${c}" title="Center"><i class="bi bi-text-center"></i></button>
                    <button class="btn btn-sm align-btn ${aligns[c] === 'right' ? 'active' : ''}" data-align="right" data-col="${c}" title="Right"><i class="bi bi-text-right"></i></button>
                </div>
            </th>`;
        }
        html += '</tr></thead><tbody>';

        for (let r = 0; r < rows; r++) {
            html += `<tr><td class="row-num">${r + 1}</td>`;
            for (let c = 0; c < cols; c++) {
                html += `<td><input class="cell-input" data-type="cell" data-row="${r}" data-col="${c}" value="${escapeHtml(data[r][c])}"></td>`;
            }
            html += '</tr>';
        }
        html += '</tbody>';
        editTable.innerHTML = html;

        bindEvents();
        generateOutput();
    }

    function bindEvents() {
        editTable.querySelectorAll('input.cell-input').forEach(input => {
            input.addEventListener('input', function () {
                if (this.dataset.type === 'header') {
                    headers[parseInt(this.dataset.col)] = this.value;
                } else {
                    data[parseInt(this.dataset.row)][parseInt(this.dataset.col)] = this.value;
                }
                generateOutput();
            });
            input.addEventListener('keydown', function (e) {
                const r = parseInt(this.dataset.row ?? -1);
                const c = parseInt(this.dataset.col);
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const nextC = e.shiftKey ? c - 1 : c + 1;
                    const nextR = this.dataset.type === 'header' ? -1 : r;
                    let target;
                    if (nextC >= 0 && nextC < cols) {
                        target = editTable.querySelector(`input[data-type="${this.dataset.type}"][data-row="${nextR}"][data-col="${nextC}"]`)
                            || editTable.querySelector(`input[data-type="${this.dataset.type}"][data-col="${nextC}"]`);
                    } else if (nextC >= cols && nextR < rows - 1) {
                        target = editTable.querySelector(`input[data-type="cell"][data-row="${nextR + 1}"][data-col="0"]`);
                    }
                    if (target) { target.focus(); target.select(); }
                }
                if (e.key === 'ArrowDown') {
                    const nr = this.dataset.type === 'header' ? 0 : r + 1;
                    const t = editTable.querySelector(`input[data-type="cell"][data-row="${nr}"][data-col="${c}"]`);
                    if (t) { t.focus(); t.select(); }
                }
                if (e.key === 'ArrowUp') {
                    if (this.dataset.type === 'cell' && r === 0) {
                        const t = editTable.querySelector(`input[data-type="header"][data-col="${c}"]`);
                        if (t) { t.focus(); t.select(); }
                    } else if (r > 0) {
                        const t = editTable.querySelector(`input[data-type="cell"][data-row="${r - 1}"][data-col="${c}"]`);
                        if (t) { t.focus(); t.select(); }
                    }
                }
            });
        });

        editTable.querySelectorAll('.align-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const c = parseInt(this.dataset.col);
                aligns[c] = this.dataset.align;
                render();
            });
        });
    }

    function generateOutput() {
        // Markdown
        const colWidths = headers.map((h, i) => Math.max(h.length, ...data.map(r => r[i].length), 3));

        const padCell = (val, width, align) => {
            const s = val || '';
            if (align === 'center') {
                const total = width - s.length;
                const left = Math.floor(total / 2);
                return ' '.repeat(left) + s + ' '.repeat(total - left);
            }
            if (align === 'right') return s.padStart(width);
            return s.padEnd(width);
        };

        const headerLine = '| ' + headers.map((h, i) => padCell(h, colWidths[i], aligns[i])).join(' | ') + ' |';
        const sepLine = '| ' + colWidths.map((w, i) => {
            const a = aligns[i];
            if (a === 'center') return ':' + '-'.repeat(w - 2) + ':';
            if (a === 'right') return '-'.repeat(w - 1) + ':';
            return '-'.repeat(w);
        }).join(' | ') + ' |';
        const bodyLines = data.map(row =>
            '| ' + row.map((cell, i) => padCell(cell, colWidths[i], aligns[i])).join(' | ') + ' |'
        );

        mdOutput.value = [headerLine, sepLine, ...bodyLines].join('\n');

        // Alt format
        generateAltOutput();
    }

    function generateAltOutput() {
        const format = altFormat.value;
        if (format === 'html') {
            let html = '<table>\n  <thead>\n    <tr>\n';
            headers.forEach(h => { html += `      <th>${escapeHtml(h)}</th>\n`; });
            html += '    </tr>\n  </thead>\n  <tbody>\n';
            data.forEach(row => {
                html += '    <tr>\n';
                row.forEach(cell => { html += `      <td>${escapeHtml(cell)}</td>\n`; });
                html += '    </tr>\n';
            });
            html += '  </tbody>\n</table>';
            altOutput.value = html;
        } else if (format === 'csv') {
            const escape = s => s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
            altOutput.value = [headers.map(escape).join(','), ...data.map(r => r.map(escape).join(','))].join('\n');
        } else if (format === 'ascii') {
            const colWidths = headers.map((h, i) => Math.max(h.length, ...data.map(r => r[i].length), 3));
            const sep = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
            const fmtRow = row => '| ' + row.map((c, i) => (c || '').padEnd(colWidths[i])).join(' | ') + ' |';
            altOutput.value = [sep, fmtRow(headers), sep, ...data.map(r => fmtRow(r)), sep].join('\n');
        }
    }

    // Buttons
    document.getElementById('addRowBtn').addEventListener('click', () => { rows++; data.push(Array(cols).fill('')); render(); });
    document.getElementById('addColBtn').addEventListener('click', () => { cols++; headers.push('Header ' + cols); aligns.push('left'); data.forEach(r => r.push('')); render(); });
    document.getElementById('removeRowBtn').addEventListener('click', () => { if (rows > 1) { rows--; data.pop(); render(); } });
    document.getElementById('removeColBtn').addEventListener('click', () => { if (cols > 1) { cols--; headers.pop(); aligns.pop(); data.forEach(r => r.pop()); render(); } });
    document.getElementById('clearBtn').addEventListener('click', () => init(3, 3));
    altFormat.addEventListener('change', generateAltOutput);

    // Presets
    document.getElementById('presetsMenu').addEventListener('click', function (e) {
        const item = e.target.closest('[data-preset]');
        if (!item) return;
        e.preventDefault();
        const p = item.dataset.preset;
        if (p === '3x3') init(3, 3);
        else if (p === '4x5') init(4, 5);
        else if (p === '5x10') init(5, 10);
        else if (p === 'comparison') {
            cols = 4; rows = 3;
            headers = ['Feature', 'Free', 'Pro', 'Enterprise'];
            aligns = ['left', 'center', 'center', 'center'];
            data = [['Feature A', '✓', '✓', '✓'], ['Feature B', '✗', '✓', '✓'], ['Feature C', '✗', '✗', '✓']];
            render();
        } else if (p === 'api') {
            cols = 4; rows = 4;
            headers = ['Method', 'Endpoint', 'Description', 'Auth'];
            aligns = ['left', 'left', 'left', 'center'];
            data = [['GET', '/api/users', 'List all users', '✓'], ['POST', '/api/users', 'Create user', '✓'], ['GET', '/api/users/:id', 'Get user by ID', '✓'], ['DELETE', '/api/users/:id', 'Delete user', 'Admin']];
            render();
        } else if (p === 'schedule') {
            cols = 3; rows = 5;
            headers = ['Time', 'Activity', 'Notes'];
            aligns = ['center', 'left', 'left'];
            data = [['09:00', 'Stand-up', '15 min'], ['10:00', 'Sprint Planning', 'Team room'], ['12:00', 'Lunch', ''], ['14:00', 'Code Review', 'PR #42'], ['16:00', 'Retrospective', 'Bi-weekly']];
            render();
        }
    });

    // Import
    document.getElementById('importBtn').addEventListener('click', async function () {
        let text;
        try { text = await navigator.clipboard.readText(); } catch {
            text = prompt('Paste Markdown table:');
        }
        if (!text || !text.trim()) return;

        const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
        if (lines.length < 2) return;

        const parseLine = l => l.split('|').slice(1, -1).map(c => c.trim());
        headers = parseLine(lines[0]);
        cols = headers.length;

        // Parse alignment from separator line
        const sepCells = parseLine(lines[1]);
        aligns = sepCells.map(c => {
            if (c.startsWith(':') && c.endsWith(':')) return 'center';
            if (c.endsWith(':')) return 'right';
            return 'left';
        });

        data = lines.slice(2).map(l => {
            const cells = parseLine(l);
            while (cells.length < cols) cells.push('');
            return cells.slice(0, cols);
        });
        rows = data.length;
        if (rows === 0) { rows = 1; data = [Array(cols).fill('')]; }

        render();
    });

    // Copy
    document.getElementById('copyMdBtn').addEventListener('click', function () {
        navigator.clipboard.writeText(mdOutput.value).then(() => {
            this.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
            setTimeout(() => { this.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1500);
        });
    });
    document.getElementById('copyAltBtn').addEventListener('click', function () {
        navigator.clipboard.writeText(altOutput.value).then(() => {
            this.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
            setTimeout(() => { this.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1500);
        });
    });

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // Init
    init(3, 3);
});
