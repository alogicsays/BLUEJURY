# BLUEJURY Offline Mode

## Purpose

Offline Mode preserves a previously computed BLUEJURY trip when connectivity is lost offshore. It is a continuity feature around the existing online decision pipeline. It does not retrieve new marine observations, rerun marine-dependent analysis, or provide nautical navigation while offline.

## Architecture

The frontend has three distinct persistence layers:

1. A native service worker caches the essential same-origin application shell and static Next.js assets. It deliberately ignores API requests and cross-origin marine/basemap requests.
2. IndexedDB database `bluejury-offline`, store `trips`, holds one explicitly saved, versioned `SavedOfflineTrip` under the key `active-trip`.
3. Existing `localStorage` session continuity remains an online convenience. It is not accepted as a trustworthy offline trip. When offline without an IndexedDB trip, BLUEJURY clears the session decision and shows `OFFLINE_NO_CACHE`.

The central application provider derives `ONLINE`, `OFFLINE_WITH_CACHE`, `OFFLINE_NO_CACHE`, and `CONNECTION_RESTORED` from `navigator.onLine` and the browser `online`/`offline` events.

## Pre-departure workflow

1. Connect to the internet.
2. Plan from a harbour or current location.
3. Run the existing analysis against real Copernicus evidence.
4. Review the recommendation, jurors, veto trace, routes, alternatives, evidence and timestamps.
5. Choose **Save Trip for Offline Use** on the Decision or Live Trip page.
6. Confirm the saved time and latest evidence-valid time.

Saving again replaces the single active offline package with the current accepted decision.

## Persisted data

The package stores the complete existing analysis response without recalculation or fabricated defaults:

- verdict, overall confidence, policy version and generation time;
- recommended zone and selected active destination;
- all candidate and rejected-zone geometries;
- every route geometry, route identifier, distance and notice;
- all five juror scorecards, confidence, reasons, evidence references and hard vetoes;
- catch, SST, coverage and other marine values already present on candidates;
- fuel and safety details already present on scorecards;
- evidence provider, product, dataset, variable, unit, valid time, retrieval time, classification, freshness, reference and quality information;
- harbour/start point and vessel/fuel plan;
- offline save time and schema version.

No new environmental values are calculated during persistence.

## Behaviour offline

With a saved trip, the app reopens the stored DecisionBundle, candidate zones, routes, jury reasoning, vetoes and provenance. The persistent amber banner says `OFFLINE MODE`, `Using saved marine evidence`, and shows the save timestamp. Evidence is presented as `SAVED EVIDENCE` while preserving its original `SATELLITE OBSERVATION`, `ANALYSIS`, or `FORECAST` classification and valid time.

Without a saved trip, BLUEJURY displays `Marine evidence unavailable offline` and does not show or invent a recommendation.

New area evaluation, Copernicus retrieval and marine-dependent re-evaluation are unavailable offline.

## GPS and network are independent

Live Trip continues to use `navigator.geolocation.watchPosition()`. If the operating system/browser supplies GPS while the network is unavailable, BLUEJURY can still show current position, browser-reported accuracy, destination and a locally calculated great-circle distance to the saved destination. No GPS history is retained.

If positioning fails, the UI reports `GPS UNAVAILABLE` separately from network status. GPS is not described as marine-data retrieval.

## Reconnection

An `online` event changes the state to `CONNECTION_RESTORED`. The saved decision remains unchanged. The user may explicitly choose **Refresh Marine Evidence**, which invokes the existing online analysis. There is no automatic decision replacement or background marine synchronization. A refreshed decision must be saved again to update the offline package.

## Offline map behaviour

The service worker does not download global OpenFreeMap tiles. Previously browser-cached basemap resources may remain available during an existing session, but this is not guaranteed.

When the map opens while offline, BLUEJURY uses a local simplified ocean style so MapLibre can load without remote style, tile, sprite or glyph requests. Saved route, zone, destination, harbour and GPS GeoJSON layers render over that background. Detailed coastline, land, roads and labels require internet unless the browser independently retained those resources.

Status: **PARTIAL offline basemap support**, by design. This is not a nautical chart or full offline navigation system.

## What requires internet

- new Copernicus evidence retrieval;
- new candidate generation and jury evaluation;
- Evaluate This Area;
- Refresh Marine Evidence;
- guaranteed OpenFreeMap geographic tiles and labels;
- first application load before the service worker has installed its shell cache.

## Security and privacy

The saved trip is same-origin browser data in IndexedDB. It is not uploaded by Offline Mode. It may include the chosen harbour/start coordinate, destination and route, but it does not contain GPS history. Users can remove it by clearing site data; devices shared with others should use an appropriate device lock. Browser storage is not encrypted by BLUEJURY, so sensitive operational plans should not be saved on untrusted devices.

The service worker caches only public application-shell resources. It does not intercept or persist API responses, Copernicus credentials, tokens, passwords or arbitrary satellite imagery.

## MVP limitations

- one active offline trip per browser profile;
- no background synchronization;
- no automatic expiry or evidence refresh;
- no guaranteed detailed offline basemap;
- no cross-device transfer;
- no encrypted-at-rest application layer;
- no route-following instructions or nautical navigation;
- installability depends on browser PWA support and a secure context (`HTTPS`, or localhost during development).
