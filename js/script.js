var require = {
    paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }
};

// --- Application State ---
const AppState = {
    files: {
        'file-1': { id: 'file-1', name: 'index.html', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <style>\n    body { font-family: system-ui; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }\n    .glow { text-shadow: 0 0 20px #38bdf8; color: #38bdf8; }\n  </style>\n</head>\n<body>\n  <h1 class="glow">Nexus Environment Ready</h1>\n  <script src="main.js"><\/script>\n</body>\n</html>', language: 'html' },
        'file-2': { id: 'file-2', name: 'style.css', content: '/* Add your styles here */\n\nbody {\n  margin: 0;\n  padding: 0;\n}', language: 'css' },
        'file-3': { id: 'file-3', name: 'main.js', content: '// Welcome to Nexus IDE\n// A futuristic coding workspace\n\nfunction initialize() {\n  console.log("System core online.");\n  // Start building your app here\n}\n\ninitialize();', language: 'javascript' }
    },
    tabs: ['file-1', 'file-2', 'file-3'],
    activeTabId: 'file-3',
    layout: {
        left: true,
        right: false,
        bottom: true
    },
    isMobile: window.innerWidth < 768
};

// --- Global Instances ---
let editor;
let terminal;
let terminalFit;
let splitH, splitV;

// --- Utility Functions ---
const $ = (id) => document.getElementById(id);
const generateId = () => 'file-' + Math.random().toString(36).substr(2, 9);
const getFileLang = (name) => {
    if (name.endsWith('.js')) return 'javascript';
    if (name.endsWith('.ts')) return 'typescript';
    if (name.endsWith('.html')) return 'html';
    if (name.endsWith('.css')) return 'css';
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.md')) return 'markdown';
    return 'plaintext';
};
const getFileIcon = (name) => {
    if (name.endsWith('.js')) return '<span class="text-yellow-400 font-bold mr-2 text-xs">JS</span>';
    if (name.endsWith('.html')) return '<span class="text-orange-500 font-bold mr-2 text-xs">&lt;&gt;</span>';
    if (name.endsWith('.css')) return '<span class="text-blue-400 font-bold mr-2 text-xs">#</span>';
    if (name.endsWith('.json')) return '<span class="text-green-400 font-bold mr-2 text-[10px]">{ }</span>';
    return '<i data-lucide="file-text" class="w-3.5 h-3.5 text-zinc-400 mr-2"></i>';
};

// --- Initialization Sequence ---
window.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    // 1. Initialize Layouts
    initLayout();
    window.addEventListener('resize', handleResize);

    // 2. Initialize Terminal
    initTerminal();

    // 3. Load Monaco
    await loadMonacoEditor();

    // 4. Render UI elements
    renderFileTree();
    renderTabs();
    updateEditorContent();
    updateWelcomeScreen();

    // 5. Setup Event Listeners
    setupEventListeners();

    // 6. Remove Splash Screen with Animation
    setTimeout(() => {
        const splash = $('splash-screen');
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 500);
    }, 1500);
});

// --- Layout Management ---
function initLayout() {
    if (!AppState.isMobile) {
        // Initialize Split.js only for Desktop/Tablet
        splitH = Split(['#sidebar-left', '#center-area', '#sidebar-right'], {
            sizes: [20, 80, 0], // Start with right sidebar hidden
            minSize: [200, 300, 0],
            gutterSize: 4,
            snapOffset: 0,
            onDragEnd: () => { if (editor) editor.layout(); if (terminalFit) terminalFit.fit(); }
        });

        splitV = Split(['#editor-pane', '#bottom-panel'], {
            direction: 'vertical',
            sizes: [70, 30],
            minSize: [100, 36],
            gutterSize: 4,
            onDragEnd: () => { if (editor) editor.layout(); if (terminalFit) terminalFit.fit(); }
        });

        // Hide panels based on state
        if (!AppState.layout.left) {
            splitH.setSizes([0, 100, 0]);
            $('sidebar-left').style.display = 'none';
        }
    }
}

function handleResize() {
    const isNowMobile = window.innerWidth < 768;
    if (isNowMobile !== AppState.isMobile) {
        AppState.isMobile = isNowMobile;
        location.reload(); // Simplest way to cleanly swap responsive paradigms for this demo
    }
    if (editor) editor.layout();
    if (terminalFit) terminalFit.fit();
}

