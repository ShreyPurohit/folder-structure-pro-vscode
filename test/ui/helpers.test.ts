import { describe, expect, it } from 'vitest';
import { getExample, getScripts, getStyles } from '../../src/ui/helpers';

describe('ui helpers', () => {
    it('returns plain text and JSON examples', () => {
        expect(getExample('Plain Text Format')).toContain('Directory structure:');
        expect(getExample('JSON Format')).toContain('"project"');
    });

    it('returns styles and a script', () => {
        expect(getStyles()).toContain(':root');
        expect(getScripts('Plain Text Format')).toContain('acquireVsCodeApi');
    });

    it('keeps the layout usable in narrow panels', () => {
        const styles = getStyles();
        expect(styles).toContain('@media (max-width:720px)');
        expect(styles).toContain('@media (max-width:480px)');
        expect(styles).toContain('[hidden]{display:none!important}');
    });

    it('produces a script that is valid JavaScript', () => {
        for (const format of ['Plain Text Format', 'JSON Format']) {
            const script = getScripts(format)
                .replace(/^<script>/, '')
                .replace(/<\/script>$/, '');
            expect(() => new Function(script)).not.toThrow();
        }
    });

    it('avoids CSS that older VS Code versions cannot read', () => {
        expect(getStyles()).not.toContain('color-mix(');
    });
});

type Listener = (event?: Record<string, unknown>) => void;

/** A small stand-in for the elements the real page has, enough to run the real script. */
class FakeElement {
    value = '';
    textContent = '';
    innerHTML = '';
    className = '';
    disabled = false;
    hidden = false;
    scrollTop = 0;
    title = '';
    placeholder = '';
    readonly properties: Record<string, string> = {};
    readonly style = {
        display: '',
        setProperty: (name: string, value: string) => {
            this.properties[name] = value;
        },
    };
    parentNode: FakeElement | null = null;
    children: FakeElement[] = [];
    private attributes: Record<string, string> = {};
    private listeners: Record<string, Listener[]> = {};
    readonly classList = {
        add: (name: string) => {
            this.className = `${this.className} ${name}`.trim();
        },
        remove: (name: string) => {
            this.className = this.className.replace(name, '').trim();
        },
    };
    constructor(attributes: Record<string, string> = {}) {
        this.attributes = { ...attributes };
    }
    get firstChild() {
        return this.children[0] ?? null;
    }
    appendChild(child: FakeElement) {
        this.children.push(child);
    }
    removeChild(child: FakeElement) {
        this.children = this.children.filter((candidate) => candidate !== child);
    }
    setAttribute(name: string, value: string) {
        this.attributes[name] = value;
    }
    removeAttribute(name: string) {
        delete this.attributes[name];
    }
    getAttribute(name: string) {
        return this.attributes[name] ?? null;
    }
    addEventListener(type: string, listener: Listener) {
        (this.listeners[type] ??= []).push(listener);
    }
    dispatch(type: string, event: Record<string, unknown> = {}) {
        this.listeners[type]?.forEach((listener) => listener.call(this, event));
    }
    click() {
        this.dispatch('click');
    }
    focus() {}
    querySelector(selector: string) {
        return selector === '.label' ? (this.label ??= new FakeElement()) : null;
    }
    label?: FakeElement;
}

function openPage(format = 'Plain Text Format') {
    const elements = new Map<string, FakeElement>();
    const byId = (id: string) => {
        if (!elements.has(id)) {
            elements.set(id, new FakeElement());
        }
        return elements.get(id)!;
    };
    byId('destinationPath').setAttribute('data-name', 'shop');
    byId('lineNumbers').parentNode = byId('editor');
    const formatButtons = [
        new FakeElement({ 'data-format': 'Plain Text Format' }),
        new FakeElement({ 'data-format': 'JSON Format' }),
    ];
    const root = new FakeElement();
    const timers: Array<() => void> = [];
    const posted: Array<Record<string, unknown>> = [];
    const windowListeners: Listener[] = [];
    const script = getScripts(format)
        .replace(/^<script>/, '')
        .replace(/<\/script>$/, '');
    new Function(
        'acquireVsCodeApi',
        'document',
        'window',
        'setTimeout',
        'clearTimeout',
        'getComputedStyle',
        script,
    )(
        () => ({ postMessage: (message: Record<string, unknown>) => posted.push(message) }),
        {
            getElementById: byId,
            querySelectorAll: () => formatButtons,
            createElement: () => new FakeElement(),
            documentElement: root,
        },
        {
            addEventListener: (type: string, listener: Listener) => {
                if (type === 'message') {
                    windowListeners.push(listener);
                }
            },
        },
        (callback: () => void) => timers.push(callback),
        () => undefined,
        () => ({ getPropertyValue: () => '#1e1e1e' }),
    );
    const type = (text: string) => {
        byId('folderStructure').value = text;
        byId('folderStructure').dispatch('input');
        timers.splice(0).forEach((callback) => callback());
    };
    return {
        byId,
        root,
        formatButtons,
        posted,
        type,
        receive: (data: Record<string, unknown>) =>
            windowListeners.forEach((listener) => listener({ data })),
        lastPosted: () => posted[posted.length - 1],
    };
}

