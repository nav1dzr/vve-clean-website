import {
  performAdminAction,
  deliverJourneyMessages,
  JourneyError,
  londonToday,
} from "../../admin/api/_lib/bookingJourney.js";

export async function processDueBookingJourneys(
  db,
  {
    perform = performAdminAction,
    deliver = deliverJourneyMessages,
    now = new Date(),
  } = {},
) {
  const results = [];
  // Only new, explicitly agreed deposit offers participate. Historic offers
  // and free website requests never trigger payment reminders.
  const { data: offers, error: offerError } = await db.from("booking_journeys")
    .select("booking_id,revision,hold_until,reminder_sent_at,snapshot,customer_request")
    .eq("state", "offered").eq("snapshot->>paymentPlan", "deposit_after_agreement")
    .is("customer_request", null).order("hold_until", { ascending: true }).limit(10);
  if (offerError) throw new JourneyError("Could not load agreed deposit offers.", 503);
  for (const j of offers || []) {
    const remaining = new Date(j.hold_until).getTime() - now.getTime();
    const windowHours = Number(j.snapshot?.paymentWindowHours || 48);
    const operation = remaining <= 0 ? "expire" :
      !j.reminder_sent_at && remaining <= windowHours * 3600000 / 2 && remaining > 31 * 60000 ? "remind" : null;
    if (!operation) continue;
    try {
      await perform(db, j.booking_id, { operation, revision: j.revision }, "worker");
      results.push({ id: j.booking_id, status: `${operation}_queued` });
    } catch (error) { results.push({ id: j.booking_id, status: "needs_review", error: error.message }); }
  }
  const nextLondonDay = new Date(`${londonToday(now)}T12:00:00Z`);
  nextLondonDay.setUTCDate(nextLondonDay.getUTCDate() + 1);
  for (const [state, field] of [
    ["confirmed", "snapshot"],
    ["change_pending", "previous_snapshot"],
  ]) {
    const { data: appointments, error: ae } = await db
      .from("booking_journeys")
      .select("booking_id,revision")
      .eq("state", state)
      .is("appointment_reminder_sent_at", null)
      .eq(`${field}->>date`, nextLondonDay.toISOString().slice(0, 10))
      .order("booking_id", { ascending: true })
      .limit(5);
    if (ae)
      throw new JourneyError("Could not load appointment reminders.", 503);
    for (const j of appointments || []) {
      try {
        await perform(
          db,
          j.booking_id,
          { operation: "appointment_reminder", revision: j.revision },
          "worker",
        );
        results.push({
          id: j.booking_id,
          status: "appointment_reminder_queued",
        });
      } catch (error) {
        results.push({
          id: j.booking_id,
          status: "needs_review",
          error: error.message,
        });
      }
    }
  }
  const stale = new Date(now.getTime() - 10 * 60000).toISOString();
  const { data: messages, error: me } = await db
    .from("booking_journey_messages")
    .select("id,booking_id")
    .or(
      `and(status.in.(pending,failed),attempts.lt.5),and(status.eq.sending,claimed_at.lte.${stale})`,
    )
    .order("created_at", { ascending: true })
    .limit(20);
  if (me) throw new JourneyError("Could not load message retries.", 503);
  for (const m of messages || []) await deliver(db, m.booking_id, m.id);
  return { results };
}
