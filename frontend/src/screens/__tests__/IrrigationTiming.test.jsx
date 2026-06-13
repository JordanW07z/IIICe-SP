import { render, screen, waitFor } from "@testing-library/react";
import { vi, beforeEach, test, expect } from "vitest";
import IrrigationTiming from "../IrrigationTiming.jsx";
import * as api from "../../api.js";

beforeEach(() => {
  vi.spyOn(api, "getTiming").mockResolvedValue({
    stage: "mature",
    optimum: { temp: 23, rh: 90, growth: 0.97 },
    best_window: { window: null, hours: [], total_gain: 0 },
    now: { temp: 28, rh: 88 },
    live: { irrigate: false, growth_gain: 0,
            reason: "mature: never irrigate (overwatering causes spoilage)" },
  });
});

test("shows WAIT verdict and the guardrail reason", async () => {
  render(<IrrigationTiming stage="mature" />);
  await waitFor(() => expect(screen.getByText(/WAIT/)).toBeInTheDocument());
  expect(screen.getByText(/never irrigate/i)).toBeInTheDocument();
});

test("renders the identified optimum", async () => {
  render(<IrrigationTiming stage="mature" />);
  // Target the optimum card's unique text — a bare /23/ also matches the 23:00 hour tick.
  await waitFor(() => expect(screen.getByText(/Identified optimum/i)).toBeInTheDocument());
  expect(screen.getByText(/predicted growth 0\.97/)).toBeInTheDocument();
});
