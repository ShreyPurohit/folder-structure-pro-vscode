import { FolderStructure } from '../../types';
import { BaseFormatter } from './baseFormatter';

export class JsonFormatter extends BaseFormatter {
    format(structure: FolderStructure): string {
        return JSON.stringify(structure, null, 2);
    }
}