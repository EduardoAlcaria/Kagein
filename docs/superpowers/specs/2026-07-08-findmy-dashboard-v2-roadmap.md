# Find My Dashboard v2 roadmap

Captures the expanded feature vision beyond the v1 spec
(`2026-07-06-findmy-dashboard-design.md`, which explicitly deferred all of
this to "Non-goals"). Decomposed into independent sub-projects, each gets
its own dedicated brainstorm → spec → plan cycle when its turn comes.
Build order agreed with the user:

**A (this cycle) → B → C → D → E → F**

- **A — Visual redesign.** Real shadcn components (sidebar, cards, etc.)
  replacing the hand-rolled Tailwind divs from the v1 build. See
  `2026-07-08-react-frontend-redesign-design.md` for the approved spec —
  this is the sub-project actually being implemented now.

- **B — Proximity alerts.** Alert the dashboard owner (never the other
  tracked person) when two tracked people come within a configurable
  radius of each other. Radius must be configurable per pairing, somewhere
  in the 10–50 meter range, set in Settings. Reuses the existing polling
  infrastructure and alert-event table shape from v1's stale-update alert.

- **C — Movement history and patterns.** Aggregate location history into
  time-of-day / day-of-week patterns per person (not just a raw list of
  points, which v1 already has via `LocationHistoryList`). This is the data
  foundation F's prediction engine will read from — F should not be
  attempted before C has been collecting data for a while.

- **D — Estimated travel time between two points.** Derived from C's
  aggregated movement data (e.g., typical travel time between two
  frequently-visited locations). Depends on C existing first.

- **E — Geofencing.** Draw alert zones directly on the map:
  - Both shapes: circle (center + radius) and free-form polygon.
  - Zones can nest — sub-zones inside a parent zone.
  - Each zone (and each sub-zone) has its own alert type/config, not a
    single generic "someone entered" alert for everything.
  - This is a full feature in its own right: zone data model (including
    nesting), a dual drawing UX (circle + polygon, plus editing nested
    shapes), and a per-zone alert-type taxonomy. Treat as its own
    implementation plan when it comes up, not a quick add-on.
  - Related, smaller-scoped piece already built into A as a stub: the map
    gets a basic "search a point and save it" flow now (see A's spec),
    saved to `localStorage` only. E is what turns saved points/zones into
    something the backend actually evaluates and alerts on.

- **F — Probabilistic movement prediction ("Previsão").** Predict the
  chance a tracked person is at a given point at a given time, using a
  **local, free AI model** (not a paid external API — e.g. something
  served via Ollama on the same Mac mini). Needs its own architecture
  brainstorm: which model, how location history gets fed to it, latency
  budget on a Mac mini, and — critically — how to get a calibrated
  probability number out of a general-purpose model rather than a vague
  narrative answer (may end up hybrid: real frequency statistics from C's
  aggregated data for the calibrated number, model used for narrative
  reasoning on top).

  UI shape already agreed (built as a placeholder/nav skeleton in A, wired
  to real data only once F's engine exists):
  - **Dashboard totalizers:** each tracked person gets up to two cards —
    (1) chance they're at their own most-frequent/inferred location right
    now, (2) chance they're at a user-defined point of interest right now
    (only shown if that person has one set). Clicking a card navigates to
    the Previsão page pre-filtered to that person (and point, for #2).
  - **Previsão page:** filter by person, pick a point on the map, see a
    chart of the probability that person is/will be at that point. Also
    shows that person's "routine" — a chart of the times/days they
    typically move — and, alongside it, a map of the routes they might
    plausibly take.
  - In A, the totalizer cards render with mocked percentages (clearly a
    visual placeholder) so the final dashboard layout is correct now;
    swapping mock data for F's real engine later should require no layout
    changes.
