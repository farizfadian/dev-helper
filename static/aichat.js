// ── AI Chat — Ollama Chat Interface ──
document.addEventListener('DOMContentLoaded', function () {
    // ── Constants & Keys ──
    const OLLAMA_KEY = 'devhelper_ollama_url';
    const CONVS_KEY = 'devhelper_aichat_convs';
    const SETTINGS_KEY = 'devhelper_aichat_settings';
    const DEFAULT_URL = 'http://localhost:11434';
    const MAX_IMAGES = 4;

    // ── DOM Elements ──
    const modelSelect = document.getElementById('modelSelect');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const convList = document.getElementById('convList');
    const emptyState = document.getElementById('emptyState');
    const settingsBtn = document.getElementById('settingsBtn');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const statusModel = document.getElementById('statusModel');
    const statusUrl = document.getElementById('statusUrl');
    const tokenInfo = document.getElementById('tokenInfo');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const chatSidebar = document.getElementById('chatSidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const attachBtn = document.getElementById('attachBtn');
    const imgFileInput = document.getElementById('imgFileInput');
    const attachPreview = document.getElementById('attachPreview');
    const imgUrlBtn = document.getElementById('imgUrlBtn');
    const imgUrlOverlay = document.getElementById('imgUrlOverlay');
    const imgUrlInput = document.getElementById('imgUrlInput');
    const imgUrlCancel = document.getElementById('imgUrlCancel');
    const imgUrlAdd = document.getElementById('imgUrlAdd');
    const chatMain = document.querySelector('.aichat-main');

    // ── State ──
    let conversations = [];
    let currentConvId = null;
    let isStreaming = false;
    let abortController = null;
    let ollamaConnected = false;
    let pendingImages = []; // {dataUri, base64}
    let currentTTSElement = null; // track currently playing TTS button
    let currentUtterance = null;
    let ttsRate = 1.0; // speed: 0.5 - 2.0

    // ── Settings ──
    function getSettings() {
        try {
            const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            return {
                model: s.model || '',
                systemPrompt: s.systemPrompt || '',
                temperature: s.temperature !== undefined ? s.temperature : 0.7,
                maxHistory: s.maxHistory !== undefined ? s.maxHistory : 20,
                language: s.language || 'en-US',
            };
        } catch { return { model: '', systemPrompt: '', temperature: 0.7, maxHistory: 20, language: 'en-US' }; }
    }

    function saveSettings(s) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }

    function getOllamaUrl() {
        return localStorage.getItem(OLLAMA_KEY) || DEFAULT_URL;
    }

    // ── Conversations ──
    function loadConversations() {
        try {
            conversations = JSON.parse(localStorage.getItem(CONVS_KEY) || '[]');
        } catch { conversations = []; }
    }

    function saveConversations() {
        localStorage.setItem(CONVS_KEY, JSON.stringify(conversations));
    }

    function getConversation(id) {
        return conversations.find(c => c.id === id);
    }

    function createConversation() {
        const conv = {
            id: 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            title: 'New Chat',
            messages: [],
            model: modelSelect.value || '',
            createdAt: new Date().toISOString(),
        };
        conversations.unshift(conv);
        saveConversations();
        return conv;
    }

    function deleteConversation(id) {
        conversations = conversations.filter(c => c.id !== id);
        saveConversations();
        if (currentConvId === id) {
            currentConvId = null;
            renderChat();
        }
        renderConvList();
    }

    function updateConvTitle(conv) {
        // Use first user message as title
        const firstUser = conv.messages.find(m => m.role === 'user');
        if (firstUser) {
            conv.title = firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? '...' : '');
        }
    }

    // ── Image helpers ──
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function createThumbnail(dataUri, maxSize) {
        maxSize = maxSize || 400;
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxSize || h > maxSize) {
                    if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                    else { w = Math.round(w * maxSize / h); h = maxSize; }
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = dataUri;
        });
    }

    function stripBase64Prefix(dataUri) {
        // Remove "data:image/...;base64," prefix — Ollama wants raw base64
        const idx = dataUri.indexOf(',');
        return idx >= 0 ? dataUri.slice(idx + 1) : dataUri;
    }

    async function addImageFromFile(file) {
        if (!file.type.match(/^image\/(jpeg|png)$/)) {
            showToast('Only JPEG/PNG images are supported');
            return;
        }
        if (pendingImages.length >= MAX_IMAGES) {
            showToast('Max ' + MAX_IMAGES + ' images per message');
            return;
        }
        const dataUri = await fileToBase64(file);
        const base64 = stripBase64Prefix(dataUri);
        pendingImages.push({ dataUri, base64 });
        renderAttachPreview();
    }

    async function addImageFromUrl(url) {
        try {
            showToast('Fetching image...');
            const resp = await fetch('/api/proxy?url=' + encodeURIComponent(url));
            if (!resp.ok) throw new Error('Failed to fetch');
            const blob = await resp.blob();
            if (!blob.type.match(/^image\/(jpeg|png)/)) {
                showToast('URL is not a JPEG/PNG image');
                return;
            }
            const file = new File([blob], 'image.jpg', { type: blob.type });
            await addImageFromFile(file);
        } catch (err) {
            showToast('Failed to load image: ' + err.message);
        }
    }

    function renderAttachPreview() {
        attachPreview.innerHTML = '';
        pendingImages.forEach((img, i) => {
            const thumb = document.createElement('div');
            thumb.className = 'aichat-attach-thumb';
            thumb.innerHTML =
                '<img src="' + img.dataUri + '" alt="Attached">' +
                '<button class="remove-img" data-idx="' + i + '" title="Remove">&times;</button>';
            thumb.querySelector('.remove-img').addEventListener('click', () => {
                pendingImages.splice(i, 1);
                renderAttachPreview();
            });
            attachPreview.appendChild(thumb);
        });
    }

    // ── Attach button (file picker) ──
    attachBtn.addEventListener('click', () => {
        imgFileInput.click();
    });

    imgFileInput.addEventListener('change', async () => {
        const files = Array.from(imgFileInput.files);
        for (const f of files) {
            await addImageFromFile(f);
        }
        imgFileInput.value = '';
    });

    // ── Paste images (Ctrl+V) ──
    chatInput.addEventListener('paste', async (e) => {
        const items = Array.from(e.clipboardData.items);
        for (const item of items) {
            if (item.type.match(/^image\/(jpeg|png)$/)) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) await addImageFromFile(file);
            }
        }
    });

    // ── Drag & drop images ──
    chatMain.addEventListener('dragover', (e) => {
        e.preventDefault();
        chatMain.classList.add('drag-over');
    });
    chatMain.addEventListener('dragleave', (e) => {
        e.preventDefault();
        chatMain.classList.remove('drag-over');
    });
    chatMain.addEventListener('drop', async (e) => {
        e.preventDefault();
        chatMain.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        for (const f of files) {
            if (f.type.match(/^image\/(jpeg|png)$/)) {
                await addImageFromFile(f);
            }
        }
    });

    // ── Image URL overlay ──
    imgUrlBtn.addEventListener('click', () => {
        imgUrlInput.value = '';
        imgUrlOverlay.classList.add('show');
        imgUrlInput.focus();
    });
    imgUrlCancel.addEventListener('click', () => {
        imgUrlOverlay.classList.remove('show');
    });
    imgUrlOverlay.addEventListener('click', (e) => {
        if (e.target === imgUrlOverlay) imgUrlOverlay.classList.remove('show');
    });
    imgUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); imgUrlAdd.click(); }
        if (e.key === 'Escape') imgUrlOverlay.classList.remove('show');
    });
    imgUrlAdd.addEventListener('click', async () => {
        const url = imgUrlInput.value.trim();
        if (!url) return;
        imgUrlOverlay.classList.remove('show');
        await addImageFromUrl(url);
    });

    // ── TTS (Text-to-Speech) ──
    function stripMarkdownForTTS(text) {
        if (!text) return '';
        return text
            // Remove code blocks
            .replace(/```[\s\S]*?```/g, ' code block ')
            // Remove inline code
            .replace(/`([^`]+)`/g, '$1')
            // Remove images
            .replace(/!\[.*?\]\(.*?\)/g, '')
            // Convert links to just text
            .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
            // Remove headers markers
            .replace(/^#{1,6}\s+/gm, '')
            // Remove bold/italic
            .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            // Remove strikethrough
            .replace(/~~(.*?)~~/g, '$1')
            // Remove blockquotes
            .replace(/^>\s+/gm, '')
            // Remove horizontal rules
            .replace(/^---+$/gm, '')
            // Remove list markers
            .replace(/^[\s]*[-*+]\s+/gm, '')
            .replace(/^[\s]*\d+\.\s+/gm, '')
            // Remove HTML tags
            .replace(/<[^>]+>/g, '')
            // Collapse whitespace
            .replace(/\n{2,}/g, '. ')
            .replace(/\n/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    function stopCurrentTTS() {
        if (speechSynthesis.speaking || speechSynthesis.pending) {
            speechSynthesis.cancel();
        }
        if (currentTTSElement) {
            // Remove speed controls next to the button
            const actions = currentTTSElement.closest('.aichat-msg-actions');
            if (actions) {
                const speedCtrl = actions.querySelector('.tts-speed-controls');
                if (speedCtrl) speedCtrl.remove();
            }
            currentTTSElement.innerHTML = '<i class="bi bi-volume-up"></i> Listen';
            currentTTSElement.classList.remove('playing');
            currentTTSElement = null;
        }
        currentUtterance = null;
    }

    function updateSpeedLabel() {
        const label = document.querySelector('.tts-speed-label');
        if (label) label.textContent = ttsRate.toFixed(1) + 'x';
    }

    function createSpeedControls(btn, content) {
        const actions = btn.closest('.aichat-msg-actions');
        // Remove existing speed controls if any
        const existing = actions.querySelector('.tts-speed-controls');
        if (existing) existing.remove();

        const controls = document.createElement('span');
        controls.className = 'tts-speed-controls';
        controls.innerHTML =
            '<button class="tts-slower" title="Slower (−0.25)"><i class="bi bi-dash"></i></button>' +
            '<span class="tts-speed-label">' + ttsRate.toFixed(1) + 'x</span>' +
            '<button class="tts-faster" title="Faster (+0.25)"><i class="bi bi-plus"></i></button>';

        controls.querySelector('.tts-slower').addEventListener('click', (e) => {
            e.stopPropagation();
            if (ttsRate <= 0.5) return;
            ttsRate = Math.round((ttsRate - 0.25) * 100) / 100;
            updateSpeedLabel();
            // Restart with new speed
            restartTTS(btn, content);
        });
        controls.querySelector('.tts-faster').addEventListener('click', (e) => {
            e.stopPropagation();
            if (ttsRate >= 3.0) return;
            ttsRate = Math.round((ttsRate + 0.25) * 100) / 100;
            updateSpeedLabel();
            // Restart with new speed
            restartTTS(btn, content);
        });

        // Insert after listen button
        btn.after(controls);
    }

    function restartTTS(btn, content) {
        // Cancel current, re-speak with new rate
        speechSynthesis.cancel();
        const plainText = stripMarkdownForTTS(content);
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.lang = getSettings().language;
        utterance.rate = ttsRate;
        currentUtterance = utterance;

        utterance.onend = () => {
            stopCurrentTTS();
        };
        utterance.onerror = () => {
            stopCurrentTTS();
        };

        speechSynthesis.speak(utterance);
    }

    function setupListenButton(btn, content) {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('playing')) {
                // Stop
                stopCurrentTTS();
                return;
            }

            // Stop any previous TTS
            stopCurrentTTS();

            const plainText = stripMarkdownForTTS(content);
            if (!plainText) {
                showToast('No text to read');
                return;
            }

            const utterance = new SpeechSynthesisUtterance(plainText);
            utterance.lang = getSettings().language;
            utterance.rate = ttsRate;
            currentUtterance = utterance;

            btn.innerHTML = '<i class="bi bi-stop-circle"></i> Stop';
            btn.classList.add('playing');
            currentTTSElement = btn;

            // Show speed controls
            createSpeedControls(btn, content);

            utterance.onend = () => {
                stopCurrentTTS();
            };
            utterance.onerror = () => {
                stopCurrentTTS();
            };

            speechSynthesis.speak(utterance);
        });
    }

    // ── Render conversation list ──
    function renderConvList() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today - 86400000);
        const weekAgo = new Date(today - 7 * 86400000);

        const groups = { today: [], yesterday: [], week: [], older: [] };

        conversations.forEach(conv => {
            const d = new Date(conv.createdAt);
            if (d >= today) groups.today.push(conv);
            else if (d >= yesterday) groups.yesterday.push(conv);
            else if (d >= weekAgo) groups.week.push(conv);
            else groups.older.push(conv);
        });

        let html = '';
        function addGroup(label, items) {
            if (items.length === 0) return;
            html += '<div class="aichat-conv-group-label">' + label + '</div>';
            items.forEach(conv => {
                const active = conv.id === currentConvId ? ' active' : '';
                html += '<div class="aichat-conv-item' + active + '" data-id="' + conv.id + '">' +
                    '<i class="bi bi-chat-left-text" style="flex-shrink:0;"></i>' +
                    '<span class="conv-title">' + escapeHtml(conv.title) + '</span>' +
                    '<button class="conv-delete" data-id="' + conv.id + '" title="Delete"><i class="bi bi-x"></i></button>' +
                    '</div>';
            });
        }

        addGroup('Today', groups.today);
        addGroup('Yesterday', groups.yesterday);
        addGroup('This Week', groups.week);
        addGroup('Older', groups.older);

        if (conversations.length === 0) {
            html = '<div class="text-center text-muted small p-3">No conversations yet</div>';
        }

        convList.innerHTML = html;

        // Click handlers
        convList.querySelectorAll('.aichat-conv-item').forEach(el => {
            el.addEventListener('click', function (e) {
                if (e.target.closest('.conv-delete')) return;
                currentConvId = this.dataset.id;
                renderConvList();
                renderChat();
                closeMobileSidebar();
            });
        });
        convList.querySelectorAll('.conv-delete').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteConversation(this.dataset.id);
            });
        });
    }

    // ── Render chat messages ──
    function renderChat() {
        const conv = getConversation(currentConvId);
        if (!conv || conv.messages.length === 0) {
            emptyState.style.display = '';
            chatMessages.querySelectorAll('.aichat-msg').forEach(el => el.remove());
            return;
        }

        emptyState.style.display = 'none';
        // Remove existing messages but keep emptyState
        chatMessages.querySelectorAll('.aichat-msg').forEach(el => el.remove());

        conv.messages.forEach((msg, idx) => {
            const el = createMessageElement(msg, idx);
            chatMessages.appendChild(el);
        });

        scrollToBottom();
    }

    function createMessageElement(msg, idx) {
        const div = document.createElement('div');
        div.className = 'aichat-msg ' + msg.role;
        div.dataset.idx = idx;

        const label = msg.role === 'user' ? 'You' : 'Assistant';
        const labelIcon = msg.role === 'user' ? '' : '<i class="bi bi-robot"></i> ';

        // Build thumbnails HTML for user messages with images
        let thumbnailsHtml = '';
        if (msg._thumbnails && msg._thumbnails.length > 0) {
            thumbnailsHtml = '<div class="aichat-msg-images">';
            msg._thumbnails.forEach(src => {
                thumbnailsHtml += '<img src="' + src + '" alt="Attached image">';
            });
            thumbnailsHtml += '</div>';
        }

        let bodyContent = '';
        if (msg.role === 'assistant') {
            bodyContent = renderMarkdown(msg.content);
        } else {
            bodyContent = thumbnailsHtml + escapeHtml(msg.content).replace(/\n/g, '<br>');
        }

        div.innerHTML =
            '<div class="aichat-msg-label">' + labelIcon + label + '</div>' +
            '<div class="aichat-msg-body">' + bodyContent + '</div>' +
            '<div class="aichat-msg-actions">' +
            '<button class="copy-msg-btn" title="Copy"><i class="bi bi-clipboard"></i> Copy</button>' +
            (msg.role === 'assistant' ? '<button class="copy-md-btn" title="Copy as Markdown"><i class="bi bi-markdown"></i> MD</button>' : '') +
            (msg.role === 'assistant' ? '<button class="listen-btn" title="Listen"><i class="bi bi-volume-up"></i> Listen</button>' : '') +
            '</div>';

        // Add copy button to code blocks
        div.querySelectorAll('pre').forEach(pre => {
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);

            const copyBtn = document.createElement('button');
            copyBtn.className = 'code-copy-btn';
            copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
            copyBtn.addEventListener('click', () => {
                const code = pre.querySelector('code');
                navigator.clipboard.writeText(code ? code.textContent : pre.textContent).then(() => {
                    copyBtn.innerHTML = '<i class="bi bi-check"></i> Copied';
                    setTimeout(() => { copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy'; }, 1500);
                });
            });
            wrapper.appendChild(copyBtn);
        });

        // Copy message button
        const copyMsgBtn = div.querySelector('.copy-msg-btn');
        if (copyMsgBtn) {
            copyMsgBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(msg.content).then(() => {
                    copyMsgBtn.innerHTML = '<i class="bi bi-check"></i> Copied';
                    setTimeout(() => { copyMsgBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy'; }, 1500);
                });
            });
        }

        // Copy as markdown
        const copyMdBtn = div.querySelector('.copy-md-btn');
        if (copyMdBtn) {
            copyMdBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(msg.content).then(() => {
                    copyMdBtn.innerHTML = '<i class="bi bi-check"></i> Copied';
                    setTimeout(() => { copyMdBtn.innerHTML = '<i class="bi bi-markdown"></i> MD'; }, 1500);
                });
            });
        }

        // Listen button (TTS)
        const listenBtn = div.querySelector('.listen-btn');
        if (listenBtn && msg.role === 'assistant') {
            setupListenButton(listenBtn, msg.content);
        }

        return div;
    }

    // ── Markdown rendering ──
    function renderMarkdown(text) {
        if (!text) return '';
        try {
            marked.setOptions({
                breaks: true,
                gfm: true,
                highlight: function (code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                },
            });
            return marked.parse(text);
        } catch {
            return escapeHtml(text).replace(/\n/g, '<br>');
        }
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ── Scroll ──
    function scrollToBottom() {
        requestAnimationFrame(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }

    // ── Model loading ──
    async function loadModels() {
        const ollamaUrl = getOllamaUrl();
        statusUrl.textContent = ollamaUrl;
        statusDot.className = 'status-dot checking';
        statusText.textContent = 'Checking connection...';

        try {
            const resp = await fetch('/api/aichat/models?url=' + encodeURIComponent(ollamaUrl));
            const data = await resp.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.models && data.models.length > 0) {
                modelSelect.innerHTML = '';
                const settings = getSettings();
                data.models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.name;
                    opt.textContent = m.name;
                    if (m.name === settings.model) opt.selected = true;
                    modelSelect.appendChild(opt);
                });

                // If no saved model matched, select first
                if (!settings.model || !data.models.some(m => m.name === settings.model)) {
                    modelSelect.selectedIndex = 0;
                }

                statusDot.className = 'status-dot connected';
                statusText.textContent = 'Connected';
                statusModel.textContent = modelSelect.value;
                ollamaConnected = true;

                // Fetch Ollama version
                fetch('/api/aichat/version?url=' + encodeURIComponent(ollamaUrl))
                    .then(r => r.json())
                    .then(v => {
                        if (v.version) {
                            document.getElementById('statusVersion').textContent = 'v' + v.version;
                        }
                    })
                    .catch(() => {});
            } else {
                modelSelect.innerHTML = '<option value="">No models found</option>';
                statusDot.className = 'status-dot disconnected';
                statusText.textContent = 'No models available';
                ollamaConnected = false;
            }
        } catch (err) {
            modelSelect.innerHTML = '<option value="">Connection failed</option>';
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'Disconnected — ' + err.message;
            ollamaConnected = false;
        }
    }

    modelSelect.addEventListener('change', () => {
        const s = getSettings();
        s.model = modelSelect.value;
        saveSettings(s);
        statusModel.textContent = modelSelect.value;
    });

    // ── Send message ──
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text && pendingImages.length === 0) return;
        if (!text) { showToast('Please type a message'); return; }
        if (isStreaming) return;

        if (!ollamaConnected) {
            showToast('Not connected to Ollama. Check settings.');
            return;
        }

        const model = modelSelect.value;
        if (!model) {
            showToast('No model selected');
            return;
        }

        // Get or create conversation
        let conv = getConversation(currentConvId);
        if (!conv) {
            conv = createConversation();
            currentConvId = conv.id;
        }
        conv.model = model;

        // Build user message with optional images
        const userMsg = { role: 'user', content: text };
        const currentImages = pendingImages.slice(); // snapshot

        if (currentImages.length > 0) {
            // images for Ollama API (raw base64, no prefix)
            userMsg.images = currentImages.map(img => img.base64);
            // Create thumbnails for localStorage display
            const thumbnails = [];
            for (const img of currentImages) {
                const thumb = await createThumbnail(img.dataUri);
                thumbnails.push(thumb);
            }
            userMsg._thumbnails = thumbnails;
        }

        // Add user message
        conv.messages.push(userMsg);
        updateConvTitle(conv);
        saveConversations();
        renderConvList();

        // Clear input & images
        chatInput.value = '';
        chatInput.style.height = 'auto';
        pendingImages = [];
        renderAttachPreview();

        // Render user message
        emptyState.style.display = 'none';
        const userEl = createMessageElement(conv.messages[conv.messages.length - 1], conv.messages.length - 1);
        chatMessages.appendChild(userEl);
        scrollToBottom();

        // Show typing indicator
        const typingEl = document.createElement('div');
        typingEl.className = 'aichat-msg assistant';
        typingEl.id = 'typingIndicator';
        typingEl.innerHTML =
            '<div class="aichat-msg-label"><i class="bi bi-robot"></i> Assistant</div>' +
            '<div class="aichat-msg-body"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
        chatMessages.appendChild(typingEl);
        scrollToBottom();

        // Start streaming
        isStreaming = true;
        sendBtn.classList.add('stop');
        sendBtn.innerHTML = '<i class="bi bi-stop-fill"></i>';
        sendBtn.title = 'Stop (Esc)';

        abortController = new AbortController();
        const settings = getSettings();

        // Build messages array for API
        let apiMessages = [];
        // Build system prompt with language hint
        const LANG_NAMES = { 'en-US': 'English', 'en-GB': 'English', 'id-ID': 'Bahasa Indonesia', 'ja-JP': 'Japanese', 'ko-KR': 'Korean', 'zh-CN': 'Chinese', 'zh-TW': 'Chinese', 'es-ES': 'Spanish', 'fr-FR': 'French', 'de-DE': 'German', 'pt-BR': 'Portuguese', 'ru-RU': 'Russian', 'ar-SA': 'Arabic', 'hi-IN': 'Hindi', 'th-TH': 'Thai', 'vi-VN': 'Vietnamese', 'nl-NL': 'Dutch', 'it-IT': 'Italian', 'tr-TR': 'Turkish', 'pl-PL': 'Polish' };
        let sysContent = '';
        if (settings.systemPrompt) sysContent += settings.systemPrompt;
        if (settings.language && settings.language !== 'en-US') {
            const langName = LANG_NAMES[settings.language] || settings.language;
            const langHint = 'Always respond in ' + langName + '.';
            sysContent += (sysContent ? '\n' : '') + langHint;
        }
        if (sysContent) {
            apiMessages.push({ role: 'system', content: sysContent });
        }
        // Apply max history
        let historyMsgs = conv.messages.slice(); // copy
        if (settings.maxHistory > 0 && historyMsgs.length > settings.maxHistory) {
            historyMsgs = historyMsgs.slice(-settings.maxHistory);
        }
        // Clean messages for API: strip _thumbnails, strip images from all but the last user message
        apiMessages = apiMessages.concat(historyMsgs.map((m, i) => {
            const cleaned = { role: m.role, content: m.content };
            // Only include images on the very last user message (current one)
            if (m.images && i === historyMsgs.length - 1) {
                cleaned.images = m.images;
            }
            return cleaned;
        }));

        let assistantContent = '';
        let startTime = Date.now();
        let tokenCount = 0;

        try {
            const resp = await fetch('/api/aichat/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ollamaUrl: getOllamaUrl(),
                    model: model,
                    messages: apiMessages,
                }),
                signal: abortController.signal,
            });

            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(errText || 'Server error ' + resp.status);
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            // Replace typing indicator with streaming message
            const streamEl = document.createElement('div');
            streamEl.className = 'aichat-msg assistant';
            streamEl.innerHTML =
                '<div class="aichat-msg-label"><i class="bi bi-robot"></i> Assistant</div>' +
                '<div class="aichat-msg-body" id="streamBody"></div>' +
                '<div class="aichat-msg-actions">' +
                '<button class="copy-msg-btn" title="Copy"><i class="bi bi-clipboard"></i> Copy</button>' +
                '<button class="copy-md-btn" title="Copy as Markdown"><i class="bi bi-markdown"></i> MD</button>' +
                '<button class="listen-btn" title="Listen"><i class="bi bi-volume-up"></i> Listen</button>' +
                '</div>';

            typingEl.replaceWith(streamEl);
            const streamBody = document.getElementById('streamBody');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.message && parsed.message.content) {
                            assistantContent += parsed.message.content;
                            tokenCount++;

                            // Render markdown progressively
                            streamBody.innerHTML = renderMarkdown(assistantContent);

                            // Add copy to code blocks
                            streamBody.querySelectorAll('pre:not([data-copy-added])').forEach(pre => {
                                pre.setAttribute('data-copy-added', 'true');
                                const wrapper = document.createElement('div');
                                wrapper.className = 'code-block-wrapper';
                                pre.parentNode.insertBefore(wrapper, pre);
                                wrapper.appendChild(pre);
                                const copyBtn = document.createElement('button');
                                copyBtn.className = 'code-copy-btn';
                                copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
                                copyBtn.addEventListener('click', () => {
                                    const code = pre.querySelector('code');
                                    navigator.clipboard.writeText(code ? code.textContent : pre.textContent).then(() => {
                                        copyBtn.innerHTML = '<i class="bi bi-check"></i> Copied';
                                        setTimeout(() => { copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy'; }, 1500);
                                    });
                                });
                                wrapper.appendChild(copyBtn);
                            });

                            scrollToBottom();
                        }

                        // Show token stats
                        if (parsed.done && parsed.total_duration) {
                            const durationSec = parsed.total_duration / 1e9;
                            const tokPerSec = tokenCount / durationSec;
                            tokenInfo.textContent = tokenCount + ' tokens · ' + tokPerSec.toFixed(1) + ' tok/s · ' + durationSec.toFixed(1) + 's';
                        }
                    } catch { /* skip malformed lines */ }
                }
            }

            // Save assistant message
            if (assistantContent) {
                conv.messages.push({ role: 'assistant', content: assistantContent });
                // Strip full-res images from the user message that was just sent (keep only thumbnails in localStorage)
                const lastUserIdx = conv.messages.length - 2; // the user message before this assistant reply
                if (lastUserIdx >= 0 && conv.messages[lastUserIdx].images) {
                    delete conv.messages[lastUserIdx].images;
                }
                saveConversations();

                // Wire up copy buttons on the stream element
                const finalCopyBtn = streamEl.querySelector('.copy-msg-btn');
                if (finalCopyBtn) {
                    finalCopyBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(assistantContent).then(() => {
                            finalCopyBtn.innerHTML = '<i class="bi bi-check"></i> Copied';
                            setTimeout(() => { finalCopyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy'; }, 1500);
                        });
                    });
                }
                const finalMdBtn = streamEl.querySelector('.copy-md-btn');
                if (finalMdBtn) {
                    finalMdBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(assistantContent).then(() => {
                            finalMdBtn.innerHTML = '<i class="bi bi-check"></i> Copied';
                            setTimeout(() => { finalMdBtn.innerHTML = '<i class="bi bi-markdown"></i> MD'; }, 1500);
                        });
                    });
                }
                // Wire up listen button on stream element
                const finalListenBtn = streamEl.querySelector('.listen-btn');
                if (finalListenBtn) {
                    setupListenButton(finalListenBtn, assistantContent);
                }
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                // User cancelled
                if (assistantContent) {
                    conv.messages.push({ role: 'assistant', content: assistantContent + '\n\n*[Generation stopped]*' });
                    saveConversations();
                }
            } else {
                // Show error
                const errEl = typingEl.id === 'typingIndicator' ? typingEl : null;
                if (errEl) errEl.remove();

                const errorDiv = document.createElement('div');
                errorDiv.className = 'aichat-msg assistant';
                errorDiv.innerHTML =
                    '<div class="aichat-msg-label"><i class="bi bi-robot"></i> Assistant</div>' +
                    '<div class="aichat-msg-body text-danger"><i class="bi bi-exclamation-triangle"></i> Error: ' + escapeHtml(err.message) + '</div>';
                chatMessages.appendChild(errorDiv);
                scrollToBottom();
            }
        } finally {
            isStreaming = false;
            abortController = null;
            sendBtn.classList.remove('stop');
            sendBtn.innerHTML = '<i class="bi bi-send-fill"></i>';
            sendBtn.title = 'Send (Enter)';

            // Remove typing indicator if still present
            const ti = document.getElementById('typingIndicator');
            if (ti) ti.remove();

            chatInput.focus();
        }
    }

    function stopStreaming() {
        if (abortController) {
            abortController.abort();
        }
    }

    // ── Event handlers ──

    // Send button
    sendBtn.addEventListener('click', () => {
        if (isStreaming) {
            stopStreaming();
        } else {
            sendMessage();
        }
    });

    // Textarea: Enter to send, Shift+Enter for newline, auto-resize
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isStreaming) return;
            sendMessage();
        }
        if (e.key === 'Escape' && isStreaming) {
            stopStreaming();
        }
    });

    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
    });

    // New chat
    newChatBtn.addEventListener('click', () => {
        currentConvId = null;
        pendingImages = [];
        renderAttachPreview();
        renderChat();
        renderConvList();
        chatInput.focus();
        closeMobileSidebar();
    });

    // Clear current chat
    clearChatBtn.addEventListener('click', () => {
        const conv = getConversation(currentConvId);
        if (conv) {
            if (!confirm('Delete this conversation?')) return;
            deleteConversation(conv.id);
        }
    });

    // Settings
    settingsBtn.addEventListener('click', () => {
        const s = getSettings();
        document.getElementById('settingsOllamaUrl').value = getOllamaUrl();
        document.getElementById('settingsSystemPrompt').value = s.systemPrompt;
        document.getElementById('settingsTemperature').value = s.temperature;
        document.getElementById('tempValue').textContent = s.temperature;
        document.getElementById('settingsMaxHistory').value = s.maxHistory;
        document.getElementById('settingsLanguage').value = s.language;
        new bootstrap.Modal(document.getElementById('settingsModal')).show();
    });

    document.getElementById('settingsTemperature').addEventListener('input', function () {
        document.getElementById('tempValue').textContent = this.value;
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        const newUrl = document.getElementById('settingsOllamaUrl').value.trim() || DEFAULT_URL;
        localStorage.setItem(OLLAMA_KEY, newUrl);

        const s = getSettings();
        s.systemPrompt = document.getElementById('settingsSystemPrompt').value;
        s.temperature = parseFloat(document.getElementById('settingsTemperature').value);
        s.maxHistory = parseInt(document.getElementById('settingsMaxHistory').value);
        s.language = document.getElementById('settingsLanguage').value;
        saveSettings(s);

        bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
        showToast('Settings saved');
        loadModels();
    });

    // Mobile sidebar
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            chatSidebar.classList.toggle('show');
            sidebarBackdrop.classList.toggle('show');
        });
    }
    sidebarBackdrop.addEventListener('click', closeMobileSidebar);

    function closeMobileSidebar() {
        chatSidebar.classList.remove('show');
        sidebarBackdrop.classList.remove('show');
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isStreaming) {
            stopStreaming();
        }
    });

    // ── Highlight.js dark mode ──
    function updateHljsTheme() {
        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        document.querySelectorAll('link[href*="highlightjs"]').forEach(link => {
            if (link.href.includes('github-dark')) {
                link.media = isDark ? 'all' : '(prefers-color-scheme: dark)';
            } else if (link.href.includes('github.min.css')) {
                link.media = isDark ? '(prefers-color-scheme: dark)' : 'all';
            }
        });
    }
    window.addEventListener('devhelper-theme', updateHljsTheme);
    updateHljsTheme();

    // ── Toast ──
    function showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-dark py-2 px-3 small shadow-sm';
        toast.style.zIndex = '9999';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    }

    // ── Init ──
    loadConversations();
    renderConvList();
    renderChat();
    loadModels();
    chatInput.focus();
});
