const STORAGE_KEY_V2 = "flowr_mock_state_v2";
const STORAGE_KEY_V1 = "flowr_mock_state_v1";

const CONFIRM_GRACE_MS = 20_000;

const DEFAULT_STATE = {
  version: 2,

  // Defaults for *next* session
  mode: "nextHour", // "nextHour" | "duration"
  durationMinutes: 60,

  introMessage: "sup gang",
  outroMessage: "flowr this hour",

  settings: {
    sound: false,
    confetti: true,
    reminders: true,
    reminderMsg: "hydrate + vibe check",
    confirmEnd: true,
    idleFinish: false,
    idleMinutes: 10,
  },

  ui: {
    focus: false,
    wakeLock: false,
  },

  // Current session
  active: null,

  // Completed sessions
  history: [],
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatHMS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function computeBaseFinishTs({ mode, startTs, durationMinutes }) {
  if (!startTs) return null;
  if (mode === "duration") {
    return startTs + durationMinutes * 60 * 1000;
  }
  // nextHour: top of the next hour
  const d = new Date(startTs);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.getTime();
}

function makeId() {
  // short-ish random id is enough for local mockup
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNotes(notes) {
  const n = notes ?? {};
  const tagsRaw = String(n.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
  return {
    strain: String(n.strain ?? "").slice(0, 80),
    vibe: String(n.vibe ?? "").slice(0, 80),
    where: String(n.where ?? "").slice(0, 80),
    rating: clamp(Number(n.rating ?? 4), 1, 5),
    tags: tagsRaw,
    text: String(n.text ?? "").slice(0, 400),
  };
}

function loadStateV2() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 2) return null;

    const durationMinutes = clamp(
      Number(parsed.durationMinutes ?? DEFAULT_STATE.durationMinutes),
      5,
      240,
    );

    const settings = {
      ...DEFAULT_STATE.settings,
      ...(parsed.settings ?? {}),
      idleMinutes: clamp(
        Number(parsed.settings?.idleMinutes ?? DEFAULT_STATE.settings.idleMinutes),
        2,
        60,
      ),
    };

    const ui = { ...DEFAULT_STATE.ui, ...(parsed.ui ?? {}) };

    const history = Array.isArray(parsed.history) ? parsed.history : [];
    const normalizedHistory = history
      .map((s) => ({
        id: String(s.id ?? makeId()),
        startTs: Number(s.startTs),
        finishTs: Number(s.finishTs),
        rule: s.rule ?? null,
        extensionMs: Number(s.extensionMs ?? 0),
        notes: normalizeNotes(s.notes),
      }))
      .filter((s) => Number.isFinite(s.startTs) && Number.isFinite(s.finishTs) && s.finishTs >= s.startTs)
      .slice(-200);

    const active = parsed.active
      ? {
          id: String(parsed.active.id ?? makeId()),
          startTs: Number(parsed.active.startTs),
          finishTs: parsed.active.finishTs ? Number(parsed.active.finishTs) : null,
          baseFinishTs: Number(parsed.active.baseFinishTs),
          extensionMs: Number(parsed.active.extensionMs ?? 0),
          rule: parsed.active.rule ?? null,
          notes: normalizeNotes(parsed.active.notes),
          reminderSent: Boolean(parsed.active.reminderSent),
          lastActivityTs: Number(parsed.active.lastActivityTs ?? Date.now()),
          confirm: parsed.active.confirm
            ? {
                open: Boolean(parsed.active.confirm.open),
                deadlineTs: Number(parsed.active.confirm.deadlineTs),
              }
            : { open: false, deadlineTs: 0 },
        }
      : null;

    const normalizedActive =
      active && Number.isFinite(active.startTs) && Number.isFinite(active.baseFinishTs)
        ? active
        : null;

    return {
      ...DEFAULT_STATE,
      ...parsed,
      version: 2,
      durationMinutes,
      settings,
      ui,
      active: normalizedActive,
      history: normalizedHistory,
    };
  } catch {
    return null;
  }
}

