import { FolderStructure } from '../../types';

export abstract class BaseFormatter {
    abstract format(structure: FolderStructure, level?: number): string;
}