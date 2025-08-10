const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_INTENSITY = 8; // after this, further clicks keep max darkness

let currentViewDate;
// single-click opens modal; Ctrl/Cmd-click increments

// Daily goals for 100% bars – tweak as desired
const GOALS = {
  protein: 120,     // grams
  calories: 2000,   // kcal
  pushups: 100,     // count
  crunches: 100,    // count
  miles: 3,         // miles
};

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
    return {
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

function isDayOverLimit(record, viewDate, day, today) {
  if (!record) return false;
  const dayDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isPast = dayDate < todayDate; // only evaluate at end-of-day (past days)
  if (!isPast) return false;

  const calories = coerceNumberOrZero(record.calories);
  const protein = coerceNumberOrZero(record.protein);
  const pushups = coerceNumberOrZero(record.pushups);
  const crunches = coerceNumberOrZero(record.crunches);
  const miles = coerceNumberOrZero(record.miles);

  const caloriesOver = calories > GOALS.calories; // exceed goal
  const proteinShort = protein < GOALS.protein;
  const pushupsShort = pushups < GOALS.pushups;
  const crunchesShort = crunches < GOALS.crunches;
  const milesShort = miles < GOALS.miles;

  return caloriesOver || proteinShort || pushupsShort || crunchesShort || milesShort;
}

function renderBars(container, record) {
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

  addBar("protein", record.protein, GOALS.protein, "Protein");
  addBar("calories", record.calories, GOALS.calories, "Calories");
  addBar("pushups", record.pushups, GOALS.pushups, "Pushups");
  addBar("crunches", record.crunches, GOALS.crunches, "Crunches");
  addBar("miles", record.miles, GOALS.miles, "Miles");

  container.appendChild(bars);
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
    const overLimit = isDayOverLimit(record, viewDate, day, today);

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

    renderBars(cell, record);

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

  title.textContent = `Edit ${yearMonth}-${String(day).padStart(2, "0")}`;

  form.elements.calories.value = record.calories ?? "";
  form.elements.protein.value = record.protein ?? "";
  if (form.elements.pushups) form.elements.pushups.value = record.pushups ?? "";
  if (form.elements.crunches) form.elements.crunches.value = record.crunches ?? "";
  if (form.elements.miles) form.elements.miles.value = record.miles ?? "";
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

    const calories = form.elements.calories.value.trim();
    const protein = form.elements.protein.value.trim();
    const pushups = form.elements.pushups ? form.elements.pushups.value.trim() : "";
    const crunches = form.elements.crunches ? form.elements.crunches.value.trim() : "";
    const miles = form.elements.miles ? form.elements.miles.value.trim() : "";
    const workoutDone = form.elements.workoutDone.checked;
    const dietNotes = form.elements.dietNotes.value;
    const workoutNotes = form.elements.workoutNotes.value;

    record.calories = calories === "" ? undefined : Number(calories);
    record.protein = protein === "" ? undefined : Number(protein);
    record.pushups = pushups === "" ? undefined : Number(pushups);
    record.crunches = crunches === "" ? undefined : Number(crunches);
    record.miles = miles === "" ? undefined : Number(miles);
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
  renderCalendar(currentViewDate);
}

document.addEventListener("DOMContentLoaded", main);