function loadStateV1AndMigrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return null;
    const v1 = JSON.parse(raw);
    if (!v1 || (!v1.startTs && !v1.finishTs)) {
      return null;
    }

    const migrated = { ...DEFAULT_STATE };
    migrated.mode = v1.mode === "duration" ? "duration" : "nextHour";
    migrated.durationMinutes = clamp(Number(v1.durationMinutes ?? 60), 5, 240);
    migrated.introMessage = String(v1.introMessage ?? DEFAULT_STATE.introMessage);
    migrated.outroMessage = String(v1.outroMessage ?? DEFAULT_STATE.outroMessage);

    if (v1.startTs) {
      const startTs = Number(v1.startTs);
      const rule = {
        mode: migrated.mode,
        durationMinutes: migrated.durationMinutes,
      };
      const baseFinishTs = computeBaseFinishTs({ mode: rule.mode, startTs, durationMinutes: rule.durationMinutes });
      migrated.active = {
        id: makeId(),
        startTs,
        finishTs: v1.finishTs ? Number(v1.finishTs) : null,
        baseFinishTs,
        extensionMs: 0,
        rule,
        notes: normalizeNotes({}),
        reminderSent: false,
        lastActivityTs: Date.now(),
        confirm: { open: false, deadlineTs: 0 },
      };
    }

    return migrated;
  } catch {
    return null;
  }
}

function loadState() {
  return loadStateV2() ?? loadStateV1AndMigrate() ?? { ...DEFAULT_STATE };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
}

function toast(title, body) {
  const host = document.getElementById("toastHost");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<div class="toastTitle"></div><div class="toastBody"></div>`;
  el.querySelector(".toastTitle").textContent = title;
  el.querySelector(".toastBody").textContent = body;
  host.appendChild(el);
  window.setTimeout(() => el.remove(), 4200);
}

function getPhase(state) {
  if (!state.active) return "idle";
  if (state.active && !state.active.finishTs) return "running";
  return "finished";
}

function setStatusUI(phase) {
  const statusText = document.getElementById("statusText");
  const dot = document.getElementById("statusDot");

  if (phase === "idle") {
    statusText.textContent = "Idle";
    dot.style.background = "rgba(255,255,255,0.35)";
    dot.style.boxShadow = "0 0 0 4px rgba(255,255,255,0.06)";
    return;
  }
  if (phase === "running") {
    statusText.textContent = "Smoking";
    dot.style.background = "rgba(75, 247, 165, 0.95)";
    dot.style.boxShadow = "0 0 0 4px rgba(75, 247, 165, 0.14)";
    return;
  }
  statusText.textContent = "Finished";
  dot.style.background = "rgba(255, 211, 79, 0.95)";
  dot.style.boxShadow = "0 0 0 4px rgba(255, 211, 79, 0.14)";
}

function setModeUI(state) {
  const nextHourBtn = document.getElementById("modeNextHour");
  const durationBtn = document.getElementById("modeDuration");
  const durationInput = document.getElementById("durationMinutes");
  const explainer = document.getElementById("ruleExplainer");

  nextHourBtn.classList.toggle("isActive", state.mode === "nextHour");
  durationBtn.classList.toggle("isActive", state.mode === "duration");

  durationInput.disabled = state.mode !== "duration";
  durationInput.value = String(state.durationMinutes);

  explainer.textContent =
    state.mode === "nextHour"
      ? "“Next hour” ends at the top of the next hour (your “flowr this hour” vibe)."
      : "“Duration” ends after N minutes from the moment you tapped “Smoked.”";
}

function getTargetFinishTs(active) {
  if (!active) return null;
  return Number(active.baseFinishTs) + Number(active.extensionMs ?? 0);
}

function setClockProgress(progress01) {
  const ring = document.getElementById("clockRing");
  if (!ring) return;
  const C = 289; // matches CSS dasharray
  const p = clamp(Number(progress01 ?? 0), 0, 1);
  const offset = C * (1 - p);
  ring.style.strokeDashoffset = String(offset);
}

function renderHistory(state) {
  const list = document.getElementById("historyList");
  const totalsToday = document.getElementById("totalsToday");

  const todayKey = formatDateKey(Date.now());
  const todays = state.history.filter((s) => formatDateKey(s.startTs) === todayKey);
  const totalMs = todays.reduce((acc, s) => acc + (s.finishTs - s.startTs), 0);
  totalsToday.textContent = `Today: ${todays.length} session${todays.length === 1 ? "" : "s"} • ${formatHMS(totalMs)}`;

  if (!state.history.length) {
    list.innerHTML = `<div class="emptyState">No history yet. Tap <b>Smoked</b>, and Flowr will save it when it finishes.</div>`;
    return;
  }

  const items = [...state.history].sort((a, b) => b.startTs - a.startTs).slice(0, 50);

  list.innerHTML = items
    .map((s) => {
      const dur = s.finishTs - s.startTs;
      const time = `${formatTime(s.startTs)} → ${formatTime(s.finishTs)}`;
      const date = new Date(s.startTs).toLocaleDateString([], { month: "short", day: "numeric" });
      const pills = [];
      if (s.notes?.strain) pills.push(`<span class="pill pillAccent">strain: ${escapeHtml(s.notes.strain)}</span>`);
      if (s.notes?.vibe) pills.push(`<span class="pill">vibe: ${escapeHtml(s.notes.vibe)}</span>`);
      if (s.notes?.where) pills.push(`<span class="pill">where: ${escapeHtml(s.notes.where)}</span>`);
      if (s.notes?.rating) pills.push(`<span class="pill">rate: ${Number(s.notes.rating)}/5</span>`);
      const tags = Array.isArray(s.notes?.tags) ? s.notes.tags : [];
      for (const t of tags.slice(0, 6)) pills.push(`<span class="pill">#${escapeHtml(t)}</span>`);
      const noteLine = s.notes?.text ? escapeHtml(s.notes.text) : "";

      return `
        <div class="historyItem" data-session-id="${escapeHtml(s.id)}">
          <div class="historyMain">
            <div class="historyLine1">
              <span class="historyTime">${escapeHtml(time)}</span>
              <span class="historyDur">${escapeHtml(formatHMS(dur))}</span>
              <span class="historyMeta">(${escapeHtml(date)})</span>
            </div>
            ${pills.length ? `<div class="pillRow">${pills.join("")}</div>` : ""}
            ${noteLine ? `<div class="historyMeta">${noteLine}</div>` : ""}
          </div>
          <div class="historyRight">
            <button class="btn btnGhost btnTiny" type="button" data-del="${escapeHtml(s.id)}">Delete</button>
          </div>
        </div>
      `.trim();
    })
    .join("\n");
}

