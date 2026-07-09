# Dashboard visual fixes — plan for later

User feedback after seeing the redesign live: color scheme bad, "Add as alert
point" button huge/broken, Dashboard is just a full-bleed map with no cards,
Settings/Alerts/Prediction pages are a single lonely floating card instead of
a real dashboard sub-page. Reference: shadcn's own `dashboard-01` block
(confirmed via web search) uses `SidebarProvider` → `SidebarInset` →
`SiteHeader` → `flex flex-col gap-4 md:gap-6` container → `SectionCards`
(stat card grid) → main content grid, with `px-4 lg:px-6` horizontal padding
throughout and `rounded-lg border bg-card` cards. This plan applies that
shape to our pages.

Work from `react-frontend/`. Repo convention: one file changed = one commit
= one push, no AI attribution.

## 1. New theme: cosmic-night (tweakcn)

Replace `react-frontend/src/index.css` `:root`/`.dark` blocks with these
exact values (keep the file's existing structure: `@tailwind` directives at
top, `:root {}`, `.dark {}`, then the `body { background-color: var(--background); color: var(--foreground); font-family: var(--font-sans); }` rule at the bottom — same pattern as the current tweakcn integration, just swap the variable values and drop unused `--chart-*`/`--shadow-*`/font-serif/font-mono vars since nothing in the app consumes them, matching how the previous theme swap was scoped):

```css
:root {
  --background: oklch(0.9730 0.0133 286.1503);
  --foreground: oklch(0.3015 0.0572 282.4176);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3015 0.0572 282.4176);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3015 0.0572 282.4176);
  --primary: oklch(0.5417 0.1790 288.0332);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9174 0.0435 292.6901);
  --secondary-foreground: oklch(0.4143 0.1039 288.1742);
  --muted: oklch(0.9580 0.0133 286.1454);
  --muted-foreground: oklch(0.5426 0.0465 284.7435);
  --accent: oklch(0.9221 0.0373 262.1410);
  --accent-foreground: oklch(0.3015 0.0572 282.4176);
  --destructive: oklch(0.6861 0.2061 14.9941);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9115 0.0216 285.9625);
  --input: oklch(0.9115 0.0216 285.9625);
  --ring: oklch(0.5417 0.1790 288.0332);
  --sidebar: oklch(0.9580 0.0133 286.1454);
  --sidebar-foreground: oklch(0.3015 0.0572 282.4176);
  --sidebar-primary: oklch(0.5417 0.1790 288.0332);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9221 0.0373 262.1410);
  --sidebar-accent-foreground: oklch(0.3015 0.0572 282.4176);
  --sidebar-border: oklch(0.9115 0.0216 285.9625);
  --sidebar-ring: oklch(0.5417 0.1790 288.0332);
  --font-sans: Inter, ui-sans-serif, sans-serif, system-ui;
  --radius: 0.5rem;
}

.dark {
  --background: oklch(0.1743 0.0227 283.7998);
  --foreground: oklch(0.9185 0.0257 285.8834);
  --card: oklch(0.2284 0.0384 282.9324);
  --card-foreground: oklch(0.9185 0.0257 285.8834);
  --popover: oklch(0.2284 0.0384 282.9324);
  --popover-foreground: oklch(0.9185 0.0257 285.8834);
  --primary: oklch(0.7162 0.1597 290.3962);
  --primary-foreground: oklch(0.1743 0.0227 283.7998);
  --secondary: oklch(0.3139 0.0736 283.4591);
  --secondary-foreground: oklch(0.8367 0.0849 285.9111);
  --muted: oklch(0.2710 0.0621 281.4377);
  --muted-foreground: oklch(0.7166 0.0462 285.1741);
  --accent: oklch(0.3354 0.0828 280.9705);
  --accent-foreground: oklch(0.9185 0.0257 285.8834);
  --destructive: oklch(0.6861 0.2061 14.9941);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.3261 0.0597 282.5832);
  --input: oklch(0.3261 0.0597 282.5832);
  --ring: oklch(0.7162 0.1597 290.3962);
  --sidebar: oklch(0.2284 0.0384 282.9324);
  --sidebar-foreground: oklch(0.9185 0.0257 285.8834);
  --sidebar-primary: oklch(0.7162 0.1597 290.3962);
  --sidebar-primary-foreground: oklch(0.1743 0.0227 283.7998);
  --sidebar-accent: oklch(0.3354 0.0828 280.9705);
  --sidebar-accent-foreground: oklch(0.9185 0.0257 285.8834);
  --sidebar-border: oklch(0.3261 0.0597 282.5832);
  --sidebar-ring: oklch(0.7162 0.1597 290.3962);
  --font-sans: Inter, ui-sans-serif, sans-serif, system-ui;
  --radius: 0.5rem;
}
```

`tailwind.config.js` needs no change (it already maps `border`/`ring`/etc to
`var(--x)` generically). No Google Fonts CDN load for "Inter" — same
self-hosted-app simplification as before, system sans-serif fallback is
close enough; note this inline if it matters later.

## 2. Fix MapPanel "Add as alert point" stretching full width

Root cause: `react-frontend/src/components/MapPanel.tsx`'s search-controls
wrapper (`<div className="absolute left-2 top-2 z-10 flex flex-col gap-2">`)
has no `items-start`, so flex's default `align-items: stretch` makes every
block-level child (including the lone `<Button>Add as alert point</Button>`)
stretch to the container's full width. The `flex gap-2` row above it doesn't
show this because row children only stretch height, not width, by default.

