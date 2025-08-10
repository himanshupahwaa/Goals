const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_INTENSITY = 8; // after this, further clicks keep max darkness

let currentViewDate;
// single-click opens modal; Ctrl/Cmd-click increments

// Settings for custom fields persisted in localStorage
function cryptoRandomId() {
  try {
    return (crypto.randomUUID && crypto.randomUUID()) || Array.from(crypto.getRandomValues(new Uint32Array(2))).map(n => n.toString(36)).join("");
  } catch {
    return String(Date.now()) + Math.random().toString(36).slice(2, 8);
  }
}

function defaultSettings() {
  return {
    fields: [
      { id: cryptoRandomId(), label: "Protein (g)", key: "protein", goal: 120, compare: "under", step: 1, min: 0 },
      { id: cryptoRandomId(), label: "Calories", key: "calories", goal: 2000, compare: "over", step: 1, min: 0 },
      { id: cryptoRandomId(), label: "Pushups", key: "pushups", goal: 100, compare: "under", step: 1, min: 0 },
      { id: cryptoRandomId(), label: "Crunches", key: "crunches", goal: 100, compare: "under", step: 1, min: 0 },
      { id: cryptoRandomId(), label: "Miles run", key: "miles", goal: 3, compare: "under", step: 0.1, min: 0 },
    ],
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("goals:settings");
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.fields)) return defaultSettings();
    const fields = parsed.fields
      .map(f => ({
        id: f.id || cryptoRandomId(),
        label: String(f.label || "Field"),
        key: String(f.key || "field" + Math.random().toString(36).slice(2,5)),
        goal: Number(f.goal) || 0,
        compare: f.compare === "over" ? "over" : "under",
        step: Number(f.step) || 1,
        min: Number(f.min) || 0,
      }))
      .slice(0, 5);
    return { fields };
  } catch {
    return defaultSettings();
  }
}

function saveSettings(settings) {
  try { localStorage.setItem("goals:settings", JSON.stringify(settings)); } catch {}
}

function pad(value) { return String(value).padStart(2, "0"); }

function formatYearMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function getLocalStorageKey(yearMonth) {
  return `goals:${yearMonth}`;
}

function loadMonthData(yearMonth) {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(yearMonth));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function saveMonthData(yearMonth, data) {
  try {
    localStorage.setItem(getLocalStorageKey(yearMonth), JSON.stringify(data));
  } catch {
    // ignore write errors (e.g., private mode quota)
  }
}

function ensureDayRecord(entry) {
  // Backward compatible migration: number -> { clicks }
  if (entry == null) return { clicks: 0 };
  if (typeof entry === "number") return { clicks: entry };
  if (typeof entry === "object") {
    const clicks = Number(entry.clicks ?? 0) || 0;
    const normalized = {
      clicks,
      calories: entry.calories != null ? Number(entry.calories) : undefined,
      protein: entry.protein != null ? Number(entry.protein) : undefined,
      pushups: entry.pushups != null ? Number(entry.pushups) : undefined,
      crunches: entry.crunches != null ? Number(entry.crunches) : undefined,
      miles: entry.miles != null ? Number(entry.miles) : undefined,
      workoutDone: Boolean(entry.workoutDone),
      dietNotes: entry.dietNotes ?? "",
      workoutNotes: entry.workoutNotes ?? "",
    };
    // Preserve any additional numeric custom fields
    for (const key of Object.keys(entry)) {
      if (key in normalized) continue;
      const v = entry[key];
      if (v == null) continue;
      const n = Number(v);
      if (Number.isFinite(n)) normalized[key] = n;
    }
    return normalized;
  }
  return { clicks: 0 };
}

