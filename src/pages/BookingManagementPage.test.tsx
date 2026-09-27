import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookingManagementPage from "./BookingManagementPage";

const booking = {
  reference: "TEST-001",
  firstName: "Test",
  revision: 3,
  offerVersion: 1,
  state: "confirmed",
  agreement: {
    service: "Carpet cleaning",
    items: "2 bedrooms",
    scope: "Hot water extraction",
    exclusions: "",
    address: "Test address",
    postcode: "E1 1AA",
    date: "2026-10-10",
    time: "09:00–11:00",
    totalPence: 10000,
    preparation: "Clear the floors",
  },
  previousAgreement: null,
  holdUntil: null,
  paidPence: 3000,
  refundedPence: 0,
  balancePence: 7000,
  customerRequest: null,
  canPayDeposit: false,
  canPayBalance: false,
  canChange: true,
  canAccept: false,
};
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(
    null,
    "",
    "/manage-booking#token=private-test-token",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ booking }) }),
  );
});
describe("private customer management journey", () => {
  it("does not offer deposit payment for an older unpaid offer, even if a stale response allows it", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ booking: {
        ...booking, state: "offered", paidPence: 0, balancePence: 10000,
        holdUntil: "2099-10-10T09:00:00Z", canPayDeposit: true,
      } }),
    } as Response);
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Please check your booking details" });
    expect(screen.queryByRole("button", { name: /^Pay / })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/£30|deposit deadline|payment deadline|payment confirms/i);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("shows an appointment confirmed with no payment without suggesting payment is needed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ booking: { ...booking, paidPence: 0, balancePence: 10000 } }),
    } as Response);
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your clean is booked" });
    expect(screen.queryByRole("button", { name: /^Pay / })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/deposit|payment confirms/i);
    expect(screen.queryByText("£0.00")).not.toBeInTheDocument();
  });
  it("preserves recorded payments and the remaining-balance checkout after a completed clean", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ booking: { ...booking, state: "completed", canPayBalance: true } }),
    } as Response);
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Thank you for choosing VVE Clean" });
    expect(screen.getByText("£30.00")).toBeInTheDocument();
    expect(screen.getByText("£70.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pay £70.00 remaining balance" }));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toMatchObject({ operation: "checkout", revision: 3 });
  });
  it("opens with a read-only GET and removes the bearer token from the address bar", async () => {
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your clean is booked" });
    expect(window.location.hash).toBe("");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: { Authorization: "Bearer private-test-token" },
    });
    expect(
      screen.queryByRole("button", { name: "Pay £30 deposit" }),
    ).not.toBeInTheDocument();
  });
  it("requires explicit confirmation before posting a cancellation and shows the returned state", async () => {
    const user = userEvent.setup();
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your clean is booked" });
    await user.click(
      screen.getByRole("button", { name: "Request cancellation" }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Send cancellation request" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: "I want to cancel this appointment.",
      }),
    );
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        booking: { ...booking, customerRequest: { kind: "cancel" }, canChange: false },
      }),
    } as Response);
    await user.click(
      screen.getByRole("button", { name: "Send cancellation request" }),
    );
    await screen.findByText(/Payment is paused until we have reviewed/);
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body)),
    ).toMatchObject({ operation: "cancel", revision: 3, confirm: true });
    expect(
      screen.getByText(/Your cancellation request is with the team. We will email/),
    ).toBeInTheDocument();
  });
  it("posts a reschedule preference and explains that the original appointment remains in place", async () => {
    const user = userEvent.setup();
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your clean is booked" });
    await user.click(
      screen.getByRole("button", { name: "Request another time" }),
    );
    await user.type(screen.getByLabelText("Preferred date"), "2026-10-11");
    await user.type(
      screen.getByLabelText("Preferred arrival window"),
      "11:00–13:00",
    );
    await user.click(screen.getByRole("checkbox"));
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        booking: {
          ...booking,
          customerRequest: {
            kind: "reschedule",
            date: "2026-10-11",
            time: "11:00–13:00",
          },
        },
      }),
    } as Response);
    await user.click(
      screen.getByRole("button", { name: "Send rescheduling request" }),
    );
    await screen.findByText(/Your existing appointment has not changed/);
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body)),
    ).toMatchObject({
      operation: "reschedule",
      date: "2026-10-11",
      confirm: true,
    });
  });
  it("does not call the API when no private link is available", async () => {
    window.history.replaceState(null, "", "/manage-booking");
    render(<BookingManagementPage />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Open the private booking link",
      ),
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "Manage your booking" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("link", { name: "Message us on WhatsApp" })).toHaveAttribute("href", "https://wa.me/447845451111");
  });
  it("keeps a heading and a recovery route when the private link is rejected", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "This private link has expired. Please contact the team." }),
    } as Response);
    render(<BookingManagementPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("private link has expired");
    expect(screen.getByRole("heading", { level: 1, name: "Manage your booking" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh booking" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Pay £30 deposit" })).not.toBeInTheDocument();
  });
  it("explains an empty successful response rather than leaving an unexplained blank page", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    render(<BookingManagementPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not load your booking details");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Manage your booking");
  });
  it("does not invent a confirmed status when a newer status is not recognised", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ booking: { ...booking, state: "unrecognised" } }) } as Response);
    render(<BookingManagementPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Please check your booking with the team" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your clean is booked" })).not.toBeInTheDocument();
  });
  it("keeps an API conflict visible and offers a refresh instead of claiming success", async () => {
    const user = userEvent.setup();
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your clean is booked" });
    await user.click(
      screen.getByRole("button", { name: "Request cancellation" }),
    );
    await user.click(screen.getByRole("checkbox"));
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Payment is processing. Please wait." }),
    } as Response);
    await user.click(
      screen.getByRole("button", { name: "Send cancellation request" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Payment is processing",
    );
    expect(
      screen.getByRole("heading", { name: "Your clean is booked" }),
    ).toBeInTheDocument();
  });
});


