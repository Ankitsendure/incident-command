# Incident Command

A real-time incident triage dashboard built with **Next.js (App Router), React and TypeScript**.

A simulated production event stream (~200 events/sec) is pushed to the browser over Server-Sent Events.
The dashboard computes rolling metrics, detects a degrading service automatically, and lets an on-call
engineer record decisions while the data keeps moving.

## What it demonstrates
- **Performance at volume:** a 50,000-event ring buffer, a hand-written windowed log list (about 17 DOM rows regardless of data size), and a fixed 4 Hz render tick instead of one render per event.
- **Streaming architecture:** a Next.js route handler that streams SSE; client-side EventSource with reconnect status.
- **Decision-making under pressure:** automatic incident detection (error rate above 15% over 10s) with one-click response actions and a timestamped decision log.
- **Fundamentals:** semantic HTML, CSS Grid/Flexbox, accessible labels, strict TypeScript.

## Run it
    npm install
    npm run dev        # http://localhost:3000

## Deploy
Push to GitHub, import the repo on vercel.com. Note: Vercel limits the duration of streaming functions
on some plans, so the stream may reconnect periodically. The UI handles that.

## Known limitations (be upfront about these)
- Data is simulated, not from a real system.
- Filtering re-scans the buffer every tick; at much larger scale this belongs in a Web Worker.
- No auth, persistence or tests yet.
