/** A structure is a few kilobytes of text; this only stops a runaway pipe. */
export const MAX_STDIN_BYTES = 5 * 1024 * 1024;

export interface StdinSource extends AsyncIterable<Buffer | string> {
    isTTY?: boolean;
}

/** Reads all of standard input as UTF-8 text. */
export async function readStdinText(
    stream: StdinSource = process.stdin,
    maxBytes = MAX_STDIN_BYTES,
): Promise<string> {
    if (stream.isTTY) {
        throw new Error(
            'Nothing was piped in. Pipe the structure into the command, for example: pbpaste | folder-structure-pro create - --yes',
        );
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
        const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        size += buffer.length;
        if (size > maxBytes) {
            throw new Error(
                `The input is larger than ${Math.round(maxBytes / 1024 / 1024)} MB, which is too large for a folder structure.`,
            );
        }
        chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString('utf8');
}