function render(state) {
  const phase = getPhase(state);
  setStatusUI(phase);
  setModeUI(state);

  const smokedAt = document.getElementById("smokedAt");
  const autoFinishAt = document.getElementById("autoFinishAt");
  const finishedAt = document.getElementById("finishedAt");
  const meta = document.getElementById("timerMeta");

  const active = state.active;
  const targetFinishTs = active ? getTargetFinishTs(active) : null;

  smokedAt.textContent = formatTime(active?.startTs);
  autoFinishAt.textContent = formatTime(targetFinishTs);
  finishedAt.textContent = formatTime(active?.finishTs);

  const startBtn = document.getElementById("btnStart");
  const resetBtn = document.getElementById("btnReset");
  const finishBtn = document.getElementById("btnFinish");
  const focusBtn = document.getElementById("btnFocus");
  const wakeBtn = document.getElementById("btnWake");

  startBtn.textContent = phase === "idle" ? "Smoked" : phase === "running" ? "Smoking…" : "Start again";
  startBtn.disabled = phase === "running";

  finishBtn.disabled = phase !== "running";
  resetBtn.disabled = phase === "idle";

  if (phase === "idle") meta.textContent = "Tap “Smoked” to start.";
  if (phase === "running") meta.textContent = "Auto-finish will trigger when your session’s end time hits.";
  if (phase === "finished") meta.textContent = "Session finished. Start again, or check History.";

  const intro = document.getElementById("introMessage");
  const outro = document.getElementById("outroMessage");
  intro.value = state.introMessage;
  outro.value = state.outroMessage;

  // Notes
  document.getElementById("noteStrain").value = active?.notes?.strain ?? "";
  document.getElementById("noteVibe").value = active?.notes?.vibe ?? "";
  document.getElementById("noteWhere").value = active?.notes?.where ?? "";
  document.getElementById("noteRating").value = String(active?.notes?.rating ?? 4);
  document.getElementById("noteTags").value = (active?.notes?.tags ?? []).join(", ");
  document.getElementById("noteText").value = active?.notes?.text ?? "";

  // Settings
  document.getElementById("setSound").checked = Boolean(state.settings.sound);
  document.getElementById("setConfetti").checked = Boolean(state.settings.confetti);
  document.getElementById("setReminders").checked = Boolean(state.settings.reminders);
  document.getElementById("setReminderMsg").value = String(state.settings.reminderMsg ?? "");
  document.getElementById("setConfirmEnd").checked = Boolean(state.settings.confirmEnd);
  document.getElementById("setIdleFinish").checked = Boolean(state.settings.idleFinish);
  document.getElementById("setIdleMinutes").value = String(state.settings.idleMinutes);

  // Focus + wake lock UI
  focusBtn.textContent = state.ui.focus ? "Exit focus" : "Focus";
  wakeBtn.textContent = state.ui.wakeLock ? "Awake ✓" : "Keep awake";

  document.body.classList.toggle("isFocus", Boolean(state.ui.focus));
  document.body.classList.toggle("isRunning", phase === "running");

  // Modal open?
  const modalHost = document.getElementById("modalHost");
  const isModalOpen = Boolean(active?.confirm?.open);
  modalHost.hidden = !isModalOpen;

  renderHistory(state);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function playFinishSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.24);
    window.setTimeout(() => ctx.close?.(), 400);
  } catch {
    // ignore
  }
}

