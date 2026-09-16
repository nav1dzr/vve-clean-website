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
    await user.clear(screen.getByLabelText(/Additional details \(optional\)/));
    await user.type(screen.getByLabelText(/Additional details \(optional\)/), "My own scope");
    await user.click(screen.getByRole("button", { name: "Fill empty wording from this request" }));
    expect(screen.getByLabelText(/Additional details \(optional\)/)).toHaveValue("My own scope");
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
  it("separates access costs for a new draft and submits owner edits without changing its price", async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue(empty);
    render(<BookingJourneyPanel booking={{ ...booking, service: "Carpet cleaning\n2 × bedrooms\nParking: free — £0\nCongestion Charge: £18" }} onChanged={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save agreement and preview email" })).toBeEnabled());
    expect(screen.getByLabelText(/Your cleaning includes/)).toHaveValue("Carpet cleaning\n2 × bedrooms");
    const access = screen.getByLabelText(/Parking and access costs \(optional\)/);
    expect(access).toHaveValue("Parking: free — £0\nCongestion Charge: £18");
    await user.clear(access);
    await user.type(access, "Parking permit arranged by customer");
    await user.click(screen.getByRole("button", { name: "Agreed by message" }));
    await user.click(screen.getByRole("button", { name: "Save agreement and preview email" }));
    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(2));
    const submitted = JSON.parse(authFetchMock.mock.calls[1][1].body);
    expect(submitted.agreement).toMatchObject({ items: "Carpet cleaning\n2 × bedrooms", accessNotes: "Parking permit arranged by customer", totalPence: 10000 });
    expect(submitted.operation).toBe("draft");
  });
  it("opens a legacy saved draft without adding package promises or changing the owner's wording", async () => {
    const user = userEvent.setup();
    const savedAgreement = { service: "Selected tenancy tasks", items: "Bathroom surfaces only\nParking: permit arranged", scope: "Customer asked us to leave the kitchen", exclusions: "No oven clean", preparation: "Keys with concierge", address: "Test address", postcode: "E1 1AA", date: "2026-10-10", time: "09:00–11:00", totalPence: 10000, changeReason: "Adjusted by phone" };
    authFetchMock.mockResolvedValue({ ...empty, journey: { revision: 1, offer_version: 0, state: "draft", draft: savedAgreement, snapshot: null, paid_pence: 0, refunded_pence: 0, customer_request: null } });
    render(<BookingJourneyPanel booking={{ ...booking, quoteConfig: { service: "deep", deepService: "end_of_tenancy", eotPackage: "complete" } }} onChanged={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText(/Your cleaning includes/)).toHaveValue(savedAgreement.items));
    expect(screen.getByLabelText(/Parking and access costs/)).toHaveValue("");
    expect(screen.queryByText("Paid", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Refunded", { exact: true })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fill empty wording from this request" }));
    expect(screen.getByLabelText(/Your cleaning includes/)).toHaveValue(savedAgreement.items);
    expect(screen.getByLabelText(/Additional details \(optional\)/)).toHaveValue(savedAgreement.scope);
    expect(screen.getByLabelText(/Not included \(optional\)/)).toHaveValue(savedAgreement.exclusions);
    expect(screen.getByLabelText("Total (£)")).toHaveValue(100);
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

describe("deposit operator controls", () => {
  const agreement = { service: "Carpet cleaning", items: "Two bedrooms", scope: "Extraction", exclusions: "", address: "Test address", postcode: "E1 1AA", date: "2026-10-10", time: "09:00–11:00", totalPence: 10000, changeReason: "Agreed by WhatsApp", preparation: "", paymentPlan: "deposit_after_agreement", paymentWindowHours: 48 };
  const offered = { ...empty, journey: { revision: 2, offer_version: 1, state: "offered", draft: agreement, snapshot: agreement, paid_pence: 0, refunded_pence: 0, customer_request: null, hold_until: "2099-01-01T00:00:00Z", reminder_sent_at: null } };
  it("defaults new agreements to £30 after agreement and keeps the public request free", async () => {
    authFetchMock.mockResolvedValue(empty);
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    expect(await screen.findByLabelText("Payment arrangement")).toHaveValue("deposit_after_agreement");
    expect(screen.getByLabelText(/Pay within/)).toHaveValue("48");
  });
  it("requires actual bank receipt before confirming and retains its bank reference", async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue(offered);
    const changed = vi.fn();
    render(<BookingJourneyPanel booking={{ ...booking, bookingRef: "E11AA101026" }} onChanged={changed} />);
    const button = await screen.findByRole("button", { name: "Record £30 bank deposit and send confirmation" });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /I checked the bank account/ }));
    authFetchMock.mockResolvedValueOnce({ ...offered, journey: { ...offered.journey, revision: 3, state: "confirmed", paid_pence: 3000 } });
    await user.click(button);
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(screen.getByText("Paid", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Refunded", { exact: true })).not.toBeInTheDocument();
    expect(JSON.parse(authFetchMock.mock.calls[authFetchMock.mock.calls.length - 1][1].body)).toMatchObject({ operation: "manual_deposit", amountPence: 3000, method: "bank_transfer", reference: "E11AA101026", receivedConfirmed: true });
  });
  it("offers a reminder only until one is sent", async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValueOnce(offered);
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    const remind = await screen.findByRole("button", { name: "Send unpaid deposit reminder" });
    authFetchMock.mockResolvedValueOnce({ ...offered, journey: { ...offered.journey, revision: 3, reminder_sent_at: "2026-09-16T12:00:00Z" } });
    await user.click(remind);
    expect(await screen.findByRole("button", { name: "Deposit reminder sent" })).toBeDisabled();
    expect(JSON.parse(authFetchMock.mock.calls[authFetchMock.mock.calls.length - 1][1].body)).toMatchObject({ operation: "remind", revision: 2 });
  });
});
