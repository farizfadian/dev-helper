// ── Keycode Viewer ──
document.addEventListener('DOMContentLoaded', function () {
    const keyDisplay = document.getElementById('keyDisplay');
    const history = [];
    const locations = { 0: 'Standard', 1: 'Left', 2: 'Right', 3: 'Numpad' };

    document.addEventListener('keydown', function (e) {
        e.preventDefault();
        keyDisplay.textContent = e.key === ' ' ? 'Space' : e.key;
        keyDisplay.classList.add('active');
        setTimeout(() => keyDisplay.classList.remove('active'), 200);

        document.getElementById('propKey').textContent = e.key;
        document.getElementById('propCode').textContent = e.code;
        document.getElementById('propKeyCode').textContent = e.keyCode;
        document.getElementById('propWhich').textContent = e.which;
        document.getElementById('propLocation').textContent = locations[e.location] || e.location;

        const mods = [];
        if (e.ctrlKey) mods.push('Ctrl');
        if (e.shiftKey) mods.push('Shift');
        if (e.altKey) mods.push('Alt');
        if (e.metaKey) mods.push('Meta');
        document.getElementById('propModifiers').textContent = mods.length ? mods.join(' + ') : 'None';

        history.unshift({ key: e.key, code: e.code, keyCode: e.keyCode, mods: mods.join('+') });
        if (history.length > 30) history.pop();
        renderHistory();
    });

    function renderHistory() {
        document.getElementById('historyList').innerHTML = history.map(h =>
            `<div class="history-item">
                <span class="badge bg-secondary" style="min-width:60px;">${esc(h.key === ' ' ? 'Space' : h.key)}</span>
                <span>${esc(h.code)}</span>
                <span class="text-muted">${h.keyCode}</span>
                ${h.mods ? `<span class="text-primary">${esc(h.mods)}</span>` : ''}
            </div>`
        ).join('') || '<div class="text-center text-muted py-3">No keys pressed yet</div>';
    }

    document.getElementById('clearHistory').addEventListener('click', function () {
        history.length = 0;
        renderHistory();
    });

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    renderHistory();
});

function copyVal(el) {
    const val = el.querySelector('.prop-value').textContent;
    navigator.clipboard.writeText(val).then(() => {
        el.style.borderColor = 'var(--bs-success)';
        setTimeout(() => el.style.borderColor = '', 600);
    });
}