function startConfettiBurst() {
  const canvas = document.getElementById("confettiCanvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  canvas.width = w;
  canvas.height = h;

  const colors = ["#ff4fd8", "#4bf7a5", "#ffd34f", "#7aa5ff", "#ffffff"];
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * w,
    y: -Math.random() * h * 0.2,
    vx: (Math.random() - 0.5) * 2.2 * dpr,
    vy: (Math.random() * 3.2 + 1.8) * dpr,
    r: (Math.random() * 6 + 4) * dpr,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.2,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));

  document.body.classList.add("isConfetti");
  const t0 = performance.now();

  function frame(t) {
    const dt = Math.min(32, t - t0);
    ctx.clearRect(0, 0, w, h);
    for (const p of pieces) {
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.rot += p.vr * (dt / 16);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    }
    if (t - t0 < 1400) {
      requestAnimationFrame(frame);
    } else {
      document.body.classList.remove("isConfetti");
      ctx.clearRect(0, 0, w, h);
    }
  }

  requestAnimationFrame(frame);
}

function finishSession(state, now, reason) {
  if (!state.active || state.active.finishTs) return state;
  const finishedActive = { ...state.active, finishTs: now, confirm: { open: false, deadlineTs: 0 } };
  const session = {
    id: finishedActive.id,
    startTs: finishedActive.startTs,
    finishTs: finishedActive.finishTs,
    rule: finishedActive.rule,
    extensionMs: finishedActive.extensionMs ?? 0,
    notes: normalizeNotes(finishedActive.notes),
    reason: String(reason ?? "finish"),
  };

  const already = state.history.some((s) => s.id === session.id);
  const nextHistory = already ? state.history : [...state.history, session].slice(-200);

  const next = { ...state, active: finishedActive, history: nextHistory };
  saveState(next);

  toast("Flowr", state.outroMessage || "flowr this hour");
  if (state.settings.sound) playFinishSound();
  if (state.settings.confetti) startConfettiBurst();

  return next;
}

function maybeSendHalfwayReminder(state, now) {
  const a = state.active;
  if (!a || a.finishTs) return state;
  if (!state.settings.reminders) return state;
  if (a.reminderSent) return state;

  const target = getTargetFinishTs(a);
  if (!target) return state;
  const halfwayTs = a.startTs + (target - a.startTs) / 2;
  if (now < halfwayTs) return state;

  const next = { ...state, active: { ...a, reminderSent: true } };
  saveState(next);
  toast("Check-in", state.settings.reminderMsg || "hydrate + vibe check");
  return next;
}

function maybeIdleFinish(state, now) {
  const a = state.active;
  if (!a || a.finishTs) return state;
  if (!state.settings.idleFinish) return state;
  const idleMs = clamp(Number(state.settings.idleMinutes ?? 10), 2, 60) * 60 * 1000;
  if (now - (a.lastActivityTs ?? now) < idleMs) return state;
  toast("Flowr", `Idle for ${state.settings.idleMinutes}m — finishing.`);
  return finishSession(state, now, "idle");
}