Fix: add `items-start` to that wrapper div's className. One-line change,
verify visually (or add a test asserting the button's className doesn't
include a stretch-implying class — simplest is just a visual check since
this is a layout bug, not a logic bug).

## 3. Redesign DashboardPage as a real card-based dashboard

Current: `PredictionTotalizers` (bare, no page padding) → a hardcoded
`h-[calc(100vh-49px)]` flex row of raw `PeopleSidebar`/`MapPanel`/
`LocationHistoryList` (full-bleed, map dominates) → `RecentAlertsWidget`.

Target shape (matching the researched shadcn dashboard-01 pattern):

```tsx
// react-frontend/src/pages/DashboardPage.tsx — target structure, fill in real imports
<div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
  <PredictionTotalizers people={people ?? []} />
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Map</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[420px] overflow-hidden rounded-b-xl">
          <MapPanel people={...} selectedPersonId={...} onSelectPerson={...} trail={...} />
        </div>
      </CardContent>
    </Card>
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>People</CardTitle></CardHeader>
        <CardContent><PeopleSidebar .../></CardContent>
      </Card>
      {selectedPersonId !== null && (
        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <CardContent><LocationHistoryList locations={...} /></CardContent>
        </Card>
      )}
    </div>
  </div>
  <RecentAlertsWidget alerts={alerts ?? []} />
</div>
```

Map gets a fixed height (`h-[420px]`) since it now lives inside a card
instead of filling the viewport — MapView/MapLibre need an explicit
container height to render correctly (it already works this way, just
constrained now instead of `100vh`). Fullscreen toggle inside MapPanel still
escapes this constraint via `fixed inset-0` when active, unaffected.

## 4. Restyle PeopleSidebar to work as card content, not a standalone side panel

`react-frontend/src/components/PeopleSidebar.tsx` currently hardcodes
`w-64`, `border-r border-sidebar-border`, `bg-sidebar` — all side-panel-only
styling that doesn't make sense inside a `CardContent`. Change the root
`<ul>` className to just `flex flex-col gap-1` (drop width/border/bg — the
parent `Card` already provides the background/border), and swap
`sidebar`/`sidebar-accent`/`sidebar-foreground` tokens for the generic
`accent`/`card-foreground` tokens so it reads correctly on a plain card
background instead of the sidebar-specific palette:

```tsx
<ul className="flex flex-col gap-1">
  {people.map((person) => (
    <li key={person.id}>
      <button
        type="button"
        onClick={() => onSelectPerson(person.id)}
        className={`w-full rounded-lg px-3 py-2 text-left ${
          person.id === selectedPersonId
            ? 'bg-accent text-accent-foreground'
            : 'text-card-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <div className="font-medium">{person.name}</div>
        <div className="text-sm text-muted-foreground">
          {person.latest ? relativeTime(person.latest.capturedAt) : 'no location yet'}
        </div>
      </button>
    </li>
  ))}
</ul>
```

No prop/behavior change — existing `PeopleSidebar.test.tsx` should keep
passing unchanged (queries by text/role, not classNames).

## 5. Restyle LocationHistoryList the same way

`react-frontend/src/components/LocationHistoryList.tsx` currently hardcodes
`w-72`, `border-l`, `bg-card` (redundant once it's inside a real `Card`).
Drop to just `flex flex-col gap-1` (or keep as a plain `<ul>` with
`divide-y divide-border` for row separators instead of individual
`border-b`s):

```tsx
<ul className="divide-y divide-border">
  {locations.map((location, index) => (
    <li key={`${location.capturedAt}-${index}`} className="py-2 text-sm text-card-foreground">
      {new Date(location.capturedAt).toLocaleString()}
    </li>
  ))}
</ul>
```

## 6. RecentAlertsWidget: drop the hardcoded `m-4`

`react-frontend/src/components/RecentAlertsWidget.tsx`'s `<Card className="m-4">`
— the `m-4` fought with the new page-level `gap-4`/`p-4` container from
Section 3. Drop it to just `<Card>`.

## 7. Give Settings/Alerts/Prediction real page containers

All three currently wrap a single centered/floating `Card` in a bare `p-6`
div — reads as an empty page with one lonely box, not a dashboard section.
Match the same `flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6` container
used on Dashboard (Section 3) for consistency, and drop the artificial
`flex justify-center`/fixed `w-96`/`w-80` card-width constraints — let cards
size naturally within the padded container (`max-w-2xl` is reasonable for
single-column form pages like Settings, full-width for Alerts' list):

- `SettingsPage.tsx`: `<div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6"><Card className="max-w-md">...</Card></div>`
- `AlertsPage.tsx`: `<div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6"><Card>...</Card></div>` (drop the old `p-6` wrapper)
- `PredictionPage.tsx`: same container pattern as AlertsPage

No logic changes to any of the three — `AccountSettingsForm`, `useAlerts()`,
`useSearchParams()`/`usePeople()` usage all stay exactly as-is, this is
purely the outer container markup.

## Execution note

This is a visual-only pass (CSS variables + Tailwind classNames + JSX
container restructuring) — no new hooks, no new API calls, no behavior
change anywhere. Existing tests should require zero or near-zero changes
(they query by role/label/text, not by className or DOM nesting depth) —
run the full suite after each file change to confirm, fix only what
actually breaks rather than pre-emptively rewriting tests.
