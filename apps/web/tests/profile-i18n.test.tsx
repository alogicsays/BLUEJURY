import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ExperienceProvider, LANGUAGE_KEY, PROFILE_KEY, useExperience } from "@/components/experience-provider";
import { WelcomeScreen } from "@/components/welcome-screen";
import { Jury } from "@/components/decision-panel";
import { dictionaries, locales, type Locale } from "@/lib/i18n";
import { ACCOUNTS_KEY, registerLocalAccount, SESSION_KEY, signInLocalAccount } from "@/lib/local-auth";
import { persistOfflineTrip, removeOfflineTrip, retrieveOfflineTrip } from "@/lib/offline-trip-store";
import { decision, plan } from "./offline-trip-store.test";

function ProfileProbe() {
  const { ready, profile, locale, setLocale, saveProfile, signOut, t } = useExperience();
  if (!ready) return <span>boot</span>;
  return <div>
    <span data-testid="profile">{profile?.displayName ?? "NO_PROFILE"}</span>
    <span data-testid="email">{profile?.email ?? "NO_EMAIL"}</span>
    <span data-testid="locale">{locale}</span>
    <span data-testid="plan-label">{t("planTrip")}</span>
    <button onClick={() => saveProfile("Edited Fisher")}>edit</button>
    <button onClick={signOut}>sign out</button>
    <button onClick={() => setLocale("te")}>తెలుగు</button>
  </div>;
}

function WelcomeWhenReady() {
  const { ready, profile } = useExperience();
  return ready && !profile ? <WelcomeScreen /> : null;
}

async function signUpThroughUi(name = "Amulya", email = "amulya@example.test", password = "Bluejury42!") {
  fireEvent.click(screen.getByRole("tab", { name: /sign up/i }));
  fireEvent.change(screen.getByPlaceholderText("Enter your name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("EMAIL ADDRESS"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("PASSWORD"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("CONFIRM PASSWORD"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
  await waitFor(() => expect(screen.getByTestId("profile")).toHaveTextContent(name));
}

describe("device-local authentication and shared language experience", () => {
  beforeEach(async () => { localStorage.clear(); await removeOfflineTrip(); });

  it("registers an account, stores no plaintext password, and restores its session", async () => {
    const view = render(<ExperienceProvider><WelcomeWhenReady /><ProfileProbe /></ExperienceProvider>);
    await waitFor(() => expect(screen.getByTestId("profile")).toHaveTextContent("NO_PROFILE"));
    await signUpThroughUi();
    const stored = localStorage.getItem(ACCOUNTS_KEY) ?? "";
    expect(stored).not.toContain("Bluejury42!");
    expect(JSON.parse(stored)[0]).toEqual(expect.objectContaining({ email: "amulya@example.test", salt: expect.any(String), verifier: expect.any(String) }));
    expect(localStorage.getItem(SESSION_KEY)).toBeTruthy();
    view.unmount();
    render(<ExperienceProvider><ProfileProbe /></ExperienceProvider>);
    await waitFor(() => expect(screen.getByTestId("profile")).toHaveTextContent("Amulya"));
  });

  it("rejects duplicate registration and an incorrect password", async () => {
    await registerLocalAccount("Fisher", "fisher@example.test", "Fishing123!");
    localStorage.removeItem(SESSION_KEY);
    await expect(registerLocalAccount("Other", "FISHER@example.test", "Another123!")).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });
    await expect(signInLocalAccount("fisher@example.test", "Wrong12345!")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("signs out and back in without deleting the saved IndexedDB trip", async () => {
    await persistOfflineTrip(plan, decision, "ZONE-A");
    await registerLocalAccount("Fisher", "fisher@example.test", "Fishing123!");
    render(<ExperienceProvider><WelcomeWhenReady /><ProfileProbe /></ExperienceProvider>);
    await waitFor(() => expect(screen.getByTestId("profile")).toHaveTextContent("Fisher"));
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    expect(screen.getByTestId("profile")).toHaveTextContent("Edited Fisher");
    fireEvent.click(screen.getByRole("button", { name: "sign out" }));
    expect(screen.getByTestId("profile")).toHaveTextContent("NO_PROFILE");
    expect(await retrieveOfflineTrip()).toEqual(expect.objectContaining({ activeZoneId: "ZONE-A" }));
    fireEvent.change(screen.getByLabelText("EMAIL ADDRESS"), { target: { value: "fisher@example.test" } });
    fireEvent.change(screen.getByLabelText("PASSWORD"), { target: { value: "Fishing123!" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in/i }));
    await waitFor(() => expect(screen.getByTestId("profile")).toHaveTextContent("Edited Fisher"));
    expect(await retrieveOfflineTrip()).toEqual(expect.objectContaining({ activeZoneId: "ZONE-A" }));
  });

  it("migrates a name-only profile without deleting it or saved trips", async () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ displayName: "Legacy Fisher" }));
    await persistOfflineTrip(plan, decision, "ZONE-A");
    render(<ExperienceProvider><WelcomeWhenReady /><ProfileProbe /></ExperienceProvider>);
    await waitFor(() => expect(screen.getByDisplayValue("Legacy Fisher")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("EMAIL ADDRESS"), { target: { value: "legacy@example.test" } });
    fireEvent.change(screen.getByLabelText("PASSWORD"), { target: { value: "Legacy1234!" } });
    fireEvent.change(screen.getByLabelText("CONFIRM PASSWORD"), { target: { value: "Legacy1234!" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(screen.getByTestId("profile")).toHaveTextContent("Legacy Fisher"));
    expect(localStorage.getItem(PROFILE_KEY)).toBe(JSON.stringify({ displayName: "Legacy Fisher" }));
    expect(await retrieveOfflineTrip()).toBeTruthy();
  });

  it("switches Telugu immediately, persists it, and keeps all six dictionaries complete", async () => {
    const view = render(<ExperienceProvider><ProfileProbe /></ExperienceProvider>);
    await waitFor(() => expect(screen.getByTestId("locale")).toHaveTextContent("en"));
    fireEvent.click(screen.getByRole("button", { name: "తెలుగు" }));
    expect(screen.getByTestId("locale")).toHaveTextContent("te");
    expect(screen.getByTestId("plan-label")).toHaveTextContent("ప్రయాణాన్ని ప్లాన్ చేయండి");
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("te");
    const englishKeys = Object.keys(dictionaries.en).sort();
    for (const locale of locales) expect(Object.keys(dictionaries[locale]).sort()).toEqual(englishKeys);
    view.unmount();
    render(<ExperienceProvider><ProfileProbe /></ExperienceProvider>);
    await waitFor(() => expect(screen.getByTestId("locale")).toHaveTextContent("te"));
  });

  it("localizes a known juror status without changing the scorecard", async () => {
    localStorage.setItem(LANGUAGE_KEY, "hi" satisfies Locale);
    const candidate = decision.candidates[0];
    render(<ExperienceProvider><Jury candidate={candidate} /></ExperienceProvider>);
    await waitFor(() => expect(screen.getByText("ईंधन")).toBeInTheDocument());
    expect(screen.getByText("वीटो")).toBeInTheDocument();
    expect(candidate.juror_scorecards[0].veto).toBe(true);
    expect(candidate.juror_scorecards[0].score).toBe(0);
  });
});