function maybeAutoFinishOrConfirm(state, now) {
  const a = state.active;
  if (!a || a.finishTs) return state;
  const target = getTargetFinishTs(a);
  if (!target) return state;
  if (now < target) return state;

  if (!state.settings.confirmEnd) {
    return finishSession(state, now, "auto");
  }

  // Confirm modal flow
  if (!a.confirm?.open) {
    const next = {
      ...state,
      active: {
        ...a,
        confirm: { open: true, deadlineTs: now + CONFIRM_GRACE_MS },
      },
    };
    saveState(next);
    toast("Flowr", "Auto-finish reached — extend if you want.");
    return next;
  }

  // countdown expired
  if (now >= a.confirm.deadlineTs) {
    return finishSession(state, now, "confirm_timeout");
  }

  return state;
}

function main() {
  let state = loadState();

  // wire UI
  const startBtn = document.getElementById("btnStart");
  const resetBtn = document.getElementById("btnReset");
  const finishBtn = document.getElementById("btnFinish");
  const fullscreenBtn = document.getElementById("btnFullscreen");
  const focusBtn = document.getElementById("btnFocus");
  const wakeBtn = document.getElementById("btnWake");
  const nextHourBtn = document.getElementById("modeNextHour");
  const durationBtn = document.getElementById("modeDuration");
  const durationInput = document.getElementById("durationMinutes");
  const introInput = document.getElementById("introMessage");
  const outroInput = document.getElementById("outroMessage");
  const elapsedEl = document.getElementById("elapsed");
  const commandForm = document.getElementById("commandForm");
  const commandInput = document.getElementById("commandInput");

  // notes
  const noteStrain = document.getElementById("noteStrain");
  const noteVibe = document.getElementById("noteVibe");
  const noteWhere = document.getElementById("noteWhere");
  const noteRating = document.getElementById("noteRating");
  const noteTags = document.getElementById("noteTags");
  const noteText = document.getElementById("noteText");

  // settings
  const setSound = document.getElementById("setSound");
  const setConfetti = document.getElementById("setConfetti");
  const setReminders = document.getElementById("setReminders");
  const setReminderMsg = document.getElementById("setReminderMsg");
  const setConfirmEnd = document.getElementById("setConfirmEnd");
  const setIdleFinish = document.getElementById("setIdleFinish");
  const setIdleMinutes = document.getElementById("setIdleMinutes");

  // history actions
  const btnExport = document.getElementById("btnExport");
  const btnClear = document.getElementById("btnClear");

  // modal
  const modalHost = document.getElementById("modalHost");
  const modalCountdown = document.getElementById("modalCountdown");
  const btnModalFinish = document.getElementById("btnModalFinish");
  const btnModalPlus15 = document.getElementById("btnModalPlus15");
  const btnModalPlus30 = document.getElementById("btnModalPlus30");

  // wake lock
  let wakeLockSentinel = null;

  function update(partial) {
    state = { ...state, ...partial };
    saveState(state);
    render(state);
  }

  startBtn.addEventListener("click", () => {
    const phase = getPhase(state);
    if (phase === "running") return;
    const now = Date.now();

    const rule = {
      mode: state.mode,
      durationMinutes: state.durationMinutes,
    };
    const baseFinishTs = computeBaseFinishTs({ mode: rule.mode, startTs: now, durationMinutes: rule.durationMinutes });

    const active = {
      id: makeId(),
      startTs: now,
      finishTs: null,
      baseFinishTs,
      extensionMs: 0,
      rule,
      notes: normalizeNotes({}),
      reminderSent: false,
      lastActivityTs: now,
      confirm: { open: false, deadlineTs: 0 },
    };

    state = { ...state, active };
    saveState(state);
    render(state);
    toast("Flowr", state.introMessage || "sup gang");
  });

  finishBtn.addEventListener("click", () => {
    const phase = getPhase(state);
    if (phase !== "running") return;
    state = finishSession(state, Date.now(), "manual");
    render(state);
  });

  resetBtn.addEventListener("click", () => {
    const keep = {
      mode: state.mode,
      durationMinutes: state.durationMinutes,
      introMessage: state.introMessage,
      outroMessage: state.outroMessage,
      settings: state.settings,
      ui: { ...state.ui, focus: state.ui.focus },
      history: state.history,
    };
    state = { ...DEFAULT_STATE, ...keep, active: null, version: 2 };
    saveState(state);
    render(state);
    toast("Flowr", "Session reset.");
  });

  nextHourBtn.addEventListener("click", () => update({ mode: "nextHour" }));
  durationBtn.addEventListener("click", () => update({ mode: "duration" }));

  durationInput.addEventListener("change", () => {
    const n = clamp(Number(durationInput.value || 60), 5, 240);
    update({ durationMinutes: n });
  });

  introInput.addEventListener("input", () => update({ introMessage: introInput.value }));
  outroInput.addEventListener("input", () => update({ outroMessage: outroInput.value }));

  function updateActiveNotes(partialNotes) {
    const a = state.active;
    if (!a) {
      // allow editing notes only when session exists: create a draft session? keep simple.
      toast("Flowr", "Start a session first to attach notes.");
      render(state);
      return;
    }
    const nextActive = { ...a, notes: normalizeNotes({ ...a.notes, ...partialNotes }) };
    state = { ...state, active: nextActive };
    saveState(state);
  }

  noteStrain.addEventListener("input", () => updateActiveNotes({ strain: noteStrain.value }));
  noteVibe.addEventListener("input", () => updateActiveNotes({ vibe: noteVibe.value }));
  noteWhere.addEventListener("input", () => updateActiveNotes({ where: noteWhere.value }));
  noteRating.addEventListener("change", () => updateActiveNotes({ rating: Number(noteRating.value) }));
  noteTags.addEventListener("input", () => updateActiveNotes({ tags: noteTags.value }));
  noteText.addEventListener("input", () => updateActiveNotes({ text: noteText.value }));

  function updateSettings(partial) {
    state = { ...state, settings: { ...state.settings, ...partial } };
    saveState(state);
    render(state);
  }

  setSound.addEventListener("change", () => updateSettings({ sound: setSound.checked }));
  setConfetti.addEventListener("change", () => updateSettings({ confetti: setConfetti.checked }));
  setReminders.addEventListener("change", () => updateSettings({ reminders: setReminders.checked }));
  setReminderMsg.addEventListener("input", () => updateSettings({ reminderMsg: setReminderMsg.value }));
  setConfirmEnd.addEventListener("change", () => updateSettings({ confirmEnd: setConfirmEnd.checked }));
  setIdleFinish.addEventListener("change", () => updateSettings({ idleFinish: setIdleFinish.checked }));
  setIdleMinutes.addEventListener("change", () => {
    const n = clamp(Number(setIdleMinutes.value || 10), 2, 60);
    setIdleMinutes.value = String(n);
    updateSettings({ idleMinutes: n });
  });

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: state.version,
      history: state.history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowr-sessions-${formatDateKey(Date.now())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Flowr", "Exported JSON.");
  }

  btnExport.addEventListener("click", exportJson);
  btnClear.addEventListener("click", () => {
    if (!state.history.length) return;
    if (!window.confirm("Clear all Flowr history? This cannot be undone.")) return;
    state = { ...state, history: [] };
    saveState(state);
    render(state);
    toast("Flowr", "History cleared.");
  });

  function deleteSession(id) {
    const nextHistory = state.history.filter((s) => s.id !== id);
    state = { ...state, history: nextHistory };
    saveState(state);
    render(state);
    toast("Flowr", "Deleted.");
  }

  document.getElementById("historyList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    const id = btn.getAttribute("data-del");
    if (!id) return;
    deleteSession(id);
  });

  function toggleFocus() {
    state = { ...state, ui: { ...state.ui, focus: !state.ui.focus } };
    saveState(state);
    render(state);
  }

  focusBtn.addEventListener("click", toggleFocus);

  async function toggleWakeLock() {
    const wants = !state.ui.wakeLock;
    if (!("wakeLock" in navigator) || !navigator.wakeLock) {
      toast("Wake lock", "Not supported on this browser/device.");
      return;
    }
    try {
      if (wants) {
        wakeLockSentinel = await navigator.wakeLock.request("screen");
        wakeLockSentinel.addEventListener("release", () => {
          state = { ...state, ui: { ...state.ui, wakeLock: false } };
          saveState(state);
          render(state);
        });
        state = { ...state, ui: { ...state.ui, wakeLock: true } };
        saveState(state);
        render(state);
        toast("Flowr", "Keeping screen awake.");
      } else {
        await wakeLockSentinel?.release?.();
        wakeLockSentinel = null;
        state = { ...state, ui: { ...state.ui, wakeLock: false } };
        saveState(state);
        render(state);
        toast("Flowr", "Wake lock off.");
      }
    } catch {
      toast("Wake lock", "Could not enable.");
    }
  }

  wakeBtn.addEventListener("click", () => {
    toggleWakeLock();
  });

  fullscreenBtn.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        toast("Flowr", "Fullscreen on.");
      } else {
        await document.exitFullscreen?.();
        toast("Flowr", "Fullscreen off.");
      }
    } catch {
      toast("Fullscreen", "Not supported.");
    }
  });

  function closeModalAndFinish() {
    if (!state.active) return;
    state = finishSession(state, Date.now(), "confirm_finish");
    render(state);
  }

  function extendSession(minutes) {
    const a = state.active;
    if (!a || a.finishTs) return;
    const extra = minutes * 60 * 1000;
    const nextActive = {
      ...a,
      extensionMs: (a.extensionMs ?? 0) + extra,
      confirm: { open: false, deadlineTs: 0 },
    };
    state = { ...state, active: nextActive };
    saveState(state);
    render(state);
    toast("Flowr", `Extended +${minutes}m.`);
  }

  btnModalFinish.addEventListener("click", closeModalAndFinish);
  btnModalPlus15.addEventListener("click", () => extendSession(15));
  btnModalPlus30.addEventListener("click", () => extendSession(30));

  modalHost.addEventListener("click", (e) => {
    const close = e.target?.getAttribute?.("data-modal-close");
    if (!close) return;
    closeModalAndFinish();
  });

  // Activity tracking for idle-finish
  function markActivity() {
    if (!state.active || state.active.finishTs) return;
    const now = Date.now();
    state = { ...state, active: { ...state.active, lastActivityTs: now } };
    saveState(state);
  }

  ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, markActivity, { passive: true });
  });

  commandForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = commandInput.value.trim().toLowerCase();
    commandInput.value = "";
    if (!raw) return;

    if (raw === "help") {
      toast("Commands", "smoke / done / reset / focus / awake / export / clear / help");
      return;
    }
    if (raw === "smoke") {
      startBtn.click();
      return;
    }
    if (raw === "done") {
      finishBtn.click();
      return;
    }
    if (raw === "reset") {
      resetBtn.click();
      return;
    }
    if (raw === "focus") {
      toggleFocus();
      return;
    }
    if (raw === "awake") {
      toggleWakeLock();
      return;
    }
    if (raw === "export") {
      exportJson();
      return;
    }
    if (raw === "clear") {
      btnClear.click();
      return;
    }
    if (raw === "fullscreen" || raw === "fs") {
      fullscreenBtn.click();
      return;
    }
    toast("Unknown command", `Try: smoke / done / reset / focus / awake / export / clear / help`);
  });

  // initial render
  render(state);

  // tick
  window.setInterval(() => {
    const now = Date.now();
    const prevFinishTs = state.active?.finishTs ?? null;
    const prevConfirmOpen = state.active?.confirm?.open ?? false;

    state = maybeIdleFinish(state, now);
    state = maybeSendHalfwayReminder(state, now);
    state = maybeAutoFinishOrConfirm(state, now);

    const nextFinishTs = state.active?.finishTs ?? null;
    const nextConfirmOpen = state.active?.confirm?.open ?? false;

    if (prevFinishTs !== nextFinishTs || prevConfirmOpen !== nextConfirmOpen) {
      render(state);
    }

    const phase = getPhase(state);
    const start = state.active?.startTs ?? now;
    const elapsedMs = phase === "idle" ? 0 : (state.active?.finishTs ?? now) - start;
    elapsedEl.textContent = formatHMS(elapsedMs);

    // Keep “Auto-finish at” fresh (+ countdown if modal open)
    if (phase !== "idle" && state.active) {
      const target = getTargetFinishTs(state.active);
      document.getElementById("autoFinishAt").textContent = formatTime(target);
      if (state.active.confirm?.open) {
        const left = Math.max(0, state.active.confirm.deadlineTs - now);
        modalCountdown.textContent = `Auto-finishing in ${Math.ceil(left / 1000)}s`;
      }

      const total = Math.max(1, target - state.active.startTs);
      const done = clamp((now - state.active.startTs) / total, 0, 1);
      setClockProgress(state.active.finishTs ? 1 : done);

      const mini = document.getElementById("clockMini");
      if (mini) {
        const leftMs = Math.max(0, target - now);
        mini.textContent = `ends in ${formatHMS(leftMs)} • ${formatTime(target)}`;
      }
    } else {
      setClockProgress(0);
      const mini = document.getElementById("clockMini");
      if (mini) mini.textContent = "—";
    }
  }, 250);
}

document.addEventListener("DOMContentLoaded", main);
