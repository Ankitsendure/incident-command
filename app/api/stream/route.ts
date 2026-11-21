// Server-Sent Events endpoint that simulates a production event stream (~200 events/sec).
// Every other 40s window, the "payments" service degrades so the UI has a real incident to detect.
export const dynamic = "force-dynamic";

const SERVICES = ["auth", "payments", "search", "checkout", "gateway"];

export async function GET() {
  const enc = new TextEncoder();
  let n = 0;
  let timer: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      timer = setInterval(() => {
        const t = Date.now();
        const bad = Math.floor(t / 40000) % 2 === 1 ? "payments" : "";
        const batch = Array.from({ length: 40 }, () => {
          const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
          const degraded = service === bad;
          const isError = Math.random() < (degraded ? 0.45 : 0.02);
          return {
            id: n++,
            t,
            service,
            level: isError ? "error" : Math.random() < 0.1 ? "warn" : "info",
            latency: Math.round((degraded ? 900 : 120) * (0.5 + Math.random() * 1.5)),
            msg: isError ? "upstream timeout" : "request ok",
          };
        });
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(batch)}\n\n`));
        } catch {
          clearInterval(timer);
        }
      }, 200);
    },
    cancel() {
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
