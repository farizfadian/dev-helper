document.addEventListener('DOMContentLoaded', function () {
    const STORAGE_KEY = 'devhelper_chat_username';
    const SOUND_KEY = 'devhelper_chat_sound';

    // DOM elements
    const usernameModal = new bootstrap.Modal(document.getElementById('usernameModal'));
    const usernameInput = document.getElementById('usernameInput');
    const avatarPreview = document.getElementById('avatarPreview');
    const joinBtn = document.getElementById('joinBtn');
    const chatUI = document.getElementById('chatUI');
    const chatMessages = document.getElementById('chatMessages');
    const msgInput = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendBtn');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const usersList = document.getElementById('usersList');
    const onlineCount = document.getElementById('onlineCount');
    const leaveBtn = document.getElementById('leaveBtn');
    const soundToggle = document.getElementById('soundToggle');
    const scrollFab = document.getElementById('scrollFab');
    const unreadBadge = document.getElementById('unreadBadge');

    // New DOM elements
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiBackdrop = document.getElementById('emojiBackdrop');
    const emojiSearch = document.getElementById('emojiSearch');
    const emojiGrid = document.getElementById('emojiGrid');
    const emojiCats = document.getElementById('emojiCats');
    const uploadPreview = document.getElementById('uploadPreview');
    const uploadThumb = document.getElementById('uploadThumb');
    const uploadFileIcon = document.getElementById('uploadFileIcon');
    const uploadFileName = document.getElementById('uploadFileName');
    const uploadCancel = document.getElementById('uploadCancel');
    const dragOverlay = document.getElementById('dragOverlay');
    const chatContainer = document.querySelector('.chat-container');
    const lightboxModal = new bootstrap.Modal(document.getElementById('chatLightbox'));
    const lightboxImg = document.getElementById('lightboxImg');

    let currentUser = '';
    let eventSource = null;
    let soundEnabled = localStorage.getItem(SOUND_KEY) !== 'false';
    let unreadCount = 0;
    let isNearBottom = true;
    let lastDateStr = '';
    let audioCtx = null;
    let originalTitle = document.title;

    // Pending file attachment
    let pendingFile = null; // { url, name, isImage }

    // ── Avatar color ──
    function getAvatarColor(name) {
        const colors = [
            '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
            '#009688', '#4caf50', '#ff9800', '#ff5722', '#795548',
            '#607d8b', '#f44336', '#00bcd4', '#8bc34a', '#cddc39'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    function getInitials(name) {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    }

    // ── Sound ──
    function playBeep() {
        if (!soundEnabled) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 800;
            osc.type = 'sine';
            gain.gain.value = 0.1;
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.3);
        } catch (e) { /* ignore */ }
    }

    function updateSoundIcon() {
        const icon = soundToggle.querySelector('i');
        icon.className = soundEnabled ? 'bi bi-volume-up-fill' : 'bi bi-volume-mute-fill';
        soundToggle.title = soundEnabled ? 'Sound on' : 'Sound off';
    }

    soundToggle.addEventListener('click', function () {
        soundEnabled = !soundEnabled;
        localStorage.setItem(SOUND_KEY, soundEnabled);
        updateSoundIcon();
    });
    updateSoundIcon();

    // ── XSS protection ──
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function linkify(text) {
        return text.replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    }

    // ── Auto-replace emoji shortcuts ──
    var emojiShortcuts = [
        // Order matters: longer patterns first to avoid partial matches
        { pattern: '<333', emoji: '💕' },
        { pattern: ":'(", emoji: '😭' },
        { pattern: '>:(', emoji: '😡' },
        { pattern: '<3', emoji: '❤️' },
        { pattern: ':)', emoji: '😊' },
        { pattern: ':(', emoji: '😢' },
        { pattern: ':D', emoji: '😁' },
        { pattern: ';)', emoji: '😉' },
        { pattern: ':P', emoji: '😛' },
        { pattern: ':O', emoji: '😮' },
        { pattern: ':/', emoji: '😕' },
        { pattern: 'XD', emoji: '😆' },
        { pattern: ':*', emoji: '😘' },
        { pattern: 'B)', emoji: '😎' },
        { pattern: ':3', emoji: '😺' },
        { pattern: 'o/', emoji: '👋' },
        { pattern: '(y)', emoji: '👍' },
        { pattern: '(n)', emoji: '👎' }
    ];

    function applyEmojiShortcuts(text) {
        emojiShortcuts.forEach(function (s) {
            // Escape special regex chars in the pattern
            var escaped = s.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Boundary-aware: start of string or whitespace before, end of string or whitespace after
            var re = new RegExp('(^|\\s)' + escaped + '(\\s|$)', 'g');
            text = text.replace(re, function (match, before, after) {
                return before + s.emoji + after;
            });
        });
        return text;
    }

    // ── Desktop notifications ──
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function showNotification(title, body) {
        if (!document.hidden) return;
        if ('Notification' in window && Notification.permission === 'granted') {
            const n = new Notification(title, { body: body, icon: '/static/icons/claude.png', tag: 'devhelper-chat' });
            n.onclick = function () { window.focus(); n.close(); };
            setTimeout(function () { n.close(); }, 5000);
        }
    }

    // ── Scroll management ──
    function checkNearBottom() {
        const threshold = 100;
        isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < threshold;
        scrollFab.classList.toggle('show', !isNearBottom);
        if (isNearBottom) {
            unreadCount = 0;
            unreadBadge.style.display = 'none';
            document.title = originalTitle;
        }
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        unreadCount = 0;
        unreadBadge.style.display = 'none';
        document.title = originalTitle;
        scrollFab.classList.remove('show');
    }

    chatMessages.addEventListener('scroll', checkNearBottom);
    scrollFab.addEventListener('click', scrollToBottom);

    // ── Date separator ──
    function getDateLabel(timestamp) {
        const d = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function maybeAddDateSep(timestamp) {
        const dateStr = new Date(timestamp).toDateString();
        if (dateStr !== lastDateStr) {
            lastDateStr = dateStr;
            const sep = document.createElement('div');
            sep.className = 'chat-date-sep';
            sep.innerHTML = '<span>' + getDateLabel(timestamp) + '</span>';
            chatMessages.appendChild(sep);
        }
    }

    // ── Image lightbox ──
    const lightboxDownload = document.getElementById('lightboxDownload');

    function openLightbox(url) {
        lightboxImg.src = url;
        lightboxDownload.href = url;
        // Extract filename from URL for download attribute
        var parts = url.split('/');
        lightboxDownload.download = parts[parts.length - 1] || 'image';
        lightboxModal.show();
    }

    // ── Render message ──
    function renderMessage(msg) {
        if (msg.type === 'system') {
            maybeAddDateSep(msg.timestamp);
            const div = document.createElement('div');
            div.className = 'chat-msg system';
            div.innerHTML = '<div class="chat-system-msg"><i class="bi bi-info-circle"></i> ' + escapeHtml(msg.message) + '</div>';
            chatMessages.appendChild(div);
        } else if (msg.type === 'user') {
            maybeAddDateSep(msg.timestamp);
            const isOwn = msg.username === currentUser;
            const div = document.createElement('div');
            div.className = 'chat-msg' + (isOwn ? ' own' : '');

            const color = getAvatarColor(msg.username);
            const initials = getInitials(msg.username);
            const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            // Build message content
            var contentHtml = '';
            if (msg.message) {
                var escapedMsg = linkify(escapeHtml(msg.message)).replace(/\n/g, '<br>');
                contentHtml += '<div>' + escapedMsg + '</div>';
            }

            // File attachment
            if (msg.fileUrl) {
                if (msg.fileIsImage) {
                    contentHtml += '<img class="chat-img-thumb" src="' + escapeHtml(msg.fileUrl) + '" alt="' + escapeHtml(msg.fileName || 'image') + '" loading="lazy">';
                } else {
                    contentHtml += '<a class="chat-file-card" href="' + escapeHtml(msg.fileUrl) + '" target="_blank" download>' +
                        '<i class="bi bi-file-earmark-arrow-down"></i>' +
                        '<span class="chat-file-name">' + escapeHtml(msg.fileName || 'file') + '</span>' +
                        '<i class="bi bi-download" style="font-size:0.85rem;opacity:0.6;"></i>' +
                        '</a>';
                }
            }

            div.innerHTML =
                '<div class="chat-avatar chat-avatar-sm" style="background:' + color + ';">' + initials + '</div>' +
                '<div class="chat-bubble">' +
                    '<div class="chat-bubble-sender" style="color:' + color + ';">' + escapeHtml(msg.username) + '</div>' +
                    contentHtml +
                    '<div class="chat-bubble-time">' + time + '</div>' +
                '</div>';

            // Attach lightbox click handler for images
            if (msg.fileUrl && msg.fileIsImage) {
                var thumb = div.querySelector('.chat-img-thumb');
                if (thumb) {
                    thumb.addEventListener('click', function () {
                        openLightbox(this.src);
                    });
                }
            }

            chatMessages.appendChild(div);

            // Notifications for others' messages
            if (!isOwn) {
                playBeep();
                showNotification(msg.username, msg.message ? msg.message.slice(0, 100) : (msg.fileName || 'sent a file'));
                if (!isNearBottom) {
                    unreadCount++;
                    unreadBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    unreadBadge.style.display = 'flex';
                }
                if (document.hidden) {
                    document.title = '(' + (unreadCount || 1) + ') ' + originalTitle;
                }
            }
        }

        if (isNearBottom) {
            scrollToBottom();
        }
    }

    // ── Online users ──
    function renderOnlineUsers(users) {
        onlineCount.textContent = users.length;
        usersList.innerHTML = '';
        users.sort(function (a, b) {
            if (a === currentUser) return -1;
            if (b === currentUser) return 1;
            return a.localeCompare(b);
        });
        users.forEach(function (u) {
            const color = getAvatarColor(u);
            const initials = getInitials(u);
            const isYou = u === currentUser;
            const div = document.createElement('div');
            div.className = 'chat-user-item';
            div.innerHTML =
                '<div class="chat-avatar chat-avatar-sm" style="background:' + color + ';">' + initials + '</div>' +
                '<span>' + escapeHtml(u) + (isYou ? ' <span class="badge bg-primary" style="font-size:0.6rem;">You</span>' : '') + '</span>';
            usersList.appendChild(div);
        });
    }

    // ── SSE Connection ──
    function connect() {
        if (eventSource) {
            eventSource.close();
        }

        // Clear messages for fresh start (history will be re-sent)
        chatMessages.innerHTML = '';
        lastDateStr = '';
        unreadCount = 0;
        unreadBadge.style.display = 'none';
        document.title = originalTitle;

        setStatus('connecting');
        eventSource = new EventSource('/api/chat/stream?username=' + encodeURIComponent(currentUser));

        eventSource.addEventListener('message', function (e) {
            try {
                var msg = JSON.parse(e.data);
                renderMessage(msg);
            } catch (err) { /* ignore */ }
        });

        eventSource.addEventListener('online', function (e) {
            try {
                var users = JSON.parse(e.data);
                renderOnlineUsers(users);
            } catch (err) { /* ignore */ }
        });

        eventSource.addEventListener('open', function () {
            setStatus('connected');
            msgInput.disabled = false;
            sendBtn.disabled = false;
            msgInput.focus();
        });

        eventSource.addEventListener('error', function () {
            setStatus('disconnected');
            msgInput.disabled = true;
            sendBtn.disabled = true;
            // EventSource auto-reconnects
        });
    }

    function setStatus(state) {
        statusDot.className = 'chat-status-dot ' + state;
        var labels = { connected: 'Connected', connecting: 'Connecting...', disconnected: 'Reconnecting...' };
        statusText.textContent = labels[state] || state;
    }

    // ── File upload ──
    function isImageFile(name) {
        return /\.(jpe?g|png|gif|webp|svg|bmp|ico|avif)$/i.test(name);
    }

    function uploadFile(file) {
        var formData = new FormData();
        formData.append('file', file);

        attachBtn.disabled = true;
        uploadPreview.style.display = 'flex';
        uploadFileName.textContent = 'Uploading ' + file.name + '...';
        uploadThumb.style.display = 'none';
        uploadFileIcon.style.display = 'none';

        fetch('/api/upload', { method: 'POST', body: formData })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.url) {
                    var isImg = isImageFile(file.name);
                    pendingFile = { url: data.url, name: file.name, isImage: isImg };
                    uploadFileName.textContent = file.name;

                    if (isImg) {
                        uploadThumb.src = data.url;
                        uploadThumb.style.display = 'block';
                        uploadFileIcon.style.display = 'none';
                    } else {
                        uploadThumb.style.display = 'none';
                        uploadFileIcon.style.display = 'inline';
                    }
                    msgInput.focus();
                } else {
                    clearPendingFile();
                }
            })
            .catch(function () {
                clearPendingFile();
            })
            .finally(function () {
                attachBtn.disabled = false;
            });
    }

    function clearPendingFile() {
        pendingFile = null;
        uploadPreview.style.display = 'none';
        uploadThumb.src = '';
        uploadFileName.textContent = '';
        fileInput.value = '';
    }

    // Attach button click
    attachBtn.addEventListener('click', function () {
        fileInput.click();
    });

    fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) {
            uploadFile(fileInput.files[0]);
        }
    });

    uploadCancel.addEventListener('click', function () {
        clearPendingFile();
    });

    // Drag & drop on chat container
    var dragCounter = 0;

    chatContainer.addEventListener('dragenter', function (e) {
        e.preventDefault();
        dragCounter++;
        dragOverlay.classList.add('show');
    });

    chatContainer.addEventListener('dragleave', function (e) {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            dragOverlay.classList.remove('show');
        }
    });

    chatContainer.addEventListener('dragover', function (e) {
        e.preventDefault();
    });

    chatContainer.addEventListener('drop', function (e) {
        e.preventDefault();
        dragCounter = 0;
        dragOverlay.classList.remove('show');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            uploadFile(e.dataTransfer.files[0]);
        }
    });

    // Paste image (Ctrl+V)
    msgInput.addEventListener('paste', function (e) {
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (var i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image/') === 0) {
                e.preventDefault();
                var blob = items[i].getAsFile();
                if (blob) {
                    // Give a name based on timestamp
                    var ext = blob.type.split('/')[1] || 'png';
                    if (ext === 'jpeg') ext = 'jpg';
                    var fileName = 'paste-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.' + ext;
                    var file = new File([blob], fileName, { type: blob.type });
                    uploadFile(file);
                }
                return;
            }
        }
    });

    // Keyboard shortcut: Ctrl+U for attach
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'u' && !e.shiftKey) {
            // Only if chat UI is visible and not in modal
            if (chatUI.style.display !== 'none') {
                e.preventDefault();
                fileInput.click();
            }
        }
    });

    // ── Send message ──
    function sendMessage() {
        var text = msgInput.value.trim();
        if (!text && !pendingFile) return;

        // Apply emoji shortcuts to text
        if (text) {
            text = applyEmojiShortcuts(text);
        }

        var payload = { username: currentUser, message: text };
        if (pendingFile) {
            payload.fileUrl = pendingFile.url;
            payload.fileName = pendingFile.name;
            payload.fileIsImage = pendingFile.isImage;
        }

        sendBtn.disabled = true;
        fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (r) {
            if (r.ok) {
                msgInput.value = '';
                msgInput.style.height = 'auto';
                clearPendingFile();
                msgInput.focus();
            }
        }).catch(function () { /* ignore */ })
        .finally(function () {
            sendBtn.disabled = false;
        });
    }

    sendBtn.addEventListener('click', sendMessage);

    // Enter to send, Shift+Enter for newline
    msgInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    msgInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // ── Emoji Picker ──
    var emojiData = [
        { cat: 'Smileys', icon: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
        { cat: 'Gestures', icon: '🤚', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄'] },
        { cat: 'Animals', icon: '🐶', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘'] },
        { cat: 'Food', icon: '🍔', emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯'] },
        { cat: 'Activities', icon: '⚽', emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🕹️','🎰'] },
        { cat: 'Objects', icon: '💡', emojis: ['💡','🔦','🕯️','🧯','💻','🖥️','🖨️','⌨️','🖱️','🖲️','💾','💿','📀','📱','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','📡','🔋','🔌','🪫','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🧴','🛎️','🔑','🗝️','🚪','🪑','🛋️','🛏️','🛌','🧸','🪆','🖼️','🪞','🪟','🛍️','🛒','🎁','🎈','🎏','🎀','🪄','🪅','🎊','🎉','🎎','🏮','🎐','🧧','✉️','📩','📨','📧','💌','📥','📤','📦','🏷️','🪧','📪','📫','📬','📭','📮','📯','📜','📃','📄','📑','🧾','📊','📈','📉','🗒️','🗓️','📆','📅','🗑️','📇','🗃️','🗳️','🗄️','📋','📁','📂','🗂️','🗞️','📰','📓','📔','📒','📕','📗','📘','📙','📚','📖','🔖','🧷','🔗','📎','🖇️','📐','📏','🧮','📌','📍','✂️','🖊️','🖋️','✒️','🖌️','🖍️','📝','✏️','🔍','🔎','🔏','🔐','🔒','🔓'] },
        { cat: 'Hearts', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','💑','💏','❤️‍🔥','❤️‍🩹','💋','💐','🌹','🥀','🌷','🌺','🌸','🌼','🌻'] }
    ];

    var activeCat = 0;

    function buildEmojiPicker() {
        // Category tabs
        emojiCats.innerHTML = '';
        emojiData.forEach(function (cat, idx) {
            var btn = document.createElement('button');
            btn.className = 'emoji-cat-btn' + (idx === 0 ? ' active' : '');
            btn.textContent = cat.icon;
            btn.title = cat.cat;
            btn.addEventListener('click', function () {
                activeCat = idx;
                emojiCats.querySelectorAll('.emoji-cat-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                renderEmojiGrid('');
                emojiSearch.value = '';
            });
            emojiCats.appendChild(btn);
        });
        renderEmojiGrid('');
    }

    function renderEmojiGrid(query) {
        emojiGrid.innerHTML = '';
        var q = query.toLowerCase().trim();

        if (q) {
            // Search across all categories
            var label = document.createElement('div');
            label.className = 'emoji-cat-label';
            label.textContent = 'Search results';
            emojiGrid.appendChild(label);

            var row = document.createElement('div');
            row.className = 'emoji-grid-row';
            var found = 0;
            emojiData.forEach(function (cat) {
                cat.emojis.forEach(function (em) {
                    // Simple search: match emoji itself or category name
                    if (em.includes(q) || cat.cat.toLowerCase().includes(q)) {
                        var btn = createEmojiBtn(em);
                        row.appendChild(btn);
                        found++;
                    }
                });
            });
            if (found === 0) {
                row.innerHTML = '<div class="text-muted small p-2">No emoji found</div>';
            }
            emojiGrid.appendChild(row);
        } else {
            // Show active category
            var cat = emojiData[activeCat];
            var label = document.createElement('div');
            label.className = 'emoji-cat-label';
            label.textContent = cat.cat;
            emojiGrid.appendChild(label);

            var row = document.createElement('div');
            row.className = 'emoji-grid-row';
            cat.emojis.forEach(function (em) {
                row.appendChild(createEmojiBtn(em));
            });
            emojiGrid.appendChild(row);
        }
    }

    function createEmojiBtn(emoji) {
        var btn = document.createElement('button');
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.title = emoji;
        btn.addEventListener('click', function () {
            insertAtCursor(emoji);
            closeEmojiPicker();
        });
        return btn;
    }

    function insertAtCursor(text) {
        var start = msgInput.selectionStart;
        var end = msgInput.selectionEnd;
        var val = msgInput.value;
        msgInput.value = val.substring(0, start) + text + val.substring(end);
        msgInput.selectionStart = msgInput.selectionEnd = start + text.length;
        msgInput.focus();
        // Trigger input event for auto-resize
        msgInput.dispatchEvent(new Event('input'));
    }

    function toggleEmojiPicker() {
        var isOpen = emojiPicker.classList.contains('show');
        if (isOpen) {
            closeEmojiPicker();
        } else {
            openEmojiPicker();
        }
    }

    function openEmojiPicker() {
        emojiPicker.classList.add('show');
        emojiBackdrop.classList.add('show');
        emojiSearch.value = '';
        renderEmojiGrid('');
        emojiSearch.focus();
    }

    function closeEmojiPicker() {
        emojiPicker.classList.remove('show');
        emojiBackdrop.classList.remove('show');
    }

    emojiBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleEmojiPicker();
    });

    emojiBackdrop.addEventListener('click', closeEmojiPicker);

    emojiSearch.addEventListener('input', function () {
        renderEmojiGrid(this.value);
    });

    // Close emoji picker on Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && emojiPicker.classList.contains('show')) {
            closeEmojiPicker();
            msgInput.focus();
        }
    });

    // Build emoji picker on init
    buildEmojiPicker();

    // ── Username modal ──
    var savedUser = localStorage.getItem(STORAGE_KEY);

    function updateAvatarPreview() {
        var name = usernameInput.value.trim();
        if (name) {
            avatarPreview.style.background = getAvatarColor(name);
            avatarPreview.textContent = getInitials(name);
        } else {
            avatarPreview.style.background = '#6c757d';
            avatarPreview.textContent = '?';
        }
        joinBtn.disabled = !name;
    }

    usernameInput.addEventListener('input', updateAvatarPreview);
    usernameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && usernameInput.value.trim()) {
            joinBtn.click();
        }
    });

    joinBtn.addEventListener('click', function () {
        var name = usernameInput.value.trim();
        if (!name) return;
        currentUser = name;
        localStorage.setItem(STORAGE_KEY, name);
        usernameModal.hide();
        chatUI.style.display = '';
        requestNotificationPermission();
        connect();
    });

    // ── Leave ──
    leaveBtn.addEventListener('click', function () {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        setStatus('disconnected');
        msgInput.disabled = true;
        sendBtn.disabled = true;
        chatUI.style.display = 'none';
        localStorage.removeItem(STORAGE_KEY);
        currentUser = '';
        clearPendingFile();
        closeEmojiPicker();
        usernameInput.value = '';
        updateAvatarPreview();
        usernameModal.show();
        setTimeout(function () { usernameInput.focus(); }, 300);
    });

    // ── Tab visibility ──
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && isNearBottom) {
            unreadCount = 0;
            unreadBadge.style.display = 'none';
            document.title = originalTitle;
        }
    });

    // ── Init ──
    if (savedUser) {
        currentUser = savedUser;
        chatUI.style.display = '';
        requestNotificationPermission();
        connect();
    } else {
        usernameModal.show();
        setTimeout(function () { usernameInput.focus(); }, 300);
    }
});
