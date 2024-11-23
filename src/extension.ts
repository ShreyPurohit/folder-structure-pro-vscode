import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

// Activates the extension
export function activate(context: vscode.ExtensionContext): void {
	const copyFolderStructure = vscode.commands.registerCommand(
		'extension.copyFolderStructure',
		async (uri: vscode.Uri) => {
			try {
				if (!uri || !fs.statSync(uri.fsPath).isDirectory()) {
					vscode.window.showErrorMessage('Please select a valid folder.');
					return;
				}
				const rootPath = uri.fsPath;
				const gitignorePath = path.join(rootPath, '.gitignore');
				// Load .gitignore rules
				const ignoreRules = loadIgnoreRules(gitignorePath);
				const ig = ignore().add(ignoreRules);
				// Generate folder structure
				const structure = getFolderStructure(rootPath, ig);
				// Get output format from settings
				const outputFormat = vscode.workspace
					.getConfiguration('folderStructure')
					.get<string>('outputFormat', 'JSON Format');
				const formattedStructure = formatStructure(structure, outputFormat);
				// Copy to clipboard
				await vscode.env.clipboard.writeText(formattedStructure);
				vscode.window.showInformationMessage('Folder structure copied to clipboard!');
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to copy folder structure: ${(error as Error).message}`);
			}
		}
	);
	context.subscriptions.push(copyFolderStructure);
}

// Loads ignore rules from .gitignore if it exists
function loadIgnoreRules(gitignorePath: string): string[] {
	if (fs.existsSync(gitignorePath)) {
		const rules = fs.readFileSync(gitignorePath, 'utf-8').split('\n').filter(Boolean);
		return rules;
	}
	return [];
}

// Generates the folder structure as a nested object
function getFolderStructure(dir: string, ig: ReturnType<typeof ignore>): Record<string, Record<string, any> | null> {
	const result: Record<string, Record<string, any> | null> = {};
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		const relativePath = path.relative(dir, fullPath);

		if (entry.name.startsWith('.') || ig.ignores(relativePath)) {
			continue;
		}

		if (entry.isDirectory()) {
			result[entry.name] = getFolderStructure(fullPath, ig);
		} else {
			result[entry.name] = null;
		}
	}

	return result;
}

// Formats the folder structure based on the chosen format
function formatStructure(structure: Record<string, Record<string, any> | null>, format: string): string {
	if (format === 'Plain Text Format') {
		return toPlainText(structure, 0);
	}
	return JSON.stringify(structure, null, 2);
}

// Converts the folder structure to plain text format
function toPlainText(structure: Record<string, Record<string, any> | null>, level: number): string {
	let result = '';
	for (const [key, value] of Object.entries(structure)) {
		result += ' '.repeat(level * 4) + '|-- ' + key + (value ? '/' : '') + '\n';  // Adjusted line for tree structure
		if (value) {
			result += toPlainText(value, level + 1);
		}
	}
	return result;
}

/*
 * Copyright (c) 2024 Shrey Purohit.
 * This code is licensed under the MIT License.
 */