function clampPercent(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function coerceNumberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isDayOverLimit(record, viewDate, day, today, settings) {
  if (!record) return false;
  const dayDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isPast = dayDate < todayDate; // only evaluate at end-of-day (past days)
  if (!isPast) return false;

  const fields = (settings && settings.fields) ? settings.fields : [];
  for (const f of fields) {
    const val = coerceNumberOrZero(record[f.key]);
    if (f.compare === "over" && val > f.goal) return true;
    if (f.compare === "under" && val < f.goal) return true;
  }
  return false;
}

function renderBars(container, record, settings) {
  const bars = document.createElement("div");
  bars.className = "bars";

  const addBar = (type, value, goal, label) => {
    const bar = document.createElement("div");
    bar.className = `bar ${type}`;
    const fill = document.createElement("span");
    const pct = clampPercent((Number(value) || 0) / goal);
    fill.style.width = `${Math.round(pct * 100)}%`;
    bar.appendChild(fill);
    const shownValue = Number(value) || 0;
    const tooltip = `${label}: ${shownValue}/${goal}`;
    bar.title = tooltip;
    bar.setAttribute("aria-label", tooltip);
    fill.title = tooltip;
    bars.appendChild(bar);
  };

  const fields = (settings && settings.fields) ? settings.fields : [];
  for (const f of fields) {
    addBar(`dynamic ${cssSafeClass(f.key)}`, record[f.key], f.goal, f.label);
  }

  container.appendChild(bars);
}

function cssSafeClass(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function colorForCount(count) {
  // Neutral gray/black translucence; more clicks -> darker
  const clamped = Math.max(0, Math.min(count, MAX_INTENSITY));
  const alpha = Math.min(0.85, (clamped / MAX_INTENSITY) * 0.85);
  return `rgba(0, 0, 0, ${alpha})`;
}

function intlMonthLabel(date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function buildWeekdayHeader() {
  const row = document.createElement("div");
  row.className = "weekday-row";
  for (const label of WEEKDAY_LABELS) {
    const el = document.createElement("div");
    el.className = "weekday";
    el.textContent = label;
    row.appendChild(el);
  }
  return row;
}

function getMonthMeta(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();
  const startWeekday = firstOfMonth.getDay(); // 0..6 (Sun..Sat)
  return { firstOfMonth, lastOfMonth, daysInMonth, startWeekday };
}

function renderCalendar(viewDate) {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  const header = buildWeekdayHeader();
  calendar.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "calendar-grid";
  calendar.appendChild(grid);

  const { daysInMonth, startWeekday } = getMonthMeta(viewDate);
  const yearMonth = formatYearMonth(viewDate);
  const monthData = loadMonthData(yearMonth);
  const settings = loadSettings();

  // leading empty cells
  for (let i = 0; i < startWeekday; i++) {
    const placeholder = document.createElement("div");
    placeholder.className = "day-cell";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.style.visibility = "hidden";
    grid.appendChild(placeholder);
  }

  // month days
  const today = new Date();
  const isSameMonth = today.getFullYear() === viewDate.getFullYear() && today.getMonth() === viewDate.getMonth();
  for (let day = 1; day <= daysInMonth; day++) {
    const record = ensureDayRecord(monthData[String(day)]);
    const count = Number(record.clicks || 0);
    const overLimit = isDayOverLimit(record, viewDate, day, today, settings);

    const cell = document.createElement("button");
    cell.className = "day-cell";
    cell.setAttribute("data-day", String(day));
    cell.setAttribute("aria-label", `Day ${day}, clicks ${count}${overLimit ? ", over limit" : ""}`);
    cell.type = "button";

    const dateEl = document.createElement("div");
    dateEl.className = "date";
    dateEl.textContent = String(day);
    cell.appendChild(dateEl);

    if (isSameMonth && today.getDate() === day) {
      cell.classList.add("is-today");
    }

    if (overLimit) {
      cell.classList.add("over-limit");
    }

    const intensity = document.createElement("div");
    intensity.className = "intensity";
    intensity.style.backgroundColor = colorForCount(count);
    cell.appendChild(intensity);

    // Removed counter pill; intensity color now reflects clicks only

    // Removed indicator pills for workout and calories

    renderBars(cell, record, settings);

    cell.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        const current = Number(monthData[String(day)] || 0) + 1;
        const updated = ensureDayRecord(monthData[String(day)]);
        updated.clicks = current;
        monthData[String(day)] = updated;
        saveMonthData(yearMonth, monthData);
        intensity.style.backgroundColor = colorForCount(current);
        cell.setAttribute("aria-label", `Day ${day}, clicks ${current}`);
      } else {
        openDayModal(yearMonth, day);
      }
    });

    cell.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const updated = ensureDayRecord(monthData[String(day)]);
      const current = Math.max(0, Number(updated.clicks || 0) - 1);
      updated.clicks = current;
      monthData[String(day)] = updated;
      saveMonthData(yearMonth, monthData);
      intensity.style.backgroundColor = colorForCount(current);
      cell.setAttribute("aria-label", `Day ${day}, clicks ${current}`);
    });

    // no double-click handler; single-click opens modal

    grid.appendChild(cell);
  }
}

