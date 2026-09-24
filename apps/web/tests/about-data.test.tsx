import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AboutDataPage from "../app/about-data/page";

describe("About Data evidence claims", () => {
  it("uses the exact current Copernicus wave dataset identifier", () => {
    render(<AboutDataPage />);
    expect(screen.getByText("cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411", { exact: false })).toBeInTheDocument();
  });

  it("distinguishes installed references, trip insufficiency and deployment absence", () => {
    render(<AboutDataPage />);
    expect(screen.getAllByText("INTEGRATED · LOCAL REFERENCE INSTALLED")).toHaveLength(2);
    expect(screen.getByText(/a checked trip can still return insufficient coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/Ecology reports source unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Border reports data unavailable/i)).toBeInTheDocument();
  });

  it("states the WII and Marine Regions limits without asserting clearance", () => {
    render(<AboutDataPage />);
    expect(screen.getByText(/historical biodiversity point context/i)).toBeInTheDocument();
    expect(screen.getByText(/not a protected-area boundary/i)).toBeInTheDocument();
    expect(screen.getByText(/not legal fishing clearance/i)).toBeInTheDocument();
  });

  it("describes caching, GPS, Fuel and Offline Mode conservatively", () => {
    render(<AboutDataPage />);
    expect(screen.getByText(/remains explicitly labelled CACHED/i)).toBeInTheDocument();
    expect(screen.getByText(/Fuel is calculated deterministically/i)).toBeInTheDocument();
    expect(screen.getByText(/Browser GPS supplies position separately/i)).toBeInTheDocument();
    expect(screen.getByText(/does not retrieve or refresh marine evidence while disconnected/i)).toBeInTheDocument();
  });
});
