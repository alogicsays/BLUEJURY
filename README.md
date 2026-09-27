# BLUEJURY

### Smarter Fishing Decisions, Safer Journeys

**BLUEJURY** is a marine decision-support platform that helps fishermen discover fishing zones, assess risks, and plan trips using marine data.

Available as a **web application and Android prototype**, BLUEJURY brings five specialized jurors together to provide explainable fishing-zone recommendations.

---

## Key Features

| Feature                | Description                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Smart Route Planning   | Compare fishing zones and find a recommended destination and route.                      |
| Evaluate This Area     | Select a location on the marine map and assess its suitability.                          |
| Five-Juror System      | Understand recommendations through Catch, Safety, Fuel, Ecology, and Border assessments. |
| Live Trip              | Check alternative zones using your current GPS location and remaining fuel.              |
| Multilingual Interface | Available in English, Kannada, Hindi, Tamil, Malayalam, and Telugu.                      |
| Web and Android        | Access the prototype through a browser or Android app.                                   |
| Offline Trips          | Save trip information locally for later access.                                          |
| Local Authentication   | Sign up and sign in using device-local accounts.                                         |

---

## The Five Jurors

| Juror   | What It Evaluates                                       |
| ------- | ------------------------------------------------------- |
| Catch   | Fishing potential based on available marine conditions. |
| Safety  | Sea conditions and safety risks.                        |
| Fuel    | Fuel availability and route feasibility.                |
| Ecology | Available environmental context and restrictions.       |
| Border  | Maritime boundaries and geographic constraints.         |

BLUEJURY combines eligible assessments into an explainable recommendation. Verified hard-veto conditions can rule out unsuitable zones.

**Ecology limitation:** Due to insufficient data coverage, the currently displayed illustrative Ecology value of 75 is excluded from the final decision calculation.

---

## Tech Stack

| Component       | Technology                                         |
| --------------- | -------------------------------------------------- |
| Frontend        | Next.js, React, TypeScript                         |
| Backend         | Python, FastAPI                                    |
| Android         | Capacitor                                          |
| Decision Engine | Five-juror assessment and policy-based veto system |

---

## Run Locally

**Requirements:** Node.js 20+, Python 3.12+, npm, and the required marine reference data.

**1. Start the backend**

From the project root:

```bash
make backend-dev
```

**2. Start the website in another terminal**

```bash
cd apps/web
npm install
npm run dev -- --port 3000
```

Open **http://localhost:3000**.

For environment configuration and marine reference-data requirements, see `.env.example` and `docs/DATA_SOURCES.md`.

---

## Android Setup

The Android project is located in `apps/web/android/`.

Open it in Android Studio to build the application. For local testing, connect your Android device through USB and run:

```bash
adb reverse tcp:8000 tcp:8000
```

Keep the FastAPI backend running on your computer.

**Note:** The GitHub repository contains the Android source code, not a ready-to-install APK.

---

## Documentation

| Document                                  | Contents                                  |
| ----------------------------------------- | ----------------------------------------- |
| `docs/DATA_SOURCES.md`                    | Marine data sources and requirements      |
| `docs/DECISION_POLICY.md`                 | Decision rules and juror logic            |
| `docs/ECOLOGY_BORDER_METHOD.md`           | Ecology and Border assessment methodology |
| `docs/OFFLINE_MODE.md`                    | Offline features and limitations          |
| `data/reference/marine-regions/README.md` | Marine Regions reference-data setup       |

---

## Prototype Limitations

* Fresh assessments and live alternative-zone checks require access to the backend and relevant marine data.
* GPS-based features require device-location permission and a usable GPS fix.
* Local accounts and saved trips are not automatically synchronized across devices.
* Some large marine reference datasets are excluded from GitHub and must be obtained separately.
* BLUEJURY is a decision-support prototype, not a replacement for official maritime forecasts, navigation systems, or regulatory advisories.

---

**BLUEJURY — Five perspectives. One informed fishing decision.**
