import type { FolderStructure } from './folderStructure.js';
import { parseJsonWithComments, validateJsonStructure } from './json.js';
import { parsePlainTextToStructure, type PlainTextParserOptions } from './parser.js';

/**
 * Reads a folder structure that someone typed, pasted or saved. It is meant for input of
 * unknown origin: it fixes line endings and a missing "Directory structure:" header,
 * guesses the format, and reports problems with line numbers and the offending text.
 */
export type StructureFormat = 'text' | 'json';

export interface InvalidStructureLine {
    /** 1-based line number in the text as the user wrote it. */
    line: number;
    text: string;
}

export type StructureInputResult =
    | { ok: true; format: StructureFormat; structure: FolderStructure }
    | {
          ok: false;
          format: StructureFormat;
          message: string;
          invalidLines: InvalidStructureLine[];
      };

export interface ParseStructureInputOptions {
    /** 'auto' (the default) picks JSON when the text starts with "{". */
    format?: StructureFormat | 'auto';
    /** Passed through to the plain-text parser. */
    parserOptions?: PlainTextParserOptions;
}

const HEADER = 'Directory structure:';
const HEADER_PATTERN = /^\s*Directory structure:/i;

export const EMPTY_STRUCTURE_MESSAGE = 'Empty input or no valid lines.';
export const INVALID_JSON_SHAPE_MESSAGE =
    'JSON structure must be nested objects with string or string[] file types.';

export function detectStructureFormat(text: string): StructureFormat {
    return text
        .replace(/^\uFEFF/, '')
        .trimStart()
        .startsWith('{')
        ? 'json'
        : 'text';
}

/**
 * The plain-text parser treats the first line as a heading and ignores it, so text copied
 * without that heading would silently lose its first line (usually the root folder).
 */
function prepareText(text: string): { text: string; lines: string[]; lineOffset: number } {
    const unified = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const lines = unified.split('\n');
    const leadingBlank = lines.findIndex((line) => line.trim() !== '');
    const significant = leadingBlank === -1 ? [] : lines.slice(leadingBlank);
    const hasHeader = significant.length > 0 && HEADER_PATTERN.test(significant[0]);
    const body = hasHeader ? significant : [HEADER, ...significant];
    return {
        text: body.join('\n'),
        lines,
        // original line = prepared line + lineOffset
        lineOffset: Math.max(leadingBlank, 0) - (hasHeader ? 0 : 1),
    };
}

export function parseStructureInput(
    text: string,
    options: ParseStructureInputOptions = {},
): StructureInputResult {
    const requested = options.format ?? 'auto';
    const format = requested === 'auto' ? detectStructureFormat(text) : requested;

    if (format === 'json') {
        let value: unknown;
        try {
            value = parseJsonWithComments(text.replace(/^\uFEFF/, ''));
        } catch (error) {
            return {
                ok: false,
                format,
                message: `Invalid JSON: ${(error as Error).message}`,
                invalidLines: [],
            };
        }
        return validateJsonStructure(value) && Object.keys(value).length > 0
            ? { ok: true, format, structure: value }
            : {
                  ok: false,
                  format,
                  message: validateJsonStructure(value)
                      ? EMPTY_STRUCTURE_MESSAGE
                      : INVALID_JSON_SHAPE_MESSAGE,
                  invalidLines: [],
              };
    }

    const prepared = prepareText(text);
    const { structure, invalidLines } = parsePlainTextToStructure(
        prepared.text,
        options.parserOptions,
    );
    if (invalidLines.length > 0) {
        return {
            ok: false,
            format,
            message: 'Some lines could not be read.',
            invalidLines: invalidLines.map((line) => {
                const original = line + prepared.lineOffset;
                return { line: original, text: prepared.lines[original - 1] ?? '' };
            }),
        };
    }
    if (Object.keys(structure).length === 0) {
        return { ok: false, format, message: EMPTY_STRUCTURE_MESSAGE, invalidLines: [] };
    }
    return { ok: true, format, structure };
}
