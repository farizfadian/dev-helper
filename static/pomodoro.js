// ── Pomodoro Timer ──
document.addEventListener('DOMContentLoaded', function () {
    const STORAGE_KEY = 'devhelper_pomodoro';
    const display = document.getElementById('timerDisplay');
    const label = document.getElementById('timerLabel');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const skipBtn = document.getElementById('skipBtn');
    const sessionDots = document.getElementById('sessionDots');

    let state = loadState();
    let interval = null;

    function loadState() {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return {
            mode: saved.mode || 'work',
            running: false,
            timeLeft: null,
            session: saved.session || 0,
            completedPomodoros: saved.completedPomodoros || 0,
            totalMinutes: saved.totalMinutes || 0,
            streak: saved.streak || 0,
        };
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            mode: state.mode,
            session: state.session,
            completedPomodoros: state.completedPomodoros,
            totalMinutes: state.totalMinutes,
            streak: state.streak,
        }));
    }

    function getDuration(mode) {
        if (mode === 'work') return parseInt(document.getElementById('setWork').value) * 60;
        if (mode === 'short') return parseInt(document.getElementById('setShort').value) * 60;
        if (mode === 'long') return parseInt(document.getElementById('setLong').value) * 60;
        return 25 * 60;
    }

    function getMaxSessions() { return parseInt(document.getElementById('setSessions').value) || 4; }

    function formatTime(secs) {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
    }

    function updateDisplay() {
        const t = state.timeLeft !== null ? state.timeLeft : getDuration(state.mode);
        display.textContent = formatTime(t);

        const labels = { work: 'Focus Time', short: 'Short Break', long: 'Long Break' };
        label.textContent = labels[state.mode];

        startBtn.innerHTML = state.running
            ? '<i class="bi bi-pause-fill"></i> Pause'
            : '<i class="bi bi-play-fill"></i> Start';

        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === state.mode);
        });

        // Session dots
        const max = getMaxSessions();
        let dots = '';
        for (let i = 0; i < max; i++) {
            const cls = i < state.session ? 'completed' : i === state.session && state.mode === 'work' ? 'current' : 'pending';
            dots += `<span class="session-dot ${cls}"></span>`;
        }
        sessionDots.innerHTML = dots;

        // Stats
        document.getElementById('statPomodoros').textContent = state.completedPomodoros;
        document.getElementById('statMinutes').textContent = state.totalMinutes;
        document.getElementById('statStreak').textContent = state.streak;

        // Update page title
        if (state.running) {
            document.title = `${formatTime(t)} — Pomodoro`;
        } else {
            document.title = 'Pomodoro Timer — Dev Helper';
        }
    }

    function start() {
        if (state.timeLeft === null) state.timeLeft = getDuration(state.mode);
        state.running = true;
        interval = setInterval(tick, 1000);
        updateDisplay();
    }

    function pause() {
        state.running = false;
        clearInterval(interval);
        interval = null;
        updateDisplay();
    }

    function tick() {
        state.timeLeft--;
        if (state.timeLeft <= 0) {
            clearInterval(interval);
            interval = null;
            state.running = false;
            onComplete();
        }
        updateDisplay();
    }

    function onComplete() {
        // Sound notification
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.frequency.value = state.mode === 'work' ? 800 : 600;
            gain.gain.value = 0.3;
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
            setTimeout(() => { const o2 = audioCtx.createOscillator(); o2.connect(gain); o2.frequency.value = state.mode === 'work' ? 1000 : 800; o2.start(); o2.stop(audioCtx.currentTime + 0.3); }, 400);
        } catch {}

        // Browser notification
        if (Notification.permission === 'granted') {
            new Notification(state.mode === 'work' ? 'Focus session complete!' : 'Break is over!', {
                body: state.mode === 'work' ? 'Time for a break.' : 'Ready to focus again?',
                icon: '/static/icons/favicon.svg',
            });
        }

        if (state.mode === 'work') {
            state.completedPomodoros++;
            state.totalMinutes += parseInt(document.getElementById('setWork').value);
            state.streak++;
            state.session++;
            if (state.session >= getMaxSessions()) {
                state.mode = 'long';
                state.session = 0;
            } else {
                state.mode = 'short';
            }
        } else {
            state.mode = 'work';
        }
        state.timeLeft = null;
        saveState();
        updateDisplay();
    }

    function setMode(mode) {
        if (state.running) pause();
        state.mode = mode;
        state.timeLeft = null;
        updateDisplay();
    }

    // Events
    startBtn.addEventListener('click', function () {
        if (state.running) pause(); else start();
    });

    resetBtn.addEventListener('click', function () {
        pause();
        state.timeLeft = null;
        updateDisplay();
    });

    skipBtn.addEventListener('click', function () {
        pause();
        state.timeLeft = 0;
        onComplete();
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', function () { setMode(this.dataset.mode); });
    });

    // Settings change
    ['setWork', 'setShort', 'setLong', 'setSessions'].forEach(id => {
        document.getElementById(id).addEventListener('change', function () {
            if (!state.running) { state.timeLeft = null; updateDisplay(); }
        });
    });

    // Request notification permission
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }

    updateDisplay();
});
