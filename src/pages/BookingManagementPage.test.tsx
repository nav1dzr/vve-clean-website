import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    await screen.findByRole("heading", { name: "Your appointment is being arranged" });
    expect(screen.getByText(/No deposit is required/)).toBeInTheDocument();
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
    await screen.findByRole("heading", { name: "Your booking is confirmed" });
    expect(screen.queryByRole("button", { name: /^Pay / })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/deposit|payment confirms/i);
    expect(screen.getByText("£0.00")).toBeInTheDocument();
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
    await screen.findByRole("heading", { name: "Your booking is confirmed" });
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
    await screen.findByRole("heading", { name: "Your booking is confirmed" });
    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Confirm cancellation" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: "I want to cancel this appointment.",
      }),
    );
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        booking: { ...booking, state: "cancelled", canChange: false },
      }),
    } as Response);
    await user.click(
      screen.getByRole("button", { name: "Confirm cancellation" }),
    );
    await screen.findByRole("heading", { name: "Your booking is cancelled" });
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body)),
    ).toMatchObject({ operation: "cancel", revision: 3, confirm: true });
    expect(
      screen.getByText(/refund is handled separately/),
    ).toBeInTheDocument();
  });
  it("posts a reschedule preference and explains that the original appointment remains in place", async () => {
    const user = userEvent.setup();
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your booking is confirmed" });
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
    expect(screen.queryByRole("heading", { name: "Your booking is confirmed" })).not.toBeInTheDocument();
  });
  it("keeps an API conflict visible and offers a refresh instead of claiming success", async () => {
    const user = userEvent.setup();
    render(<BookingManagementPage />);
    await screen.findByRole("heading", { name: "Your booking is confirmed" });
    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    await user.click(screen.getByRole("checkbox"));
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Payment is processing. Please wait." }),
    } as Response);
    await user.click(
      screen.getByRole("button", { name: "Confirm cancellation" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Payment is processing",
    );
    expect(
      screen.getByRole("heading", { name: "Your booking is confirmed" }),
    ).toBeInTheDocument();
  });
});
