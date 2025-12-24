# Flowr mockup

A simple UI mockup for **Flowr**: track when you smoked and when you’re finished, with **auto-finish** so you don’t have to manually stop the timer.

## Run it

Open `flowr-mockup/index.html` in a browser, or run a local static server from the repo root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/flowr-mockup/`.

## What’s included

- **Start**: tap **Smoked**
- **Auto-finish rules**:
  - **Next hour** (top of next hour — “flowr this hour”)
  - **Duration** (N minutes)
- **Optional confirm at end**: shows a modal with **Finish / +15 / +30**, then auto-finishes after a short countdown.
- **Halfway check-in** reminder (optional)
- **Idle finish** (optional)
- **Notes** (strain/vibe/where/rating/tags/notes) attached to the current session
- **History** list + **today totals**
- **Export JSON** + clear/delete
- **Focus mode**, **fullscreen**, optional **wake lock** (“Keep awake”)
- **Polish**: petal animation while running, optional **confetti** and **sound** on finish

State is saved in your browser via `localStorage`.

