(function () {
    'use strict';

    const API_BASE = '';

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + target).classList.add('active');
        });
    });

    function setLoading(btn, loading) {
        const text = btn.querySelector('.btn-text');
        const loader = btn.querySelector('.btn-loader');
        btn.disabled = loading;
        if (loading) {
            text.classList.add('hidden');
            loader.classList.remove('hidden');
        } else {
            text.classList.remove('hidden');
            loader.classList.add('hidden');
        }
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg || 'Copied!';
        toast.classList.remove('hidden');
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2200);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!')).catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        try {
            document.execCommand('copy');
            showToast('Copied to clipboard!');
        } catch (_) {
            showToast('Copy failed');
        }
        document.body.removeChild(el);
    }

    async function apiPost(endpoint, body) {
        const resp = await fetch(API_BASE + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: 'Server error' }));
            throw new Error(err.error || `HTTP ${resp.status}`);
        }
        return resp.json();
    }

    function showError(container, message) {
        const existing = container.querySelector('.error-msg');
        if (existing) existing.remove();
        const div = document.createElement('div');
        div.className = 'error-msg';
        div.textContent = '✗ ' + message;
        container.appendChild(div);
        setTimeout(() => div.remove(), 5000);
    }

    function setCheck(el, pass) {
        el.classList.remove('pass', 'fail');
        el.classList.add(pass ? 'pass' : 'fail');
    }

    function setupToggle(toggleId, inputId) {
        const btn = document.getElementById(toggleId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;
        btn.addEventListener('click', () => {
            const isPass = input.type === 'password';
            input.type = isPass ? 'text' : 'password';
        });
    }

    setupToggle('toggle-check-vis', 'check-password');
    setupToggle('toggle-breach-vis', 'breach-password');

    const btnGenerate = document.getElementById('btn-generate');
    const genPhrase = document.getElementById('gen-phrase');

    genPhrase.addEventListener('keydown', e => {
        if (e.key === 'Enter') btnGenerate.click();
    });

    btnGenerate.addEventListener('click', async () => {
        const phrase = genPhrase.value.trim();
        if (!phrase) {
            showError(document.getElementById('tab-generator'), 'Please enter words or numbers');
            return;
        }

        setLoading(btnGenerate, true);
        document.getElementById('gen-result').style.display = 'none';

        try {
            const data = await apiPost('/generate', { phrase });
            renderGeneratorResult(data);
        } catch (err) {
            showError(document.getElementById('tab-generator'), err.message);
        } finally {
            setLoading(btnGenerate, false);
        }
    });

    function renderGeneratorResult(data) {
        const result = document.getElementById('gen-result');
        result.style.display = 'block';

        document.getElementById('gen-password-text').textContent = data.password;
        document.getElementById('gen-entropy').textContent = data.entropy;
        document.getElementById('gen-length').textContent = data.length;
        document.getElementById('gen-rating').textContent = data.strength_rating;

        setCheck(document.getElementById('chk-upper-g'), data.has_uppercase);
        setCheck(document.getElementById('chk-lower-g'), data.has_lowercase);
        setCheck(document.getElementById('chk-num-g'), data.has_numbers);
        setCheck(document.getElementById('chk-sym-g'), data.has_symbols);
    }

    document.getElementById('copy-gen').addEventListener('click', () => {
        const pw = document.getElementById('gen-password-text').textContent;
        if (pw) copyToClipboard(pw);
    });

    const btnCheck = document.getElementById('btn-check');
    const checkPw = document.getElementById('check-password');

    checkPw.addEventListener('keydown', e => {
        if (e.key === 'Enter') btnCheck.click();
    });

    btnCheck.addEventListener('click', async () => {
        const password = checkPw.value;
        if (!password) {
            showError(document.getElementById('tab-checker'), 'Please enter a password');
            return;
        }

        setLoading(btnCheck, true);
        document.getElementById('check-result').style.display = 'none';

        try {
            const data = await apiPost('/check-strength', { password });
            renderStrengthResult(data);
        } catch (err) {
            showError(document.getElementById('tab-checker'), err.message);
        } finally {
            setLoading(btnCheck, false);
        }
    });

    function renderStrengthResult(data) {
        const result = document.getElementById('check-result');
        result.style.display = 'block';

        const bar = document.getElementById('strength-bar');
        bar.style.width = data.score + '%';
        bar.style.backgroundColor = data.color;

        document.getElementById('strength-label').textContent = data.label;
        document.getElementById('strength-label').style.color = data.color;
        document.getElementById('strength-score').textContent = data.score + '/100';

        document.getElementById('chk-entropy').textContent = data.entropy;
        document.getElementById('chk-crack').textContent = data.crack_time;
        document.getElementById('chk-length').textContent = data.length;

        setCheck(document.getElementById('chk-upper'), data.has_uppercase);
        setCheck(document.getElementById('chk-lower'), data.has_lowercase);
        setCheck(document.getElementById('chk-num'), data.has_numbers);
        setCheck(document.getElementById('chk-sym'), data.has_symbols);

        const patternsSection = document.getElementById('patterns-section');
        const patternList = document.getElementById('pattern-list');
        patternList.innerHTML = '';
        if (data.patterns && data.patterns.length > 0) {
            patternsSection.style.display = 'block';
            data.patterns.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                patternList.appendChild(li);
            });
        } else {
            patternsSection.style.display = 'none';
        }

        const suggList = document.getElementById('suggestion-list');
        suggList.innerHTML = '';
        if (data.suggestions && data.suggestions.length > 0) {
            data.suggestions.forEach(s => {
                const li = document.createElement('li');
                li.textContent = s;
                suggList.appendChild(li);
            });
        }

        const upgradeSection = document.getElementById('upgrade-section');
        if (data.upgraded_password) {
            upgradeSection.style.display = 'block';
            document.getElementById('upgraded-password').textContent = data.upgraded_password;
        } else {
            upgradeSection.style.display = 'none';
        }
    }

    document.getElementById('copy-upgraded').addEventListener('click', () => {
        const pw = document.getElementById('upgraded-password').textContent;
        if (pw) copyToClipboard(pw);
    });

    const btnBreach = document.getElementById('btn-breach');
    const breachPw = document.getElementById('breach-password');

    breachPw.addEventListener('keydown', e => {
        if (e.key === 'Enter') btnBreach.click();
    });

    btnBreach.addEventListener('click', async () => {
        const password = breachPw.value;
        if (!password) {
            showError(document.getElementById('tab-breach'), 'Please enter a password');
            return;
        }

        setLoading(btnBreach, true);
        document.getElementById('breach-result').style.display = 'none';

        try {
            const data = await apiPost('/check-breach', { password });
            renderBreachResult(data);
        } catch (err) {
            showError(document.getElementById('tab-breach'), err.message);
        } finally {
            setLoading(btnBreach, false);
        }
    });

    function renderBreachResult(data) {
        const result = document.getElementById('breach-result');
        result.style.display = 'block';

        const statusEl = document.getElementById('breach-status');
        const messageEl = document.getElementById('breach-message');
        const countSection = document.getElementById('breach-count-section');
        const safeSection = document.getElementById('breach-safe-section');

        statusEl.className = 'breach-status';
        countSection.style.display = 'none';
        safeSection.style.display = 'none';

        if (data.error) {
            statusEl.classList.add('unknown');
            statusEl.textContent = '⚠ Connection Error';
            messageEl.textContent = data.message;
            return;
        }

        if (data.found) {
            statusEl.classList.add('danger');
            statusEl.textContent = 'PASSWORD COMPROMISED';
            messageEl.textContent = data.message;
            countSection.style.display = 'block';
            document.getElementById('breach-count').textContent = data.count.toLocaleString();
        } else {
            statusEl.classList.add('safe');
            statusEl.textContent = 'NOT FOUND IN BREACHES';
            messageEl.textContent = data.message;
            safeSection.style.display = 'block';
        }
    }

})();
