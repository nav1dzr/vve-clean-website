import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
beforeEach(() => { authFetchMock.mockReset(); });
describe("CRM booking agreement controls", () => {
  it.each(['completed', 'cancelled'])('explains a %s booking without inviting another deposit request', async (state) => {
    authFetchMock.mockResolvedValue({ ...empty, journey: { revision: 2, offer_version: 1, state, draft: {}, snapshot: null, paid_pence: 3000, refunded_pence: 0, customer_request: null } });
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    expect(await screen.findByRole('heading', { name: state === 'completed' ? 'Completed booking' : 'Cancelled booking' })).toBeInTheDocument();
    expect(screen.queryByText(/then send the £30 deposit request/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save agreement and preview email' })).toBeDisabled();
  });
  it('shows a neutral pending state until the saved workflow is known', async () => {
    let resolveWorkflow!: (value: unknown) => void;
    authFetchMock.mockReturnValue(new Promise((resolve) => { resolveWorkflow = resolve; }));
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    expect(screen.getByText('Loading booking workflow…')).toBeInTheDocument();
    expect(screen.queryByText('Draft agreement')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sending is disabled until/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No deposit for this booking/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save agreement and preview email' })).toBeDisabled();
    resolveWorkflow(empty);
    await screen.findByText('Draft agreement');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save agreement and preview email' })).toBeEnabled());
  });
  it('reports a load failure without claiming the booking is a draft or its integration is disabled', async () => {
    let rejectWorkflow!: (reason: Error) => void;
    authFetchMock.mockReturnValue(new Promise((_resolve, reject) => { rejectWorkflow = reject; }));
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    await act(async () => { rejectWorkflow(new Error('TEST ONLY — workflow unavailable')); });
    await screen.findByText('TEST ONLY — workflow unavailable');
    expect(screen.getByText('Booking workflow unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Draft agreement')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sending is disabled until/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save agreement and preview email' })).toBeDisabled();
  });
  it('saves the selected appointment date after a native date input change', async () => {
    authFetchMock.mockResolvedValue(empty);
    const user = userEvent.setup();
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save agreement and preview email' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Appointment date'), { target: { value: '2026-10-25' } });
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Save agreement and preview email' }));
    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(authFetchMock.mock.calls[1][1].body).agreement.date).toBe('2026-10-25');
  });
  it('restores the explicit manual no-deposit choice after reload without changing the public request default', async () => {
    authFetchMock.mockResolvedValue(empty);
    const { unmount } = render(<BookingJourneyPanel booking={{ ...booking, email: 'local@example.invalid', attribution: { firstSource: 'admin_manual' } as BookingDetail['attribution'], quoteConfig: { manualPaymentPlan: 'after_clean' } }} onChanged={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save agreement and preview email' })).toBeEnabled());
    expect(screen.getByLabelText('Payment arrangement')).toHaveValue('after_clean');
    expect(screen.getByText(/No deposit for this booking/)).toBeInTheDocument();
    expect(screen.queryByText(/Their appointment is confirmed when the deposit is received/)).not.toBeInTheDocument();
    unmount();
    render(<BookingJourneyPanel booking={{ ...booking, quoteConfig: { manualPaymentPlan: 'after_clean' } }} onChanged={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Payment arrangement')).toHaveValue('deposit_after_agreement'));
  });
  it("saves a new request without optional typing and never sends it automatically", async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue(empty);
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    const save = await screen.findByRole("button", { name: "Save agreement and preview email" });
    await waitFor(() => expect(save).toBeEnabled());
    expect(screen.getByText("Extra notes and preparation — optional").closest("details")).not.toHaveAttribute("open");
    await user.click(save);
    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(authFetchMock.mock.calls[1][1].body)).toMatchObject({ operation: "draft", agreement: { totalPence: 10000, changeReason: "Booking details prepared in CRM for customer review." } });
  });
  it("uses request wording and a phone shortcut without sending anything", async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue(empty);
    render(<BookingJourneyPanel booking={{ ...booking, preferredTime: "Morning (8am–12pm)", quoteConfig: { service: "deep", deepService: "carpet_upholstery" } }} onChanged={() => {}} />);
    expect(screen.getByLabelText("Service")).toHaveValue("Carpet and upholstery cleaning");
    expect(screen.getByLabelText(/Arrival window/)).toHaveValue("08:00–12:00");
    await user.click(screen.getByText("Extra notes and preparation — optional"));
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
    await user.click(screen.getByText("Extra notes and preparation — optional"));
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
    await user.click(screen.getByText("Extra notes and preparation — optional"));
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
  it('directs a cancellation request to the cancellation action and keeps refund handling separate', async () => {
    authFetchMock.mockResolvedValue({ ...offered, journey: { ...offered.journey, state: 'confirmed', paid_pence: 3000, customer_request: { kind: 'cancel', reason: 'TEST ONLY — plans changed' } } });
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    await screen.findByText('Customer request: cancel');
    expect(screen.getByText(/Review the cancellation request with the customer/)).toHaveTextContent('Cancel appointment');
    expect(screen.getByText(/Cancelling does not issue a refund/)).toBeInTheDocument();
    expect(screen.queryByText(/Check availability, agree the change/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel appointment' })).toBeEnabled();
    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });
  it('keeps revised-date guidance for a rescheduling request', async () => {
    authFetchMock.mockResolvedValue({ ...offered, journey: { ...offered.journey, customer_request: { kind: 'reschedule', date: '2026-10-25', time: '09:00–11:00', reason: 'TEST ONLY — new date' } } });
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    await screen.findByText('Customer request: reschedule');
    expect(screen.getByText(/Check availability, agree the change/)).toBeInTheDocument();
    expect(screen.queryByText(/Review the cancellation request with the customer/)).not.toBeInTheDocument();
  });
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
  it("does not claim delivery when a requested reminder failed", async () => {
    authFetchMock.mockResolvedValue({
      ...offered,
      journey: { ...offered.journey, revision: 3, reminder_sent_at: "2026-09-16T12:00:00Z" },
      notifications: [{ id: "test-reminder", kind: "reminder", channel: "email", audience: "customer", status: "failed", attempts: 1, last_error: "TEST ONLY — mail delivery unavailable", sent_at: null, created_at: "2026-09-16T12:00:00Z" }],
    });
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    expect(await screen.findByRole("button", { name: "Reminder requested" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Deposit reminder sent" })).not.toBeInTheDocument();
    expect(screen.getByText("failed", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("TEST ONLY — mail delivery unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry this delivery" })).toBeEnabled();
    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });
  it("offers a reminder only until one is requested", async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValueOnce(offered);
    render(<BookingJourneyPanel booking={booking} onChanged={() => {}} />);
    const remind = await screen.findByRole("button", { name: "Send unpaid deposit reminder" });
    authFetchMock.mockResolvedValueOnce({ ...offered, journey: { ...offered.journey, revision: 3, reminder_sent_at: "2026-09-16T12:00:00Z" } });
    await user.click(remind);
    expect(await screen.findByRole("button", { name: "Reminder requested" })).toBeDisabled();
    expect(JSON.parse(authFetchMock.mock.calls[authFetchMock.mock.calls.length - 1][1].body)).toMatchObject({ operation: "remind", revision: 2 });
  });
});