const VALID = {
    command: 'validationResult',
    valid: true,
    invalidLines: [],
    problems: [],
    counts: { folders: 2, files: 3 },
    preview: 'shop/\n└── a.ts',
};

describe('webview page', () => {
    it('starts empty, with Create and Copy preview disabled', () => {
        const page = openPage();
        expect(page.byId('submitBtn').disabled).toBe(true);
        expect(page.byId('copyBtn').disabled).toBe(true);
        expect(page.byId('status').textContent).toBe('Empty');
        expect(page.byId('summaryText').innerHTML).toContain('insert the example');
    });

    it('shows what will be created and counts it on the button', () => {
        const page = openPage();
        page.type('Directory structure:\n└── shop/');
        expect(page.lastPosted()).toEqual({
            command: 'validate',
            text: 'Directory structure:\n└── shop/',
            format: 'Plain Text Format',
        });
        expect(page.byId('status').textContent).toBe('Checking…');

        page.receive(VALID);
        expect(page.byId('submitBtn').disabled).toBe(false);
        expect(page.byId('submitLabel').textContent).toBe('Create 5 items');
        expect(page.byId('preview').textContent).toBe('shop/\n└── a.ts');
        expect(page.byId('status').textContent).toBe('Valid');
        expect(page.byId('copyBtn').disabled).toBe(false);
        expect(page.byId('summaryText').innerHTML).toBe(
            '<span><b>2 folders and 3 files</b> will be created in <b class="mono">shop</b>. Existing folders are reused, and nothing is replaced without asking.</span>',
        );
    });

    it('lists each line to fix and keeps Create disabled', () => {
        const page = openPage();
        page.type('bad');
        page.receive({
            command: 'validationResult',
            valid: false,
            invalidLines: [3],
            problems: [{ line: 3, text: '      └── deep.ts' }],
        });
        const problems = page.byId('problems');
        expect(problems.hidden).toBe(false);
        expect(page.byId('preview').hidden).toBe(true);
        expect(problems.children).toHaveLength(1);
        expect(problems.children[0].children.map((child) => child.textContent)).toEqual([
            'Line 3',
            '└── deep.ts',
        ]);
        expect(page.byId('status').textContent).toBe('1 line to fix');
        expect(page.byId('submitBtn').disabled).toBe(true);
        expect(page.byId('copyBtn').disabled).toBe(true);
    });

    it('explains an error that has no line numbers', () => {
        const page = openPage('JSON Format');
        page.type('{ nope');
        page.receive({
            command: 'validationResult',
            valid: false,
            invalidLines: [],
            problems: [],
            errorMessage: 'Invalid JSON: <bad>',
        });
        expect(page.byId('status').textContent).toBe('Invalid');
        expect(page.byId('preview').textContent).toBe('Invalid JSON: <bad>');
        // Shown as text, never as markup.
        expect(page.byId('summaryText').innerHTML).toBe('Invalid JSON: &#60;bad&#62;');
    });

    it('sends nothing when Create is clicked while disabled, and submits once valid', () => {
        const page = openPage();
        page.type('Directory structure:\n└── a.ts');
        page.byId('submitBtn').click();
        expect(page.posted.some((message) => message.command === 'submit')).toBe(false);

        page.receive(VALID);
        page.byId('submitBtn').click();
        expect(page.lastPosted()).toEqual({
            command: 'submit',
            text: 'Directory structure:\n└── a.ts',
            format: 'Plain Text Format',
        });
    });

    it('submits with Ctrl+Enter only when valid', () => {
        const page = openPage();
        page.type('x');
        page.byId('folderStructure').dispatch('keydown', { ctrlKey: true, key: 'Enter' });
        expect(page.posted.some((message) => message.command === 'submit')).toBe(false);
        page.receive(VALID);
        page.byId('folderStructure').dispatch('keydown', { metaKey: true, key: 'Enter' });
        expect(page.lastPosted()).toMatchObject({ command: 'submit' });
    });

    it('disables Create again as soon as the text changes', () => {
        const page = openPage();
        page.type('a');
        page.receive(VALID);
        expect(page.byId('submitBtn').disabled).toBe(false);
        page.byId('folderStructure').value = 'edited';
        page.byId('folderStructure').dispatch('input');
        expect(page.byId('submitBtn').disabled).toBe(true);
    });

    it('numbers every line and follows scrolling', () => {
        const page = openPage();
        expect(page.byId('lineNumbers').textContent).toBe('1');
        page.type('a\nb\nc');
        expect(page.byId('lineNumbers').textContent).toBe('1\n2\n3');
        expect(page.byId('editor').properties['--digits']).toBe('1');
        page.type(Array.from({ length: 120 }, (_, index) => `line ${index}`).join('\n'));
        expect(page.byId('lineNumbers').textContent?.split('\n').at(-1)).toBe('120');
        // The number column widens for three-digit numbers.
        expect(page.byId('editor').properties['--digits']).toBe('3');
        page.byId('folderStructure').scrollTop = 120;
        page.byId('folderStructure').dispatch('scroll');
        expect(page.byId('lineNumbers').scrollTop).toBe(120);
    });

    it('updates the numbers when the example is inserted or the text cleared', () => {
        const page = openPage();
        page.byId('exampleBtn').click();
        expect(page.byId('lineNumbers').textContent?.split('\n')).toHaveLength(
            getExample('Plain Text Format').split('\n').length,
        );
        page.byId('clearBtn').click();
        expect(page.byId('lineNumbers').textContent).toBe('1');
    });

    it('switches the format and checks the text again', () => {
        const page = openPage();
        page.type('{"a": "ts"}');
        page.formatButtons[1].click();
        expect(page.formatButtons[1].getAttribute('aria-checked')).toBe('true');
        expect(page.formatButtons[0].getAttribute('aria-checked')).toBe('false');
        expect(page.lastPosted()).toMatchObject({ command: 'validate', format: 'JSON Format' });
        expect(page.byId('folderStructure').placeholder).toBe('Paste JSON here…');
    });

    it('inserts the example for the current format, and clears', () => {
        const page = openPage('JSON Format');
        page.byId('exampleBtn').click();
        expect(page.byId('folderStructure').value).toBe(getExample('JSON Format'));
        page.byId('clearBtn').click();
        expect(page.byId('folderStructure').value).toBe('');
        expect(page.byId('submitBtn').disabled).toBe(true);
    });

    it('copies only a valid preview', () => {
        const page = openPage();
        page.byId('copyBtn').click();
        expect(page.posted.some((message) => message.command === 'copyPreview')).toBe(false);
        page.type('a');
        page.receive(VALID);
        page.byId('copyBtn').click();
        expect(page.lastPosted()).toEqual({ command: 'copyPreview', text: 'shop/\n└── a.ts' });
        expect(page.byId('copyBtn').label?.textContent).toBe('Copied');
    });

    it('asks the extension to change the folder, copy the command and open the npm page', () => {
        const page = openPage();
        page.byId('changeDestinationBtn').click();
        page.byId('copyCommandBtn').click();
        page.byId('learnMoreBtn').click();
        expect(page.posted.slice(-3)).toEqual([
            { command: 'changeDestination' },
            { command: 'copyCommand' },
            { command: 'learnMore' },
        ]);
        expect(page.byId('copyCommandBtn').label?.textContent).toBe('Copied');
    });

    it('shows a new destination and uses its name in the summary', () => {
        const page = openPage();
        page.receive({ command: 'destination', path: '/work/api', name: 'api' });
        expect(page.byId('destinationPathText').textContent).toBe('/work/api');
        expect(page.byId('destinationPath').title).toBe('/work/api');
        page.type('a');
        page.receive(VALID);
        expect(page.byId('summaryText').innerHTML).toContain('<b class="mono">api</b>');
    });

    it('follows the VS Code theme and keeps the toggle', () => {
        const page = openPage();
        expect(page.root.getAttribute('data-theme')).toBeNull();
        expect(page.byId('themeBtn').title).toBe('Switch to light theme');
        page.byId('themeBtn').click();
        expect(page.root.getAttribute('data-theme')).toBe('light');
        expect(page.byId('themeBtn').title).toBe('Switch to dark theme');
    });
});
