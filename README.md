# BLUEJURY AI V2

BLUEJURY is a prototype marine decision-support app for fishers near the Karnataka Arabian Sea coast. It combines actual Copernicus Marine chlorophyll-a observations, sea-surface temperature analysis, and wave forecasts with vessel fuel, route, protected-area, and maritime-reference checks. Five independent jurors—Catch, Safety, Fuel, Ecology, and Border—assess each candidate. Hard vetoes remove infeasible candidates before the remaining candidates are compared. The output includes a route, jury scorecards, alternatives, evidence timestamps, confidence, and an explainable verdict. It is not a nautical navigation or legal-compliance service.

## What is in this branch

- Next.js website and shared Capacitor Android frontend: Home, Plan, Marine Map, Decision, Live Trip, and About Data.
- Device-local sign-up/sign-in and display-name settings; English, Kannada, Hindi, Tamil, Malayalam, and Telugu UI. Local accounts do not synchronize or isolate saved trips between users.
- MapLibre with an online OpenFreeMap basemap, sampled real marine overlays, candidate discovery circles, routes, and tap-to-evaluate a destination.
- FastAPI `/api/v1/analyze` pipeline with real Copernicus inputs, five jurors, hard vetoes, and weighted comparison. The backend also exposes `/health` and `/api/v1/health`.
- Live Trip foreground GPS position, accuracy, distance to destination, and user-triggered alternative-zone checks. The app does not provide nautical turn-by-turn guidance.
- Explicit **Save Trip for Offline Use**: one active saved decision, evidence, scorecards, candidate geometries, and routes in device/browser IndexedDB. The website caches its application shell; Android bundles the frontend.

## Requirements and setup

- Node.js **22 or newer** and npm (recommended for Next.js 16 and Capacitor 8); Python **3.12 or newer**.
- Internet for initial npm/Python installation, new Copernicus analysis, online map tiles, and official reference downloads.
- For Android development: Android Studio/SDK, Java compatible with the checked-in Gradle project, and Android platform tools (`adb`). A USB-connected, authorized Android phone can use `adb reverse`.
- PostgreSQL/PostGIS is only needed for the separate `/api/v1/cases` persistence endpoints and Alembic migrations. The `/api/v1/analyze` prototype does not use that database. Docker is optional; it is not needed to run a marine analysis.

From the repository root, install dependencies:

```bash
npm --prefix apps/web ci
python3 -m venv services/api/.venv
services/api/.venv/bin/python -m pip install -e 'services/api[dev]'
```

Start the API and website in separate terminals, from the repository root:

```bash
make backend-dev
```

```bash
make frontend-dev
```

Open `http://localhost:3000`; check the API at `http://127.0.0.1:8000/health`. Create a local account in the browser, choose **Plan**, then run an analysis. The website calls `http://localhost:8000` by default and CORS allows `http://localhost:3000`. A request may take longer or fall back to a time-labelled, validated real Copernicus response when the public provider is unavailable; cached evidence is not presented as a current observation. If neither real retrieval nor a valid local cache is available, the API reports unavailable evidence.

### Configuration

`.env.example` lists the available variable names: `DATABASE_URL`, `API_HOST`, `API_PORT`, `WEB_ORIGIN`, `CAPACITOR_ORIGIN`, `NEXT_PUBLIC_API_URL`, and `PROTECTED_PLANET_API_TOKEN`. Use your own values in an ignored `.env` for backend settings and, if the website API address differs from its default, an ignored `apps/web/.env.local` containing `NEXT_PUBLIC_API_URL=<your API URL>`. Restart/rebuild the website after changing a `NEXT_PUBLIC_` variable because it is embedded in frontend output. Leave `PROTECTED_PLANET_API_TOKEN` unset when the official local India extract is installed; the v4 API is only an optional fallback. Never place tokens in `NEXT_PUBLIC_` variables or the APK.

The backend's `.env` file is resolved relative to its process working directory; `make backend-dev` runs at the repository root. The current `/api/v1/analyze` flow does not need a database connection. For the separate case-persistence endpoints, configure `DATABASE_URL` and start/migrate a PostgreSQL/PostGIS database; the Makefile's `db-up` target uses Docker Compose if you choose that optional path.

## Reference data omitted from a branch ZIP

The API's marine source is public Copernicus Marine ARCO Zarr (the exact product and dataset IDs are in [DATA_SOURCES.md](docs/DATA_SOURCES.md)). It requests a bounded subset at analysis time and keeps the last validated real response at `data/cache/copernicus/latest.json`. A branch ZIP may include an older tracked cache; check its timestamps and do not treat it as current data. No Copernicus credentials are required for the public endpoints used here.