function togglePanel(panel) {
    if (AppState.isMobile) return; // Panels are handled via bottom nav on mobile

    if (panel === 'right') {
        AppState.layout.right = !AppState.layout.right;
        if (AppState.layout.right) {
            $('sidebar-right').style.display = 'flex';
            splitH.setSizes([20, 55, 25]);
        } else {
            $('sidebar-right').style.display = 'none';
            splitH.setSizes([20, 80, 0]);
        }
    } else if (panel === 'bottom') {
        AppState.layout.bottom = !AppState.layout.bottom;
        if (AppState.layout.bottom) {
            $('bottom-panel').style.display = 'flex';
            splitV.setSizes([70, 30]);
        } else {
            $('bottom-panel').style.display = 'none';
            splitV.setSizes([100, 0]);
        }
    } else if (panel === 'left') {
        AppState.layout.left = !AppState.layout.left;
        if (AppState.layout.left) {
            $('sidebar-left').style.display = 'flex';
            splitH.setSizes([20, AppState.layout.right ? 55 : 80, AppState.layout.right ? 25 : 0]);
        } else {
            $('sidebar-left').style.display = 'none';
            splitH.setSizes([0, AppState.layout.right ? 70 : 100, AppState.layout.right ? 30 : 0]);
        }
    }

    if (editor) editor.layout();
    if (terminalFit) terminalFit.fit();
}

// --- Terminal Integration ---
function initTerminal() {
    terminal = new Terminal({
        theme: {
            background: '#18181b', // panel bg
            foreground: '#e4e4e7',
            cursor: '#06b6d4',
            selectionBackground: 'rgba(6, 182, 212, 0.3)'
        },
        fontFamily: '"Fira Code", monospace',
        fontSize: 12,
        cursorBlink: true
    });
    terminalFit = new FitAddon.FitAddon();
    terminal.loadAddon(terminalFit);

    terminal.open($('terminal-container'));
    terminalFit.fit();

    terminal.writeln('\x1b[1;36mNexus OS Terminal v1.0.0\x1b[0m');
    terminal.writeln('Type "help" for a list of commands.');
    terminal.write('\r\n\x1b[1;35m~/workspace\x1b[0m$ ');

    // Simple terminal echo
    let currentLine = '';
    terminal.onData(e => {
        if (e === '\r') { // Enter
            terminal.write('\r\n');
            if (currentLine === 'help') {
                terminal.writeln('Available commands: help, clear, build, start');
            } else if (currentLine === 'clear') {
                terminal.clear();
            } else if (currentLine.trim() !== '') {
                terminal.writeln(`Command not found: ${currentLine}`);
            }
            currentLine = '';
            terminal.write('\x1b[1;35m~/workspace\x1b[0m$ ');
        } else if (e === '\x7F') { // Backspace
            if (currentLine.length > 0) {
                currentLine = currentLine.substring(0, currentLine.length - 1);
                terminal.write('\b \b');
            }
        } else {
            currentLine += e;
            terminal.write(e);
        }
    });
}

