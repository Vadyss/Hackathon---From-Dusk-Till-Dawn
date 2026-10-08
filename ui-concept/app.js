"use strict";

// This entire experience is local sample data. It never calls the real backend.
const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  compare: '<path d="M5 4v16M19 4v16M8 8h8m-3-3 3 3-3 3M16 16H8m3-3-3 3 3 3"/>',
  chevrons: '<path d="m9 8 3-3 3 3m-6 8 3 3 3-3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14.1A8.5 8.5 0 0 1 9.9 4a8.5 8.5 0 1 0 10.2 10.2Z"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  "wifi-off": '<path d="m3 3 18 18M8 4.5A16 16 0 0 1 22 8M2 8a16 16 0 0 1 2.5-1.5M6 12a10 10 0 0 1 2-1m4-1a10 10 0 0 1 6 2M9 16a5 5 0 0 1 6 0M12 20h.01"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6.1 7A7 7 0 0 1 18 6l2 3M4 15l2 3a7 7 0 0 0 11.9-1"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  "arrow-right": '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  "arrow-left": '<path d="M20 12H4m6-6-6 6 6 6"/>',
  "arrow-up-right": '<path d="M6 18 18 6M6 6h12v12"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  fingerprint: '<path d="M6 7a7 7 0 0 1 13 4v4m-15-2v-2a8 8 0 0 1 .3-2M8 20a15 15 0 0 0 1-7v-2a3 3 0 0 1 6 0v3c0 3 1 5 2 6M12 10v6a15 15 0 0 1-1 6M5 18l1-6m13 7 1 2"/>',
  network: '<circle cx="12" cy="5" r="3"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="m10.5 7.5-4 8m7-8 4 8M8 18h8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
  sliders: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sparkles}</svg>`;
}
document.querySelectorAll("[data-icon]").forEach((element) => { element.innerHTML = icon(element.dataset.icon); });

const $ = (id) => document.getElementById(id);
const preferenceKey = "frankenstein-ui-concept-preferences";
const systemTheme = window.matchMedia("(prefers-color-scheme: light)");
const sendShortcut = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "Cmd + Enter" : "Ctrl + Enter";
const defaultPreferences = Object.freeze({
  theme: "dark", enterBehavior: "newline", readingSize: "standard",
  density: "comfortable", contentWidth: "standard", showTemplates: true,
  showRecentWork: true, showContext: true, spellcheck: true,
  showShortcuts: true, wrapCode: true,
});
const preferenceOptions = {
  theme: ["light", "dark", "system"], enterBehavior: ["newline", "send"],
  readingSize: ["standard", "large"], density: ["comfortable", "compact"],
  contentWidth: ["standard", "wide"],
};
const preferences = { ...defaultPreferences };
function validPreference(key, value) {
  if (!Object.hasOwn(defaultPreferences, key)) return false;
  return preferenceOptions[key]?.includes(value) ?? typeof value === "boolean";
}

// Preferences belong only to this standalone preview. Drafts are never persisted.
try {
  const saved = JSON.parse(localStorage.getItem(preferenceKey));
  Object.keys(defaultPreferences).forEach((key) => {
    if (validPreference(key, saved?.[key])) preferences[key] = saved[key];
  });
} catch {
  // Storage can be unavailable or contain an older, invalid value.
}
function applyPreferences() {
  const light = preferences.theme === "light" || (preferences.theme === "system" && systemTheme.matches);
  document.body.classList.toggle("light", light);
  ["readingSize", "density", "contentWidth"].forEach((key) => { document.body.dataset[key] = preferences[key]; });
  Object.entries({ showTemplates: "hide-templates", showRecentWork: "hide-recent-work", showContext: "hide-context", showShortcuts: "hide-shortcuts", wrapCode: "code-nowrap" })
    .forEach(([key, className]) => document.body.classList.toggle(className, !preferences[key]));
  $("prompt-input").spellcheck = preferences.spellcheck;
  document.querySelectorAll("[data-preference]").forEach((input) => {
    const value = preferences[input.dataset.preference];
    if (input.type === "radio") input.checked = input.value === value;
    else if (input.type === "checkbox") input.checked = value;
    else input.value = value;
  });
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).getPropertyValue("--bg").trim();
  document.querySelectorAll('input[name="theme"]').forEach((input) => { input.checked = input.value === preferences.theme; });
  document.querySelectorAll('input[name="enter-behavior"]').forEach((input) => { input.checked = input.value === preferences.enterBehavior; });
  $("preferences-send-shortcut").textContent = sendShortcut;
  $("prompt-hint").innerHTML = preferences.enterBehavior === "newline"
    ? `<span><kbd>Enter</kbd> new line</span><span aria-hidden="true">·</span><span><kbd>${sendShortcut}</kbd> send</span>`
    : '<span><kbd>Enter</kbd> send</span><span aria-hidden="true">·</span><span><kbd>Shift + Enter</kbd> new line</span>';
}
function savePreferences() {
  applyPreferences();
  try {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    $("preferences-storage").textContent = "Saved in this browser.";
  } catch {
    $("preferences-storage").textContent = "Applied for this session. Browser storage is unavailable.";
  }
}
const phases = [
  ["Understanding the request", "Identify the threat and the relevant log fields."],
  ["Planning the detection", "Reuse the SSH parser and choose a time window."],
  ["Building & testing", "Validate the candidate against a sample dataset."],
  ["Ready for your review", "Inspect the rule and decide what happens next."],
];
const phaseMessages = [
  "Threat identified: password spraying against SSH accounts.",
  "Selected ssh_log_parser. Planning account-level aggregation.",
  "Example validation complete: 96.8% precision across 12,480 logs.",
  "Rule prepared. Waiting for a human decision.",
];
const samplePrompt = "Detect SSH password spraying from a single source across multiple accounts.";
let online = true;
let busy = false;
let phase = 0;
let phaseTimer;
let voiceTimer;
let toastTimer;
let retryTimer;
let retryGeneration = 0;
let voiceActive = false;
let currentView = "home";
let runInitialized = false;
let activeRun = null;
let runSequence = 0;
let lastRunId = "DEMO-003";
const mobileViewport = window.matchMedia("(max-width: 780px)");

function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 3600);
}
function setNavigation(open) {
  document.body.classList.toggle("nav-open", open);
  $("mobile-overlay").hidden = !open;
  $("menu-toggle").setAttribute("aria-expanded", String(open));
  $("menu-toggle").setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  $("sidebar").inert = mobileViewport.matches && !open;
  if (open) $("sidebar").querySelector("a, button").focus();
}
function showView(view) {
  currentView = view;
  ["home", "run", "compare", "skills"].forEach((name) => { $(`${name}-view`).hidden = name !== view; });
  document.querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("breadcrumb-current").textContent = { home: "New detection", run: "Current run", compare: "Compare runs", skills: "Skill library" }[view];
  setNavigation(false);
  updateComposer();
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  $("main-content").focus({ preventScroll: true });
}
function updateComposer() {
  $("send-button").disabled = !online || busy || voiceActive || window.conceptComposer?.isReading() || !$("prompt-input").value.trim();
  $("voice-button").disabled = busy;
  const message = !online ? "Your draft is kept on this page. Reconnect to start." : busy ? phase === 3 ? "Review the current detection before starting another." : "A detection is in progress. Your next draft can wait here." : voiceActive ? "Sample English dictation · no microphone access." : "Every rule needs your approval.";
  $("composer-note").textContent = message;
  $("stop-run").hidden = activeRun?.status !== "working";
  $("edit-request").disabled = activeRun?.status === "working";
}
function setOnline(value) {
  online = value;
  $("offline-banner").hidden = value;
  $("connection-status").classList.toggle("offline", !value);
  $("connection-label").textContent = value ? "Preview online" : "Preview offline";
  updateComposer();
}
function stopVoice() {
  clearInterval(voiceTimer);
  voiceActive = false;
  $("voice-button").classList.remove("listening");
  $("voice-button").setAttribute("aria-pressed", "false");
  $("voice-button").setAttribute("aria-label", "Preview English voice input");
  $("voice-button").querySelector("[data-icon]").innerHTML = icon("mic");
  $("voice-label").textContent = "Voice";
  updateComposer();
}
function renderPhases() {
  $("phase-list").innerHTML = phases.map(([title, description], index) => `<li class="phase-item ${index < phase ? "complete" : index === phase ? "current" : ""}"><span class="phase-icon">${index < phase ? icon("check") : String(index + 1).padStart(2, "0")}</span><div class="phase-copy"><strong>${title}</strong><p>${description}</p></div><span class="phase-meta">${index < phase ? "Done" : index === phase ? phase === 3 ? "Your turn" : "In progress" : "Queued"}</span></li>`).join("");
  $("phase-counter").textContent = `STEP ${phase + 1} OF 4`;
  $("activity-entries").replaceChildren();
  phaseMessages.slice(0, phase + 1).forEach((message, index) => {
    const entry = document.createElement("div");
    entry.className = "activity-entry";
    const time = document.createElement("span");
    time.className = "mono muted";
    time.textContent = `00:0${index * 2}`;
    const text = document.createElement("span");
    text.textContent = message;
    entry.append(time, text);
    $("activity-entries").append(entry);
  });
  const ready = phase === 3;
  $("review-panel").hidden = !ready;
  $("run-status").textContent = ready ? "Awaiting review" : ["Understanding", "Planning", "Building & testing"][phase];
  $("run-status").className = "status-badge";
  busy = true;
  if (ready) $("preview-state").value = "review";
  updateComposer();
}
function startRun(ready = false) {
  cancelRetry();
  if (activeRun?.status === "working") stopRun(false);
  else saveActiveRun();
  clearInterval(phaseTimer);
  stopVoice();
  runInitialized = true;
  const prompt = $("prompt-input").value.trim() || samplePrompt;
  activeRun = {
    id: `LOCAL-${String(++runSequence).padStart(3, "0")}`,
    title: prompt.split("\n")[0].slice(0, 72), prompt,
    status: ready ? "review" : "working", phase: ready ? 3 : 0,
    comment: "", reason: "", context: window.conceptComposer?.snapshot() || { instructions: "", files: [] },
  };
  lastRunId = activeRun.id;
  $("run-id").textContent = `/ ${activeRun.id}`;
  $("run-request").textContent = prompt;
  $("run-title").textContent = activeRun.title;
  window.conceptComposer?.renderContext(activeRun.context);
  $("review-form").hidden = false;
  $("reject-form").hidden = true;
  $("decision-result").hidden = true;
  $("review-comment").value = "";
  $("reject-reason").value = "";
  document.querySelector(".context-skill:last-child small").textContent = "Pending your approval";
  phase = ready ? 3 : 0;
  $("preview-state").value = ready ? "review" : "working";
  renderPhases();
  saveActiveRun();
  showView("run");
  if (!ready) {
    phaseTimer = setInterval(() => {
      phase += 1;
      activeRun.status = phase === 3 ? "review" : "working";
      renderPhases();
      saveActiveRun();
      if (phase === 3) { clearInterval(phaseTimer); toast("Example detection ready for review."); }
    }, 1800);
  }
}
function decision(approved, notify = true) {
  $("review-form").hidden = true;
  $("reject-form").hidden = true;
  $("decision-result").hidden = false;
  $("decision-result").textContent = approved ? "Approved in this preview. No rule or skill has been installed." : `Rejected in this preview. Reason: ${$("reject-reason").value.trim()}`;
  $("run-status").textContent = approved ? "Approved" : "Rejected";
  $("run-status").className = `status-badge ${approved ? "approved" : "rejected"}`;
  busy = false;
  const lastPhase = $("phase-list").lastElementChild;
  lastPhase.className = "phase-item complete";
  lastPhase.querySelector(".phase-icon").innerHTML = icon("check");
  lastPhase.querySelector(".phase-copy strong").textContent = approved ? "Review complete · approved" : "Review complete · rejected";
  lastPhase.querySelector(".phase-copy p").textContent = "Your example decision has been recorded in this preview.";
  lastPhase.querySelector(".phase-meta").textContent = "Done";
  $("activity-entries").lastElementChild.lastElementChild.textContent = approved ? "Example rule approved. No real installation performed." : "Example rule rejected. Nothing installed.";
  document.querySelector(".context-skill:last-child small").textContent = approved ? "Approved in this preview" : "Not approved";
  if (activeRun) activeRun.status = approved ? "approved" : "rejected";
  saveActiveRun();
  updateComposer();
  if (notify) {
    $("decision-result").focus();
    toast(approved ? "Approval preview complete." : "Rejection preview complete.");
  }
}

function saveActiveRun() {
  if (!activeRun) return;
  activeRun.phase = phase;
  activeRun.comment = $("review-comment").value;
  activeRun.reason = $("reject-reason").value;
  const stored = window.conceptHistory?.get(activeRun.id);
  if (stored && ["id", "title", "prompt", "status", "phase", "comment", "reason"].every(key => stored[key] === activeRun[key])
      && JSON.stringify(stored.context) === JSON.stringify(activeRun.context)) return;
  window.conceptHistory?.update(activeRun);
}

function cancelRetry() {
  clearTimeout(retryTimer);
  retryGeneration += 1;
  $("retry-button").disabled = false;
  $("retry-button").innerHTML = `${icon("refresh")}Retry`;
}

function stopRun(notify = true) {
  if (activeRun?.status !== "working") return;
  clearInterval(phaseTimer);
  activeRun.status = "stopped";
  busy = false;
  $("run-status").textContent = "Stopped";
  $("run-status").className = "status-badge";
  const current = $("phase-list").querySelector(".current");
  if (current) current.querySelector(".phase-meta").textContent = "Stopped";
  $("preview-state").value = "ready";
  saveActiveRun();
  updateComposer();
  if (notify) toast("Run stopped. Edit the request to try again.");
}

window.restoreConceptRun = (snapshot) => {
  cancelRetry();
  if (activeRun?.status === "working") stopRun(false);
  else saveActiveRun();
  clearInterval(phaseTimer);
  stopVoice();
  activeRun = structuredClone(window.conceptHistory?.get(snapshot.id) || snapshot);
  lastRunId = activeRun.id;
  runInitialized = true;
  phase = Math.max(0, Math.min(3, activeRun.phase ?? 3));
  $("run-id").textContent = `/ ${activeRun.id}`;
  $("run-title").textContent = activeRun.title;
  $("run-request").textContent = activeRun.prompt;
  $("review-comment").value = activeRun.comment || "";
  $("reject-reason").value = activeRun.reason || "";
  $("review-form").hidden = false;
  $("reject-form").hidden = true;
  $("decision-result").hidden = true;
  document.querySelector(".context-skill:last-child small").textContent = "Pending your approval";
  window.conceptComposer?.renderContext(activeRun.context);
  renderPhases();
  if (["approved", "rejected"].includes(activeRun.status)) decision(activeRun.status === "approved", false);
  else if (["stopped", "working"].includes(activeRun.status)) {
    activeRun.status = "working";
    stopRun(false);
  }
  updateComposer();
  $("preview-state").value = !online ? "offline" : phase === 3 ? "review" : "ready";
  showView("run");
};

function newDraft() {
  cancelRetry();
  if (activeRun?.status === "working") stopRun(false);
  else saveActiveRun();
  stopVoice();
  busy = false;
  $("prompt-input").value = "";
  window.conceptComposer?.clear();
  $("preview-state").value = online ? "ready" : "offline";
  showView("home");
  $("prompt-input").focus();
}

async function copyText(text, success) {
  try {
    await navigator.clipboard.writeText(text);
    toast(success);
  } catch {
    const dialog = document.createElement("dialog");
    dialog.className = "preferences-dialog";
    dialog.setAttribute("aria-label", "Copy text manually");
    const form = document.createElement("form");
    form.method = "dialog";
    form.className = "preferences-body";
    const label = document.createElement("label");
    label.textContent = "Clipboard unavailable. Select and copy this text:";
    const field = document.createElement("textarea");
    field.readOnly = true;
    field.value = text;
    field.rows = 10;
    field.style.cssText = "display:block;width:100%;margin:16px 0;background:var(--bg);padding:12px;border:1px solid var(--border)";
    label.append(field);
    const close = document.createElement("button");
    close.className = "primary-button";
    close.textContent = "Done";
    form.append(label, close);
    dialog.append(form);
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
    field.focus();
    field.select();
  }
}

$("new-detection").addEventListener("click", newDraft);
$("stop-run").addEventListener("click", () => stopRun());
$("edit-request").addEventListener("click", () => {
  if (!activeRun || activeRun.status === "working") return;
  saveActiveRun();
  stopVoice();
  busy = false;
  $("prompt-input").value = activeRun.prompt;
  window.conceptComposer?.restore(activeRun.context);
  showView("home");
  $("prompt-input").focus();
});
$("copy-request").addEventListener("click", () => copyText($("run-request").textContent, "Prompt copied."));
$("copy-rule").addEventListener("click", () => copyText($("rule-json").textContent, "Example rule copied."));
$("download-rule").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([$("rule-json").textContent], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "example-ssh-password-spraying.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener("concept:history-changed", () => {
  const stored = activeRun && window.conceptHistory?.get(activeRun.id);
  if (stored) {
    activeRun.title = stored.title;
    $("run-title").textContent = stored.title;
  }
});
document.addEventListener("concept:composer-changed", updateComposer);

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", (event) => {
  event.preventDefault();
  stopVoice();
  if (button.dataset.view === "run" && !runInitialized) {
    const snapshot = window.conceptHistory?.get(lastRunId);
    if (snapshot) window.restoreConceptRun(snapshot);
    else startRun(true);
  } else {
    if (button.dataset.view === "run") busy = ["working", "review"].includes(activeRun?.status);
    showView(button.dataset.view);
  }
}));
$("prompt-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("send-button").disabled) return;
  startRun();
});
$("prompt-input").addEventListener("input", () => { stopVoice(); updateComposer(); });
$("prompt-input").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
  const sendWithModifier = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
  const sendWithEnter = preferences.enterBehavior === "send" && !event.shiftKey && !event.altKey;
  if (sendWithModifier || sendWithEnter) {
    event.preventDefault();
    if (!event.repeat) $("prompt-form").requestSubmit();
  }
});
document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => {
  stopVoice();
  $("prompt-input").value = button.dataset.prompt;
  updateComposer();
  $("prompt-input").focus();
}));
$("voice-button").addEventListener("click", () => {
  if (voiceActive) { stopVoice(); return; }
  voiceActive = true;
  $("voice-button").classList.add("listening");
  $("voice-button").setAttribute("aria-pressed", "true");
  $("voice-button").setAttribute("aria-label", "Stop voice preview");
  $("voice-button").querySelector("[data-icon]").innerHTML = icon("stop");
  $("voice-label").textContent = "Stop preview";
  const prefix = $("prompt-input").value.trim();
  const words = samplePrompt.split(" ");
  let count = 0;
  updateComposer();
  toast("Playing sample dictation. Your microphone is not accessed.");
  voiceTimer = setInterval(() => {
    count += 1;
    $("prompt-input").value = `${prefix ? prefix + " " : ""}${words.slice(0, count).join(" ")}`.slice(0, 2000);
    if (count >= words.length) stopVoice();
  }, 150);
});
$("preview-state").addEventListener("change", () => {
  const value = $("preview-state").value;
  if (activeRun?.status === "working") stopRun(false);
  else saveActiveRun();
  clearInterval(phaseTimer);
  clearTimeout(retryTimer);
  retryGeneration += 1;
  $("retry-button").disabled = false;
  $("retry-button").innerHTML = `${icon("refresh")}Retry`;
  busy = false;
  runInitialized = false;
  stopVoice();
  setOnline(value !== "offline");
  if (value === "working" || value === "review") startRun(value === "review");
  else { $("preview-state").value = value; showView("home"); }
});
$("retry-button").addEventListener("click", () => {
  const generation = ++retryGeneration;
  $("retry-button").disabled = true;
  $("retry-button").textContent = "Reconnecting…";
  retryTimer = setTimeout(() => {
    if (generation !== retryGeneration) return;
    setOnline(true);
    $("preview-state").value = "ready";
    $("retry-button").disabled = false;
    $("retry-button").innerHTML = `${icon("refresh")}Retry`;
    toast("Preview connection restored. Your draft is ready.");
  }, 700);
});
$("review-form").addEventListener("submit", (event) => { event.preventDefault(); decision(true); });
$("reject-open").addEventListener("click", () => { $("review-form").hidden = true; $("reject-form").hidden = false; $("reject-reason").focus(); });
$("reject-cancel").addEventListener("click", () => { $("reject-form").hidden = true; $("review-form").hidden = false; $("reject-open").focus(); });
$("reject-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!$("reject-reason").value.trim()) { $("reject-reason").setCustomValidity("Please explain why this rule needs to change."); $("reject-reason").reportValidity(); return; }
  decision(false);
});
$("reject-reason").addEventListener("input", () => $("reject-reason").setCustomValidity(""));
$("preferences-toggle").addEventListener("click", () => {
  stopVoice();
  $("preferences-dialog").showModal();
});
$("preferences-close").addEventListener("click", () => $("preferences-dialog").close());
$("preferences-dialog").addEventListener("close", () => $("preferences-toggle").focus());
$("preferences-dialog").addEventListener("change", (event) => {
  const input = event.target;
  const key = input.dataset.preference || ({ theme: "theme", "enter-behavior": "enterBehavior" })[input.name];
  const value = input.type === "checkbox" ? input.checked : input.value;
  if (!validPreference(key, value)) return;
  preferences[key] = value;
  savePreferences();
});
$("preferences-reset").addEventListener("click", () => {
  Object.assign(preferences, defaultPreferences);
  savePreferences();
  toast("Default preferences restored. Your session work is unchanged.");
});
systemTheme.addEventListener("change", () => { if (preferences.theme === "system") applyPreferences(); });
$("menu-toggle").addEventListener("click", () => setNavigation(!document.body.classList.contains("nav-open")));
$("mobile-overlay").addEventListener("click", () => { setNavigation(false); $("menu-toggle").focus(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    stopVoice();
    const wasOpen = document.body.classList.contains("nav-open");
    setNavigation(false);
    if (wasOpen) $("menu-toggle").focus();
  }
  if (event.key === "Tab" && document.body.classList.contains("nav-open")) {
    const buttons = [...$("sidebar").querySelectorAll("a, button")];
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
mobileViewport.addEventListener("change", () => setNavigation(false));
setNavigation(false);
applyPreferences();
updateComposer();
