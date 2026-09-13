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
  const { data: due, error } = await db
    .from("booking_journeys")
    .select("booking_id,revision,state,hold_until")
    .eq("state", "offered")
    .lte("hold_until", now.toISOString())
    .order("hold_until", { ascending: true })
    .limit(10);
  if (error) throw new JourneyError("Could not load due holds.", 503);
  for (const j of due || []) {
    try {
      await perform(
        db,
        j.booking_id,
        { operation: "expire", revision: j.revision },
        "worker",
      );
      results.push({ id: j.booking_id, status: "expired" });
    } catch (error) {
      results.push({
        id: j.booking_id,
        status: "needs_review",
        error: error.message,
      });
    }
  }
  // A per-offer marker is cleared on Send and set in the same transaction as
  // the reminder outbox. Already-reminded rows cannot starve later bookings.
  const { data: reminders, error: re } = await db
    .from("booking_journeys")
    .select("booking_id,revision,offer_version,hold_until")
    .eq("state", "offered")
    .is("reminder_sent_at", null)
    .gt("hold_until", new Date(now.getTime() + 31 * 60000).toISOString())
    .lte("hold_until", new Date(now.getTime() + 24 * 3600000).toISOString())
    .order("hold_until", { ascending: true })
    .limit(10);
  if (re) throw new JourneyError("Could not load deposit reminders.", 503);
  for (const j of reminders || []) {
    try {
      await perform(
        db,
        j.booking_id,
        { operation: "remind", revision: j.revision },
        "worker",
      );
      results.push({ id: j.booking_id, status: "reminder_queued" });
    } catch (error) {
      results.push({
        id: j.booking_id,
        status: "needs_review",
        error: error.message,
      });
    }
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
