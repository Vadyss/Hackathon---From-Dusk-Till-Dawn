# UI concept

A standalone, interactive design concept with sample data. It has no dependencies, makes no backend requests, and does not change the production frontend or backend.

From this directory, run:

```sh
npm start
```

On Windows PowerShell, use `npm.cmd start`. Open http://127.0.0.1:3100. The real frontend on port 3000 runs independently. Set the `PORT` environment variable to use another preview port.

Use the preview state selector to explore **Ready**, **Working**, **Review**, and **Offline**. Try the scripted workflow, approval and rejection, run comparison, and skills. All actions stay inside this preview and do not install skills or run real tasks.

Every submitted prompt follows the same illustrative SSH password-spraying scenario. Drafts, run history, attachments, instructions, and decisions are kept only on the current page and reset when you reload it.

Use **Search runs** or **Ctrl / Cmd + K** to find runs by title, prompt, or ID. Rename, pin, archive, and restore runs in the history dialog. Each submitted request keeps its own status and review decision. **New detection** starts a fresh draft; **Edit & rerun** copies an existing request and its context into the editor. **Stop run** stops the sample workflow.

**Attach files** accepts up to three local TXT, LOG, CSV, JSON, or MD files, each up to 256 KB. Click an attachment to preview its text or remove it from the draft. **Instructions** adds conventions or constraints to the request context. Files are read locally and are never uploaded; neither attachments nor instructions affect the fixed sample rule. Submitted context remains available with its run.

Use **Copy prompt**, or expand **Inspect the rule** for **Copy JSON** and **Download JSON**. The exported rule is the illustrative SSH example shown in the preview.

The microphone button previews sample English dictation without accessing the microphone. The concept's interface is English only.

Open **Preferences** in the header to choose **Light**, **Dark**, or **System** appearance. System follows your device's color scheme, including changes while the preview is open.

Preferences also include larger request/result text, comfortable or compact spacing, and a wider desktop workspace. Show or hide the home templates, recent-work table, and context panels; history remains accessible through Search runs. Toggle prompt spellcheck, keyboard hints, and line wrapping in the JSON rule viewer. Changes apply immediately and are saved in this browser. **Restore defaults** resets only these settings, keeping the current draft, context, and run history.

By default, **Enter inserts a new line**. Send with **Ctrl + Enter** on Windows/Linux, **Cmd + Enter** on Mac, or the **Build detection** button. You can optionally choose **Send prompt** for the Enter key; then **Shift + Enter** inserts a new line. These preferences are saved in this browser when local storage is available. Prompt text is not saved to storage.
