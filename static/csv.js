// ── CSV Viewer ──
document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const pasteBtn = document.getElementById('pasteBtn');
    const addRowBtn = document.getElementById('addRowBtn');
    const addColBtn = document.getElementById('addColBtn');
    const deleteRowBtn = document.getElementById('deleteRowBtn');
    const deleteColBtn = document.getElementById('deleteColBtn');
    const clearBtn = document.getElementById('clearBtn');
    const exportGroup = document.getElementById('exportGroup');
    const searchBar = document.getElementById('searchBar');
    const globalSearch = document.getElementById('globalSearch');
    const clearSearch = document.getElementById('clearSearch');
    const hasHeaderCb = document.getElementById('hasHeader');
    const colFiltersCb = document.getElementById('colFilters');
    const delimiterSel = document.getElementById('delimiter');
    const statsBar = document.getElementById('statsBar');
    const dropZone = document.getElementById('dropZone');
    const tableContainer = document.getElementById('tableContainer');
    const csvHead = document.getElementById('csvHead');
    const csvBody = document.getElementById('csvBody');

    let rawData = [];       // all rows (array of arrays)
    let headers = [];       // column headers
    let sortCol = -1;
    let sortAsc = true;
    let selectedRows = new Set();
    let editingCell = null;
    let fileName = 'data';

    // ── Parse CSV ──
    function parseCSV(text, delim) {
        if (delim === 'auto') {
            // detect delimiter
            const firstLine = text.split('\n')[0] || '';
            const counts = { '\t': 0, ',': 0, ';': 0, '|': 0 };
            for (const ch of firstLine) { if (ch in counts) counts[ch]++; }
            delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
            if (counts[delim] === 0) delim = ',';
        }

        const rows = [];
        let row = [];
        let cell = '';
        let inQuotes = false;
        let i = 0;
        const len = text.length;

        while (i < len) {
            const ch = text[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < len && text[i + 1] === '"') {
                        cell += '"';
                        i += 2;
                    } else {
                        inQuotes = false;
                        i++;
                    }
                } else {
                    cell += ch;
                    i++;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                    i++;
                } else if (ch === delim) {
                    row.push(cell);
                    cell = '';
                    i++;
                } else if (ch === '\r') {
                    if (i + 1 < len && text[i + 1] === '\n') i++;
                    row.push(cell);
                    cell = '';
                    rows.push(row);
                    row = [];
                    i++;
                } else if (ch === '\n') {
                    row.push(cell);
                    cell = '';
                    rows.push(row);
                    row = [];
                    i++;
                } else {
                    cell += ch;
                    i++;
                }
            }
        }
        if (cell || row.length > 0) {
            row.push(cell);
            rows.push(row);
        }

        // Remove trailing empty rows
        while (rows.length > 0 && rows[rows.length - 1].every(c => c === '')) {
            rows.pop();
        }

        // Normalize column count
        const maxCols = Math.max(...rows.map(r => r.length), 0);
        for (const r of rows) {
            while (r.length < maxCols) r.push('');
        }

        return rows;
    }

    // ── Load data ──
    function loadData(text, name) {
        const delim = delimiterSel.value;
        const allRows = parseCSV(text, delim);
        if (allRows.length === 0) return;

        fileName = name || 'data';
        sortCol = -1;
        sortAsc = true;
        selectedRows.clear();

        if (hasHeaderCb.checked && allRows.length > 1) {
            headers = allRows[0];
            rawData = allRows.slice(1);
        } else {
            headers = allRows[0].map((_, i) => 'Col ' + (i + 1));
            rawData = allRows;
        }

        showTable();
    }

    function showTable() {
        dropZone.classList.add('d-none');
        tableContainer.classList.remove('d-none');
        searchBar.classList.remove('d-none');
        [addRowBtn, addColBtn, deleteRowBtn, deleteColBtn, exportGroup, clearBtn].forEach(
            el => el.classList.remove('d-none')
        );
        renderTable();
    }

    // ── Render ──
    function renderTable() {
        // Get filtered + sorted data
        const { filtered, indices } = getFilteredData();

        // Stats
        const totalRows = rawData.length;
        const shownRows = filtered.length;
        const totalCols = headers.length;
        statsBar.textContent = shownRows === totalRows
            ? `${totalRows} rows × ${totalCols} cols`
            : `${shownRows} / ${totalRows} rows × ${totalCols} cols`;

        // Head
        let headHtml = '<tr><th class="row-num">#</th>';
        headers.forEach((h, ci) => {
            const sortIcon = sortCol === ci
                ? (sortAsc ? 'bi-sort-up' : 'bi-sort-down')
                : 'bi-arrow-down-up';
            const activeClass = sortCol === ci ? ' active' : '';
            headHtml += `<th data-col="${ci}">${escapeHtml(h)} <i class="bi ${sortIcon} sort-icon${activeClass}"></i>`;
            if (colFiltersCb.checked) {
                const val = colFilterValues[ci] || '';
                headHtml += `<br><input type="text" class="col-filter-input" data-col="${ci}" placeholder="Filter..." value="${escapeHtml(val)}">`;
            }
            headHtml += '</th>';
        });
        headHtml += '</tr>';
        csvHead.innerHTML = headHtml;

        // Body
        let bodyHtml = '';
        filtered.forEach((row, fi) => {
            const ri = indices[fi]; // original index
            const selected = selectedRows.has(ri) ? ' selected' : '';
            bodyHtml += `<tr data-row="${ri}" class="${selected}">`;
            bodyHtml += `<td class="row-num">${ri + 1}</td>`;
            row.forEach((cell, ci) => {
                bodyHtml += `<td data-row="${ri}" data-col="${ci}">${escapeHtml(cell)}</td>`;
            });
            bodyHtml += '</tr>';
        });
        csvBody.innerHTML = bodyHtml || '<tr><td colspan="' + (headers.length + 1) + '" class="csv-empty"><i class="bi bi-funnel"></i> No matching rows</td></tr>';

        // Update delete button
        deleteRowBtn.disabled = selectedRows.size === 0;
        deleteRowBtn.innerHTML = selectedRows.size > 0
            ? `<i class="bi bi-trash"></i> ${selectedRows.size} Row${selectedRows.size > 1 ? 's' : ''}`
            : '<i class="bi bi-trash"></i> Row';

        // Bind events
        bindTableEvents();
    }

    // ── Column filters ──
    let colFilterValues = {};

    function getFilteredData() {
        const query = globalSearch.value.toLowerCase().trim();
        let indices = rawData.map((_, i) => i);
        let filtered = rawData;

        // Global search
        if (query) {
            const result = [];
            const resIdx = [];
            rawData.forEach((row, i) => {
                if (row.some(cell => cell.toLowerCase().includes(query))) {
                    result.push(row);
                    resIdx.push(i);
                }
            });
            filtered = result;
            indices = resIdx;
        }

        // Column filters
        if (colFiltersCb.checked) {
            const newFiltered = [];
            const newIdx = [];
            filtered.forEach((row, fi) => {
                let match = true;
                for (const [col, val] of Object.entries(colFilterValues)) {
                    if (val && !row[parseInt(col)]?.toLowerCase().includes(val.toLowerCase())) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    newFiltered.push(row);
                    newIdx.push(indices[fi]);
                }
            });
            filtered = newFiltered;
            indices = newIdx;
        }

        // Sort
        if (sortCol >= 0) {
            const pairs = filtered.map((row, i) => ({ row, idx: indices[i] }));
            pairs.sort((a, b) => {
                let va = a.row[sortCol] || '';
                let vb = b.row[sortCol] || '';
                // Try numeric sort
                const na = parseFloat(va);
                const nb = parseFloat(vb);
                if (!isNaN(na) && !isNaN(nb)) {
                    return sortAsc ? na - nb : nb - na;
                }
                return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            });
            filtered = pairs.map(p => p.row);
            indices = pairs.map(p => p.idx);
        }

        return { filtered, indices };
    }

    // ── Table events ──
    function bindTableEvents() {
        // Sort on header click
        csvHead.querySelectorAll('th[data-col]').forEach(th => {
            th.addEventListener('click', function (e) {
                if (e.target.classList.contains('col-filter-input')) return;
                const col = parseInt(this.dataset.col);
                if (sortCol === col) {
                    sortAsc = !sortAsc;
                } else {
                    sortCol = col;
                    sortAsc = true;
                }
                renderTable();
            });
        });

        // Column filter inputs
        csvHead.querySelectorAll('.col-filter-input').forEach(input => {
            input.addEventListener('input', function () {
                colFilterValues[this.dataset.col] = this.value;
                renderTable();
                // Re-focus the input after re-render
                const newInput = csvHead.querySelector(`.col-filter-input[data-col="${this.dataset.col}"]`);
                if (newInput) {
                    newInput.focus();
                    newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
                }
            });
            input.addEventListener('click', e => e.stopPropagation());
        });

        // Row select
        csvBody.querySelectorAll('tr[data-row]').forEach(tr => {
            tr.addEventListener('click', function (e) {
                if (e.target.tagName === 'INPUT') return;
                const ri = parseInt(this.dataset.row);
                if (e.ctrlKey || e.metaKey) {
                    if (selectedRows.has(ri)) selectedRows.delete(ri);
                    else selectedRows.add(ri);
                } else if (e.shiftKey && selectedRows.size > 0) {
                    const last = [...selectedRows].pop();
                    const from = Math.min(last, ri);
                    const to = Math.max(last, ri);
                    for (let i = from; i <= to; i++) selectedRows.add(i);
                } else {
                    if (selectedRows.size === 1 && selectedRows.has(ri)) {
                        selectedRows.clear();
                    } else {
                        selectedRows.clear();
                        selectedRows.add(ri);
                    }
                }
                renderTable();
            });
        });

        // Double-click to edit cell
        csvBody.querySelectorAll('td[data-col]').forEach(td => {
            td.addEventListener('dblclick', function () {
                if (this.classList.contains('editing')) return;
                const ri = parseInt(this.dataset.row);
                const ci = parseInt(this.dataset.col);
                startEdit(this, ri, ci);
            });
        });
    }

    // ── Cell editing ──
    function startEdit(td, ri, ci) {
        if (editingCell) finishEdit();
        editingCell = { td, ri, ci };
        const val = rawData[ri][ci];
        td.classList.add('editing');
        td.innerHTML = `<input type="text" value="${escapeHtml(val)}">`;
        const input = td.querySelector('input');
        input.focus();
        input.select();
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { finishEdit(); }
            else if (e.key === 'Escape') { cancelEdit(); }
            else if (e.key === 'Tab') {
                e.preventDefault();
                finishEdit();
                // Move to next/prev cell
                const nextCi = e.shiftKey ? ci - 1 : ci + 1;
                if (nextCi >= 0 && nextCi < headers.length) {
                    const nextTd = csvBody.querySelector(`td[data-row="${ri}"][data-col="${nextCi}"]`);
                    if (nextTd) startEdit(nextTd, ri, nextCi);
                }
            }
        });
        input.addEventListener('blur', function () {
            setTimeout(finishEdit, 100);
        });
    }

    function finishEdit() {
        if (!editingCell) return;
        const input = editingCell.td.querySelector('input');
        if (input) {
            rawData[editingCell.ri][editingCell.ci] = input.value;
        }
        editingCell = null;
        renderTable();
    }

    function cancelEdit() {
        editingCell = null;
        renderTable();
    }

    // ── Add / Delete ──
    addRowBtn.addEventListener('click', function () {
        rawData.push(new Array(headers.length).fill(''));
        renderTable();
        // Scroll to bottom
        tableContainer.scrollTop = tableContainer.scrollHeight;
    });

    addColBtn.addEventListener('click', function () {
        const colName = 'Col ' + (headers.length + 1);
        headers.push(colName);
        rawData.forEach(row => row.push(''));
        renderTable();
    });

    deleteRowBtn.addEventListener('click', function () {
        if (selectedRows.size === 0) return;
        const toDelete = [...selectedRows].sort((a, b) => b - a);
        toDelete.forEach(i => rawData.splice(i, 1));
        selectedRows.clear();
        renderTable();
    });

    deleteColBtn.addEventListener('click', function () {
        if (headers.length === 0) return;
        const select = document.getElementById('deleteColSelect');
        select.innerHTML = headers.map((h, i) => `<option value="${i}">${escapeHtml(h)}</option>`).join('');
        new bootstrap.Modal(document.getElementById('deleteColModal')).show();
    });

    document.getElementById('deleteColConfirm').addEventListener('click', function () {
        const ci = parseInt(document.getElementById('deleteColSelect').value);
        headers.splice(ci, 1);
        rawData.forEach(row => row.splice(ci, 1));
        if (sortCol === ci) { sortCol = -1; }
        else if (sortCol > ci) { sortCol--; }
        delete colFilterValues[ci];
        bootstrap.Modal.getInstance(document.getElementById('deleteColModal')).hide();
        renderTable();
    });

    // ── File import ──
    fileInput.addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            loadData(e.target.result, file.name.replace(/\.[^.]+$/, ''));
        };
        reader.readAsText(file);
        this.value = '';
    });

    // Paste
    pasteBtn.addEventListener('click', async function () {
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) loadData(text, 'pasted');
        } catch {
            // Fallback: prompt
            const text = prompt('Paste CSV data:');
            if (text && text.trim()) loadData(text, 'pasted');
        }
    });

    // Drop zone
    dropZone.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
    });
    dropZone.addEventListener('drop', function (e) {
        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => loadData(ev.target.result, file.name.replace(/\.[^.]+$/, ''));
            reader.readAsText(file);
        }
    });

    // Also support dropping on the table
    tableContainer.addEventListener('dragover', e => e.preventDefault());
    tableContainer.addEventListener('drop', function (e) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => loadData(ev.target.result, file.name.replace(/\.[^.]+$/, ''));
            reader.readAsText(file);
        }
    });

    // Clear
    clearBtn.addEventListener('click', function () {
        rawData = [];
        headers = [];
        sortCol = -1;
        selectedRows.clear();
        colFilterValues = {};
        globalSearch.value = '';
        dropZone.classList.remove('d-none');
        tableContainer.classList.add('d-none');
        searchBar.classList.add('d-none');
        [addRowBtn, addColBtn, deleteRowBtn, deleteColBtn, exportGroup, clearBtn].forEach(
            el => el.classList.add('d-none')
        );
    });

    // Search
    globalSearch.addEventListener('input', () => renderTable());
    clearSearch.addEventListener('click', () => { globalSearch.value = ''; renderTable(); });

    // Header checkbox
    hasHeaderCb.addEventListener('change', function () {
        if (rawData.length === 0 && headers.length === 0) return;
        // Re-merge and re-split
        const all = hasHeaderCb.checked
            ? rawData // already split, need to check if we should re-parse
            : [headers, ...rawData]; // merge back

        // Easiest: just re-parse from the full data
        const fullRows = this.checked
            ? (() => { const merged = [headers, ...rawData]; return merged; })()
            : [headers, ...rawData];

        if (this.checked && fullRows.length > 1) {
            headers = fullRows[0];
            rawData = fullRows.slice(1);
        } else {
            headers = fullRows[0].map((_, i) => 'Col ' + (i + 1));
            rawData = fullRows;
        }
        sortCol = -1;
        renderTable();
    });

    // Column filters toggle
    colFiltersCb.addEventListener('change', function () {
        if (!this.checked) colFilterValues = {};
        renderTable();
    });

    // Delimiter change
    delimiterSel.addEventListener('change', function () {
        // Would need to re-parse from original text — just notify user
        // For simplicity, delimiter only affects next file load
    });

    // ── Export ──
    function generateCSV(delim) {
        const { filtered } = getFilteredData();
        const rows = hasHeaderCb.checked ? [headers, ...filtered] : filtered;
        return rows.map(row =>
            row.map(cell => {
                const s = String(cell);
                if (s.includes(delim) || s.includes('"') || s.includes('\n')) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }).join(delim)
        ).join('\n');
    }

    function downloadFile(content, name, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    }

    document.getElementById('exportCsv').addEventListener('click', function (e) {
        e.preventDefault();
        downloadFile(generateCSV(','), fileName + '.csv', 'text/csv');
    });

    document.getElementById('exportTsv').addEventListener('click', function (e) {
        e.preventDefault();
        downloadFile(generateCSV('\t'), fileName + '.tsv', 'text/tab-separated-values');
    });

    document.getElementById('exportJson').addEventListener('click', function (e) {
        e.preventDefault();
        const { filtered } = getFilteredData();
        const jsonData = filtered.map(row => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = row[i] || ''; });
            return obj;
        });
        downloadFile(JSON.stringify(jsonData, null, 2), fileName + '.json', 'application/json');
    });

    document.getElementById('exportSql').addEventListener('click', function (e) {
        e.preventDefault();
        document.getElementById('sqlTableName').value = fileName.replace(/[^a-zA-Z0-9_]/g, '_');
        new bootstrap.Modal(document.getElementById('sqlModal')).show();
    });

    document.getElementById('sqlExportConfirm').addEventListener('click', function () {
        const tableName = document.getElementById('sqlTableName').value.trim() || 'my_table';
        const { filtered } = getFilteredData();
        const cols = headers.map(h => '`' + h.replace(/`/g, '``') + '`').join(', ');
        const inserts = filtered.map(row => {
            const vals = row.map(cell => {
                if (cell === '' || cell === null || cell === undefined) return 'NULL';
                const n = Number(cell);
                if (!isNaN(n) && cell.trim() !== '') return cell;
                return "'" + String(cell).replace(/'/g, "''") + "'";
            }).join(', ');
            return `INSERT INTO \`${tableName}\` (${cols}) VALUES (${vals});`;
        }).join('\n');
        downloadFile(inserts, fileName + '.sql', 'text/sql');
        bootstrap.Modal.getInstance(document.getElementById('sqlModal')).hide();
    });

    document.getElementById('exportCopy').addEventListener('click', function (e) {
        e.preventDefault();
        const csv = generateCSV(',');
        navigator.clipboard.writeText(csv).then(() => {
            const orig = this.innerHTML;
            this.innerHTML = '<i class="bi bi-check-lg text-success"></i> Copied!';
            setTimeout(() => { this.innerHTML = orig; }, 1500);
        });
    });

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', function (e) {
        // Ctrl+O: open file
        if ((e.ctrlKey || e.metaKey) && e.key === 'o' && !e.shiftKey) {
            e.preventDefault();
            fileInput.click();
        }
        // Ctrl+F: focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !searchBar.classList.contains('d-none')) {
            e.preventDefault();
            globalSearch.focus();
            globalSearch.select();
        }
        // Delete: delete selected rows
        if (e.key === 'Delete' && selectedRows.size > 0 && document.activeElement.tagName !== 'INPUT') {
            deleteRowBtn.click();
        }
        // Ctrl+A: select all visible rows
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !searchBar.classList.contains('d-none') && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            const { indices } = getFilteredData();
            indices.forEach(i => selectedRows.add(i));
            renderTable();
        }
    });

    // ── Global paste ──
    document.addEventListener('paste', function (e) {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        const text = e.clipboardData.getData('text');
        if (text && text.trim() && rawData.length === 0) {
            e.preventDefault();
            loadData(text, 'pasted');
        }
    });

    // ── Helpers ──
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
});