For the two local geospatial jurors, obtain the official files yourself and keep their original names:

1. **Border:** Download `World_EEZ_v12_20231025.zip` (World EEZ v12) via the [Marine Regions download page](https://www.marineregions.org/downloads.php) and its form. Extract it into `data/reference/marine-regions/World_EEZ_v12_20231025/`. The loader requires `eez_v12.shp`, `.shx`, `.dbf`, `.prj`, and `LICENSE_EEZ_v12.txt` in that folder. See [the import notes](data/reference/marine-regions/README.md).
2. **Ecology:** From the [official Protected Planet India page](https://www.protectedplanet.net/country/IND), obtain the **September 2026 public India WDPCA Shapefile extract**, subject to its [terms](https://www.protectedplanet.net/en/legal). Put `WDPA_WDOECM_Sep2026_Public_IND_shp_0.zip`, `_1.zip`, and `_2.zip`, plus `WDPA_sources_Sep2026.csv` and `Shapefile_splitting_README.txt`, unmodified in `data/reference/protected-planet/india-wdpca-2026-09/`. Do not extract the three similarly named internal shapefiles over one another. The current loader validates this specific release and its 63 polygon parcels and 27 point-only records; another release needs a reviewed loader update.
3. **Supplementary context:** `data/reference/wii-icmba/mulki-pavanje-2013.json` is a tracked, source-labelled point record from the Wildlife Institute of India. It adds historical context only, never a protected-area boundary or fishing restriction.

The official downloads are not needed merely to launch the UI. If an official reference fails validation, its juror reports unavailable evidence rather than claiming clearance. Do not redistribute the Protected Planet download with a ZIP or APK. See [ECOLOGY_BORDER_METHOD.md](docs/ECOLOGY_BORDER_METHOD.md) for fields, limitations, attribution, and import behavior.

## Android development connection

The existing Capacitor app bundles the shared Next.js frontend; it does **not** bundle FastAPI or the marine reference files. Its debug build uses `http://localhost:8000` for the API, with Android's debug-only cleartext exception. Run `make backend-dev` on the Mac, connect and authorize the phone over USB, then run:

```bash
adb reverse tcp:8000 tcp:8000
```

Open the installed BLUEJURY debug app. The app's `localhost:8000` now reaches the Mac API through ADB reverse. Keep the Mac API and USB/ADB connection available for new analyses. The online basemap and Copernicus retrieval still require the respective network access. To build your own debug APK (the branch ZIP does not include a built artifact):

```bash
cd apps/web
npm run build:capacitor
npm run cap:sync
cd android
./gradlew assembleDebug
```

The Gradle output is `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`. Normal website builds use `npm --prefix apps/web run build`; Capacitor's static-export build is separate. Physical GPS uses the Capacitor Geolocation plugin on Android and browser Geolocation on the website, subject to device permission and availability.

## Offline and current limits

Save a successful analysis **before departure** to keep its last computed decision, jurors, route, candidate geometries, and marine evidence with valid/retrieved timestamps. With GPS available, Live Trip can continue showing position and locally calculated distance while offline. A simplified ocean-background map can display saved geometry without detailed geographic tiles. New marine analysis, Evaluate This Area, fresh alternative checks, and guaranteed OpenFreeMap coastlines need connectivity and the backend. Reconnection does not silently replace the saved decision; refresh is user initiated. See [OFFLINE_MODE.md](docs/OFFLINE_MODE.md).

The public India WDPCA extract is incomplete and has point-only records; no detected polygon conflict therefore does **not** establish ecological clearance. The current Ecology card may display an illustrative `75`; its expanded text explains that insufficient coverage is not assessed, and that display value does not enter ranking, confidence, vetoes, or verdicts. The Marine Regions EEZ is a geographic reference, not legal or navigational clearance. Protected-area designation alone does not establish a fishing prohibition. PFZ is not integrated. Local accounts are device/browser convenience only; there is no cloud account recovery or per-account private trip storage. Route lines are decision-support geometry rather than safe passage instructions.

## Checks

From the repository root:

```bash
make test
make lint
make typecheck
npm --prefix apps/web run build
```

`make test` runs backend pytest and frontend Vitest; `make lint` runs Ruff and ESLint; `make typecheck` runs mypy and TypeScript. The Android build commands above require the installed Android SDK/Gradle toolchain. No physical-device behavior is claimed by these automated checks.
