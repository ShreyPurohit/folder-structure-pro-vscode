import {
    parseStructureInput,
    type FolderStructure,
    type StructureFormat,
    type StructureInputResult,
} from '@folder-structure-pro/core';

export type InvalidStructure = Extract<StructureInputResult, { ok: false }>;

/** Explains what is wrong with a structure, naming the lines the user should look at. */
export function formatStructureProblem(problem: InvalidStructure): string {
    if (problem.invalidLines.length === 0) {
        return problem.message;
    }
    const shown = problem.invalidLines.slice(0, 5);
    const lines = [
        `Invalid plain-text structure lines: ${problem.invalidLines.map(({ line }) => line).join(', ')}.`,
        ...shown.map(({ line, text }) => `- line ${line}: ${text.trim()}`),
    ];
    if (problem.invalidLines.length > shown.length) {
        lines.push(`- and ${problem.invalidLines.length - shown.length} more`);
    }
    return lines.join('\n');
}

/** For non-interactive use: a structure that cannot be read stops the run before anything is created. */
export function parseStructureOrThrow(text: string, format?: StructureFormat): FolderStructure {
    const result = parseStructureInput(text, { format });
    if (!result.ok) {
        throw new Error(`${formatStructureProblem(result)}\nNo files or directories were created.`);
    }
    return result.structure;
}

// Comment lines at the top of the editor file, like the ones `git commit` shows.
const COMMENT_PATTERN = /^#(?: .*)?$/;

/**
 * The text the editor opens with: the structure so far (empty at first, so the cursor sits
 * where a paste belongs), then a few comment lines like the ones `git commit` shows. Keeping
 * the structure first means line numbers in the editor match the numbers in error messages.
 */
export function buildEditorText(
    structure: string,
    options: { instructions?: string; problem?: InvalidStructure } = {},
): string {
    const comments = [
        '# Paste your structure above: a tree like the one this tool copies, or JSON.',
        options.instructions ? `# ${options.instructions}` : undefined,
        '# Lines that start with "# " are ignored.',
        ...(options.problem
            ? [
                  '#',
                  '# These lines could not be read:',
                  ...(options.problem.invalidLines.length > 0
                      ? options.problem.invalidLines.map(
                            ({ line, text }) => `#   line ${line}: ${text.trim()}`,
                        )
                      : [`#   ${options.problem.message}`]),
              ]
            : []),
    ].filter((line): line is string => line !== undefined);
    return `${structure}\n\n${comments.join('\n')}\n`;
}

/** Removes the comment lines added by buildEditorText (and any the user added). */
export function stripEditorComments(text: string): string {
    return text
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .filter((line) => !COMMENT_PATTERN.test(line))
        .join('\n');
}
