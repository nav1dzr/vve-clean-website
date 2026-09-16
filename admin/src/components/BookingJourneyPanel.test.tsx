import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookingJourneyPanel from "./BookingJourneyPanel";
import type { BookingDetail } from "../types/booking";
const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("../lib/authFetch", () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
}));
const booking = {
  id: "booking-test",
  service: "Carpet cleaning",
  address: "Test address",
  postcode: "E1 1AA",
  preferredDate: "2026-10-10",
  preferredTime: "09:00–11:00",
  totalPrice: 100,
  notifications: { emailCustomerSent: true, emailBusinessSent: true },
} as BookingDetail;
const empty = { enabled: true, journey: null, notifications: [], events: [] };
beforeEach(() => authFetchMock.mockReset());
describe("CRM booking agreement controls", () => {
  it("uses request wording and a phone shortcut without sending anything", async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue(empty);
    render(<BookingJourneyPanel booking={{ ...booking, preferredTime: "Morning (8am–12pm)", quoteConfig: { service: "deep", deepService: "carpet_upholstery" } }} onChanged={() => {}} />);
    expect(screen.getByLabelText("Service")).toHaveValue("Carpet and upholstery cleaning");
    expect(screen.getByLabelText(/Arrival window/)).toHaveValue("08:00–12:00");
    await user.click(screen.getByRole("button", { name: "Agreed by phone" }));
    expect(screen.getByLabelText(/Reason for agreed scope/)).toHaveValue("Details agreed by phone with the customer.");
    await user.clear(screen.getByLabelText("Included scope"));
    await user.type(screen.getByLabelText("Included scope"), "My own scope");
    await user.click(screen.getByRole("button", { name: "Fill empty wording from this request" }));
    expect(screen.getByLabelText("Included scope")).toHaveValue("My own scope");
    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps Send unavailable when the integration is disabled", async () => {
    authFetchMock.mockResolvedValue({ ...empty, enabled: false });
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    await screen.findByText(/Sending is disabled/);
    expect(
      screen.getByRole("button", { name: "Save agreement and preview email" }),
    ).toBeDisabled();
    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });
  it("saves the agreement, previews it, and confirms without a payment deadline only after staff confirms availability", async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValueOnce(empty);
    const changed = vi.fn();
    render(<BookingJourneyPanel booking={booking} onChanged={changed} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Save agreement and preview email",
        }),
      ).toBeEnabled(),
    );
    await user.type(
      screen.getByLabelText(/Reason for agreed scope, price or changes/),
      "Agreed after customer discussion",
    );
    const agreement = {
      service: "Carpet cleaning",
      items: "Carpet cleaning",
      scope: "",
      exclusions: "",
      address: "Test address",
      postcode: "E1 1AA",
      date: "2026-10-10",
      time: "09:00–11:00",
      totalPence: 10000,
      changeReason: "Agreed after customer discussion",
      preparation: "",
    };
    const saved = {
      ...empty,
      journey: {
        revision: 1,
        offer_version: 0,
        state: "draft",
        draft: agreement,
        snapshot: null,
        paid_pence: 0,
        refunded_pence: 0,
        customer_request: null,
      },
      preview: {
        subject: "Confirm your clean",
        html: "<p>Review these details</p>",
        text: "Review these details",
      },
      previewHoldUntil: "2026-09-10T12:00:00.000Z",
    };
    authFetchMock.mockResolvedValueOnce(saved);
    await user.click(
      screen.getByRole("button", { name: "Save agreement and preview email" }),
    );
    await screen.findByTitle("Booking email preview");
    expect(
      screen.getByRole("button", { name: "Confirm booking and send email" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: /I checked availability/ }),
    );
    authFetchMock.mockResolvedValueOnce({
      ...saved,
      journey: { ...saved.journey, revision: 2, state: "confirmed" },
      deliveries: [{ status: "sent" }],
    });
    await user.click(
      screen.getByRole("button", { name: "Confirm booking and send email" }),
    );
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    const sent = JSON.parse(
      authFetchMock.mock.calls[authFetchMock.mock.calls.length - 1][1].body,
    );
    expect(sent).not.toHaveProperty("holdUntil");
    expect(screen.queryByLabelText(/Payment deadline/)).not.toBeInTheDocument();
    expect(sent).toMatchObject({
      operation: "send",
      revision: 1,
      availabilityConfirmed: true,

    });
  });
});
