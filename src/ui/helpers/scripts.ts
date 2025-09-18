export const getScripts = () => {
    return `
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
    `;
};
