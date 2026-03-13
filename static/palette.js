// ── Color Palette Generator ──
document.addEventListener('DOMContentLoaded', function () {
    const baseColor = document.getElementById('baseColor');
    const baseHex = document.getElementById('baseHex');
    const palettes = document.getElementById('palettes');

    function hexToHsl(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        return [h * 360, s * 100, l * 100];
    }

    function hslToHex(h, s, l) {
        h = ((h % 360) + 360) % 360;
        s = Math.max(0, Math.min(100, s)) / 100;
        l = Math.max(0, Math.min(100, l)) / 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, '0'); };
        return '#' + f(0) + f(8) + f(4);
    }

    function generate() {
        const hex = baseColor.value;
        const [h, s, l] = hexToHsl(hex);

        const harmonies = {
            'Complementary': [[h, s, l], [(h + 180), s, l]],
            'Analogous': [[(h - 30), s, l], [h, s, l], [(h + 30), s, l]],
            'Triadic': [[h, s, l], [(h + 120), s, l], [(h + 240), s, l]],
            'Split Complementary': [[h, s, l], [(h + 150), s, l], [(h + 210), s, l]],
            'Tetradic': [[h, s, l], [(h + 90), s, l], [(h + 180), s, l], [(h + 270), s, l]],
            'Shades': Array.from({ length: 7 }, (_, i) => [h, s, 10 + i * 12]),
            'Tints': Array.from({ length: 7 }, (_, i) => [h, s, 30 + i * 10]),
            'Tones': Array.from({ length: 7 }, (_, i) => [h, 10 + i * 13, l]),
            'Warm': Array.from({ length: 5 }, (_, i) => [(h + i * 15) % 360, s, l]),
            'Cool': Array.from({ length: 5 }, (_, i) => [(h + 180 + i * 15) % 360, s, l]),
        };

        let html = '';
        for (const [name, colors] of Object.entries(harmonies)) {
            html += `<div class="harmony-label">${name}</div><div class="palette-row">`;
            colors.forEach(([ch, cs, cl]) => {
                const c = hslToHex(ch, cs, cl);
                html += `<div class="color-swatch" style="background:${c};" onclick="navigator.clipboard.writeText('${c}');this.style.borderColor='var(--bs-success)';setTimeout(()=>this.style.borderColor='transparent',600)" title="Click to copy">
                    <span class="hex">${c}</span>
                </div>`;
            });
            html += '</div>';
        }
        palettes.innerHTML = html;
    }

    baseColor.addEventListener('input', function () { baseHex.value = this.value; generate(); });
    baseHex.addEventListener('input', function () {
        if (/^#[0-9a-fA-F]{6}$/.test(this.value)) { baseColor.value = this.value; generate(); }
    });
    document.getElementById('randomBtn').addEventListener('click', function () {
        const hex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        baseColor.value = hex; baseHex.value = hex; generate();
    });

    // Extract from image
    document.getElementById('imgInput').addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const size = 50;
                canvas.width = size; canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, size, size);
                const data = ctx.getImageData(0, 0, size, size).data;

                // Simple k-means-ish: sample pixels and find dominant colors
                const colors = {};
                for (let i = 0; i < data.length; i += 16) {
                    const r = Math.round(data[i] / 32) * 32;
                    const g = Math.round(data[i+1] / 32) * 32;
                    const b = Math.round(data[i+2] / 32) * 32;
                    const key = `${r},${g},${b}`;
                    colors[key] = (colors[key] || 0) + 1;
                }
                const sorted = Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 8);
                const imgPalette = document.getElementById('imgPalette');
                imgPalette.innerHTML = sorted.map(([rgb]) => {
                    const [r, g, b] = rgb.split(',').map(Number);
                    const hex = '#' + [r, g, b].map(v => Math.min(255, v).toString(16).padStart(2, '0')).join('');
                    return `<div class="img-swatch" style="background:${hex};" onclick="document.getElementById('baseColor').value='${hex}';document.getElementById('baseHex').value='${hex}';document.getElementById('baseColor').dispatchEvent(new Event('input'));" title="${hex}"></div>`;
                }).join('');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(f);
    });

    generate();
});
