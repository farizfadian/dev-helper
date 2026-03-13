// ── Placeholder Image Generator ──
document.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const widthInput = document.getElementById('imgWidth');
    const heightInput = document.getElementById('imgHeight');
    const textInput = document.getElementById('imgText');
    const showSize = document.getElementById('showSize');
    const fontSizeSlider = document.getElementById('fontSize');
    const fontSizeVal = document.getElementById('fontSizeVal');
    const bgColor = document.getElementById('bgColor');
    const textColor = document.getElementById('textColor');
    const bgStyle = document.getElementById('bgStyle');
    const gradientEnd = document.getElementById('gradientEnd');
    const gradientEndWrap = document.getElementById('gradientEndWrap');

    function render() {
        const w = parseInt(widthInput.value) || 640;
        const h = parseInt(heightInput.value) || 480;
        canvas.width = w;
        canvas.height = h;

        // Background
        const style = bgStyle.value;
        const bg = bgColor.value;
        if (style === 'solid') {
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
        } else if (style.startsWith('gradient')) {
            let grad;
            const end = gradientEnd.value;
            if (style === 'gradient-h') grad = ctx.createLinearGradient(0, 0, w, 0);
            else if (style === 'gradient-v') grad = ctx.createLinearGradient(0, 0, 0, h);
            else grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, bg);
            grad.addColorStop(1, end);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        } else if (style === 'crosshatch') {
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = textColor.value + '20';
            ctx.lineWidth = 1;
            const spacing = 20;
            for (let i = -h; i < w; i += spacing) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(i + h, 0); ctx.lineTo(i, h); ctx.stroke();
            }
        }

        // Text
        let text = textInput.value || (showSize.checked ? `${w}×${h}` : '');
        if (!text) return;

        let fs = parseInt(fontSizeSlider.value);
        if (fs === 0) {
            // Auto: fit text
            fs = Math.min(w, h) / 5;
            fs = Math.max(16, Math.min(fs, 200));
            // Shrink if too wide
            ctx.font = `bold ${fs}px Arial, sans-serif`;
            while (ctx.measureText(text).width > w * 0.85 && fs > 10) {
                fs -= 2;
                ctx.font = `bold ${fs}px Arial, sans-serif`;
            }
        }

        ctx.font = `bold ${fs}px Arial, sans-serif`;
        ctx.fillStyle = textColor.value;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2);
    }

    // Events
    [widthInput, heightInput, textInput, bgColor, textColor, bgStyle, gradientEnd].forEach(el => {
        el.addEventListener('input', render);
    });
    showSize.addEventListener('change', render);
    fontSizeSlider.addEventListener('input', function () {
        fontSizeVal.textContent = this.value === '0' ? 'auto' : this.value + 'px';
        render();
    });
    bgStyle.addEventListener('change', function () {
        gradientEndWrap.classList.toggle('d-none', !this.value.startsWith('gradient'));
        render();
    });

    // Size presets
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            widthInput.value = this.dataset.w;
            heightInput.value = this.dataset.h;
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            render();
        });
    });

    // Color presets
    document.querySelectorAll('.preset-color').forEach(el => {
        el.addEventListener('click', function () {
            const target = this.dataset.target === 'bg' ? bgColor : textColor;
            target.value = this.dataset.color;
            render();
        });
    });

    // Download PNG
    document.getElementById('downloadPng').addEventListener('click', function () {
        const a = document.createElement('a');
        a.download = `placeholder-${widthInput.value}x${heightInput.value}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    });

    // Download SVG
    document.getElementById('downloadSvg').addEventListener('click', function () {
        const w = parseInt(widthInput.value) || 640;
        const h = parseInt(heightInput.value) || 480;
        const text = textInput.value || (showSize.checked ? `${w}×${h}` : '');
        let fs = parseInt(fontSizeSlider.value);
        if (fs === 0) fs = Math.max(16, Math.min(Math.min(w, h) / 5, 200));

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${bgColor.value}"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="${fs}" fill="${textColor.value}">${escapeXml(text)}</text>
</svg>`;
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const a = document.createElement('a');
        a.download = `placeholder-${w}x${h}.svg`;
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
    });

    // Copy Data URI
    document.getElementById('copyDataUri').addEventListener('click', function () {
        navigator.clipboard.writeText(canvas.toDataURL('image/png')).then(() => {
            const orig = this.innerHTML;
            this.innerHTML = '<i class="bi bi-check-lg text-success"></i> Copied!';
            setTimeout(() => { this.innerHTML = orig; }, 1500);
        });
    });

    function escapeXml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    render();
});
