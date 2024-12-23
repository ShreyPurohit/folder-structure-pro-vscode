import * as fs from 'fs';
import ignore from 'ignore';
import * as path from 'path';

/**
 * Load ignore rules from a .gitignore file.
 * @param gitignorePath The path to the .gitignore file.
 * @returns An array of ignore rules.
 */
export function loadIgnoreRules(gitignorePath: string): string[] {
    return fs.existsSync(gitignorePath)
        ? fs.readFileSync(gitignorePath, 'utf-8').split('\n').filter(Boolean)
        : [];
}

/**
 * Recursively get folder structure in a hierarchical format.
 * @param dir The directory path.
 * @param ig The ignore instance with rules.
 * @returns A folder structure object.
 */
export function getFolderStructure(dir: string, ig: ReturnType<typeof ignore>): Record<string, any> {
    const result: Record<string, any> = {};
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.name.startsWith('.') || ig.ignores(path.relative(dir, fullPath))) return;
        result[entry.name] = entry.isDirectory() ? getFolderStructure(fullPath, ig) : null;
    });
    return result;
}

/**
 * Format folder structure in the desired output format.
 * @param structure The folder structure object.
 * @param format Output format: 'Plain Text Format' or 'JSON Format'.
 * @returns Formatted structure as a string.
 */
export function formatStructure(structure: Record<string, any>, format: string): string {
    return format === 'Plain Text Format'
        ? toPlainText(structure, 0)
        : JSON.stringify(structure, null, 2);
}

/**
 * Convert folder structure to plain text format.
 * @param structure The folder structure object.
 * @param level The current indentation level.
 * @returns Plain text representation of the folder structure.
 */
function toPlainText(structure: Record<string, any>, level: number): string {
    return Object.entries(structure)
        .map(([key, value]) =>
            ' '.repeat(level * 4) + '|-- ' + key + (value ? '/' : '') + '\n' + (value ? toPlainText(value, level + 1) : '')
        )
        .join('');
}

/**
 * Utility function to create a directory if it doesn't exist.
 * @param dirPath Directory path.
 */
export const ensureDirectoryExists = (dirPath: string): void => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Creates files with an empty content if they don't exist.
 * @param filePath File path.
 */
export const ensureFileExists = (filePath: string): void => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '', 'utf-8');
    }
};
