import { FolderStructure } from '../../types';

export abstract class BaseFormatter {
    abstract format(structure: FolderStructure, level?: number): string;
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */