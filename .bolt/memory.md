# Project memory

## Product intent & audience

- Executive Dashboard for project leadership to quickly monitor financial health, construction progress, property/land sales, risks, issues, documents, and milestones.
- All dashboard content should be derived from existing database records and presented through calculated KPIs, charts, and operational summaries.
- AI-generated values or insights are not part of the dashboard scope.

## Brand personality & voice

- Production-oriented, executive, and data-led.
- Prefer concise labels, clear metric definitions, and decision-useful status information over decorative copy.
- Surface uncertainty or proxy calculations explicitly rather than implying unsupported precision.

## Visual design & UX direction

- Dashboard is a dedicated page separate from the existing general Dashboard.
- Organize content into scannable executive sections covering:
  - KPI overview
  - Finance
  - Operations/construction
  - Sales/assets
  - Risks and issues
  - Documents and milestones
- Use prominent KPI cards for headline values and lightweight charts for trends, progress, rankings, and rates.
- Chart components use plain SVG/CSS and existing project capabilities; no additional visualization package was introduced.
- Keep the interface suitable for production use and responsive review, but visual browser verification is still pending.

## Decisions, constraints & rationale

- Implemented as a Vite/React page with separate data-loader, shared-card, chart, and section modules.
- Reused existing data fetchers and row types rather than introducing a parallel data-access layer.
- Registered the Executive Dashboard in navigation and routing immediately after the regular Dashboard.
- Typecheck, lint, and production build passed after implementation.
- Current metric definitions include known proxies:
  - Open risks is represented by delayed phases and critical defects.
  - Upcoming payments is represented by due reminders.
  - Contractor balance currently means committed contract value, not unpaid amount.
- Some requested figures are stand-ins because the current database does not track the underlying concept directly.
- Avoid circular imports by keeping shared dashboard UI primitives in their own module.
- Existing House Archive still permits deletion despite the archive being described as permanent; this remains unresolved.

## Open questions & assumptions

- Confirm KPI definitions with stakeholders, especially “contractor balance,” “vendor balance,” “funding gap,” “cash available,” and “upcoming payments.”
- Determine whether database fields can support true paid, outstanding, and cash-balance calculations instead of current proxies.
- Clarify how open risks and open issues should be sourced and distinguished.
- Confirm whether property offers, land-sale ranking, and material rates need historical trends, timestamps, or only current snapshots.
- Browser review is still needed to validate layout, chart readability, responsive behavior, and data presentation.
- Decide whether to remove the House Archive delete action to preserve permanence.