function attachNav(viewDate) {
  const label = document.getElementById("monthLabel");
  const applyLabel = () => { label.textContent = intlMonthLabel(viewDate); };
  applyLabel();

  document.getElementById("prevMonth").addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    applyLabel();
    renderCalendar(viewDate);
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    applyLabel();
    renderCalendar(viewDate);
  });
}

function openDayModal(yearMonth, day) {
  const modal = document.getElementById("dayModal");
  const title = document.getElementById("dayModalTitle");
  const form = document.getElementById("dayForm");
  const monthData = loadMonthData(yearMonth);
  const record = ensureDayRecord(monthData[String(day)]);
  const settings = loadSettings();

  title.textContent = `Edit ${yearMonth}-${String(day).padStart(2, "0")}`;
  // Build dynamic field inputs
  const container = document.getElementById("customFieldsContainer");
  container.innerHTML = "";
  (settings.fields || []).forEach((f, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.setAttribute("for", `cf_${idx}`);
    label.textContent = f.label;
    const input = document.createElement("input");
    input.type = "number";
    input.id = `cf_${idx}`;
    input.name = f.key;
    if (f.min != null) input.min = String(f.min);
    if (f.step != null) input.step = String(f.step);
    input.placeholder = `Goal: ${f.goal}`;
    const v = record[f.key];
    input.value = v != null ? String(v) : "";
    wrap.appendChild(label);
    wrap.appendChild(input);
    container.appendChild(wrap);
  });
  form.elements.workoutDone.checked = Boolean(record.workoutDone);
  form.elements.dietNotes.value = record.dietNotes ?? "";
  form.elements.workoutNotes.value = record.workoutNotes ?? "";

  form.dataset.yearMonth = yearMonth;
  form.dataset.day = String(day);

  modal.removeAttribute("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeDayModal() {
  const modal = document.getElementById("dayModal");
  modal.setAttribute("aria-hidden", "true");
  modal.setAttribute("hidden", "");
}

function setupModalHandlers() {
  const modal = document.getElementById("dayModal");
  modal.querySelectorAll("[data-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeDayModal());
  });

  const form = document.getElementById("dayForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const yearMonth = form.dataset.yearMonth;
    const day = Number(form.dataset.day);
    const monthData = loadMonthData(yearMonth);
    const record = ensureDayRecord(monthData[String(day)]);
    const settings = loadSettings();

    // Read dynamic numeric fields
    (settings.fields || []).forEach((f) => {
      const el = form.elements[f.key];
      if (!el) return;
      const val = String(el.value).trim();
      record[f.key] = val === "" ? undefined : Number(val);
    });
    const workoutDone = form.elements.workoutDone.checked;
    const dietNotes = form.elements.dietNotes.value;
    const workoutNotes = form.elements.workoutNotes.value;

    record.workoutDone = workoutDone;
    record.dietNotes = dietNotes;
    record.workoutNotes = workoutNotes;

    monthData[String(day)] = record;
    saveMonthData(yearMonth, monthData);
    closeDayModal();
    renderCalendar(currentViewDate);
  });

  document.getElementById("resetDay").addEventListener("click", () => {
    const yearMonth = form.dataset.yearMonth;
    const day = Number(form.dataset.day);
    const monthData = loadMonthData(yearMonth);
    monthData[String(day)] = { clicks: 0 };
    saveMonthData(yearMonth, monthData);
    closeDayModal();
    renderCalendar(currentViewDate);
  });
}

function main() {
  currentViewDate = new Date();
  attachNav(currentViewDate);
  setupModalHandlers();
  setupSettings();
  renderCalendar(currentViewDate);
}

document.addEventListener("DOMContentLoaded", main);

