# Change Log

## [0.1.1] - 2026-11-23

### Added

- Copying over SSH or on a machine without a desktop session now falls back to the terminal clipboard (OSC 52), so the structure can reach your local clipboard without `xsel`, `xclip` or `wl-copy` on the server. Works through tmux.
- In the interactive flow, when no clipboard route works, you can now print the structure to the terminal or save it to a file instead of ending with an error.
- npm releases are published from GitHub Actions with provenance.
- Interactive mode: directory prompts now autocomplete folders (press Tab), a spinner shows while the folder is scanned, and a missing structure file is reported immediately so you can correct the path instead of the run ending.

### Changed

- This removes `clipboardy` and its transitive dependencies from the CLI package.
- Clipboard failures are explained in plain language, one reason per line, including which clipboard tool to install on Linux (for example, `sudo apt install xclip`).
- The success message says "Sent … to your terminal's clipboard" when the copy could not be confirmed, with a hint to use `export --output` if the paste is empty.
- Over SSH, the CLI now asks your local terminal emulator to update its clipboard first, rather than attempting to copy to the remote machine's clipboard. A forwarded X11 or Wayland display on Linux is still used.

## [0.1.0] - 2026-11-23

### Added

- Initial release: `copy`, `export` and `create` commands, plus an interactive menu, for folder structures in Plain Text and JSON.
