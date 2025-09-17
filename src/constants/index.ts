export const DEFAULT_OUTPUT_FORMAT = 'Plain Text Format';
export const INDENTATION_SPACES = 4;
export const DEFAULT_ENCODING = 'utf-8';

// Tree drawing symbols used for the GitIngest-style formatter and parser
export const TREE_SYMBOLS = {
    VERTICAL: '│',        // vertical guide
    BRANCH: '├── ',       // branch connector (with trailing space)
    LAST: '└── ',         // last connector (with trailing space)
    INDENT: '    '        // 4-space indent used between levels
} as const;

export const ERROR_MESSAGES = {
    INVALID_FILE: 'Invalid file selected. Please try again.',
    INVALID_DIRECTORY: 'Please select a valid folder.',
    PERMISSION_DENIED: 'Permission denied or file inaccessible.',
    EMPTY_STRUCTURE: 'Plain Text structure cannot be empty.',
    TARGET_REQUIRED: 'Target directory is required.'
} as const;

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
