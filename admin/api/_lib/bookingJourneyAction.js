import { verifyAdminRequest } from "./adminAuth.js";
import { getServiceClient } from "./supabaseAdmin.js";
import { extractIdParam } from "./routeParams.js";
import { isValidUuid } from "./normalise.js";
import { readJsonBody } from "./body.js";
import {
  journeyAdminView,
  performAdminAction,
  JourneyError,
} from "./bookingJourney.js";

export async function handleBookingJourney(req, res, headers) {
  const send = (status, body) => {
    res.writeHead(status, headers);
    return res.end(JSON.stringify(body));
  };
  if (!["GET", "POST"].includes(req.method))
    return send(405, { error: "Method not allowed" });
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return send(auth.status, { error: auth.error });
  const id = extractIdParam(req);
  if (!isValidUuid(id)) return send(400, { error: "Invalid booking id" });
  const db = getServiceClient();
  if (!db) return send(503, { error: "Server misconfiguration" });
  try {
    let result;
    if (req.method === "POST") {
      const body = await readJsonBody(req, 32 * 1024);
      if (body.operation === "preview") {
        const view = await journeyAdminView(db, id, {
          holdUntil: body.holdUntil,
        });
        if (!view.journey || view.journey.revision !== body.revision)
          throw new JourneyError(
            "This booking changed. Reload before previewing.",
            409,
          );
        return send(200, view);
      }
      result = await performAdminAction(db, id, body, `admin:${auth.admin.id}`);
    }
    return send(200, {
      ...(await journeyAdminView(db, id)),
      ...(result ? { deliveries: result.deliveries } : {}),
    });
  } catch (error) {
    return send(error instanceof JourneyError ? error.status : 503, {
      error:
        error instanceof JourneyError
          ? error.message
          : "Could not complete this booking action.",
    });
  }
}
