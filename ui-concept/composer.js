(() => {
  "use strict";

  const form = document.getElementById("prompt-form");
  const toolbar = form?.querySelector(".composer-toolbar");
  if (!form || !toolbar) return;

  const MAX_FILES = 3;
  const MAX_BYTES = 256 * 1024;
  const MAX_INSTRUCTIONS = 1000;
  const extensions = /\.(txt|log|csv|json|md)$/i;
  let instructions = "";
  let files = [];
  let reading = false;
  let generation = 0;
  let nextFileId = 1;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function symbol(name) {
    const paths = {
      attach: "m21 11-8 8a6 6 0 0 1-8.5-8.5l8-8a4 4 0 0 1 5.7 5.7l-8 8a2 2 0 0 1-2.8-2.8L15 6",
      instructions: "M5 4h14M5 12h14M5 20h14M9 2v4M15 10v4M9 18v4",
      close: "m6 6 12 12M6 18 18 6",
      file: "M14 2H5v20h14V7zM14 2v6h5M8 12h8M8 16h8",
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", paths[name]);
    svg.append(path);
    return svg;
  }

  function button(label, iconName, className = "context-tool-button") {
    const node = element("button", className);
    node.type = "button";
    if (iconName) node.append(symbol(iconName));
    node.append(element("span", "", label));
    return node;
  }

  const tools = element("div", "composer-context-tools");
  const attachButton = button("Attach files", "attach");
  attachButton.id = "attach-files-button";
  attachButton.title = "Add local preview context: up to 3 text files, 256 KB each";
  const instructionsButton = button("Instructions", "instructions");
  instructionsButton.id = "instructions-button";
  instructionsButton.setAttribute("aria-haspopup", "dialog");
  instructionsButton.setAttribute("aria-controls", "instructions-dialog");
  tools.append(attachButton, instructionsButton);
  toolbar.prepend(tools);

  const fileInput = element("input");
  fileInput.type = "file";
  fileInput.id = "context-file-input";
  fileInput.multiple = true;
  fileInput.accept = ".txt,.log,.csv,.json,.md";
  fileInput.hidden = true;
  tools.append(fileInput);

  const contextArea = element("div", "composer-context-status");
  contextArea.id = "composer-context";
  const chipList = element("ul", "context-chips");
  chipList.setAttribute("aria-label", "Attached preview context");
  const contextNote = element("p", "context-local-note", "Local preview context only. Files and instructions do not change the sample result.");
  const feedback = element("p", "context-feedback");
  feedback.id = "context-feedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  contextArea.append(chipList, contextNote, feedback);
  toolbar.before(contextArea);

  function makeDialog(id, title, description) {
    const dialog = element("dialog", "context-dialog");
    dialog.id = id;
    dialog.setAttribute("aria-labelledby", `${id}-title`);
    dialog.setAttribute("aria-describedby", `${id}-description`);
    const header = element("div", "context-dialog-header");
    const copy = element("div");
    const heading = element("h2", "", title);
    heading.id = `${id}-title`;
    const note = element("p", "", description);
    note.id = `${id}-description`;
    const close = button("", "close", "icon-button context-dialog-close");
    close.setAttribute("aria-label", `Close ${title.toLowerCase()}`);
    close.addEventListener("click", () => dialog.close());
    copy.append(heading, note);
    header.append(copy, close);
    dialog.append(header);
    document.body.append(dialog);
    return { dialog, heading, note };
  }

  const filePreview = makeDialog("context-file-dialog", "File preview", "Read locally in this browser. No file is uploaded.");
  const previewMetadata = element("p", "context-file-metadata");
  const previewText = element("pre", "context-file-preview");
  previewText.tabIndex = 0;
  previewText.setAttribute("aria-label", "File contents");
  const fileFooter = element("div", "context-dialog-actions");
  const doneButton = button("Done", null, "secondary-button");
  doneButton.addEventListener("click", () => filePreview.dialog.close());
  fileFooter.append(doneButton);
  filePreview.dialog.append(previewMetadata, previewText, fileFooter);

  function fileSize(size) {
    return size < 1024 ? `${size} B` : `${Math.ceil(size / 1024)} KB`;
  }

  function openFile(file) {
    filePreview.heading.textContent = file.name;
    previewMetadata.textContent = `${fileSize(file.size)} · Local text preview`;
    previewText.textContent = file.text || "(Empty file)";
    filePreview.dialog.showModal();
  }

  const instructionEditor = makeDialog("instructions-dialog", "Workspace instructions", "Add constraints or preferred conventions to your local preview context. These instructions do not affect the sample rule.");
  const instructionForm = element("form", "context-instructions-form");
  const instructionLabel = element("label", "field-label", "Instructions");
  instructionLabel.htmlFor = "workspace-instructions";
  const instructionInput = element("textarea");
  instructionInput.id = "workspace-instructions";
  instructionInput.rows = 6;
  instructionInput.maxLength = MAX_INSTRUCTIONS;
  instructionInput.placeholder = "Use UTC timestamps. Exclude monitoring and service accounts. Explain each threshold and list assumptions before the rule.";
  instructionInput.setAttribute("aria-describedby", "instructions-count instructions-storage");
  const instructionMeta = element("div", "context-instructions-meta");
  const storageNote = element("span", "", "Kept for this page session only.");
  storageNote.id = "instructions-storage";
  const characterCount = element("span");
  characterCount.id = "instructions-count";
  instructionMeta.append(storageNote, characterCount);
  const instructionActions = element("div", "context-dialog-actions");
  const cancelInstructions = button("Cancel", null, "secondary-button");
  cancelInstructions.addEventListener("click", () => instructionEditor.dialog.close());
  const applyInstructions = button("Apply instructions", null, "primary-button");
  applyInstructions.type = "submit";
  instructionActions.append(cancelInstructions, applyInstructions);
  instructionForm.append(instructionLabel, instructionInput, instructionMeta, instructionActions);
  instructionEditor.dialog.append(instructionForm);

  function updateCount() {
    characterCount.textContent = `${instructionInput.value.length} / ${MAX_INSTRUCTIONS}`;
  }

  function openInstructions() {
    instructionInput.value = instructions;
    updateCount();
    instructionEditor.dialog.showModal();
    instructionInput.focus();
  }

  instructionsButton.addEventListener("click", openInstructions);
  instructionInput.addEventListener("input", updateCount);
  instructionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    instructions = instructionInput.value.slice(0, MAX_INSTRUCTIONS).trim();
    instructionEditor.dialog.close();
    render();
    announce(instructions ? "Workspace instructions applied to your preview context." : "Workspace instructions cleared.");
  });

  function announce(message, error = false) {
    feedback.textContent = message;
    feedback.classList.toggle("is-error", error);
    feedback.hidden = !message;
    contextArea.hidden = !files.length && !instructions && !message;
  }

  function render() {
    chipList.replaceChildren();
    files.forEach((file) => {
      const item = element("li", "context-chip");
      const preview = button(file.name, "file", "context-chip-preview");
      preview.title = `Preview ${file.name} (${fileSize(file.size)})`;
      preview.setAttribute("aria-label", `Preview ${file.name}, ${fileSize(file.size)}`);
      preview.setAttribute("aria-haspopup", "dialog");
      preview.addEventListener("click", () => openFile(file));
      const remove = button("", "close", "context-chip-remove");
      remove.setAttribute("aria-label", `Remove ${file.name}`);
      remove.addEventListener("click", () => {
        files = files.filter((entry) => entry.id !== file.id);
        render();
        announce(`Removed ${file.name}.`);
        attachButton.focus();
      });
      item.append(preview, remove);
      chipList.append(item);
    });
    if (instructions) {
      const item = element("li", "context-chip");
      const edit = button("Workspace instructions", "instructions", "context-chip-preview");
      edit.setAttribute("aria-haspopup", "dialog");
      edit.addEventListener("click", openInstructions);
      const remove = button("", "close", "context-chip-remove");
      remove.setAttribute("aria-label", "Remove workspace instructions");
      remove.addEventListener("click", () => {
        instructions = "";
        render();
        announce("Workspace instructions cleared.");
        instructionsButton.focus();
      });
      item.append(edit, remove);
      chipList.append(item);
    }
    chipList.hidden = !files.length && !instructions;
    contextNote.hidden = chipList.hidden;
    contextArea.hidden = chipList.hidden && !feedback.textContent;
    instructionsButton.classList.toggle("has-context", Boolean(instructions));
    instructionsButton.title = instructions ? "Edit workspace instructions" : "Add workspace instructions for this preview";
  }

  function setReading(value) {
    reading = value;
    attachButton.disabled = value;
    document.dispatchEvent(new CustomEvent("concept:composer-changed", { detail: { reading } }));
  }

  attachButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const selected = Array.from(fileInput.files || []);
    fileInput.value = "";
    if (!selected.length) return;
    const currentGeneration = generation;
    setReading(true);
    announce("Reading files locally…");
    const errors = [];
    let added = 0;
    try {
      for (const file of selected) {
        if (generation !== currentGeneration) return;
        if (files.length >= MAX_FILES) {
          errors.push(`Only ${MAX_FILES} files can be attached. Remove a file to add another.`);
          break;
        }
        if (!extensions.test(file.name)) {
          errors.push(`${file.name}: choose a TXT, LOG, CSV, JSON, or MD file.`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          errors.push(`${file.name}: the limit is 256 KB per file.`);
          continue;
        }
        try {
          const text = await file.text();
          if (generation !== currentGeneration) return;
          if (text.includes("\0")) {
            errors.push(`${file.name}: this does not appear to be a text file.`);
            continue;
          }
          files.push({ id: nextFileId++, name: file.name, text, size: file.size });
          added += 1;
        } catch {
          errors.push(`${file.name}: this file could not be read. Try selecting it again.`);
        }
      }
      if (generation !== currentGeneration) return;
      render();
      const success = added ? `${added} ${added === 1 ? "file" : "files"} added as local preview context.` : "";
      announce([success, ...errors].filter(Boolean).join(" "), errors.length > 0);
    } finally {
      if (generation === currentGeneration) setReading(false);
    }
  });

  function normalizeContext(context) {
    return {
      instructions: typeof context?.instructions === "string" ? context.instructions.slice(0, MAX_INSTRUCTIONS) : "",
      files: Array.isArray(context?.files) ? context.files.slice(0, MAX_FILES).filter((file) => (
        file && typeof file.name === "string" && typeof file.text === "string" && file.text.length <= MAX_BYTES
        && Number.isFinite(file.size) && file.size >= 0 && file.size <= MAX_BYTES
      )).map(({ name, text, size }) => ({ name, text, size })) : [],
    };
  }

  const capturedPanel = element("article", "panel captured-context-panel");
  capturedPanel.id = "captured-context-panel";
  capturedPanel.hidden = true;
  document.querySelector(".run-aside")?.append(capturedPanel);

  function renderContext(context) {
    const captured = normalizeContext(context);
    capturedPanel.replaceChildren();
    capturedPanel.hidden = !captured.instructions && !captured.files.length;
    if (capturedPanel.hidden) return;
    const header = element("div", "panel-header");
    header.append(element("h2", "", "Request context"), element("span", "tag", "LOCAL"));
    const content = element("div", "captured-context-content");
    content.append(element("p", "context-local-note", "Captured with this request. The fixed sample result does not use this context."));
    if (captured.instructions) {
      content.append(element("h3", "", "Workspace instructions"), element("p", "captured-instructions", captured.instructions));
    }
    if (captured.files.length) {
      content.append(element("h3", "", `Attached files (${captured.files.length})`));
      const list = element("ul", "captured-files");
      captured.files.forEach((file) => {
        const item = element("li");
        const preview = button(file.name, "file", "captured-file-button");
        preview.setAttribute("aria-haspopup", "dialog");
        preview.title = `Preview ${file.name} (${fileSize(file.size)})`;
        preview.addEventListener("click", () => openFile(file));
        item.append(preview, element("span", "", fileSize(file.size)));
        list.append(item);
      });
      content.append(list);
    }
    capturedPanel.append(header, content);
  }

  function restore(context) {
    generation += 1;
    const restored = normalizeContext(context);
    instructions = restored.instructions;
    files = restored.files.map((file) => ({ ...file, id: nextFileId++ }));
    fileInput.value = "";
    if (instructionEditor.dialog.open) instructionEditor.dialog.close();
    if (filePreview.dialog.open) filePreview.dialog.close();
    announce("");
    render();
    setReading(false);
  }

  window.conceptComposer = {
    snapshot: () => ({ instructions, files: files.map(({ name, text, size }) => ({ name, text, size })) }),
    isReading: () => reading,
    restore,
    clear: () => restore(null),
    renderContext,
  };
  render();
  announce("");
})();
