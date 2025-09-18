import * as vscode from 'vscode';

export class WebviewManager {
    static createStructureInputPanel(formatChoice: string): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            'folderStructureInput',
            'Folder Structure Input',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.getWebviewContent(formatChoice);
        return panel;
    }

    private static getWebviewContent(formatChoice: string): string {
        const example = formatChoice === 'Plain Text Format'
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

 return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
            <title>Folder Structure</title>
            <style>
                *, *::before, *::after { 
                    box-sizing: border-box; 
                }

                :root {
                    --bg-primary: #0d0d0f;
                    --bg-secondary: #1a1a1f;
                    --bg-tertiary: #212127;
                    --bg-elevated: #2a2a32;
                    --lavender-50: #f8f6fc;
                    --lavender-100: #ede7f5;
                    --lavender-200: #ddd0eb;
                    --lavender-300: #c8b3dd;
                    --lavender-400: #b08cc9;
                    --lavender-500: #9966b3;
                    --lavender-600: #8855a3;
                    --lavender-700: #744691;
                    --lavender-800: #5f3a7a;
                    --lavender-900: #4d2f63;
                    --text-primary: #e8e8f0;
                    --text-secondary: #c4c4d6;
                    --text-tertiary: #a0a0b8;
                    --text-muted: #7c7c94;
                    --text-accent: #b08cc9;
                    --success: #4ade80;
                    --error: #f87171;
                    --warning: #fbbf24;
                    --border-light: #3a3a42;
                    --border-medium: #4a4a54;
                    --border-strong: #5a5a66;
                    --border-accent: #6b5b95;
                    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
                    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3);
                    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4);
                    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
                    --shadow-lavender: 0 4px 20px rgba(153, 102, 179, 0.15);
                    --code-bg: #1e1e24;
                    --code-border: #3a3a42;
                    --code-text: #d4d4d8;
                    --code-comment: #6b7280;
                    --code-keyword: #c084fc;
                    --code-string: #86efac;
                    --code-number: #fbbf24;
                    --code-function: #60a5fa;
                    --code-operator: #f472b6;
                    --code-bracket: #a78bfa;
                    --interactive-bg: rgba(153, 102, 179, 0.15);
                    --interactive-border: var(--lavender-600);
                    --interactive-hover-bg: rgba(153, 102, 179, 0.25);
                    --interactive-hover-border: var(--lavender-500);
                }

                :root[data-theme='light'] {
                    --solarized-base03: #002b36;
                    --solarized-base02: #073642;
                    --solarized-base01: #586e75;
                    --solarized-base00: #657b83;
                    --solarized-base0: #839496;
                    --solarized-base1: #93a1a1;
                    --solarized-base2: #eee8d5;
                    --solarized-base3: #fdf6e3;
                    --solarized-yellow: #b58900;
                    --solarized-orange: #cb4b16;
                    --solarized-red: #dc322f;
                    --solarized-magenta: #d33682;
                    --solarized-violet: #6c71c4;
                    --solarized-blue: #268bd2;
                    --solarized-cyan: #2aa198;
                    --solarized-green: #859900;
                    --bg-primary: var(--solarized-base3);
                    --bg-secondary: var(--solarized-base2);
                    --bg-tertiary: #f5efe6;
                    --bg-elevated: #ffffff;
                    --lavender-50: #faf8ff;
                    --lavender-100: #f3f0ff;
                    --lavender-200: #e9e5ff;
                    --lavender-300: #d4cdff;
                    --lavender-400: #b8a9ff;
                    --lavender-500: #9b82ff;
                    --lavender-600: #8b5cf6;
                    --lavender-700: #7c3aed;
                    --lavender-800: #6d28d9;
                    --lavender-900: #5b21b6;
                    --text-primary: var(--solarized-base02);
                    --text-secondary: var(--solarized-base01);
                    --text-tertiary: var(--solarized-base00);
                    --text-muted: var(--solarized-base1);
                    --text-accent: var(--lavender-700);
                    --success: #16a34a;
                    --error: #dc2626;
                    --warning: var(--solarized-yellow);
                    --border-light: #ede4d3;
                    --border-medium: #ddd2c1;
                    --border-strong: var(--solarized-base1);
                    --border-accent: var(--lavender-400);
                    --shadow-sm: 0 1px 2px 0 rgba(0, 43, 54, 0.05);
                    --shadow-md: 0 4px 6px -1px rgba(0, 43, 54, 0.08), 0 2px 4px -2px rgba(0, 43, 54, 0.06);
                    --shadow-lg: 0 10px 15px -3px rgba(0, 43, 54, 0.08), 0 4px 6px -4px rgba(0, 43, 54, 0.06);
                    --shadow-xl: 0 20px 25px -5px rgba(0, 43, 54, 0.1), 0 8px 10px -6px rgba(0, 43, 54, 0.08);
                    --shadow-lavender: 0 4px 20px rgba(139, 92, 246, 0.1);
                    --code-bg: var(--solarized-base3);
                    --code-border: var(--solarized-base2);
                    --code-text: var(--solarized-base02);
                    --code-comment: var(--solarized-base1);
                    --code-keyword: var(--solarized-violet);
                    --code-string: var(--solarized-cyan);
                    --code-number: var(--solarized-orange);
                    --code-function: var(--solarized-blue);
                    --code-operator: var(--solarized-magenta);
                    --code-bracket: var(--lavender-600);
                    --interactive-bg: rgba(139, 92, 246, 0.1);
                    --interactive-border: var(--lavender-300);
                    --interactive-hover-bg: rgba(139, 92, 246, 0.2);
                    --interactive-hover-border: var(--lavender-200);
                }

                body {
                    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif;
                    margin: 0;
                    padding: 24px;
                    background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%);
                    color: var(--text-primary);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    min-height: 100vh;
                    line-height: 1.5;
                }

                .container {
                    width: min(95%, 1100px);
                    max-width: 1100px;
                    background: var(--bg-elevated);
                    border: 1px solid var(--border-accent);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: var(--shadow-xl), var(--shadow-lavender);
                    backdrop-filter: blur(10px);
                }

                header {
                    background: linear-gradient(135deg, var(--lavender-800) 0%, var(--lavender-900) 50%, #2a1f3d 100%);
                    color: white;
                    padding: 24px 28px;
                    border-bottom: 3px solid var(--border-accent);
                    position: relative;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                }

                :root[data-theme='light'] header {
                    background: linear-gradient(135deg, var(--lavender-600) 0%, var(--lavender-700) 50%, var(--lavender-800) 100%);
                    color: white;
                }

                header {
                    display: flex;
                    gap: 16px;
                    align-items: stretch;
                }

                header::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, var(--lavender-400), transparent);
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                } 

                .title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    letter-spacing: -0.025em;
                    margin: 0;
                    background: linear-gradient(135deg, white 0%, rgba(255,255,255,0.8) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    white-space: nowrap;
                }

                .icon-btn.theme-toggle {
                    width: 28px;
                    height: 28px;
                    margin-top: 3px;
                    border-radius: 6px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: var(--shadow-sm);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                    font-size: 14px;
                }

                .icon-btn.theme-toggle:hover {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: rgba(255, 255, 255, 0.3);
                    transform: translateY(-1px);
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 50px;
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 0.025em;
                    text-transform: uppercase;
                    border: 2px solid transparent;
                    backdrop-filter: blur(10px);
                    white-space: nowrap;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border-color: rgba(255, 255, 255, 0.2);
                }

                .status-badge.valid {
                    background: rgba(74, 222, 128, 0.2);
                    color: #4ade80;
                    border-color: #4ade80;
                }

                .status-badge.invalid {
                    background: rgba(248, 113, 113, 0.2);
                    color: #f87171;
                    border-color: #f87171;
                }

                .status-badge.warning {
                    background: rgba(251, 191, 36, 0.2);
                    color: #fbbf24;
                    border-color: #fbbf24;
                }

                :root[data-theme='light'] .status-badge.valid {
                    background: rgba(22, 163, 74, 0.15);
                    color: #16a34a;
                    border-color: #16a34a;
                }

                :root[data-theme='light'] .status-badge.invalid {
                    background: rgba(220, 38, 38, 0.15);
                    color: #dc2626;
                    border-color: #dc2626;
                }

                :root[data-theme='light'] .status-badge.warning {
                    background: rgba(181, 137, 0, 0.15);
                    color: #b58900;
                    border-color: #b58900;
                }

                .status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: currentColor;
                    flex-shrink: 0;
                }

                .interactive-btn {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    padding: 10px 20px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    position: relative;
                    backdrop-filter: blur(10px);
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }

                .interactive-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: rgba(255, 255, 255, 0.3);
                    transform: translateY(-1px);
                }

                .example-content {
                    display: none;
                    position: absolute;
                    top: calc(100% + 12px);
                    right: 0;
                    background: var(--bg-elevated);
                    color: var(--code-text);
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid var(--border-accent);
                    white-space: pre;
                    font-family: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
                    font-size: 13px;
                    line-height: 1.6;
                    z-index: 1000;
                    text-align: left;
                    box-shadow: var(--shadow-lg), var(--shadow-lavender);
                    max-width: min(90vw, 500px);
                    overflow: auto;
                    backdrop-filter: blur(20px);
                    background: var(--code-bg);
                    border: 1px solid var(--code-border);
                }

                .interactive-btn:hover .example-content {
                    display: block;
                }

                @media (max-width: 768px) {
                    body { 
                        padding: 16px; 
                    }
                    
                    .container { 
                        width: 100%; 
                        border-radius: 12px; 
                    }
                    
                    header { 
                        padding: 20px;
                        flex-direction: column;
                        align-items: stretch;
                        gap: 16px;
                    }

                    .header-title {
                        justify-content: center;
                    }
                    
                    .title { 
                        font-size: 1.25rem;
                        text-align: center;
                    }
                    
                    .status-badge,
                    .interactive-btn {
                        flex: 1;
                        min-width: 120px;
                        max-width: 150px;
                        justify-content: center;
                    }
                    
                    .icon-btn.theme-toggle {
                        align-self: center;
                        margin-bottom: 8px;
                    }
                }

                @media (max-width: 480px) {
                    header {
                        padding: 16px;
                    }
                    
                    .title {
                        font-size: 1.125rem;
                    }
                    
                    .status-badge,
                    .interactive-btn {
                        width: 100%;
                        max-width: none;
                    }
                }

                .content {
                    padding: 32px;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    background: var(--bg-tertiary);
                }

                .input-section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .section-label {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-accent);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 4px;
                }

                textarea {
                    width: 100%;
                    height: 400px;
                    margin: 0;
                    padding: 20px;
                    border: 2px solid var(--border-strong);
                    border-radius: 12px;
                    background: var(--code-bg);
                    color: var(--code-text);
                    font-family: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
                    font-size: 14px;
                    line-height: 1.6;
                    resize: vertical;
                    box-shadow: var(--shadow-sm);
                    transition: all 0.2s ease;
                }

                textarea::placeholder {
                    color: var(--text-muted);
                    font-style: italic;
                }

                textarea:focus {
                    outline: none;
                    border-color: var(--lavender-500);
                    box-shadow: 0 0 0 4px rgba(153, 102, 179, 0.2), var(--shadow-md);
                }

                :root[data-theme='light'] textarea:focus {
                    border-color: var(--lavender-600);
                    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.15), var(--shadow-md);
                }

                .preview-section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .preview {
                    width: 100%;
                    height: 400px;
                    margin: 0;
                    padding: 20px;
                    border: 2px solid var(--code-border);
                    border-radius: 12px;
                    font-family: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
                    font-size: 13px;
                    line-height: 1.6;
                    white-space: pre;
                    overflow: auto;
                    background: var(--code-bg);
                    color: var(--code-text);
                    box-shadow: var(--shadow-sm);
                }

                .preview:empty::before {
                    content: "Preview will appear here...";
                    color: var(--text-muted);
                    font-style: italic;
                }

                footer {
                    padding: 24px 32px;
                    background: var(--bg-secondary);
                    border-top: 1px solid var(--border-accent);
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                }

                .button-group {
                    display: flex;
                    flex-direction: row; 
                    flex-wrap: wrap;    
                    gap: 12px;
                    align-items: center;
                }

                .btn {
                    border: none;
                    padding: 12px 24px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    letter-spacing: 0.025em;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    min-height: 44px;
                    box-shadow: var(--shadow-sm);
                    transition: all 0.2s ease;
                }

                .btn-secondary {
                    background: var(--bg-elevated);
                    color: var(--text-secondary);
                    border: 2px solid var(--border-strong);
                }

                .btn-secondary:hover {
                    background: var(--interactive-bg);
                    border-color: var(--interactive-border);
                    color: var(--text-primary);
                    transform: translateY(-1px);
                }

                :root[data-theme='light'] .btn-secondary:hover {
                    background: var(--interactive-bg);
                    border-color: var(--interactive-border);
                }

                .btn-primary {
                    background: linear-gradient(135deg, var(--lavender-700) 0%, var(--lavender-800) 100%);
                    color: var(--text-primary);
                    border: 2px solid var(--lavender-600);
                }

                :root[data-theme='light'] .btn-primary {
                    background: linear-gradient(135deg, var(--lavender-600) 0%, var(--lavender-700) 100%);
                    color: white;
                    border-color: var(--lavender-500);
                }

                .btn-primary:hover {
                    background: linear-gradient(135deg, var(--lavender-600) 0%, var(--lavender-700) 100%);
                    border-color: var(--lavender-500);
                    box-shadow: var(--shadow-md);
                    transform: translateY(-1px);
                }

                :root[data-theme='light'] .btn-primary:hover {
                    background: linear-gradient(135deg, var(--lavender-500) 0%, var(--lavender-600) 100%);
                    border-color: var(--lavender-400);
                }

                .btn:focus {
                    outline: none;
                    box-shadow: 0 0 0 4px rgba(153, 102, 179, 0.3);
                }

                :root[data-theme='light'] .btn:focus {
                    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.2);
                }

                @media (max-width: 900px) {
                    .content { 
                        grid-template-columns: 1fr; 
                        padding: 24px;
                        gap: 20px;
                    }
                    
                    textarea, .preview { height: 300px; }
                    
                    footer { 
                        flex-direction: column; 
                        gap: 16px;
                        padding: 20px;
                    }
                    
                    .button-group { 
                        width: 100%; 
                        justify-content: center;
                    }
                    
                    .btn { 
                        flex: 1; 
                        justify-content: center;
                        min-width: 120px;
                    }
                }

                @media (max-width: 600px) {                
                    .btn { 
                        width: 100%; 
                    }
                }

                * {
                    scrollbar-width: thin;
                    scrollbar-color: var(--border-accent) transparent;
                }
                *::-webkit-scrollbar { width: 8px; height: 8px; }
                *::-webkit-scrollbar-track { background: transparent; }
                *::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 8px; }
                *::-webkit-scrollbar-thumb:hover { background: var(--lavender-600); }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <div class="header-title">
                        <h1 class="title">Folder Structure Builder</h1>
                        <button id="themeBtn" class="icon-btn theme-toggle" title="Toggle theme" aria-label="Toggle theme">
                            <span id="themeIcon" aria-hidden="true">☾</span>
                        </button>
                    </div>
                    <div class="button-group">
                        <div id="status" class="btn status-badge">
                            <div class="status-indicator"></div>
                            <span>Ready</span>
                        </div>
                        <button class="btn interactive-btn">
                            <span>View Example</span>
                            <div class="example-content">${example}</div>
                        </button>
                    </div>
                </header>
                
                <div class="content">
                    <div class="input-section">
                        <div class="section-label">Input (${formatChoice})</div>
                        <textarea 
                            id="folderStructure" 
                            placeholder="Paste your folder structure here and watch the magic happen..."
                            aria-label="Folder structure input"
                        ></textarea>
                    </div>
                    
                    <div class="preview-section">
                        <div class="section-label">Preview</div>
                        <pre id="preview" class="preview" aria-label="Structure preview"></pre>
                    </div>
                </div>
                
                <footer>
                    <div class="button-group">
                        <button class="btn btn-secondary" id="copyBtn" title="Copy preview to clipboard">
                            Copy Preview
                        </button>
                        <button class="btn btn-secondary" id="clearBtn" title="Clear input field">
                            Clear All
                        </button>
                    </div>
                    
                    <button class="btn btn-primary" id="submitBtn">
                        Create Structure
                    </button>
                </footer>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                const textarea = document.getElementById('folderStructure');
                const statusEl = document.getElementById('status');
                const statusSpan = statusEl.querySelector('span');
                const previewEl = document.getElementById('preview');
                const submitBtn = document.getElementById('submitBtn');
                const copyBtn = document.getElementById('copyBtn');
                const clearBtn = document.getElementById('clearBtn');
                const themeBtn = document.getElementById('themeBtn');

                function updateStatus({ valid, invalidLines, errorMessage }) {
                    // Reset classes
                    statusEl.className = 'status-badge';
                    
                    if (errorMessage) {
                        statusEl.classList.add('invalid');
                        statusSpan.textContent = 'Invalid';
                        return;
                    }
                    
                    if (valid) {
                        statusEl.classList.add('valid');
                        statusSpan.textContent = 'Valid';
                    } else {
                        statusEl.classList.add('invalid');
                        statusSpan.textContent = invalidLines.length > 0 
                            ? \`Invalid (\${invalidLines.length} issues)\`
                            : 'Invalid';
                    }
                }

                function requestValidation() {
                    const content = textarea.value.trim();
                    
                    if (!content) {
                        statusEl.className = 'status-badge';
                        statusSpan.textContent = 'Ready';
                        return;
                    }
                    
                    statusEl.className = 'status-badge warning';
                    statusSpan.textContent = 'Validating...';
                    
                    vscode.postMessage({ command: 'validate', text: content });
                }

                // Debounce function for performance
                function debounce(fn, delay) {
                    let timeoutId;
                    return function(...args) {
                        clearTimeout(timeoutId);
                        timeoutId = setTimeout(() => fn.apply(this, args), delay);
                    };
                }

                const debouncedValidation = debounce(requestValidation, 300);

                // Event listeners
                textarea.addEventListener('input', debouncedValidation);
                
                submitBtn.addEventListener('click', () => {
                    const content = textarea.value.trim();
                    if (content) {
                        vscode.postMessage({ command: 'submit', text: content });
                    }
                });

                copyBtn.addEventListener('click', async () => {
                    const text = previewEl.textContent || '';
                    if (text && text !== "Preview will appear here...") {
                        vscode.postMessage({ command: 'copyPreview', text });
                        
                        // Provide visual feedback
                        const originalText = copyBtn.textContent;
                        copyBtn.textContent = 'Copied!';
                        copyBtn.style.background = 'var(--success)';
                        
                        setTimeout(() => {
                            copyBtn.textContent = originalText;
                            copyBtn.style.background = '';
                        }, 1500);
                    }
                });

                clearBtn.addEventListener('click', () => {
                    if (textarea.value.trim()) {
                        textarea.value = '';
                        previewEl.textContent = '';
                        requestValidation();
                        textarea.focus();
                        
                        // Visual feedback
                        const originalText = clearBtn.textContent;
                        clearBtn.textContent = 'Cleared!';
                        setTimeout(() => {
                            clearBtn.textContent = originalText;
                        }, 1000);
                    }
                });

                // Handle messages from VS Code
                window.addEventListener('message', (event) => {
                    const message = event.data;
                    
                    if (message.command === 'validationResult') {
                        updateStatus(message);
                        previewEl.textContent = message.preview || '';
                    }
                });

                // Initialize with empty state
                requestValidation();
                
                // Theme toggle: infer VS Code theme, allow manual toggle (no persistence)
                function parseColorToRGB(c) {
                    const s = (c || '').toString().trim();
                    if (s.startsWith('#')) {
                        const hex = s.slice(1);
                        const h = hex.length === 3 ? hex.split('').map(x=>x+x).join('') : hex;
                        const num = parseInt(h, 16) || 0x1e1e1e;
                        return { r: (num>>16)&255, g: (num>>8)&255, b: num&255 };
                    }
                    const m = s.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
                    if (m) { return { r:+m[1], g:+m[2], b:+m[3] }; }
                    return { r:30, g:30, b:30 };
                }

                function luminance({r,g,b}) {
                    const a=[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});
                    return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2];
                }

                function setTheme(mode){
                    if(mode==='light') document.documentElement.setAttribute('data-theme','light');
                    else document.documentElement.removeAttribute('data-theme');
                    const icon = document.getElementById('themeIcon');
                    if (icon) icon.textContent = (mode==='light') ? '☾' : '☀';
                }

                (function initTheme(){
                    const bg = getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-background');
                    const lum = luminance(parseColorToRGB(bg));
                    setTheme(lum < 0.5 ? 'dark' : 'light');
                })();

                themeBtn.addEventListener('click', ()=>{
                    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
                    setTheme(isLight ? 'dark' : 'light');
                });
                
                // Focus textarea on load
                setTimeout(() => {
                    textarea.focus();
                }, 100);
            </script>
        </body>
        </html>`;
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