// --- Monaco Editor Integration ---
function loadMonacoEditor() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
        script.onload = () => {
            require(['vs/editor/editor.main'], function () {

                // Define Custom Theme
                monaco.editor.defineTheme('nexus-dark', {
                    base: 'vs-dark',
                    inherit: true,
                    rules: [
                        { token: 'keyword', foreground: 'c586c0' }, // Violet-ish
                        { token: 'identifier', foreground: '9cdcfe' }, // Light blue
                        { token: 'string', foreground: 'ce9178' },
                        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' }
                    ],
                    colors: {
                        'editor.background': '#09090b', // workspace bg
                        'editor.lineHighlightBackground': '#ffffff0a',
                        'editorLineNumber.foreground': '#52525b',
                        'editorIndentGuide.background': '#27272a',
                        'editorSuggestWidget.background': '#18181b',
                        'editorSuggestWidget.border': '#27272a',
                    }
                });

                // Ensure Worker doesn't throw CORS errors in plain HTML
                window.MonacoEnvironment = {
                    getWorkerUrl: function (workerId, label) {
                        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                                    self.MonacoEnvironment = { baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/' };
                                    importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/base/worker/workerMain.js');
                                `)}`;
                    }
                };

                editor = monaco.editor.create($('monaco-editor'), {
                    value: '',
                    language: 'javascript',
                    theme: 'nexus-dark',
                    automaticLayout: true,
                    minimap: { enabled: !AppState.isMobile },
                    fontFamily: '"Fira Code", Consolas, monospace',
                    fontSize: 13,
                    fontLigatures: true,
                    padding: { top: 16 },
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    formatOnPaste: true,
                });

                // Handle Content Change
                editor.onDidChangeModelContent(() => {
                    if (AppState.activeTabId) {
                        AppState.files[AppState.activeTabId].content = editor.getValue();
                    }
                });

                // Handle Cursor Position update
                editor.onDidChangeCursorPosition((e) => {
                    $('status-cursor').innerText = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
                });

                $('editor-loading').style.display = 'none';
                resolve();
            });
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

// --- UI Rendering ---
function renderFileTree() {
    const renderTo = (containerId) => {
        const container = $(containerId);
        if (!container) return;
        container.innerHTML = '';

        Object.values(AppState.files).forEach(file => {
            const el = document.createElement('div');
            const isActive = file.id === AppState.activeTabId;

            el.className = `flex items-center px-2 py-1.5 rounded cursor-pointer text-xs mb-0.5 transition-colors ${isActive ? 'bg-accent/10 text-accent font-medium' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`;
            el.innerHTML = `
                        ${getFileIcon(file.name)}
                        <span class="flex-1 truncate">${file.name}</span>
                        ${isActive ? '<div class="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_5px_rgba(6,182,212,0.8)]"></div>' : ''}
                    `;
            el.onclick = () => openFile(file.id);
            container.appendChild(el);
        });
    };

    renderTo('file-tree'); // Desktop
    renderTo('mobile-file-tree'); // Mobile
}

function renderTabs() {
    const container = $('editor-tabs');
    container.innerHTML = '';

    AppState.tabs.forEach(tabId => {
        const file = AppState.files[tabId];
        if (!file) return;

        const isActive = tabId === AppState.activeTabId;
        const tab = document.createElement('div');
        tab.className = `group flex items-center h-full px-3 min-w-[120px] max-w-[200px] border-r border-border cursor-pointer select-none transition-all ${isActive ? 'bg-workspace border-t-2 border-t-accent text-white' : 'bg-panel text-zinc-500 hover:bg-workspace/50 border-t-2 border-t-transparent hover:text-zinc-300'}`;

        tab.innerHTML = `
                    <div class="flex-1 flex items-center min-w-0" onclick="window.openFile('${file.id}')">
                        ${getFileIcon(file.name)}
                        <span class="truncate text-xs ${isActive ? 'font-medium' : ''}">${file.name}</span>
                    </div>
                    <button class="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-zinc-400 hover:text-white" onclick="event.stopPropagation(); window.closeTab('${file.id}')">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                `;

        // Keep active tab cross icon always visible
        if (isActive) {
            tab.querySelector('button').classList.remove('opacity-0');
            tab.querySelector('button').classList.add('opacity-100');
        }

        container.appendChild(tab);
    });

    lucide.createIcons({ root: container });
}

function updateEditorContent() {
    if (!editor) return;

    if (!AppState.activeTabId || !AppState.files[AppState.activeTabId]) {
        editor.setValue('');
        $('status-lang').innerText = 'Plain Text';
        $('breadcrumb-current').innerText = '';
        return;
    }

    const file = AppState.files[AppState.activeTabId];

    // Set model value safely
    const currentVal = editor.getValue();
    if (currentVal !== file.content) {
        editor.setValue(file.content);
    }

    monaco.editor.setModelLanguage(editor.getModel(), file.language);

    $('status-lang').innerText = file.language.charAt(0).toUpperCase() + file.language.slice(1);
    $('breadcrumb-current').innerText = file.name;
}

function updateWelcomeScreen() {
    const hasTabs = AppState.tabs.length > 0;
    $('welcome-screen').style.display = hasTabs ? 'none' : 'flex';
    $('monaco-container').style.display = hasTabs ? 'block' : 'none';
}

// --- Core Actions ---
window.openFile = function (fileId) {
    if (!AppState.tabs.includes(fileId)) {
        AppState.tabs.push(fileId);
    }
    AppState.activeTabId = fileId;

    // Close preview if opening a file
    $('preview-container').classList.add('hidden');
    $('monaco-container').classList.remove('hidden');

    renderFileTree();
    renderTabs();
    updateEditorContent();
    updateWelcomeScreen();

    if (AppState.isMobile) {
        switchMobileView('editor');
    }
};

window.closeTab = function (fileId) {
    AppState.tabs = AppState.tabs.filter(id => id !== fileId);
    if (AppState.activeTabId === fileId) {
        AppState.activeTabId = AppState.tabs.length > 0 ? AppState.tabs[AppState.tabs.length - 1] : null;
    }
    renderFileTree();
    renderTabs();
    updateEditorContent();
    updateWelcomeScreen();
};

function createNewFile() {
    const name = prompt("Enter file name:", "untitled.js");
    if (!name) return;

    const id = generateId();
    AppState.files[id] = {
        id,
        name,
        content: '',
        language: getFileLang(name)
    };

    openFile(id);
}

function runLivePreview() {
    // Find HTML, CSS, JS files
    let html = '', css = '', js = '';

    Object.values(AppState.files).forEach(f => {
        if (f.language === 'html') html = f.content;
        if (f.language === 'css') css = f.content;
        if (f.language === 'javascript') js = f.content;
    });

    // Minimal fallback if no HTML found but JS exists
    if (!html && js) {
        html = `<html><body><h2>Preview</h2><p>Check console for output.</p></body></html>`;
    }

    const blob = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>${css}</style>
                </head>
                <body>
                    ${html}
                    <script>
                        // Intercept console.log to show in terminal
                        const originalLog = console.log;
                        console.log = function(...args) {
                            window.parent.postMessage({ type: 'console', data: args }, '*');
                            originalLog.apply(console, args);
                        };
                        
                        try {
                            ${js}
                        } catch(e) {
                            window.parent.postMessage({ type: 'error', data: e.message }, '*');
                        }
                    <\/script>
                </body>
                </html>
            `;

    $('monaco-container').classList.add('hidden');
    $('preview-container').classList.remove('hidden');

    const iframe = $('preview-iframe');
    iframe.srcdoc = blob;

    // Optional: Open terminal to show logs
    if (!AppState.layout.bottom && !AppState.isMobile) {
        togglePanel('bottom');
    }
}

// Listen for iframe messages
window.addEventListener('message', (e) => {
    if (!terminal) return;
    if (e.data && e.data.type === 'console') {
        terminal.writeln(`\x1b[36m[Preview]\x1b[0m ${e.data.data.join(' ')}`);
    } else if (e.data && e.data.type === 'error') {
        terminal.writeln(`\x1b[31m[Error]\x1b[0m ${e.data.data}`);
    }
});

// --- Mobile Specific ---
function switchMobileView(view) {
    if (!AppState.isMobile) return;

    // Reset all
    $('split-v').style.display = 'none';
    $('mobile-files-modal').style.display = 'none';
    $('bottom-panel').classList.add('hidden');
    $('sidebar-right').style.display = 'none';

    document.querySelectorAll('.mobile-nav').forEach(el => {
        el.classList.remove('text-accent', 'active');
        el.classList.add('text-zinc-500');
    });
    document.querySelector(`.mobile-nav[data-view="${view}"]`).classList.add('text-accent', 'active');
    document.querySelector(`.mobile-nav[data-view="${view}"]`).classList.remove('text-zinc-500');

    if (view === 'editor') {
        $('split-v').style.display = 'flex';
        $('editor-pane').style.display = 'flex';
        $('editor-pane').style.height = '100%';
        if (editor) setTimeout(() => editor.layout(), 100);
    } else if (view === 'files') {
        $('mobile-files-modal').style.display = 'flex';
    } else if (view === 'terminal') {
        $('split-v').style.display = 'flex';
        $('editor-pane').style.display = 'none';
        $('bottom-panel').classList.remove('hidden');
        $('bottom-panel').style.height = '100%';
        if (terminalFit) setTimeout(() => terminalFit.fit(), 100);
    } else if (view === 'ai') {
        $('sidebar-right').style.display = 'flex';
        $('sidebar-right').style.width = '100%';
        $('sidebar-right').style.height = '100%';
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {

    // Buttons
    $('btn-new-file').addEventListener('click', createNewFile);
    $('btn-welcome-new').addEventListener('click', createNewFile);
    $('btn-run').addEventListener('click', runLivePreview);
    $('btn-close-preview').addEventListener('click', () => {
        $('preview-container').classList.add('hidden');
        $('monaco-container').classList.remove('hidden');
    });

    // Panel Toggles
    $('btn-toggle-ai').addEventListener('click', () => togglePanel('right'));
    $('btn-close-ai').addEventListener('click', () => togglePanel('right'));
    $('btn-close-terminal').addEventListener('click', () => togglePanel('bottom'));

    // Activity Bar (Desktop)
    document.querySelectorAll('.nav-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            document.querySelectorAll('.nav-icon').forEach(i => {
                i.classList.remove('text-white', 'active');
                i.classList.add('text-zinc-500');
                i.querySelector('.active-indicator').classList.add('hidden');
            });
            btn.classList.add('text-white', 'active');
            btn.classList.remove('text-zinc-500');
            btn.querySelector('.active-indicator').classList.remove('hidden');

            if (btn.dataset.panel === 'explorer' && !AppState.layout.left) {
                togglePanel('left');
            }
        });
    });

    // Mobile Nav
    document.querySelectorAll('.mobile-nav').forEach(btn => {
        btn.addEventListener('click', (e) => switchMobileView(e.currentTarget.dataset.view));
    });

    // Command Palette
    const cmdModal = $('cmd-palette-modal');
    const cmdContent = $('cmd-palette-content');
    const cmdInput = $('cmd-input');

    const openCmd = () => {
        cmdModal.classList.remove('hidden');
        cmdModal.classList.add('flex');
        // Animate in
        setTimeout(() => {
            cmdModal.classList.add('opacity-100');
            cmdContent.classList.remove('scale-95', 'opacity-0');
            cmdContent.classList.add('scale-100', 'opacity-100');
            cmdInput.focus();
        }, 10);
    };

    const closeCmd = () => {
        cmdModal.classList.remove('opacity-100');
        cmdContent.classList.remove('scale-100', 'opacity-100');
        cmdContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            cmdModal.classList.add('hidden');
            cmdModal.classList.remove('flex');
        }, 200);
    };

    $('cmd-palette-trigger').addEventListener('click', openCmd);

    cmdModal.addEventListener('click', (e) => {
        if (e.target === cmdModal) closeCmd();
    });

    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + P
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            openCmd();
        }
        if (e.key === 'Escape' && !cmdModal.classList.contains('hidden')) {
            closeCmd();
        }
    });

    // AI Chat Simulation
    const aiInput = $('ai-input');
    aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = aiInput.value.trim();
            if (!text) return;

            const chatArea = $('ai-chat-area');

            // User Msg
            chatArea.innerHTML += `
                        <div class="flex flex-col gap-1 items-end mt-4">
                            <div class="bg-primary/20 border border-primary/30 rounded-lg rounded-tr-none p-3 text-zinc-200 text-sm max-w-[90%] shadow-sm">
                                ${text}
                            </div>
                        </div>
                    `;
            aiInput.value = '';

            // Loading
            const typingId = 'typing-' + Date.now();
            chatArea.innerHTML += `
                        <div id="${typingId}" class="flex flex-col gap-1 mt-4">
                            <div class="flex items-center gap-2 text-xs text-primary font-medium mb-1">
                                <i data-lucide="bot" class="w-4 h-4"></i> Nexus AI
                            </div>
                            <div class="text-zinc-500 text-xs flex gap-1 items-center">
                                <div class="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"></div>
                                <div class="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style="animation-delay: 0.2s"></div>
                                <div class="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style="animation-delay: 0.4s"></div>
                            </div>
                        </div>
                    `;
            lucide.createIcons({ root: chatArea });
            chatArea.scrollTop = chatArea.scrollHeight;

            // Mock response
            setTimeout(() => {
                $(typingId).remove();
                chatArea.innerHTML += `
                            <div class="flex flex-col gap-1 mt-2">
                                <div class="flex items-center gap-2 text-xs text-primary font-medium mb-1">
                                    <i data-lucide="bot" class="w-4 h-4"></i> Nexus AI
                                </div>
                                <div class="bg-zinc-800/50 border border-zinc-700 rounded-lg rounded-tl-none p-3 text-zinc-300 leading-relaxed shadow-sm text-sm">
                                    I analyzed your query. As an AI integrated directly into your Nexus environment, I can contextually edit your active file. Let me know if you want me to write the code.
                                </div>
                            </div>
                        `;
                lucide.createIcons({ root: chatArea });
                chatArea.scrollTop = chatArea.scrollHeight;
            }, 1500);
        }
    });
}