// Settings UI
function setupSettings() {
  const openBtn = document.getElementById("openSettings");
  const modal = document.getElementById("settingsModal");
  const form = document.getElementById("settingsForm");
  const fieldsList = document.getElementById("fieldsList");
  const addFieldBtn = document.getElementById("addField");
  const saveBtn = form ? form.querySelector('button[type="submit"]') : null;

  if (!openBtn || !modal || !form || !fieldsList || !addFieldBtn) {
    return; // settings UI not present
  }

  function close() {
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("hidden", "");
  }
  function open() {
    renderFieldsEditor();
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
  modal.querySelectorAll("[data-settings-close]").forEach((el) => el.addEventListener("click", close));
  openBtn.addEventListener("click", open);

  function renderFieldsEditor() {
    const settings = loadSettings();
    fieldsList.innerHTML = "";
    settings.fields.forEach((f, index) => {
      const row = document.createElement("div");
      row.className = "field-row";

      const nameField = inputField(`label_${f.id}`, "Name", f.label);
      const keyField = inputField(`key_${f.id}`, "Key", f.key);
      const goalField = inputField(`goal_${f.id}`, "Goal", String(f.goal), "number", "0", "any");
      const compareField = selectField(`cmp_${f.id}`, "X when", [
        { v: "under", t: "under (incomplete)" },
        { v: "over", t: "over (exceeds)" },
      ], f.compare);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn icon";
      removeBtn.innerText = "✕";
      removeBtn.title = "Remove";
      removeBtn.addEventListener("click", () => {
        const s = loadSettings();
        s.fields.splice(index, 1);
        saveSettings(s);
        renderFieldsEditor();
        renderCalendar(currentViewDate);
      });

      row.appendChild(nameField.wrapper);
      row.appendChild(keyField.wrapper);
      row.appendChild(goalField.wrapper);
      row.appendChild(compareField.wrapper);
      row.appendChild(removeBtn);
      fieldsList.appendChild(row);
    });
  }

  addFieldBtn.addEventListener("click", () => {
    const s = loadSettings();
    if (s.fields.length >= 5) return;
    s.fields.push({ id: cryptoRandomId(), label: "New field", key: `field${s.fields.length+1}`.toLowerCase(), goal: 0, compare: "under", step: 1, min: 0 });
    saveSettings(s);
    renderFieldsEditor();
  });

  function handleSave(e) {
    if (e) e.preventDefault();
    const s = loadSettings();
    // read back values
    s.fields = s.fields.map((f) => {
      const labelEl = form.elements[`label_${f.id}`];
      const keyEl = form.elements[`key_${f.id}`];
      const goalEl = form.elements[`goal_${f.id}`];
      const cmpEl = form.elements[`cmp_${f.id}`];
      const next = { ...f };
      if (labelEl) next.label = String(labelEl.value || next.label);
      if (keyEl) next.key = String(keyEl.value || next.key).trim() || next.key;
      if (goalEl) next.goal = Number(goalEl.value) || 0;
      if (cmpEl) next.compare = cmpEl.value === "over" ? "over" : "under";
      return next;
    }).slice(0,5);
    // ensure unique keys
    const seen = new Set();
    for (const f of s.fields) {
      let base = f.key.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
      let unique = base;
      let counter = 1;
      while (seen.has(unique)) { unique = `${base}-${counter++}`; }
      f.key = unique;
      seen.add(unique);
    }
    saveSettings(s);
    close();
    renderCalendar(currentViewDate);
  }
  form.addEventListener("submit", handleSave);
  if (saveBtn) saveBtn.addEventListener("click", handleSave);
}

function inputField(name, labelText, value, type = "text", min, step) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const label = document.createElement("label");
  label.setAttribute("for", name);
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  input.id = name;
  if (min != null) input.min = String(min);
  if (step != null) input.step = String(step);
  input.value = value ?? "";
  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return { wrapper, input };
}

function selectField(name, labelText, options, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const label = document.createElement("label");
  label.setAttribute("for", name);
  label.textContent = labelText;
  const select = document.createElement("select");
  select.name = name;
  select.id = name;
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt.v;
    o.textContent = opt.t;
    if (opt.v === value) o.selected = true;
    select.appendChild(o);
  }
  wrapper.appendChild(label);
  wrapper.appendChild(select);
  return { wrapper, select };
}


