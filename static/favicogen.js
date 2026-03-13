// ── Favicon Generator ──
document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const uploadArea = document.getElementById('uploadArea');
    const resultArea = document.getElementById('resultArea');
    const sourcePreview = document.getElementById('sourcePreview');
    const iconPreview = document.getElementById('iconPreview');
    const htmlTags = document.getElementById('htmlTags');
    const downloadZip = document.getElementById('downloadZip');
    const downloadIco = document.getElementById('downloadIco');

    const sizes = [
        { name: 'favicon-16x16.png', size: 16, label: '16×16' },
        { name: 'favicon-32x32.png', size: 32, label: '32×32' },
        { name: 'favicon-48x48.png', size: 48, label: '48×48' },
        { name: 'apple-touch-icon.png', size: 180, label: '180×180\nApple' },
        { name: 'android-chrome-192x192.png', size: 192, label: '192×192\nAndroid' },
        { name: 'android-chrome-512x512.png', size: 512, label: '512×512\nAndroid' },
        { name: 'mstile-150x150.png', size: 150, label: '150×150\nMS Tile' },
    ];

    let generatedBlobs = {};
    let sourceImg = null;

    function generateIcons(img) {
        sourceImg = img;
        sourcePreview.src = img.src;
        generatedBlobs = {};

        iconPreview.innerHTML = '';
        sizes.forEach(s => {
            const canvas = document.createElement('canvas');
            canvas.width = s.size;
            canvas.height = s.size;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, s.size, s.size);

            const div = document.createElement('div');
            div.className = 'icon-item';

            const displaySize = Math.min(s.size, 64);
            const preview = document.createElement('canvas');
            preview.width = displaySize;
            preview.height = displaySize;
            preview.style.width = displaySize + 'px';
            preview.style.height = displaySize + 'px';
            preview.getContext('2d').drawImage(canvas, 0, 0, displaySize, displaySize);

            const label = document.createElement('div');
            label.className = 'label';
            label.textContent = s.label;
            label.style.whiteSpace = 'pre-line';

            div.appendChild(preview);
            div.appendChild(label);
            iconPreview.appendChild(div);

            canvas.toBlob(blob => { generatedBlobs[s.name] = blob; }, 'image/png');
        });

        // HTML tags
        htmlTags.textContent = `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="msapplication-TileImage" content="/mstile-150x150.png">`;

        uploadArea.classList.add('d-none');
        resultArea.classList.remove('d-none');
        downloadZip.classList.remove('d-none');
        downloadIco.classList.remove('d-none');
    }

    function loadImage(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = () => generateIcons(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // File input
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function () {
        if (this.files[0]) loadImage(this.files[0]);
    });
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.add('drop-active'); }));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.remove('drop-active'); }));
    dropZone.addEventListener('drop', function (e) {
        if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
    });

    // Download individual PNGs via ZIP (using simple concatenation)
    downloadZip.addEventListener('click', async function () {
        // Simple approach: download each file individually if no JSZip
        // Try loading JSZip dynamically
        if (!window.JSZip) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
            script.onload = () => createZip();
            document.head.appendChild(script);
        } else {
            createZip();
        }
    });

    async function createZip() {
        const zip = new JSZip();
        for (const [name, blob] of Object.entries(generatedBlobs)) {
            if (blob) zip.file(name, blob);
        }
        // Add webmanifest
        zip.file('site.webmanifest', JSON.stringify({
            name: "", short_name: "", icons: [
                { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
                { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
            ], theme_color: "#ffffff", background_color: "#ffffff", display: "standalone"
        }, null, 2));

        const content = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.download = 'favicons.zip';
        a.href = URL.createObjectURL(content);
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // Download ICO (simplified - just 16 + 32 as PNG in ICO container)
    downloadIco.addEventListener('click', function () {
        // Create simple ICO with 32x32 PNG
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        canvas.getContext('2d').drawImage(sourceImg, 0, 0, 32, 32);
        canvas.toBlob(function (blob) {
            const a = document.createElement('a');
            a.download = 'favicon.ico';
            a.href = URL.createObjectURL(blob);
            a.click();
            URL.revokeObjectURL(a.href);
        }, 'image/png');
    });

    // Copy HTML
    document.getElementById('copyHtml').addEventListener('click', function () {
        navigator.clipboard.writeText(htmlTags.textContent).then(() => {
            this.innerHTML = '<i class="bi bi-check-lg text-success"></i> Copied!';
            setTimeout(() => { this.innerHTML = '<i class="bi bi-clipboard"></i> Copy HTML'; }, 1500);
        });
    });
});
