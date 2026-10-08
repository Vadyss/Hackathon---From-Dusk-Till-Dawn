"use strict";

// Run history lives only in this tab. No prompts are written to browser storage.
(() => {
  const entries = new Map();
  const labels = { working: "In progress", review: "Awaiting review", approved: "Approved", rejected: "Rejected", stopped: "Stopped" };
  const shortcut = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "Cmd + K" : "Ctrl + K";
  let filter = "all";
  let renameId = null;
  let opener = null;
  let openingRun = false;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, text, handler) => {
    const node = element("button", className, text);
    node.type = "button";
    node.addEventListener("click", handler);
    return node;
  };
  const snapshotOf = (entry) => ({ ...clone(entry.snapshot), title: entry.customTitle || entry.snapshot.title });
  const sortedEntries = () => [...entries.values()].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  const age = (entry) => {
    const minutes = Math.floor((Date.now() - entry.updatedAt) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)} h ago`;
  };
  const announce = (message) => { live.textContent = message; };

  const trigger = button("history-trigger", "", () => openHistory());
  trigger.id = "history-toggle";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", "history-dialog");
  trigger.setAttribute("aria-keyshortcuts", "Control+k Meta+k");
  const searchMark = element("span", "history-search-mark");
  searchMark.setAttribute("aria-hidden", "true");
  trigger.append(searchMark, element("span", "", "Search runs"), element("kbd", "", shortcut));
  document.querySelector(".new-detection").after(trigger);

  const dialog = element("dialog", "history-dialog");
  dialog.id = "history-dialog";
  dialog.setAttribute("aria-labelledby", "history-title");
  dialog.setAttribute("aria-describedby", "history-description");
  const header = element("div", "history-header");
  const heading = element("div");
  const title = element("h2", "", "Search runs");
  title.id = "history-title";
  const description = element("p", "", "Find and organize the runs in this tab.");
  description.id = "history-description";
  heading.append(title, description);
  const close = button("icon-button history-close", "\u00d7", () => dialog.close());
  close.setAttribute("aria-label", "Close run history");
  header.append(heading, close);

  const controls = element("div", "history-controls");
  const searchLabel = element("label", "sr-only", "Search by title, prompt, or run ID");
  searchLabel.htmlFor = "history-search";
  const search = element("input", "history-search");
  search.id = "history-search";
  search.type = "search";
  search.placeholder = "Search by title, prompt, or run ID";
  search.autocomplete = "off";
  search.maxLength = 200;
  search.setAttribute("aria-controls", "history-results");
  const filters = element("div", "history-filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Filter run history");
  ["all", "pinned", "archived"].forEach((value) => {
    const tab = button("history-filter", value[0].toUpperCase() + value.slice(1), () => {
      filter = value;
      renameId = null;
      renderResults();
    });
    tab.dataset.filter = value;
    tab.setAttribute("aria-pressed", String(value === filter));
    filters.append(tab);
  });
  controls.append(searchLabel, search, filters);
  const results = element("div", "history-results");
  results.id = "history-results";
  const live = element("p", "history-result-count");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  const footer = element("div", "history-footer");
  footer.append(element("span", "", "This session only. Reloading clears your changes."), element("span", "", "Esc to close"));
  dialog.append(header, controls, live, results, footer);
  document.body.append(dialog);

  const recentHeader = document.querySelector(".recent-section .section-heading [data-view]");
  if (recentHeader) recentHeader.replaceWith(button("text-button", "Browse all", () => openHistory()));
  const sampleLabel = document.querySelector(".recent-runs").previousElementSibling?.querySelector("span");
  if (sampleLabel) sampleLabel.textContent = "This session";

  function openHistory() {
    const otherDialog = document.querySelector("dialog[open]");
    if (otherDialog && otherDialog !== dialog) return;
    if (!dialog.open) {
      opener = document.activeElement;
      openingRun = false;
      search.value = "";
      filter = "all";
      renameId = null;
      renderResults();
      dialog.showModal();
    }
    search.focus();
  }

  function openRun(id) {
    const entry = entries.get(id);
    if (!entry || typeof window.restoreConceptRun !== "function") return;
    openingRun = true;
    if (dialog.open) dialog.close();
    window.restoreConceptRun(snapshotOf(entry));
  }

  function notify(entry) {
    document.dispatchEvent(new CustomEvent("concept:history-changed", { detail: { run: snapshotOf(entry), pinned: entry.pinned, archived: entry.archived } }));
  }

  function renderSidebar() {
    const sidebar = document.querySelector(".recent-runs");
    sidebar.replaceChildren();
    const visible = sortedEntries().filter((entry) => !entry.archived).slice(0, 6);
    visible.forEach((entry) => {
      const snapshot = snapshotOf(entry);
      const item = button("run-item history-run-item", "", () => openRun(snapshot.id));
      item.dataset.historyId = snapshot.id;
      const dot = element("span", `run-dot ${snapshot.status === "approved" ? "green" : snapshot.status === "review" ? "amber" : ""}`);
      dot.setAttribute("aria-hidden", "true");
      const copy = element("span", "history-run-copy");
      copy.append(element("span", "history-run-title", snapshot.title), element("small", "", `${entry.pinned ? "Pinned \u00b7 " : ""}${labels[snapshot.status]}`));
      item.append(dot, copy);
      sidebar.append(item);
    });
    if (!visible.length) sidebar.append(element("p", "history-sidebar-empty", "No active runs. Find archived runs in Search."));
    const table = document.querySelector(".recent-table tbody");
    table.replaceChildren();
    sortedEntries().filter((entry) => !entry.archived).slice(0, 8).forEach((entry) => {
      const snapshot = snapshotOf(entry);
      const row = element("tr");
      const name = element("td");
      const link = button("recent-title", snapshot.title, () => openRun(snapshot.id));
      link.dataset.historyId = snapshot.id;
      name.append(link);
      if (entry.pinned) name.append(element("span", "history-pinned-label", "Pinned"));
      const state = element("td");
      state.append(element("span", `state-label ${snapshot.status}`, labels[snapshot.status]));
      row.append(name, element("td", "mono", snapshot.id), state, element("td", "", age(entry)));
      table.append(row);
    });
    if (!table.children.length) {
      const row = element("tr");
      const cell = element("td", "history-empty-cell", "No active runs. Use Browse all to restore archived work.");
      cell.colSpan = 4;
      row.append(cell);
      table.append(row);
    }
  }

  function restoreResultFocus(id, action) {
    const row = [...results.children].find((item) => item.dataset.historyId === id);
    const target = row && [...row.querySelectorAll("button")].find((item) => item.dataset.action === action);
    (target || search).focus();
  }

  function makeRenameForm(entry) {
    const form = element("form", "history-rename");
    const label = element("label", "", "Run title");
    const input = element("input");
    input.id = "history-rename-input";
    input.value = snapshotOf(entry).title;
    input.maxLength = 100;
    input.required = true;
    input.autocomplete = "off";
    label.htmlFor = input.id;
    const actions = element("div", "history-rename-actions");
    const save = element("button", "secondary-button", "Save title");
    save.type = "submit";
    actions.append(save, button("text-button", "Cancel", () => {
      renameId = null;
      renderResults();
      restoreResultFocus(entry.snapshot.id, "rename");
    }));
    form.append(label, input, actions);
    input.addEventListener("input", () => input.setCustomValidity(""));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!input.value.trim()) {
        input.setCustomValidity("Enter a title for this run.");
        input.reportValidity();
        return;
      }
      entry.customTitle = input.value.trim();
      renameId = null;
      renderSidebar();
      renderResults();
      notify(entry);
      restoreResultFocus(entry.snapshot.id, "rename");
      announce("Run renamed.");
    });
    return form;
  }

  function renderResults() {
    filters.querySelectorAll("button").forEach((tab) => tab.setAttribute("aria-pressed", String(tab.dataset.filter === filter)));
    const query = search.value.trim().toLocaleLowerCase();
    const matches = sortedEntries().filter((entry) => {
      const snapshot = snapshotOf(entry);
      const inFilter = filter === "archived" ? entry.archived : !entry.archived && (filter !== "pinned" || entry.pinned);
      return inFilter && `${snapshot.title} ${snapshot.prompt} ${snapshot.id}`.toLocaleLowerCase().includes(query);
    });
    results.replaceChildren();
    announce(`${matches.length} ${matches.length === 1 ? "run" : "runs"}${filter === "archived" ? " in archive" : filter === "pinned" ? " pinned" : " in history"}.`);
    if (!matches.length) {
      const empty = element("div", "history-empty");
      empty.append(element("strong", "", query ? "No matching runs" : filter === "pinned" ? "No pinned runs" : filter === "archived" ? "Your archive is empty" : "No active runs"));
      empty.append(element("p", "", query ? "Try another title, phrase, or run ID." : filter === "pinned" ? "Pin a run to keep it at the top of your history." : filter === "archived" ? "Archived runs remain available for this session." : "Create a detection or restore a run from Archived."));
      results.append(empty);
      return;
    }
    matches.forEach((entry) => {
      const snapshot = snapshotOf(entry);
      const row = element("article", "history-result");
      row.dataset.historyId = snapshot.id;
      const open = button("history-result-open", "", () => openRun(snapshot.id));
      open.dataset.action = "open";
      const top = element("span", "history-result-top");
      top.append(element("strong", "", snapshot.title));
      if (entry.pinned) top.append(element("span", "history-pinned-label", "Pinned"));
      const meta = element("span", "history-result-meta");
      meta.append(element("span", "mono", snapshot.id), element("span", `state-label ${snapshot.status}`, labels[snapshot.status]), element("span", "", age(entry)));
      open.append(top, element("span", "history-result-prompt", snapshot.prompt), meta);
      const actions = element("div", "history-result-actions");
      const rename = button("history-action", "Rename", () => {
        renameId = snapshot.id;
        renderResults();
        const input = document.getElementById("history-rename-input");
        input.focus();
        input.select();
      });
      rename.dataset.action = "rename";
      const pin = button("history-action", entry.pinned ? "Unpin" : "Pin", () => {
        entry.pinned = !entry.pinned;
        renameId = null;
        renderSidebar();
        renderResults();
        notify(entry);
        restoreResultFocus(snapshot.id, "pin");
        announce(entry.pinned ? "Run pinned." : "Run unpinned.");
      });
      pin.dataset.action = "pin";
      pin.setAttribute("aria-pressed", String(entry.pinned));
      const archive = button("history-action", entry.archived ? "Restore" : "Archive", () => {
        entry.archived = !entry.archived;
        renameId = null;
        renderSidebar();
        renderResults();
        notify(entry);
        search.focus();
        announce(entry.archived ? "Run archived. Find it under Archived." : "Run restored to history.");
      });
      archive.dataset.action = "archive";
      actions.append(rename, pin, archive);
      row.append(open, actions);
      if (renameId === snapshot.id) row.append(makeRenameForm(entry));
      results.append(row);
    });
  }

  function upsert(snapshot) {
    if (!snapshot || typeof snapshot.id !== "string" || !snapshot.id.trim()) return null;
    const saved = clone(snapshot);
    const previous = entries.get(saved.id);
    saved.title = typeof saved.title === "string" && saved.title.trim() ? saved.title.trim() : "Untitled detection";
    saved.prompt = typeof saved.prompt === "string" ? saved.prompt : "";
    saved.status = Object.hasOwn(labels, saved.status) ? saved.status : "working";
    // Preserve the entry object while an inline rename is being edited.
    const entry = previous || { customTitle: "", pinned: false, archived: false };
    entry.snapshot = saved;
    entry.updatedAt = Date.now();
    entries.set(saved.id, entry);
    renderSidebar();
    // Keep an in-progress rename intact while a run advances in the background.
    if (dialog.open && !renameId) {
      const focused = results.contains(document.activeElement) ? document.activeElement : null;
      const focusedId = focused?.closest("[data-history-id]")?.dataset.historyId;
      const focusedAction = focused?.dataset.action;
      renderResults();
      if (focusedId) restoreResultFocus(focusedId, focusedAction);
    }
    notify(entry);
    return snapshotOf(entry);
  }

  window.conceptHistory = Object.freeze({
    record: upsert,
    update: upsert,
    get(id) { const entry = entries.get(id); return entry ? snapshotOf(entry) : null; },
  });

  search.addEventListener("input", () => { renameId = null; renderResults(); });
  dialog.addEventListener("close", () => {
    if (openingRun) return;
    if (opener?.isConnected && !opener.closest("[inert]")) opener.focus();
    else document.getElementById("main-content").focus();
  });
  dialog.addEventListener("cancel", (event) => {
    if (!renameId) return;
    event.preventDefault();
    const id = renameId;
    renameId = null;
    renderResults();
    restoreResultFocus(id, "rename");
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openHistory();
    }
  });

  const sample = {
    prompt: "Detect SSH password spraying from a single source across multiple accounts.",
    phase: 3, comment: "", reason: "", context: { instructions: "", files: [] },
  };
  upsert({ ...sample, id: "DEMO-001", title: "Password spraying baseline", status: "approved" });
  entries.get("DEMO-001").updatedAt -= 24 * 60000;
  upsert({ ...sample, id: "DEMO-003", title: "SSH password spraying", status: "review" });
})();
