![Copy Folder Structure](assets/banner.webp)

## Features:
- **Copy Folder Structure** to clipboard.
- Supports two **output formats**: 
  - **JSON Format** (default)
  - **Plain Text Format** (tree-like structure with `|--` for hierarchy).
- Right-click context menu in **Explorer** for easy access.
- Automatically **ignores files and folders** specified in `.gitignore` (e.g., `node_modules`).

## Installation:
1. Open **VS Code**.
2. Go to the **Extensions** tab.
3. Search for **Copy Folder Structure** and click **Install**.

## Usage:
- **Right-click a folder** in **Explorer** and select **Copy Folder Structure**.
- Alternatively, open **Command Palette** (`Ctrl+Shift+P`) and search for **Copy Folder Structure**.

## Settings:
- **outputFormat**: Choose between:
  - `JSON Format`
  - `Plain Text Format`

Modify in **Settings** (`Ctrl+,`) under `folderStructure`.

## Example Output:
- **JSON Format**:
    ```json
    {
      "app": {
        "index.js": null,
        "hello.js": null
      },
      "test": {
        "test.ts": null
      }
    }
    ```
- **Plain Text Format**:
    ```
    app
       |-- index.js
       |-- hello.js
    test
       |-- test.ts
    ```

## How It Works:
- Scans the folder structure, respecting `.gitignore` files.
- Excludes files like `node_modules` and `hidden files` by default.
- Copies the structure to clipboard in the selected format.

## Troubleshooting:
- **No Option in Context Menu**: Reload VS Code (`Ctrl+Shift+P` → `Reload Window`).
- **Clipboard Not Working**: Check system permissions.

## License:
MIT License.

## Contact:
For questions, open an issue on the [GitHub repository](https://github.com/ShreyPurohit/copy-folder-structure-vscode/issues).