// ── Font Preview ──
document.addEventListener('DOMContentLoaded', function () {
    const previewText = document.getElementById('previewText');
    const fontSize = document.getElementById('fontSize');
    const fontWeight = document.getElementById('fontWeight');
    const fontFilter = document.getElementById('fontFilter');
    const fontList = document.getElementById('fontList');
    const mainPreview = document.getElementById('mainPreview');
    const cssOutput = document.getElementById('cssOutput');
    const sizePreview = document.getElementById('sizePreview');

    // System + common web fonts
    const fonts = [
        'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS',
        'Times New Roman', 'Georgia', 'Garamond', 'Palatino',
        'Courier New', 'Lucida Console', 'Monaco', 'Consolas',
        'Comic Sans MS', 'Impact', 'Arial Black',
        'Segoe UI', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
        'Source Sans Pro', 'Raleway', 'Poppins', 'Nunito', 'Ubuntu',
        'Inter', 'Fira Code', 'JetBrains Mono', 'SF Mono', 'Cascadia Code',
        'system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
    ];

    let activeFont = 'Arial';

    function render() {
        const q = fontFilter.value.toLowerCase();
        const filtered = fonts.filter(f => f.toLowerCase().includes(q));
        const text = previewText.value || 'The quick brown fox';
        const size = fontSize.value + 'px';
        const weight = fontWeight.value;

        fontList.innerHTML = filtered.map(f => {
            const active = f === activeFont ? ' active' : '';
            return `<div class="font-card${active}" data-font="${f}">
                <div class="font-name">${f}</div>
                <div class="font-sample" style="font-family:'${f}', sans-serif;">${esc(text)}</div>
            </div>`;
        }).join('');

        mainPreview.style.fontFamily = `'${activeFont}', sans-serif`;
        mainPreview.style.fontSize = size;
        mainPreview.style.fontWeight = weight;
        mainPreview.textContent = text;

        cssOutput.textContent = `font-family: '${activeFont}', sans-serif; font-size: ${size}; font-weight: ${weight};`;

        // Size preview
        const sizes = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
        sizePreview.innerHTML = sizes.map(s =>
            `<div style="font-family:'${activeFont}',sans-serif; font-size:${s}px; font-weight:${weight}; margin-bottom:0.3rem;">
                <span class="text-muted" style="font-size:0.72rem; font-family:monospace; display:inline-block; width:35px;">${s}px</span> ${esc(text.slice(0, 40))}
            </div>`
        ).join('');
    }

    fontList.addEventListener('click', function (e) {
        const card = e.target.closest('.font-card');
        if (card) { activeFont = card.dataset.font; render(); }
    });

    [previewText, fontSize, fontWeight, fontFilter].forEach(el => el.addEventListener('input', render));

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    render();
});
