# BLUEJURY

**Marine Decision-Support System for Safer and More Informed Fishing Trips**

BLUEJURY is a web and Android prototype that helps fishermen evaluate potential fishing zones before and during a trip. It brings together fishing potential, sea conditions, fuel feasibility, maritime boundaries, and available ecological information to provide explainable recommendations.

Rather than relying on a single score, BLUEJURY uses five specialized jurors to assess candidate fishing zones. The fisherman remains in control of the final decision.

## Key Features

### 1. Fishing Trip Planning

Users can enter their departure location, vessel details, and available fuel to evaluate potential fishing zones.

The **Find Best Fishing Route/Zones** feature compares candidate destinations and presents a recommended zone, route information, and an overall decision verdict.

### 2. Five-Juror Decision System

BLUEJURY uses five specialized jurors:

| Juror   | Purpose                                                                      |
| ------- | ---------------------------------------------------------------------------- |
| Catch   | Assesses available marine conditions relevant to fishing potential.          |
| Safety  | Evaluates sea conditions and potential safety concerns.                      |
| Fuel    | Assesses route feasibility against the vessel's available fuel.              |
| Ecology | Provides ecological context and checks available environmental restrictions. |
| Border  | Evaluates maritime-boundary information and relevant geographic constraints. |

The system combines eligible juror assessments to produce an explainable recommendation.

Verified hard-veto conditions can rule out a candidate zone even when its other assessments are favorable.

**Ecology limitation:** The prototype currently displays an illustrative Ecology value of 75. Where ecological data coverage is insufficient, this value is excluded from the final decision calculation. Available verified ecological restrictions remain subject to the system's checks.

### 3. Interactive Marine Map

Users can explore candidate fishing zones on an interactive map.

The **Evaluate This Area** feature allows a user to select a specific location and request an assessment using the same decision framework.

### 4. Live Trip and Alternative Zones

During an active trip, BLUEJURY can use the device's current GPS location and estimated remaining fuel to check alternative fishing zones.

The fisherman initiates this process using **Check Alternative Zones**. If an eligible alternative is identified, the application can present a comparison.

The destination is never changed automatically. The user must explicitly confirm a switch.

Live Trip requires a usable device location and access to the backend for a fresh assessment.

### 5. Local Authentication

The prototype includes sign-up and sign-in functionality with accounts stored locally on the device or browser.

This is a prototype authentication system, not a production-ready cloud identity service. Accounts created on one device are not automatically synchronized with another.

### 6. Multilingual Interface

BLUEJURY supports six interface languages:

* English
* Kannada
* Hindi
* Tamil
* Malayalam
* Telugu

Users can select their preferred language through the application's interface.

### 7. Offline Trip Access

Trip information can be saved locally and accessed later without a network connection.

Offline access does not mean that every feature works offline. New marine-data retrieval, fresh zone assessments, and live alternative-zone checks require the relevant backend and data to be available.

Locally saved trips are not automatically synchronized across devices or isolated into separate cloud accounts.

## Technology Stack

| Component            | Technology                                                          |
| -------------------- | ------------------------------------------------------------------- |
| Web application      | Next.js, React, TypeScript                                          |
| Android application  | Capacitor with a native Android project                             |
| Backend API          | Python, FastAPI                                                     |
| Decision system      | Five specialized jurors with policy-based assessment and veto rules |
| Marine visualization | Interactive map interface                                           |
| Local storage        | Browser/device-local authentication and saved-trip storage          |

The website and Android application share the frontend experience and use the same backend decision-support services.

## Project Structure

```text
BLUEJURY-AI-V2/
├── apps/
│   └── web/                 # Website and Capacitor Android application
├── services/
│   └── api/                 # FastAPI backend and juror implementations
├── config/                  # Decision policy configuration
├── data/
│   ├── cache/               # Local marine-data cache
│   └── reference/           # Local reference datasets
├── docs/                    # Data, decision-policy, and feature documentation
└── README.md
```

