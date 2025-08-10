# Goals

It’s a month-view goals tracker that stores per-day data in localStorage and visualizes progress with bars and a click-based intensity overlay.

**What it does**
Calendar UI: Month grid with weekday header and prev/next navigation.
Click behaviors:
Click a day: open modal to edit details - calories/macros/workout.
Ctrl/Cmd-click: increment “intensity” (darkness).
Right-click: decrement intensity.
Per-day data: calories, protein, pushups, crunches, miles, workoutDone, dietNotes, workoutNotes, plus clicks.
Progress bars: Five bars show percent of daily goals (GOALS in script.js).
Over-limit marking: For past days, shows red warning overlay if calories exceed or other metrics are under goals.
Persistence: Saves to localStorage under goals:YYYY-MM.
Run: Open index.html directly; no build step.