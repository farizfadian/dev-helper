document.addEventListener('DOMContentLoaded', function () {
    const outputArea = document.getElementById('outputArea');
    const countInput = document.getElementById('countInput');
    const generateBtn = document.getElementById('generateBtn');

    let currentStyle = 'classic';
    let currentType = 'paragraphs';

    // ── Word Lists ──

    const WORDS = {
        classic: [
            'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
            'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
            'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
            'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
            'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
            'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
            'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
            'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'vitae', 'elementum',
            'curabitur', 'pretium', 'nibh', 'quam', 'suspendisse', 'potenti', 'nullam',
            'ac', 'tortor', 'semper', 'augue', 'maecenas', 'massa', 'eget', 'fermentum',
            'facilisis', 'volutpat', 'turpis', 'arcu', 'dictum', 'varius', 'duis',
            'convallis', 'posuere', 'morbi', 'leo', 'urna', 'molestie', 'at', 'vulputate',
            'pellentesque', 'habitant', 'tristique', 'senectus', 'netus', 'fames',
            'feugiat', 'nisl', 'vel', 'risus', 'commodo', 'viverra', 'accumsan',
            'lacus', 'sagittis', 'porta', 'felis', 'ornare', 'placerat', 'vestibulum'
        ],

        hipster: [
            'artisan', 'authentic', 'avocado', 'aesthetic', 'biodiesel', 'brunch', 'bushwick',
            'chambray', 'chartreuse', 'chillwave', 'cold-pressed', 'craft', 'cronut',
            'disrupt', 'dreamcatcher', 'echo', 'ethical', 'everyday', 'fixie', 'flannel',
            'flexitarian', 'freegan', 'gastropub', 'gentrify', 'gluten-free', 'gochujang',
            'hammock', 'hashtag', 'heirloom', 'helvetica', 'hexagon', 'hoodie', 'intelligentsia',
            'jianbing', 'kickstarter', 'kinfolk', 'knausgaard', 'kombucha', 'letterpress',
            'listicle', 'literally', 'locavore', 'lomo', 'lumbersexual', 'marfa', 'meditation',
            'microdosing', 'migas', 'mixtape', 'mumblecore', 'mustache', 'neutra', 'next-level',
            'normcore', 'organic', 'pabst', 'paleo', 'plaid', 'polaroid', 'portland',
            'post-ironic', 'pour-over', 'poutine', 'prism', 'quinoa', 'raclette', 'raw-denim',
            'retro', 'roof-party', 'schlitz', 'selvage', 'semiotics', 'seitan', 'shabby-chic',
            'shoreditch', 'single-origin', 'skateboard', 'slow-carb', 'small-batch', 'snackwave',
            'sriracha', 'stumptown', 'subway-tile', 'sustainable', 'synth', 'tacos',
            'tattooed', 'thundercats', 'tofu', 'tote-bag', 'truffaut', 'tumblr', 'tumeric',
            'typewriter', 'umami', 'unicorn', 'vaporware', 'vegan', 'venmo', 'vinyl',
            'waistcoat', 'wayfarers', 'woke', 'wolf', 'yolo', 'yuccie', 'poke-bowl'
        ],

        tech: [
            'algorithm', 'API', 'async', 'backend', 'bandwidth', 'binary', 'blockchain',
            'boolean', 'breakpoint', 'buffer', 'cache', 'callback', 'CI/CD', 'cloud',
            'cluster', 'codebase', 'compiler', 'component', 'container', 'CRUD', 'CSS',
            'database', 'debug', 'deploy', 'dependency', 'devops', 'docker', 'DOM',
            'endpoint', 'encryption', 'event-loop', 'framework', 'frontend', 'fullstack',
            'function', 'garbage-collection', 'git', 'GraphQL', 'hash', 'HTML',
            'HTTP', 'IDE', 'immutable', 'index', 'interface', 'iterator', 'JavaScript',
            'JSON', 'kernel', 'Kubernetes', 'lambda', 'latency', 'library', 'Linux',
            'load-balancer', 'localhost', 'loop', 'machine-learning', 'merge', 'method',
            'microservice', 'middleware', 'module', 'MongoDB', 'mutex', 'namespace',
            'node', 'npm', 'null', 'OAuth', 'object', 'ORM', 'package', 'parser',
            'payload', 'pipeline', 'pixel', 'plugin', 'pointer', 'polymorphism',
            'PostgreSQL', 'promise', 'protocol', 'proxy', 'pull-request', 'Python',
            'query', 'queue', 'React', 'recursion', 'Redis', 'refactor', 'regex',
            'repository', 'REST', 'runtime', 'Rust', 'schema', 'SDK', 'server',
            'serverless', 'singleton', 'socket', 'SQL', 'SSR', 'stack', 'state',
            'stream', 'string', 'syntax', 'TCP', 'template', 'terminal', 'test',
            'thread', 'token', 'TypeScript', 'UDP', 'UI', 'variable', 'virtual',
            'Vue', 'WebSocket', 'webpack', 'YAML', 'zero-downtime'
        ]
    };

    const LOREM_START = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

    // ── Random Helpers ──

    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ── Generation Functions ──

    function generateSentence(words, minLen, maxLen) {
        var len = randInt(minLen || 8, maxLen || 15);
        var sentence = [];
        for (var i = 0; i < len; i++) {
            sentence.push(pickRandom(words));
        }
        // Capitalize first word and add period
        sentence[0] = capitalize(sentence[0]);

        // Occasionally add a comma for natural feel
        if (len > 6) {
            var commaPos = randInt(2, Math.floor(len / 2));
            sentence[commaPos] = sentence[commaPos] + ',';
        }

        return sentence.join(' ') + '.';
    }

    function generateParagraph(words, startWithLorem, isFirst) {
        var sentenceCount = randInt(4, 8);
        var sentences = [];

        for (var i = 0; i < sentenceCount; i++) {
            if (i === 0 && isFirst && startWithLorem && currentStyle === 'classic') {
                sentences.push(LOREM_START);
            } else {
                sentences.push(generateSentence(words));
            }
        }

        return sentences.join(' ');
    }

    function generateText() {
        var count = Math.min(100, Math.max(1, parseInt(countInput.value) || 3));
        var words = WORDS[currentStyle];
        var startWithLorem = document.getElementById('optStartLorem').checked;
        var useHtmlTags = document.getElementById('optHtmlTags').checked;
        var result = [];

        switch (currentType) {
            case 'paragraphs':
                for (var p = 0; p < count; p++) {
                    var para = generateParagraph(words, startWithLorem, p === 0);
                    if (useHtmlTags) {
                        result.push('<p>' + para + '</p>');
                    } else {
                        result.push(para);
                    }
                }
                return result.join(useHtmlTags ? '\n\n' : '\n\n');

            case 'sentences':
                for (var s = 0; s < count; s++) {
                    if (s === 0 && startWithLorem && currentStyle === 'classic') {
                        result.push(LOREM_START);
                    } else {
                        result.push(generateSentence(words));
                    }
                }
                var text = result.join(' ');
                if (useHtmlTags) {
                    text = '<p>' + text + '</p>';
                }
                return text;

            case 'words':
                if (startWithLorem && currentStyle === 'classic') {
                    // Start with classic lorem ipsum words
                    var loremWords = ['Lorem', 'ipsum', 'dolor', 'sit', 'amet'];
                    var remaining = count - Math.min(count, loremWords.length);
                    var wordList = loremWords.slice(0, Math.min(count, loremWords.length));
                    for (var w = 0; w < remaining; w++) {
                        wordList.push(pickRandom(words));
                    }
                    return wordList.join(' ');
                } else {
                    var wordList2 = [];
                    for (var w2 = 0; w2 < count; w2++) {
                        wordList2.push(pickRandom(words));
                    }
                    return wordList2.join(' ');
                }

            default:
                return '';
        }
    }

    // ── Display & Stats ──

    function displayText(text) {
        var useHtmlTags = document.getElementById('optHtmlTags').checked;

        if (useHtmlTags && currentType === 'paragraphs') {
            // Show rendered HTML
            outputArea.innerHTML = text;
            outputArea.classList.add('html-mode');
        } else {
            outputArea.textContent = text;
            outputArea.classList.remove('html-mode');
        }

        updateStats(text);
    }

    function updateStats(text) {
        // Strip HTML tags for counting
        var plainText = text.replace(/<[^>]*>/g, '');

        // Count paragraphs
        var paragraphs = plainText.split(/\n\n+/).filter(function (p) { return p.trim().length > 0; });
        document.querySelector('#statParagraphs span').textContent = paragraphs.length;

        // Count sentences (approximate: split by . ! ?)
        var sentences = plainText.split(/[.!?]+/).filter(function (s) { return s.trim().length > 0; });
        document.querySelector('#statSentences span').textContent = sentences.length;

        // Count words
        var wordsList = plainText.split(/\s+/).filter(function (w) { return w.length > 0; });
        document.querySelector('#statWords span').textContent = wordsList.length;

        // Count characters
        document.querySelector('#statChars span').textContent = plainText.length;
    }

    // ── Generate Handler ──

    function doGenerate() {
        var text = generateText();
        displayText(text);
    }

    // ── Event Listeners ──

    // Generate button
    generateBtn.addEventListener('click', doGenerate);

    // Style buttons
    document.querySelectorAll('.style-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            currentStyle = this.dataset.style;
            document.querySelectorAll('.style-btn').forEach(function (b) {
                b.classList.remove('active');
                b.classList.replace('btn-primary', 'btn-outline-primary');
            });
            this.classList.add('active');
            this.classList.replace('btn-outline-primary', 'btn-primary');
            doGenerate();
        });
    });

    // Type buttons
    document.querySelectorAll('.type-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            currentType = this.dataset.type;
            document.querySelectorAll('.type-btn').forEach(function (b) {
                b.classList.remove('active');
                b.classList.replace('btn-secondary', 'btn-outline-secondary');
            });
            this.classList.add('active');
            this.classList.replace('btn-outline-secondary', 'btn-secondary');
            doGenerate();
        });
    });

    // Count input
    countInput.addEventListener('change', doGenerate);
    countInput.addEventListener('input', function () {
        // Clamp value
        var val = parseInt(this.value);
        if (val < 1) this.value = 1;
        if (val > 100) this.value = 100;
    });

    // Count +/- buttons
    document.getElementById('countMinus').addEventListener('click', function () {
        var val = parseInt(countInput.value) || 3;
        if (val > 1) {
            countInput.value = val - 1;
            doGenerate();
        }
    });

    document.getElementById('countPlus').addEventListener('click', function () {
        var val = parseInt(countInput.value) || 3;
        if (val < 100) {
            countInput.value = val + 1;
            doGenerate();
        }
    });

    // Options auto-generate
    document.getElementById('optStartLorem').addEventListener('change', doGenerate);
    document.getElementById('optHtmlTags').addEventListener('change', doGenerate);

    // Copy button
    document.getElementById('copyBtn').addEventListener('click', function () {
        var text;
        var useHtmlTags = document.getElementById('optHtmlTags').checked;

        if (useHtmlTags && currentType === 'paragraphs') {
            // Copy raw HTML when HTML tags are enabled
            text = outputArea.innerHTML;
        } else {
            text = outputArea.textContent;
        }

        if (!text) return;
        var btn = this;
        navigator.clipboard.writeText(text).then(function () {
            var orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
            setTimeout(function () { btn.innerHTML = orig; }, 1500);
        });
    });

    // Select All button
    document.getElementById('selectAllBtn').addEventListener('click', function () {
        var range = document.createRange();
        range.selectNodeContents(outputArea);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    });

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', function () {
        outputArea.innerHTML = '<span class="text-muted">Click "Generate" or change options to create lorem ipsum text...</span>';
        outputArea.classList.remove('html-mode');
        document.querySelector('#statParagraphs span').textContent = '0';
        document.querySelector('#statSentences span').textContent = '0';
        document.querySelector('#statWords span').textContent = '0';
        document.querySelector('#statChars span').textContent = '0';
    });

    // Keyboard shortcut: Ctrl+Enter to generate
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            doGenerate();
        }
    });

    // ── Initial generate ──
    doGenerate();
});