## Prerequisites

* Node.js 20 or later and npm
* Python 3.12 or later
* Android Studio and Android SDK for building the Android application
* Internet access for obtaining marine data and downloading required reference datasets

The local website and backend can be run without building the Android application.

## Running the Prototype Locally

Clone or download the repository and open a terminal in its root directory.

### 1. Configure the environment

```bash
cp .env.example .env
```

Review the environment variables in `.env.example` and configure the values required for your local setup.

Do not commit real API tokens, passwords, or other credentials to GitHub.

### 2. Start the backend

From the project root:

```bash
make backend-dev
```

The local API runs at:

```text
http://localhost:8000
```

Keep this terminal running.

### 3. Start the website

Open a second terminal:

```bash
cd apps/web
npm install
npm run dev -- --port 3000
```

Open the website at:

```text
http://localhost:3000
```

Keep the backend running while using features that require marine-data retrieval or zone evaluation.

## Running the Android Prototype

BLUEJURY includes a Capacitor-based Android project under `apps/web/android/`.

The Android application uses the same backend as the website.

For local development, the backend runs on the computer, and the Android device connects to it through USB debugging and ADB reverse.

### Connect the Android device to the local backend

Enable USB debugging on the Android device and connect it to the computer.

Start the FastAPI backend, then run:

```bash
adb reverse tcp:8000 tcp:8000
```

Keep the device connected while testing backend-dependent features.

If `adb` is not available in your terminal, use the full path to the Android SDK's platform-tools directory.

The Android project can be opened in Android Studio for building and testing.

**Note:** The repository contains Android source code, not a ready-to-install APK. Generated APKs are not included in the GitHub ZIP.

## Marine Data and Reference Datasets

BLUEJURY uses marine observations and local reference datasets to support its assessments.

The repository includes documentation for its data sources and decision rules:

* `docs/DATA_SOURCES.md`
* `docs/DECISION_POLICY.md`
* `docs/ECOLOGY_BORDER_METHOD.md`
* `docs/OFFLINE_MODE.md`
* `data/reference/marine-regions/README.md`

### Important: Reference datasets are not fully included in Git

The downloaded Marine Regions EEZ dataset is excluded from the repository.

A teammate downloading the ZIP must obtain the required dataset separately and place it in the expected local directory, following `data/reference/marine-regions/README.md`.

The local Copernicus cache is also not included as part of the shared prototype source code.

Marine-data availability, credentials where required, and reference-data coverage can affect the results of backend assessments.

Do not assume that a freshly downloaded ZIP contains every dataset needed to reproduce an existing local demonstration.

## Testing

### Backend

From the project root:

```bash
cd services/api
source .venv/bin/activate
PYTHONPATH=src pytest tests -q
```

### Frontend

From `apps/web/`:

```bash
npm test
npx eslint .
npx tsc --noEmit
npm run build
```

The latest reported validation after the website login-navigation fix was 38 passing frontend tests, together with successful ESLint, TypeScript, and production-build checks.

## Current Prototype Limitations

BLUEJURY is a decision-support prototype and is not a substitute for official marine forecasts, navigation systems, maritime advisories, or regulatory information.

* **Ecology coverage:** Ecological reference data is incomplete. Illustrative values must not be interpreted as verified environmental assessments.
* **Local authentication:** Accounts are stored locally and are not synchronized between devices.
* **Connectivity:** Fresh marine assessments require access to the backend and relevant data sources.
* **Live Trip:** GPS-based features require device-location permission and a usable location fix.
* **Offline mode:** Previously saved information can be accessed locally, but offline access does not provide fresh marine conditions.
* **Reference data:** Some large datasets must be downloaded and configured separately.
* **Android distribution:** The repository provides Android project source code; generated APKs are distributed separately.

BLUEJURY is intended to help users understand and compare fishing-trip options. The final decision remains with the fisherman.
