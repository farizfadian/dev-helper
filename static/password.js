document.addEventListener('DOMContentLoaded', function () {
    const passwordText = document.getElementById('passwordText');
    const passwordDisplay = document.getElementById('passwordDisplay');
    const strengthBar = document.getElementById('strengthBar');
    const strengthLabel = document.getElementById('strengthLabel');
    const lengthSlider = document.getElementById('lengthSlider');
    const lengthValue = document.getElementById('lengthValue');
    const bulkOutput = document.getElementById('bulkOutput');
    const historyList = document.getElementById('historyList');
    const wordCountSlider = document.getElementById('wordCountSlider');
    const wordCountValue = document.getElementById('wordCountValue');
    const separatorSelect = document.getElementById('separatorSelect');
    const customSepWrap = document.getElementById('customSepWrap');
    const customSeparator = document.getElementById('customSeparator');
    const capitalizeSelect = document.getElementById('capitalizeSelect');

    var history = [];
    var MAX_HISTORY = 20;
    var currentMode = 'password'; // 'password' or 'passphrase'

    // ── Character Sets ──
    var UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var LOWER = 'abcdefghijklmnopqrstuvwxyz';
    var NUMBERS = '0123456789';
    var SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    var AMBIGUOUS = '0O1lI';

    // ── Word List for Passphrase (200+ common English words) ──
    var WORDS = [
        'apple','arrow','badge','baker','beach','blade','blank','blaze','bloom','board',
        'bonus','brain','brave','brick','brief','bring','brook','brush','build','burst',
        'cabin','camel','candy','cargo','chain','chalk','charm','chase','cheap','check',
        'chess','chief','child','claim','class','clean','clear','click','climb','clock',
        'close','cloud','coach','coral','couch','count','cover','craft','crane','crash',
        'cream','creek','crisp','cross','crown','crush','cycle','dance','dawn','delta',
        'depth','diary','draft','drain','dream','dress','drift','drink','drive','eagle',
        'earth','ember','enter','equal','event','extra','fable','faith','fancy','feast',
        'fence','field','flame','flash','fleet','float','flood','floor','flute','focus',
        'force','forge','frame','fresh','front','frost','fruit','ghost','giant','given',
        'glass','gleam','globe','glory','grace','grain','grand','grant','grape','grasp',
        'grass','grave','green','grind','group','grove','guard','guide','habit','happy',
        'haven','heart','heavy','hedge','honor','horse','hotel','house','human','humor',
        'ideal','image','index','inner','input','ivory','jewel','joint','judge','juice',
        'kayak','knack','knife','knock','label','lance','large','laser','layer','lemon',
        'level','light','limit','linen','liver','logic','lotus','lucky','lunar','lunch',
        'magic','major','maker','manor','maple','march','match','medal','mercy','metal',
        'might','minor','model','money','month','moral','mount','movie','music','noble',
        'noise','north','novel','nurse','ocean','olive','opera','orbit','organ','other',
        'outer','owner','paint','panel','paper','party','paste','patch','pause','peace',
        'pearl','penny','phase','phone','piano','pilot','pixel','place','plain','plane',
        'plant','plate','plaza','plumb','point','poker','polar','pound','power','press',
        'price','pride','prime','print','prize','proof','proud','pulse','punch','queen',
        'quest','quick','quiet','quote','radar','radio','raise','range','rapid','raven',
        'reach','rebel','reign','rider','ridge','right','risky','river','robin','robot',
        'rocky','roman','round','route','royal','ruler','rumor','rural','saint','salad',
        'scale','scene','scope','score','scout','sense','serve','seven','shade','shaft',
        'shake','shame','shape','share','shark','sharp','shelf','shell','shift','shine',
        'shirt','shock','shore','sight','sigma','since','sixth','skill','skull','slash',
        'sleep','slice','slide','slope','smart','smile','smith','smoke','snake','solar',
        'solid','solve','south','space','spare','spark','speak','speed','spend','spice',
        'spike','spine','spite','sport','spray','squad','stack','staff','stage','stair',
        'stake','stamp','stand','stark','start','state','steam','steel','steep','steer',
        'stern','stick','still','stock','stone','storm','story','stove','strap','straw',
        'strip','stuff','style','sugar','suite','super','surge','swamp','sweep','sweet',
        'swift','swing','sword','table','thick','thing','think','thorn','three','throw',
        'thumb','tidal','tiger','tight','timer','title','toast','token','topaz','torch',
        'total','touch','tower','trace','track','trade','trail','train','trait','trash',
        'trend','trial','tribe','trick','troop','truck','trump','trunk','trust','truth',
        'tulip','twist','ultra','under','union','unity','upper','urban','usage','valid',
        'value','vault','verse','vigor','vinyl','viola','viral','vivid','vocal','voice',
        'voter','wagon','watch','water','wheat','wheel','while','white','whole','width',
        'witch','women','world','worth','wound','wrist','yacht','yield','young','youth',
        'zebra','zone'
    ];

    // ── Secure Random ──
    function secureRandom(max) {
        var array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0] % max;
    }

    function secureRandomChar(charset) {
        return charset[secureRandom(charset.length)];
    }

    // ── Generate Password ──
    function generatePassword() {
        var length = parseInt(lengthSlider.value);
        var charset = '';
        var required = []; // ensure at least one from each selected set

        var useUpper = document.getElementById('optUpper').checked;
        var useLower = document.getElementById('optLower').checked;
        var useNumbers = document.getElementById('optNumbers').checked;
        var useSymbols = document.getElementById('optSymbols').checked;
        var excludeAmbiguous = document.getElementById('optExcludeAmbiguous').checked;

        var upper = UPPER;
        var lower = LOWER;
        var numbers = NUMBERS;

        if (excludeAmbiguous) {
            upper = upper.replace(/[OI]/g, '');
            lower = lower.replace(/[l]/g, '');
            numbers = numbers.replace(/[01]/g, '');
        }

        if (useUpper) { charset += upper; required.push(secureRandomChar(upper)); }
        if (useLower) { charset += lower; required.push(secureRandomChar(lower)); }
        if (useNumbers) { charset += numbers; required.push(secureRandomChar(numbers)); }
        if (useSymbols) { charset += SYMBOLS; required.push(secureRandomChar(SYMBOLS)); }

        if (charset.length === 0) {
            return '(select at least one character set)';
        }

        // Fill remaining length
        var password = [];
        for (var i = 0; i < length; i++) {
            password.push(secureRandomChar(charset));
        }

        // Inject required characters at random positions
        for (var r = 0; r < required.length && r < length; r++) {
            var pos = secureRandom(length);
            password[pos] = required[r];
        }

        return password.join('');
    }

    // ── Generate Passphrase ──
    function generatePassphrase() {
        var wordCount = parseInt(wordCountSlider.value);
        var separator = getSeparator();
        var capitalize = capitalizeSelect.value;
        var addNumber = document.getElementById('optAddNumber').checked;

        var words = [];
        for (var i = 0; i < wordCount; i++) {
            var word = WORDS[secureRandom(WORDS.length)];

            switch (capitalize) {
                case 'title':
                    word = word.charAt(0).toUpperCase() + word.slice(1);
                    break;
                case 'upper':
                    word = word.toUpperCase();
                    break;
                case 'lower':
                    word = word.toLowerCase();
                    break;
                case 'random':
                    word = word.split('').map(function (c) {
                        return secureRandom(2) === 0 ? c.toUpperCase() : c.toLowerCase();
                    }).join('');
                    break;
            }
            words.push(word);
        }

        var result = words.join(separator);
        if (addNumber) {
            result += separator + secureRandom(100);
        }

        return result;
    }

    function getSeparator() {
        var val = separatorSelect.value;
        if (val === 'custom') return customSeparator.value;
        return val;
    }

    // ── Current mode generate ──
    function generate() {
        var pw;
        if (currentMode === 'passphrase') {
            pw = generatePassphrase();
        } else {
            pw = generatePassword();
        }
        passwordText.textContent = pw;
        updateStrength(pw);
        addToHistory(pw);
        return pw;
    }

    // ── Password Strength (entropy-based) ──
    function calculateEntropy(password) {
        var charsetSize = 0;
        var hasLower = /[a-z]/.test(password);
        var hasUpper = /[A-Z]/.test(password);
        var hasNumbers = /[0-9]/.test(password);
        var hasSymbols = /[^a-zA-Z0-9]/.test(password);

        if (hasLower) charsetSize += 26;
        if (hasUpper) charsetSize += 26;
        if (hasNumbers) charsetSize += 10;
        if (hasSymbols) charsetSize += 32;

        if (charsetSize === 0) return 0;
        return password.length * Math.log2(charsetSize);
    }

    function updateStrength(password) {
        if (!password || password.startsWith('(')) {
            strengthBar.style.width = '0%';
            strengthBar.className = 'strength-bar-fill';
            strengthLabel.textContent = '---';
            strengthLabel.style.color = 'var(--bs-secondary-color)';
            return;
        }

        var entropy = calculateEntropy(password);
        var percent, label, colorClass, textColor;

        if (entropy < 30) {
            percent = 15; label = 'Weak'; colorClass = 'strength-weak'; textColor = '#dc3545';
        } else if (entropy < 50) {
            percent = 40; label = 'Fair'; colorClass = 'strength-fair'; textColor = '#fd7e14';
        } else if (entropy < 70) {
            percent = 70; label = 'Strong'; colorClass = 'strength-strong'; textColor = '#0dcaf0';
        } else {
            percent = 100; label = 'Very Strong'; colorClass = 'strength-very-strong'; textColor = '#198754';
        }

        strengthBar.style.width = percent + '%';
        strengthBar.className = 'strength-bar-fill ' + colorClass;
        strengthLabel.textContent = label + ' (' + Math.round(entropy) + ' bits)';
        strengthLabel.style.color = textColor;
    }

    // ── History (session only, NOT localStorage) ──
    function addToHistory(pw) {
        if (!pw || pw.startsWith('(')) return;
        history.unshift({
            password: pw,
            mode: currentMode,
            time: new Date().toLocaleTimeString()
        });
        if (history.length > MAX_HISTORY) history.pop();
        renderHistory();
    }

    function renderHistory() {
        if (history.length === 0) {
            historyList.innerHTML = '<div class="text-center text-muted py-4 small">No passwords generated yet</div>';
            return;
        }

        historyList.innerHTML = history.map(function (item, i) {
            var badgeClass = item.mode === 'passphrase' ? 'text-bg-info' : 'text-bg-success';
            var badgeLabel = item.mode === 'passphrase' ? 'phrase' : 'pass';
            return '<div class="history-item">' +
                '<span class="pw-text" data-pw="' + escapeAttr(item.password) + '" title="Click to copy">' + escapeHtml(item.password) + '</span>' +
                '<span class="pw-meta">' +
                    '<span class="badge ' + badgeClass + '" style="font-size:0.6rem;">' + badgeLabel + '</span> ' +
                    item.time +
                '</span>' +
                '<button class="btn btn-sm p-0 border-0" data-copy="' + escapeAttr(item.password) + '" title="Copy" style="color: var(--bs-secondary-color);"><i class="bi bi-clipboard"></i></button>' +
            '</div>';
        }).join('');

        // Click to copy on password text
        historyList.querySelectorAll('.pw-text').forEach(function (el) {
            el.addEventListener('click', function () {
                copyText(this.dataset.pw);
            });
        });

        // Copy button
        historyList.querySelectorAll('[data-copy]').forEach(function (el) {
            el.addEventListener('click', function () {
                copyText(this.dataset.copy);
            });
        });
    }

    // ── Event Listeners ──

    // Generate button
    document.getElementById('generateBtn').addEventListener('click', generate);

    // Keyboard shortcut: Space or Enter (when not in input)
    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault();
            generate();
        }
    });

    // Copy button
    document.getElementById('copyBtn').addEventListener('click', function () {
        var text = passwordText.textContent;
        if (!text || text === '---' || text.startsWith('(')) return;
        copyText(text, this);
    });

    // Click display to copy
    passwordDisplay.addEventListener('click', function () {
        var text = passwordText.textContent;
        if (!text || text === '---' || text.startsWith('(')) return;
        copyText(text, document.getElementById('copyBtn'));
    });

    // Length slider
    lengthSlider.addEventListener('input', function () {
        lengthValue.textContent = this.value;
    });
    lengthSlider.addEventListener('change', function () {
        if (currentMode === 'password') generate();
    });

    // Character option changes → auto-regenerate
    ['optUpper', 'optLower', 'optNumbers', 'optSymbols', 'optExcludeAmbiguous'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', function () {
            if (currentMode === 'password') generate();
        });
    });

    // Tab switching
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(function (tab) {
        tab.addEventListener('shown.bs.tab', function (e) {
            var target = e.target.getAttribute('data-bs-target');
            currentMode = target === '#tabPassphrase' ? 'passphrase' : 'password';
            generate();
        });
    });

    // Passphrase options → auto-regenerate
    wordCountSlider.addEventListener('input', function () {
        wordCountValue.textContent = this.value;
    });
    wordCountSlider.addEventListener('change', function () {
        if (currentMode === 'passphrase') generate();
    });

    separatorSelect.addEventListener('change', function () {
        customSepWrap.classList.toggle('d-none', this.value !== 'custom');
        if (currentMode === 'passphrase') generate();
    });

    customSeparator.addEventListener('input', function () {
        if (currentMode === 'passphrase') generate();
    });

    capitalizeSelect.addEventListener('change', function () {
        if (currentMode === 'passphrase') generate();
    });

    document.getElementById('optAddNumber').addEventListener('change', function () {
        if (currentMode === 'passphrase') generate();
    });

    // Bulk generate
    document.getElementById('bulkGenerateBtn').addEventListener('click', function () {
        var count = parseInt(document.getElementById('bulkCount').value) || 10;
        var passwords = [];
        for (var i = 0; i < count; i++) {
            if (currentMode === 'passphrase') {
                passwords.push(generatePassphrase());
            } else {
                passwords.push(generatePassword());
            }
        }
        bulkOutput.value = passwords.join('\n');
        bulkOutput.style.height = 'auto';
        bulkOutput.style.height = bulkOutput.scrollHeight + 'px';
    });

    document.getElementById('bulkCopyBtn').addEventListener('click', function () {
        if (!bulkOutput.value) return;
        copyText(bulkOutput.value, this);
    });

    // History controls
    document.getElementById('clearHistoryBtn').addEventListener('click', function () {
        history = [];
        renderHistory();
    });

    document.getElementById('copyHistoryBtn').addEventListener('click', function () {
        if (history.length === 0) return;
        var text = history.map(function (h) { return h.password; }).join('\n');
        copyText(text, this);
    });

    // ── Helpers ──
    function copyText(text, btn) {
        navigator.clipboard.writeText(text).then(function () {
            if (btn) {
                var orig = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
                setTimeout(function () { btn.innerHTML = orig; }, 1500);
            }
        });
    }

    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Initial generate ──
    generate();
});
