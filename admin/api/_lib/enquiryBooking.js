import { createManualBooking } from './customerLifecycle.js';
import { isValidDateString, isValidUuid } from './normalise.js';

const roles = ['tenant', 'payer', 'agent'];
const reject = (status, error) => ({ ok: false, status, error });

export async function readEnquiryBooking(db, enquiryId) {
  const { data, error } = await db.from('bookings').select('id, booking_ref, quote_config').eq('id', enquiryId).maybeSingle();
  if (error) return reject(503, 'Could not check for an existing booking draft. Try again.');
  if (!data) return { ok: true, booking: null };
  if (data.quote_config?.sourceEnquiryId !== enquiryId) return reject(409, 'This enquiry cannot be linked automatically. Check the booking history.');
  return { ok: true, booking: { id: data.id, reference: data.booking_ref } };
}

export async function createBookingFromEnquiry(db, customerId, input, adminId) {
  const id = input?.enquiryId;
  if (!isValidUuid(id) || input.requestId !== id
    || typeof input.expectedEnquiryUpdatedAt !== 'string'
    || !Number.isFinite(Date.parse(input.expectedEnquiryUpdatedAt))
    || !['after_clean', 'deposit_after_agreement'].includes(input.paymentPlan)) {
    return reject(400, 'Reload the enquiry and choose the payment arrangement before saving.');
  }
  const saved = await readEnquiryBooking(db, id);
  if (!saved.ok) return saved;
  if (saved.booking) return { ok: true, bookingId: saved.booking.id, bookingRef: saved.booking.reference, alreadyExisted: true };

  const { data: enquiry, error } = await db.from('contact_enquiries')
    .select('id, updated_at').eq('id', id).maybeSingle();
  if (error) return reject(503, 'Could not check the enquiry. Retry the same draft.');
  if (!enquiry) return reject(404, 'The source enquiry was not found.');
  if (enquiry.updated_at !== input.expectedEnquiryUpdatedAt) {
    return reject(412, 'The enquiry changed. Close this draft and reopen it from the latest enquiry.');
  }

  if ((input.serviceDate != null && !isValidDateString(input.serviceDate))
    || (input.totalPrice != null && (typeof input.totalPrice !== 'number' || !Number.isFinite(input.totalPrice)
      || input.totalPrice < 0 || input.totalPrice > 500000))
    || (input.address != null && (typeof input.address !== 'string' || input.address.length > 500))
    || (input.postcode != null && (typeof input.postcode !== 'string' || input.postcode.length > 12))
    || (input.notes != null && (typeof input.notes !== 'string' || input.notes.length > 5000))) {
    return reject(400, 'Check the date, price, cleaning address and notes before saving.');
  }
  const contactRoles = {};
  const requestedRoles = input.contactRoles;
  if (requestedRoles !== undefined) {
    if (!requestedRoles || typeof requestedRoles !== 'object' || Array.isArray(requestedRoles)
      || Object.keys(requestedRoles).some((role) => !roles.includes(role))) {
      return reject(400, 'Choose valid booking contact roles.');
    }
    for (const role of roles) {
      if (requestedRoles[role] === undefined) continue;
      if (!isValidUuid(requestedRoles[role])) return reject(400, 'Choose a saved customer for each selected role.');
      contactRoles[role] = requestedRoles[role];
    }
    const ids = [...new Set(Object.values(contactRoles))];
    if (ids.length) {
      const contacts = await db.from('customers').select('id').in('id', ids);
      if (contacts.error) return reject(503, 'Could not check the booking contacts. Retry the same draft.');
      if (contacts.data?.length !== ids.length) return reject(400, 'A selected contact is no longer available. Choose the contact again.');
    }
  }

  // Reuse the enquiry UUID as the unique booking ID. A concurrent attempt can
  // only open the saved booking, even if a second admin chose different details.
  const result = await createManualBooking(db, customerId, {
    requestId: id, service: input.service, serviceDate: input.serviceDate,
    arrivalWindow: input.arrivalWindow, totalPrice: input.totalPrice,
    notes: input.notes, paymentPlan: input.paymentPlan, email: input.email,
    address: input.address?.trim(), postcode: input.postcode?.trim().toUpperCase(),
  }, adminId, { id, contactRoles });
  if (!result.ok && [409, 503].includes(result.status)) {
    const concurrent = await readEnquiryBooking(db, id);
    if (concurrent.ok && concurrent.booking) {
      return { ok: true, bookingId: concurrent.booking.id, bookingRef: concurrent.booking.reference, alreadyExisted: true };
    }
  }
  return result;
}
