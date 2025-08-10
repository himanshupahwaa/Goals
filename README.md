# Goals

A minimal month-view tracker. Click a day to darken it; more clicks = darker. Data persists per month in localStorage. Right-click to decrement.

## Run

Just open `index.html` in a browser. No build step.

## Features

- Month navigation
- Weekday header (Sun–Sat)
- Click to increment intensity; right-click to decrement
- Local persistence per month
- Keyboard and screen-reader friendly labels
- Customizable numeric fields and goals (up to 5) with per-field X condition (over/under)

## Notes

- Max visual intensity after several clicks; additional clicks keep the darkest shade.
- Storage keys are namespaced by `YYYY-MM` using `localStorage` under `goals:*`.

## Settings

- Click the gear button next to the month to open Settings.
- Add up to 5 fields. For each field set:
  - Name (label)
  - Key (used to store the value)
  - Goal (numeric target)
  - X when: choose "under" (incomplete) or "over" (exceeds)
- The day modal will show inputs for these fields. Bars render for each field showing progress towards the goal.

