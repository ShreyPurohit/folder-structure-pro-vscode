export const getExample = (formatChoice: string): string => {
    return formatChoice === 'Plain Text Format'
        ? `Directory structure:
└── project/
    ├── src/
    │   ├── index.js
    │   └── styles.css
    └── README.md`
        : `{
  "project": {
    "src": {
      "index": "js",
      "styles": "css"
    },
    "README": "md"
  }
}`;
};

/** Small stroke icons, drawn inline so the webview needs no extra files. */
export const ICONS = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    terminal: '<path d="M4 17l6-5-6-5M12 19h8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    external:
        '<path d="M14 3h7v7M10 14L21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
};

export const icon = (name: keyof typeof ICONS): string =>
    `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

export const getStyles = (): string =>
    `:root{--bg-primary:#0d0d0f;--bg-secondary:#1a1a1f;--bg-tertiary:#212127;--bg-elevated:#2a2a32;--lavender-400:#b08cc9;--lavender-500:#9966b3;--lavender-600:#8855a3;--lavender-700:#744691;--lavender-800:#5f3a7a;--lavender-900:#4d2f63;--text-primary:#e8e8f0;--text-secondary:#c4c4d6;--text-muted:#8e8ea6;--text-accent:#b08cc9;--success:#4ade80;--warning:#f5c451;--danger:#f87171;--success-soft:rgba(74,222,128,.12);--success-line:rgba(74,222,128,.45);--danger-soft:rgba(248,113,113,.10);--danger-line:rgba(248,113,113,.45);--warning-line:rgba(245,196,81,.45);--border-subtle:#33333d;--border-strong:#5a5a66;--border-accent:#6b5b95;--shadow-md:0 4px 6px -1px rgba(0,0,0,.4),0 2px 4px -2px rgba(0,0,0,.3);--shadow-xl:0 20px 25px -5px rgba(0,0,0,.6),0 8px 10px -6px rgba(0,0,0,.5);--code-bg:#1e1e24;--code-border:#3a3a42;--code-text:#d4d4d8;--header-text:#fff;--header-muted:rgba(255,255,255,.78);--chip-bg:rgba(255,255,255,.1);--strip-bg:#17171c;--mono:'SF Mono',Monaco,Consolas,'Liberation Mono','Courier New',monospace}[data-theme=light]{--bg-primary:#fdf6e3;--bg-secondary:#eee8d5;--bg-tertiary:#f5efe6;--bg-elevated:#fff;--lavender-500:#9b82ff;--lavender-600:#8b5cf6;--lavender-700:#7c3aed;--lavender-800:#6d28d9;--lavender-900:#5b21b6;--text-primary:#073642;--text-secondary:#586e75;--text-muted:#6c7f86;--text-accent:#7c3aed;--success:#15803d;--warning:#a16207;--danger:#b91c1c;--success-soft:rgba(21,128,61,.10);--success-line:rgba(21,128,61,.40);--danger-soft:rgba(185,28,28,.08);--danger-line:rgba(185,28,28,.40);--warning-line:rgba(161,98,7,.40);--border-subtle:#e2dccb;--border-strong:#93a1a1;--border-accent:#c4b5fd;--shadow-md:0 4px 6px -1px rgba(0,43,54,.08),0 2px 4px -2px rgba(0,43,54,.06);--shadow-xl:0 20px 25px -5px rgba(0,43,54,.1),0 8px 10px -6px rgba(0,43,54,.08);--code-bg:#fdf6e3;--code-border:#e2dccb;--code-text:#073642;--strip-bg:#f3edde}*,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}html{background:var(--bg-primary)}body{margin:0;padding:16px;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,sans-serif;font-size:13px;line-height:1.5;color:var(--text-primary);background:linear-gradient(135deg,var(--bg-primary) 0%,var(--bg-secondary) 100%);min-height:100vh}.container{width:100%;max-width:1100px;margin:0 auto;min-width:0;background:var(--bg-elevated);border:1px solid var(--border-accent);border-radius:14px;overflow:hidden;box-shadow:var(--shadow-xl)}.icon{width:16px;height:16px;flex:none;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.mono{font-family:var(--mono)}button{font:inherit;color:inherit}:focus-visible{outline:2px solid var(--lavender-500);outline-offset:2px}header{min-width:0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 16px;padding:16px 20px;color:var(--header-text);background:linear-gradient(135deg,var(--lavender-800) 0%,var(--lavender-900) 60%,#2a1f3d 100%);border-bottom:1px solid var(--border-accent)}.title{margin:0;font-size:1.25rem;font-weight:700;letter-spacing:-.01em}.subtitle{margin:2px 0 0;font-size:12px;color:var(--header-muted)}.header-actions{display:flex;align-items:center;gap:8px;min-width:0;max-width:100%}.header-actions .btn{flex:none}.destination{display:inline-flex;align-items:center;gap:6px;min-width:0;padding:5px 10px;border-radius:999px;background:var(--chip-bg);border:1px solid rgba(255,255,255,.2);font-size:12px}.destination-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;max-width:320px}.destination-label{white-space:nowrap;color:var(--header-muted)}.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:6px 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,opacity .15s ease}.btn:hover{border-color:var(--lavender-500);background:var(--bg-secondary)}.btn-ghost{background:transparent;border-color:transparent;color:var(--text-secondary)}.btn-ghost:hover{background:var(--bg-secondary);border-color:var(--border-subtle)}.btn-on-header{background:transparent;border-color:rgba(255,255,255,.25);color:var(--header-text)}.btn-on-header:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.45)}.btn-icon{padding:6px;min-width:34px}.btn-sm{min-height:28px;padding:3px 10px;font-size:12px}.btn-primary{background:linear-gradient(135deg,var(--lavender-600),var(--lavender-700));border-color:var(--lavender-500);color:#fff}.btn-primary:hover{background:linear-gradient(135deg,var(--lavender-500),var(--lavender-600))}.btn-primary:disabled,.btn-primary:disabled:hover{opacity:.5;cursor:not-allowed;background:linear-gradient(135deg,var(--lavender-600),var(--lavender-700))}.btn:disabled{cursor:default;opacity:.55}.btn-ghost:disabled:hover{background:transparent;border-color:transparent}.btn.done{border-color:var(--success);color:var(--success)}.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:10px 20px;background:var(--bg-secondary);border-bottom:1px solid var(--border-subtle)}.segmented{display:inline-flex;border:1px solid var(--border-strong);border-radius:8px;overflow:hidden}.segmented button{border:0;background:transparent;padding:5px 14px;font-size:12px;font-weight:600;color:var(--text-secondary);cursor:pointer}.segmented button[aria-checked=true]{background:var(--lavender-700);color:#fff}.tip{margin-left:auto;color:var(--text-muted);font-size:12px}.content{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;padding:16px 20px;background:var(--bg-tertiary)}.pane{display:flex;flex-direction:column;gap:6px;min-width:0}.pane-label{min-height:22px;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-accent)}.code-box{width:100%;height:clamp(180px,48vh,420px);margin:0;padding:14px 16px;border:1px solid var(--code-border);border-radius:10px;background:var(--code-bg);color:var(--code-text);font-family:var(--mono);font-size:13px;line-height:1.6;overflow:auto}.editor{--digits:1;position:relative;border:1px solid var(--code-border);border-radius:10px;background:var(--code-bg);overflow:hidden;font-family:var(--mono);font-size:13px}.editor:focus-within{border-color:var(--lavender-500);box-shadow:0 0 0 1px var(--lavender-500)}.editor textarea{display:block;width:100%;height:clamp(180px,48vh,420px);margin:0;padding:14px 16px 14px calc(var(--digits)*1ch + 30px);border:0;outline:none;background:transparent;color:var(--code-text);font-family:var(--mono);font-size:13px;line-height:1.6;resize:vertical;white-space:pre;overflow:auto;overflow-wrap:normal}.editor textarea::placeholder{color:var(--text-muted)}.line-numbers{position:absolute;top:0;bottom:0;left:0;width:calc(var(--digits)*1ch + 18px);box-sizing:border-box;padding:14px 8px 40px 10px;border-right:1px solid var(--code-border);color:var(--text-muted);font-family:var(--mono);font-size:13px;line-height:1.6;text-align:right;white-space:pre;overflow:hidden;user-select:none;opacity:.75}.output{white-space:pre}.output.placeholder{color:var(--text-muted);white-space:normal;font-family:inherit}.problems{list-style:none;margin:0;padding:10px;display:flex;flex-direction:column;gap:6px;white-space:normal;font-family:inherit}.problems li{display:flex;flex-wrap:wrap;gap:4px 10px;padding:6px 10px;border-left:3px solid var(--danger);border-radius:4px;background:var(--danger-soft)}.problems .line-no{font-family:var(--mono);font-weight:700}.problems .line-text{font-family:var(--mono);overflow-wrap:anywhere}.badge{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;border:1px solid var(--border-strong);font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--text-secondary)}.badge.valid{color:var(--success);border-color:var(--success-line);background:var(--success-soft)}.badge.invalid{color:var(--danger);border-color:var(--danger-line);background:var(--danger-soft)}.badge.checking{color:var(--warning);border-color:var(--warning-line)}footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;padding:12px 20px;background:var(--bg-secondary);border-top:1px solid var(--border-accent)}.summary{display:flex;align-items:flex-start;gap:8px;min-width:0;flex:1 1 320px;color:var(--text-secondary)}.summary b{color:var(--text-primary)}.dot{width:8px;height:8px;margin-top:6px;border-radius:50%;flex:none;background:var(--text-muted)}.summary.valid .dot{background:var(--success)}.summary.invalid .dot{background:var(--danger)}.summary.checking .dot{background:var(--warning)}.actions{display:flex;flex-wrap:wrap;gap:8px}.cli-strip{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:10px 20px;background:var(--strip-bg);border-top:1px solid var(--border-subtle)}.cli-strip>.icon{color:var(--text-accent)}.cli-text{flex:1 1 260px;min-width:0;color:var(--text-muted)}.cli-text b{color:var(--text-primary)}.cli-command{display:inline-flex;align-items:center;gap:10px;min-width:0;max-width:100%;padding:4px 4px 4px 12px;border:1px solid var(--code-border);border-radius:8px;background:var(--code-bg);color:var(--code-text);font-family:var(--mono);font-size:12.5px}.cli-command code{min-width:0;font-family:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cli-command .prompt{color:var(--success);margin-right:6px;user-select:none}.cli-actions{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0;max-width:100%}.cli-links{display:flex;gap:4px}@media(max-width:900px){.tip{display:none}.destination-path{max-width:200px}}@media (max-width:720px){body{padding:8px}.content{grid-template-columns:minmax(0,1fr)}.code-box,.editor textarea{height:clamp(150px,32vh,300px)}header,.toolbar,.content,footer,.cli-strip{padding-left:14px;padding-right:14px}.header-actions{width:100%}.destination{flex:1 1 auto}.destination-path{max-width:none}}@media (max-width:480px){.title{font-size:1.1rem}.subtitle,.destination-label{display:none}.actions{width:100%}.actions .btn{flex:1 1 auto}.cli-actions,.cli-command{width:100%}.cli-command{justify-content:space-between}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}`;

/**
 * The webview script. Plain JavaScript with no template literals, so nothing here needs
 * escaping; values from the extension are inserted with JSON.stringify.
 */
export const getScripts = (formatChoice: string): string => {
    const examples = JSON.stringify({
        'Plain Text Format': getExample('Plain Text Format'),
        'JSON Format': getExample('JSON Format'),
    });
    return `<script>(function(){
var vscode = acquireVsCodeApi();
var examples = ${examples};
var format = ${JSON.stringify(formatChoice)};
var destinationName = '';
var $ = function(id){ return document.getElementById(id); };
var textarea = $('folderStructure'), preview = $('preview'), problems = $('problems'),
    status = $('status'), summary = $('summary'), summaryText = $('summaryText'),
    submitBtn = $('submitBtn'), submitLabel = $('submitLabel'), copyBtn = $('copyBtn'),
    clearBtn = $('clearBtn'), exampleBtn = $('exampleBtn'), themeBtn = $('themeBtn'),
    destinationPath = $('destinationPath'), changeBtn = $('changeDestinationBtn'),
    copyCommandBtn = $('copyCommandBtn'), learnMoreBtn = $('learnMoreBtn'),
    formatButtons = document.querySelectorAll ? document.querySelectorAll('[data-format]') : [];
var lastTree = '';
var lineNumbers = $('lineNumbers'), editor = lineNumbers.parentNode, lineCount = 0;

function updateLineNumbers(){
    var count = textarea.value.split('\\n').length;
    if (count !== lineCount) {
        lineCount = count;
        var numbers = [];
        for (var n = 1; n <= count; n++) { numbers.push(n); }
        lineNumbers.textContent = numbers.join('\\n');
        editor.style.setProperty('--digits', String(String(count).length));
    }
    lineNumbers.scrollTop = textarea.scrollTop;
}

function plural(count, one, many){ return count + ' ' + (count === 1 ? one : many); }
function setText(node, text){ if (node) { node.textContent = text; } }

function setCanSubmit(canSubmit, items){
    submitBtn.disabled = !canSubmit;
    submitBtn.title = canSubmit ? 'Create this structure (Ctrl+Enter)' : 'Enter a valid structure first';
    setText(submitLabel, canSubmit && items ? 'Create ' + plural(items, 'item', 'items') : 'Create');
}
function setBadge(kind, text){ status.className = 'badge' + (kind ? ' ' + kind : ''); setText(status, text); }
function setSummary(kind, html){ summary.className = 'summary' + (kind ? ' ' + kind : ''); summaryText.innerHTML = html; }
function escapeHtml(value){ return String(value).replace(/[&<>"']/g, function(c){ return '&#' + c.charCodeAt(0) + ';'; }); }
function showPlaceholder(text){
    copyBtn.disabled = true;
    problems.hidden = true; preview.hidden = false;
    preview.className = 'code-box output placeholder'; setText(preview, text); lastTree = '';
}
function showTree(tree){
    copyBtn.disabled = false;
    problems.hidden = true; preview.hidden = false;
    preview.className = 'code-box output'; setText(preview, tree); lastTree = tree;
}
function showProblems(list){
    copyBtn.disabled = true;
    preview.hidden = true; problems.hidden = false; lastTree = '';
    while (problems.firstChild) { problems.removeChild(problems.firstChild); }
    list.forEach(function(problem){
        var item = document.createElement('li');
        var no = document.createElement('span'); no.className = 'line-no'; no.textContent = 'Line ' + problem.line;
        var text = document.createElement('span'); text.className = 'line-text'; text.textContent = problem.text.trim() || '(empty line)';
        item.appendChild(no); item.appendChild(text); problems.appendChild(item);
    });
}
function showEmpty(){
    setCanSubmit(false);
    setBadge('', 'Empty');
    showPlaceholder('The folders and files you paste will appear here.');
    setSummary('', 'Paste a structure, or insert the example to see how it works.');
}

function requestValidation(){
    updateLineNumbers();
    var content = textarea.value;
    if (!content.trim()) { showEmpty(); vscode.postMessage({ command: 'validate', text: '', format: format }); return; }
    setCanSubmit(false);
    setBadge('checking', 'Checking…');
    setSummary('checking', 'Checking your structure…');
    vscode.postMessage({ command: 'validate', text: content, format: format });
}
var timer;
function scheduleValidation(){ updateLineNumbers(); setCanSubmit(false); clearTimeout(timer); timer = setTimeout(requestValidation, 300); }

function onValidation(message){
    if (!textarea.value.trim()) { showEmpty(); return; }
    if (message.valid) {
        var counts = message.counts || { folders: 0, files: 0 };
        var items = counts.folders + counts.files;
        setCanSubmit(true, items);
        setBadge('valid', 'Valid');
        showTree(message.preview || '');
        setSummary('valid', '<span><b>' + escapeHtml(plural(counts.folders, 'folder', 'folders') + ' and ' + plural(counts.files, 'file', 'files')) +
            '</b> will be created in <b class="mono">' + escapeHtml(destinationName) + '</b>. Existing folders are reused, and nothing is replaced without asking.</span>');
        return;
    }
    setCanSubmit(false);
    var list = message.problems || [];
    if (list.length > 0) {
        setBadge('invalid', plural(list.length, 'line', 'lines') + ' to fix');
        showProblems(list);
        setSummary('invalid', 'Fix the ' + (list.length === 1 ? 'line' : 'lines') + ' listed above to continue. Each line needs a tree connector (├── or └──) and an indent of one level at a time.');
    } else {
        setBadge('invalid', 'Invalid');
        showPlaceholder(message.errorMessage || 'This structure cannot be read.');
        setSummary('invalid', escapeHtml(message.errorMessage || 'This structure cannot be read.'));
    }
}

function flash(button, text){
    var label = button.querySelector('.label');
    if (!label) { return; }
    var original = label.textContent;
    label.textContent = text; button.classList.add('done');
    setTimeout(function(){ label.textContent = original; button.classList.remove('done'); }, 1500);
}
function setFormat(next){
    format = next;
    for (var i = 0; i < formatButtons.length; i++) {
        formatButtons[i].setAttribute('aria-checked', formatButtons[i].getAttribute('data-format') === next ? 'true' : 'false');
    }
    textarea.placeholder = next === 'JSON Format'
        ? 'Paste JSON here…'
        : 'Paste a folder tree here…';
    requestValidation();
}
function setTheme(mode){
    if (mode === 'light') { document.documentElement.setAttribute('data-theme', 'light'); }
    else { document.documentElement.removeAttribute('data-theme'); }
    var next = mode === 'light' ? 'dark' : 'light';
    themeBtn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    themeBtn.title = 'Switch to ' + next + ' theme';
    $('themeIconDark').style.display = mode === 'light' ? '' : 'none';
    $('themeIconLight').style.display = mode === 'light' ? 'none' : '';
}
function luminance(color){
    var value = (color || '').trim(), r = 30, g = 30, b = 30, match;
    if (value.charAt(0) === '#') {
        var hex = value.slice(1); if (hex.length === 3) { hex = hex.replace(/(.)/g, '$1$1'); }
        var number = parseInt(hex.slice(0, 6), 16); if (!isNaN(number)) { r = number >> 16 & 255; g = number >> 8 & 255; b = number & 255; }
    } else if ((match = value.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/i))) { r = +match[1]; g = +match[2]; b = +match[3]; }
    var channel = function(v){ v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

textarea.addEventListener('input', scheduleValidation);
textarea.addEventListener('scroll', function(){ lineNumbers.scrollTop = textarea.scrollTop; });
textarea.addEventListener('keydown', function(event){
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !submitBtn.disabled) { submitBtn.click(); }
});
submitBtn.addEventListener('click', function(){
    if (submitBtn.disabled || !textarea.value.trim()) { return; }
    vscode.postMessage({ command: 'submit', text: textarea.value, format: format });
});
copyBtn.addEventListener('click', function(){
    if (!lastTree) { return; }
    vscode.postMessage({ command: 'copyPreview', text: lastTree });
    flash(copyBtn, 'Copied');
});
clearBtn.addEventListener('click', function(){ textarea.value = ''; requestValidation(); textarea.focus(); });
exampleBtn.addEventListener('click', function(){ textarea.value = examples[format]; requestValidation(); textarea.focus(); });
changeBtn.addEventListener('click', function(){ vscode.postMessage({ command: 'changeDestination' }); });
copyCommandBtn.addEventListener('click', function(){ vscode.postMessage({ command: 'copyCommand' }); flash(copyCommandBtn, 'Copied'); });
learnMoreBtn.addEventListener('click', function(){ vscode.postMessage({ command: 'learnMore' }); });
themeBtn.addEventListener('click', function(){
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
});
for (var i = 0; i < formatButtons.length; i++) {
    formatButtons[i].addEventListener('click', function(){ setFormat(this.getAttribute('data-format')); });
}

window.addEventListener('message', function(event){
    var message = event.data || {};
    if (message.command === 'validationResult') { onValidation(message); }
    if (message.command === 'destination') {
        destinationName = message.name || '';
        setText($('destinationPathText') || destinationPath, message.path || '');
        if (destinationPath) { destinationPath.title = message.path || ''; }
        requestValidation();
    }
});

destinationName = destinationPath ? destinationPath.getAttribute('data-name') || '' : '';
setTheme(luminance(getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-background')) < 0.5 ? 'dark' : 'light');
setFormat(format);
setTimeout(function(){ textarea.focus(); }, 100);
})();</script>`;
};

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
