"use client";
import { useEffect, useRef, useState } from "react";

type Level = "info" | "warn" | "error";
type Ev = { id: number; t: number; service: string; level: Level; latency: number; msg: string };
type Decision = { t: number; service: string; action: string };

const MAX = 50000; // ring buffer size
const ROW = 24; // log row height (px) for windowing
const VIEW = 360; // log viewport height (px)
const ACTIONS = ["Acknowledge", "Roll back last deploy", "Scale up", "Page on-call"];

// Rolling 10-second stats, scanned from the end of the buffer so cost stays O(window), not O(50k).
function stats(a: Ev[]) {
  const now = Date.now();
  const by: Record<string, { n: number; e: number }> = {};
  const lat: number[] = [];
  let n = 0, e = 0;
  for (let i = a.length - 1; i >= 0 && now - a[i].t < 10000; i--) {
    const x = a[i];
    n++;
    lat.push(x.latency);
    const s = (by[x.service] ??= { n: 0, e: 0 });
    s.n++;
    if (x.level === "error") { e++; s.e++; }
  }
  lat.sort((p, q) => p - q);
  return { eps: n / 10, rate: n ? e / n : 0, p95: lat[Math.floor(lat.length * 0.95)] ?? 0, by };
}

function Card({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className={bad ? "card bad" : "card"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function Page() {
  const buf = useRef<Ev[]>([]);
  const hist = useRef<number[]>([]);
  const [, setTick] = useState(0);
  const [connected, setConnected] = useState(false);
  const [level, setLevel] = useState<"all" | Level>("all");
  const [q, setQ] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      const a = buf.current;
      a.push(...(JSON.parse(m.data) as Ev[]));
      if (a.length > MAX) a.splice(0, a.length - MAX);
    };
    // Events land in a ref; the UI re-renders on a fixed 4 Hz tick instead of once per event.
    const iv = setInterval(() => {
      hist.current = [...hist.current.slice(-119), stats(buf.current).rate];
      setTick((x) => x + 1);
    }, 250);
    return () => { es.close(); clearInterval(iv); };
  }, []);

  const s = stats(buf.current);
  const incidents = Object.entries(s.by).filter(([, v]) => v.n >= 20 && v.e / v.n > 0.15);
  const query = q.toLowerCase();
  const rows = buf.current.filter(
    (e) => (level === "all" || e.level === level) && (!query || e.service.includes(query) || e.msg.includes(query))
  );

  // Windowing: only ~17 rows exist in the DOM no matter how many events are buffered.
  const start = Math.max(0, Math.floor(scrollTop / ROW));
  const visible = [];
  for (let i = start; i < Math.min(start + Math.ceil(VIEW / ROW) + 2, rows.length); i++) {
    visible.push({ i, e: rows[rows.length - 1 - i] });
  }
  const points = hist.current.map((v, i) => `${i * 5},${40 - (Math.min(v, 0.5) / 0.5) * 38}`).join(" ");
  const act = (service: string, action: string) => setDecisions((d) => [{ t: Date.now(), service, action }, ...d]);

  return (
    <main>
      <header>
        <h1>Incident Command</h1>
        <span className={connected ? "dot on" : "dot"} />
        <span className="muted">{connected ? "Live" : "Reconnecting…"}</span>
      </header>

      <section className="cards">
        <Card label="Events / sec" value={s.eps.toFixed(0)} />
        <Card label="Error rate (10s)" value={(s.rate * 100).toFixed(1) + "%"} bad={s.rate > 0.05} />
        <Card label="p95 latency" value={s.p95 + " ms"} bad={s.p95 > 500} />
        <Card label="Buffered events" value={buf.current.length.toLocaleString()} />
      </section>

      <svg className="spark" viewBox="0 0 600 40" preserveAspectRatio="none" role="img" aria-label="Error rate over time">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      <section className="panel">
        <h2>Incidents</h2>
        {incidents.length === 0 && <p className="muted">All systems normal. A simulated outage starts within 40 seconds.</p>}
        {incidents.map(([svc, v]) => (
          <div key={svc} className="incident">
            <div>
              <strong>{svc}</strong> <span className="badge">{((v.e / v.n) * 100).toFixed(0)}% errors</span>
            </div>
            <div className="actions">
              {ACTIONS.map((a) => (
                <button key={a} onClick={() => act(svc, a)}>{a}</button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Decision log</h2>
        {decisions.length === 0 && <p className="muted">Decisions you take are recorded here with timestamps.</p>}
        <ul>
          {decisions.map((d, i) => (
            <li key={i}>{new Date(d.t).toLocaleTimeString()} · {d.action} → {d.service}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Live logs ({rows.length.toLocaleString()} matching)</h2>
        <div className="filters">
          <select value={level} onChange={(e) => setLevel(e.target.value as "all" | Level)} aria-label="Filter by level">
            <option value="all">All levels</option>
            <option value="error">Errors</option>
            <option value="warn">Warnings</option>
            <option value="info">Info</option>
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by service or message" aria-label="Search logs" />
        </div>
        <div className="viewport" style={{ height: VIEW }} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
          <div style={{ height: rows.length * ROW, position: "relative" }}>
            {visible.map(({ i, e }) => (
              <div key={e.id} className={"row " + e.level} style={{ top: i * ROW, height: ROW }}>
                <span>{new Date(e.t).toLocaleTimeString()}</span>
                <span>{e.level}</span>
                <span>{e.service}</span>
                <span>{e.latency} ms</span>
                <span>{e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
