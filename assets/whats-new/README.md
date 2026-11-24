# What's New images

Images shown on the extension's **What's New** page (`src/whatsNew.ts`). Add them with these
exact names; a missing image is left out of the page, so the extension works without them.

| File                 | Shows                                     |
| -------------------- | ----------------------------------------- |
| `extension-view.png` | The new **Create Folder Structure** panel |
| `cli.png`            | `npx folder-structure-pro` in a terminal  |

Only the `.png` files in this folder are packaged (see `.vscodeignore`); this README is not.
Keep them reasonably small (under about 300 KB each), since they ship inside the extension.