describe("bank-transfer details", () => {
  const paymentInstructions = { due: "after_clean", bank: { accountName: "EXAMPLE ONLY", sortCode: "00-00-00", accountNumber: "00000000", reference: "E11AA101026-1" } };
  it("shows the saved reference without a pre-clean payment button or a client-side paid action", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ booking: { ...booking, paymentInstructions } }) } as Response);
    render(<BookingManagementPage />);
    await screen.findByText("E11AA101026-1");
    expect(screen.getByText(/no payment is needed now/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pay|I've paid/i })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("withholds transfer details for cancelled bookings even with stale payment instructions", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ booking: { ...booking, state: "cancelled", paymentInstructions } }) } as Response);
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your booking is cancelled" });
    expect(screen.queryByText("00000000")).not.toBeInTheDocument();
  });
});

describe("agreed deposit customer controls", () => {
  const offered = { ...booking, state: "offered", paidPence: 0, balancePence: 10000, canPayDeposit: true, holdUntil: "2099-10-10T09:00:00Z", agreement: { ...booking.agreement, paymentPlan: "deposit_after_agreement" } };
  it("shows the deposit after agreement while a normal booking link stays read-only", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ booking: offered }) } as Response);
    render(<BookingManagementPage />);
    expect(await screen.findByRole("button", { name: "Pay £30 deposit by card" })).toBeEnabled();
    const summary = screen.getByRole("region", { name: "Secure your appointment" });
    expect(within(summary).getByText("Total").nextElementSibling).toHaveTextContent("£100.00");
    expect(within(summary).getByText("Deposit due now").nextElementSibling).toHaveTextContent("£30.00");
    expect(within(summary).getByText("Balance after deposit").nextElementSibling).toHaveTextContent("£70.00");
    expect(within(summary).queryByText("Paid")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Refunded")).not.toBeInTheDocument();
    expect(within(summary).getByText(/due on the day of your clean once the deposit is received/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("prepares checkout once only when the customer follows the explicit email Pay button", async () => {
    window.history.replaceState(null, "", "/manage-booking#token=private-test-token&pay=deposit");
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ booking: offered }) } as Response);
    render(<BookingManagementPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toMatchObject({ operation: "checkout", revision: 3 });
    expect(window.location.hash).toBe("");
  });
  it.each(["expired", "change_requested", "paid"])("withholds all deposit instructions when %s even with a stale response", async kind => {
    const stopped = { ...offered, ...(kind === "expired" ? { holdUntil: "2020-01-01T00:00:00Z" } : kind === "paid" ? { paidPence: 3000 } : { customerRequest: { kind: "cancel" } }), paymentInstructions: { due: "deposit", bank: { accountName: "EXAMPLE", sortCode: "00-00-00", accountNumber: "00000000", reference: "TEST" } } };
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ booking: stopped }) } as Response);
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(screen.queryByText("Loading your booking…")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^Pay/ })).not.toBeInTheDocument();
    expect(screen.queryByText("00000000")).not.toBeInTheDocument();
    expect(screen.queryByText("Balance after deposit")).not.toBeInTheDocument();
    expect(screen.queryByText("Deposit due now")).not.toBeInTheDocument();
  });
});

