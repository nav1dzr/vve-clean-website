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
  it("keeps Send unavailable when the integration is disabled", async () => {
    authFetchMock.mockResolvedValue({ ...empty, enabled: false });
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    await screen.findByText(/Sending is disabled/);
    expect(
      screen.getByRole("button", { name: "Save agreement and preview email" }),
    ).toBeDisabled();
    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });
  it("saves the agreement, previews it, and sends the exact reviewed deadline only after staff confirms availability", async () => {
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
      screen.getByLabelText("Reason for agreed scope, price or changes"),
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
      screen.getByRole("button", { name: "Send £30 deposit request" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: /I checked availability/ }),
    );
    authFetchMock.mockResolvedValueOnce({
      ...saved,
      journey: { ...saved.journey, revision: 2, state: "offered" },
      deliveries: [{ status: "sent" }],
    });
    await user.click(
      screen.getByRole("button", { name: "Send £30 deposit request" }),
    );
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    const sent = JSON.parse(
      authFetchMock.mock.calls[authFetchMock.mock.calls.length - 1][1].body,
    );
    expect(sent).toMatchObject({
      operation: "send",
      revision: 1,
      availabilityConfirmed: true,
      holdUntil: saved.previewHoldUntil,
    });
  });
});
