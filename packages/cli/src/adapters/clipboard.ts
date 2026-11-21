import clipboard from 'clipboardy';

export interface ClipboardAdapter {
    write(text: string): Promise<void>;
}

export const systemClipboard: ClipboardAdapter = {
    write: (text) => clipboard.write(text),
};