describe("clear booking presentation", () => {
  it("separates cleaning from access costs, keeps custom details and uses a readable date", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ booking: {
      ...booking,
      agreement: { ...booking.agreement,
        items: "2 bedrooms\nHallway\nParking: free parking available — £0\nCongestion Charge zone — +£18",
        accessNotes: "Use the side entrance",
        scope: "Please focus on the stain beside the bedroom door.",
        exclusions: "The rug in the lounge is not included.",
      },
    } }) } as Response);
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your clean is booked" });
    const cleaning = screen.getByRole("region", { name: "Your cleaning includes" });
    expect(within(cleaning).getAllByRole("listitem")).toHaveLength(2);
    expect(within(cleaning).getByText("2 bedrooms")).toBeInTheDocument();
    expect(within(cleaning).queryByText(/Parking|Congestion/)).not.toBeInTheDocument();
    const access = screen.getByRole("region", { name: "Parking and access costs" });
    expect(within(access).getByText("Parking: free parking available — £0")).toBeInTheDocument();
    expect(within(access).getByText("Congestion Charge zone — +£18")).toBeInTheDocument();
    expect(within(access).getByText("Use the side entrance")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Additional details" })).toBeInTheDocument();
    expect(screen.getByText("Please focus on the stain beside the bedroom door.")).toBeInTheDocument();
    expect(screen.getByText("The rug in the lounge is not included.")).toBeInTheDocument();
    expect(screen.getByText("Saturday, 10 October 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Version 1/)).not.toBeInTheDocument();
  });

  it("omits only the old generic scope and places preparation below the payment and change options", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ booking: {
      ...booking,
      agreement: { ...booking.agreement, scope: "Clean the items and areas listed above. Any additional work or change in price will be agreed with you before it is carried out." },
    } }) } as Response);
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your clean is booked" });
    expect(screen.queryByRole("heading", { name: "Additional details" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Clean the items and areas listed above/)).not.toBeInTheDocument();
    const preparation = screen.getByRole("complementary");
    expect(preparation).toHaveTextContent("Clear the floors");
    expect(screen.getByRole("region", { name: "Payment summary" }).compareDocumentPosition(preparation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Request cancellation" }).compareDocumentPosition(preparation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the actual paid balance without subtracting the deposit a second time", async () => {
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your clean is booked" });
    const summary = screen.getByRole("region", { name: "Payment summary" });
    expect(within(summary).getByText("Paid").nextElementSibling).toHaveTextContent("£30.00");
    expect(within(summary).getByText("Remaining balance").nextElementSibling).toHaveTextContent("£70.00");
    expect(within(summary).queryByText("Balance after deposit")).not.toBeInTheDocument();
    expect(within(summary).getByText(/due on the day of your clean/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pay / })).not.toBeInTheDocument();
  });

  it("preserves real refunds and distinguishes an unpaid cancelled quote from a charge", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ booking: {
      ...booking, state: "cancelled", refundedPence: 3000, balancePence: 10000,
    } }) } as Response);
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your booking is cancelled" });
    const summary = screen.getByRole("region", { name: "Payment summary" });
    expect(within(summary).getByText("Paid").nextElementSibling).toHaveTextContent("£30.00");
    expect(within(summary).getByText("Refunded").nextElementSibling).toHaveTextContent("£30.00");
    expect(within(summary).getByText("Unpaid part of original quote").nextElementSibling).toHaveTextContent("£100.00");
    expect(within(summary).getByText(/not a cancellation charge/)).toBeInTheDocument();
    expect(within(summary).queryByText(/due on the day/)).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
