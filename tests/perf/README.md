# EVO TV Perf / Load Tests

Run the load test against a locally-running instance (`pnpm dev` or
`pnpm build && pnpm start`) with Artillery:

```bash
pnpm dlx artillery run scripts/load-test.yml
# or, with a global install:
artillery run scripts/load-test.yml
```

The config in `scripts/load-test.yml` ramps from 10 to 500 virtual users
over 60 seconds, weighted across three critical read paths: the live
streams list (`/api/streams`), a hot stream's viewer-count SSE channel
(`/api/sse/stream/stream_lagos_final`), and the trending clips feed
(`/api/vods?clips=trending`). Artillery records response time
percentiles, request rate, socket errors, and HTTP status counts.

Expected thresholds on a dev-grade box: p95 under 200ms for JSON endpoints
and SSE initial-connect under 100ms. Sustained error rate should stay
under 0.5%. If p95 regresses, check the Drizzle query plans for the
affected endpoint, confirm better-sqlite3 is running in WAL mode, and
verify the SSE bus is not fan-out-bound. Running this against production
data is an ops concern and out of scope for this file.
