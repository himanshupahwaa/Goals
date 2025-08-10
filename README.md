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

## Notes

- Max visual intensity after several clicks; additional clicks keep the darkest shade.
- Storage keys are namespaced by `YYYY-MM` using `localStorage` under `goals:*`.

