# BLUEJURY AI V2 — UX Specification

## 1. Experience principle

The map is the primary working surface; the verdict is the primary decision. The interface should feel like a dependable marine instrument: calm, legible, evidence-forward, and honest about uncertainty. It must not resemble a generic card dashboard or an “AI” demo.

## 2. Visual system

- Navy for structure and primary text, white/off-white for surfaces, restrained sea-teal for active marine context.
- Green only for GO, amber only for CAUTIOUS GO/warnings, and red only for NO-GO/veto/danger.
- Minimal gradients; no glow, glassmorphism, animated AI motifs, or decorative charts.
- Strong type hierarchy, generous spacing, high-contrast labels, and consistent numeric alignment.
- Scores always include text/labels; color is never the sole signal.
- Map symbology must remain distinguishable under common color-vision deficiencies.

TODO: Select typefaces that support all target scripts and acceptable offline bundling/licensing.

## 3. Responsive layout

### Mobile

Full-height map with a compact top status bar and draggable bottom sheet. The collapsed sheet shows verdict, destination distance, evidence age, and primary action. Expanded states show route summary, jury, alternatives, and evidence. Map controls remain reachable by thumb and avoid the location marker/bottom sheet.

### Desktop/tablet

Map occupies roughly two-thirds of the workspace; a single persistent decision rail uses the remainder. Do not fragment the rail into a wall of cards. Secondary evidence details may use drawers/tabs.

## 4. Main screens and states

### Start / readiness

- Clear “Use my location” action and why it is needed.
- Manual departure-point option if permitted by policy.
- Vessel/fuel readiness summary with missing required fields called out.
- Data availability check before presenting “Get recommendation.”

### Recommendation map

- Current location marker with accuracy halo, timestamp, and recenter control.
- Recommended candidate visually dominant but not oversized.
- Alternative zones numbered and visibly selectable.
- Recommended route solid; rejected/alternative routes visually subordinate.
- MPA/OECM and maritime boundaries use distinct line/fill patterns.
- SST, chlorophyll, and safety layers are individually toggleable.
- Legend changes with active layer and includes source, units, observation/forecast time, resolution where meaningful, freshness, and attribution.

### Verdict panel

At a glance:

- GO / CAUTIOUS GO / NO-GO / DATA UNAVAILABLE;
- destination identifier/name, bearing/distance, and route summary;
- “why this won” in two or three plain-language points;
- five compact score rows with score, confidence indicator, and veto state;
- evidence state and most decision-relevant timestamp.

Expanded:

- full scorecard reasons and evidence links;
- route fuel estimate and reserve margin with assumptions;
- risk exposures and threshold comparisons;
- rejected alternatives with elimination stage/veto;
- provenance details and policy/computation time;
- disclaimer that guidance does not replace official navigation/warnings.

### Live trip

- Persistent LIVE TRIP state, location permission, fix accuracy/time, current destination, and stop control.
- Updating indicator that keeps the previous timestamped verdict visible.
- Material verdict change shown as a concise alert with what changed and required action.
- NO-GO/veto transition takes visual priority but avoids blocking access to evidence.
- Prevent screen wake lock only with explicit user action and graceful fallback. TODO: confirm platform/PWA support requirements.

## 5. Interaction details

- Selecting a zone highlights its route and opens its five scorecards; it never silently changes the recommendation.
- Tapping a vetoed zone explains the exact veto and source/time.
- Layer toggles indicate `current`, `cached`, `stale`, `loading`, or `unavailable` independently.
- “Current” labels use actual semantics such as “Observed 08:30 IST” or “Forecast valid 14:00 IST.”
- A timestamp disclosure can show UTC and local time; primary UI uses clearly labelled local time.
- Map feature inspection shows value, unit, source, quality flag, and timestamp; nodata says “No valid observation.”
- Route instructions avoid implying turn-by-turn nautical navigation unless an authoritative navigation capability is later approved.

## 6. Loading, error, and offline states

### Loading

Show named stages—checking evidence, creating zones/routes, consulting five jurors, applying constraints—without fake percentages. Partial juror results do not form a verdict.

### Provider degradation

State which layer is affected, whether a validated cache is being used, and its age. Retain usable unaffected layers. Do not use “live” for cached data.

### DATA_UNAVAILABLE

Use a neutral blocked state, not red danger. Explain exactly what is missing/expired and what the user can do. Do not show a recommended route.

### NO-GO

Use red and show the strongest actionable veto first, followed by affected candidates and evidence. Do not encourage selecting a vetoed alternative.

### Offline

Show connectivity state persistently. Previously viewed decisions say “Past decision — computed at …” and cannot be mistaken for active guidance. Location may continue updating locally, but no new recommendation is claimed without adequate evidence/computation.

## 7. Accessibility

- Target WCAG 2.2 AA.
- Minimum 44×44 CSS-pixel touch targets and safe-area support.
- Keyboard-operable map-adjacent controls and a non-map list/table equivalent for zones, routes, layers, and evidence.
- Visible focus, semantic headings, live-region announcements for material verdict changes, and reduced-motion support.
- High contrast in sunlight and dark/night mode only if it preserves map/source attribution and hazard semantics.
- Never encode verdict, veto, freshness, or layer data using color alone; add icons, patterns, and text.
- Plain language; expandable technical provenance rather than unexplained jargon.

## 8. Location privacy and consent UX

- Ask only when the user initiates location-dependent functionality.
- Explain use before the browser permission prompt: recommendation origin and live-trip re-evaluation.
- Show whether a fix is precise/approximate, its accuracy, and last-update time.
- Provide stop tracking, clear local trip, and permission-help controls.
- Do not request or imply background location in V2.
- Do not expose coordinates in shareable URLs, analytics, screenshots by default, or support logs.
- If history/sync is added, obtain separate consent and state retention/deletion terms.
- Manual location must be visibly labelled so it is not confused with a live GPS fix.

## 9. Core wording rules

- Say “recommended from available verified evidence,” not “fish are here.”
- Say “reference maritime boundary,” not “legal border,” unless legally authoritative data/policy supports the wording.
- Distinguish “intersects a designated area” from “fishing prohibited.”
- Say “cached, retrieved … / observed …,” never “live cached data.”
- Explain confidence as evidence support/quality, not probability of safety or catch.

## 10. User acceptance scenarios

1. A fisher grants location, sees an accuracy halo, requests guidance, and can understand the winner and all five jurors without opening technical details.
2. A high-catch zone with unsafe waves is clearly rejected and never recommended.
3. A route intersecting a confirmed prohibited area displays its geometry and veto evidence.
4. During provider outage, cached evidence shows both source time and cache label; expired critical data produces DATA_UNAVAILABLE.
5. During live trip, meaningful movement triggers an update, and the fisher can see what changed between verdicts.
6. With location denied, the app explains the limitation and offers a manual start point if policy allows.
7. A keyboard/screen-reader user can inspect the same zone, score, veto, route, and provenance information without relying on the map.

## 11. UX questions to resolve

- TODO: Conduct field interviews/usability tests with small-scale and mechanized fishers.
- TODO: Confirm target languages, terminology, number formats, units, and audio/voice needs.
- TODO: Determine connectivity/device/browser baseline and map offline requirements.
- TODO: Validate marine symbology, sunlight contrast, and touch use on moving vessels.
- TODO: Determine whether routes/destinations may be safely shared and with whom.
- TODO: Define emergency-warning escalation and links to authoritative channels.
