import { verifyMediaAdminRequest } from "../_lib/adminAuth.js";
import { corsHeaders } from "../_lib/cors.js";
import { readJsonBody } from "../_lib/body.js";
import { getMediaServiceClient } from "../_lib/supabaseAdmin.js";
import {
  createDownloadUrl,
  createImageDeliveryTemplate,
  getMediaConfig,
  muxAuthHeader,
  originalExists,
  createUploadUrl,
} from "../_lib/mediaConfig.js";
import {
  normaliseMetadata,
  toMediaSummary,
  validMediaUuid,
} from "../_lib/mediaFields.js";
import {
  MEDIA_ASSETS_TABLE,
  MEDIA_ASSIGNMENTS_TABLE,
  MEDIA_GALLERY_SLOTS_TABLE,
  MEDIA_REFERENCES_TABLE,
  MEDIA_WEBSITE_SLOTS_TABLE,
} from "../_lib/mediaTables.js";

export const config = { api: { bodyParser: false } };
const MAX_BODY_BYTES = 16 * 1024;

export async function mediaAssetHandler(req, res) {
  const headers = {
    ...corsHeaders(req.headers.origin || ""),
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    return res.end();
  }
  if (!["POST", "PATCH"].includes(req.method)) {
    res.writeHead(405, headers);
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
  const auth = await verifyMediaAdminRequest(req);
  if (!auth.ok) {
    res.writeHead(auth.status, headers);
    return res.end(JSON.stringify({ error: auth.error }));
  }
  const supabase = getMediaServiceClient();
  if (!supabase) {
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: "Server misconfiguration" }));
  }
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!validMediaUuid(id)) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: "Invalid media item." }));
  }
  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch {
    res.writeHead(400, headers);
    return res.end(
      JSON.stringify({ error: "The request details were invalid." }),
    );
  }
  try {
    const { data: asset, error } = await supabase
      .from(MEDIA_ASSETS_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !asset) {
      res.writeHead(404, headers);
      return res.end(JSON.stringify({ error: "Media item not found." }));
    }
    if (req.method === "PATCH")
      return await updateMetadata(res, headers, supabase, asset, body);
    if (body.action === "complete")
      return await completeUpload(res, headers, supabase, asset);
    if (body.action === "sync")
      return await syncVideo(res, headers, supabase, asset);
    if (body.action === "retry-upload")
      return await retryUpload(res, headers, supabase, asset);
    if (body.action === "fail")
      return await failUpload(res, headers, supabase, asset);
    if (body.action === "archive" || body.action === "restore")
      return await archiveAsset(
        res,
        headers,
        supabase,
        asset,
        body,
        auth.admin.id,
      );
    if (body.action === "history")
      return await positionHistory(res, headers, supabase, body);
    if (body.action === "assign")
      return await assignMedia(
        res,
        headers,
        supabase,
        asset,
        body,
        auth.admin.id,
      );
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: "Unknown media action." }));
  } catch (error) {
    console.error("[admin/media] item route failed:", error?.message);
    res.writeHead(500, headers);
    return res.end(
      JSON.stringify({ error: "Could not update that media item." }),
    );
  }
}

async function updateMetadata(res, headers, supabase, asset, body) {
  if (typeof body.updatedAt !== "string" || body.updatedAt !== asset.updated_at)
    return reply(res, headers, 409, {
      error: "This media changed. Refresh before editing it.",
    });
  const fields = normaliseMetadata(body);
  if (!fields.title || !fields.altText)
    return reply(res, headers, 400, {
      error: "Add a visible caption and an accessibility description.",
    });
  if (
    fields.category !== asset.category ||
    fields.beforeAfter !== asset.before_after
  ) {
    const { data: uses, error: usesError } = await supabase
      .from(MEDIA_ASSIGNMENTS_TABLE)
      .select("id")
      .eq("asset_id", asset.id);
    if (usesError) throw usesError;
    if (uses?.length)
      return reply(res, headers, 409, {
        error:
          "Replace this media in its published positions before changing its service or stage.",
      });
  }
  const { data: updated, error } = await supabase
    .from(MEDIA_ASSETS_TABLE)
    .update({
      title: fields.title,
      alt_text: fields.altText,
      service: fields.service,
      category: fields.category,
      before_after: fields.beforeAfter,
      pair_key: fields.pairKey,
      location_label: fields.locationLabel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", asset.id)
    .eq("updated_at", body.updatedAt)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!updated)
    return reply(res, headers, 409, {
      error: "This media changed. Refresh before editing it.",
    });
  return reply(res, headers, 200, { asset: toMediaSummary(updated, []) });
}

function reply(res, headers, status, body) {
  res.writeHead(status, headers);
  return res.end(JSON.stringify(body));
}

async function retryUpload(res, headers, supabase, asset) {
  if (
    !["uploading", "failed"].includes(asset.status) ||
    asset.mux_asset_id ||
    asset.delivery_url
  )
    return reply(res, headers, 409, {
      error:
        "This original is already processed. Upload a new file to replace it.",
    });
  const mediaConfig = getMediaConfig(asset.media_type);
  if (!mediaConfig)
    return reply(res, headers, 503, {
      error: "Hosting for this media type is not configured.",
    });
  if (await originalExists(mediaConfig, asset.r2_key, asset))
    return reply(res, headers, 200, { id: asset.id, alreadyStored: true });
  const uploadUrl = await createUploadUrl(
    mediaConfig,
    asset.r2_key,
    asset.original_content_type,
  );
  const { error } = await supabase
    .from(MEDIA_ASSETS_TABLE)
    .update({
      status: "uploading",
      processing_error: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", asset.id);
  if (error) throw error;
  return reply(res, headers, 200, {
    id: asset.id,
    uploadUrl,
    expiresInSeconds: 900,
  });
}

async function failUpload(res, headers, supabase, asset) {
  if (asset.status === "uploading")
    await markFailed(
      supabase,
      asset.id,
      "Transfer interrupted. Choose the same file and retry, or check whether the original finished uploading.",
    );
  return reply(res, headers, 200, { saved: true });
}

async function archiveAsset(res, headers, supabase, asset, body, adminId) {
  const { error } = await supabase.rpc("archive_media_asset", {
    p_asset_id: asset.id,
    p_admin_id: adminId,
    p_restore: body.action === "restore",
  });
  if (error)
    return reply(res, headers, 409, {
      error:
        "Replace all uses before archiving. Only completed media can be archived or restored.",
    });
  return reply(res, headers, 200, { saved: true });
}

async function positionHistory(res, headers, supabase, body) {
  if (
    !validMediaUuid(body.targetId) ||
    !["gallery", "website"].includes(body.targetType)
  )
    return reply(res, headers, 400, { error: "Choose a valid position." });
  const { data, error } = await supabase
    .from("media_publication_history")
    .select("id, previous_assignments, created_at")
    .eq("target_type", body.targetType)
    .eq("target_id", body.targetId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return reply(res, headers, 200, { history: data || [] });
}

async function completeUpload(res, headers, supabase, asset) {
  if (["ready", "processing"].includes(asset.status))
    return reply(res, headers, 200, { asset: toMediaSummary(asset, []) });
  if (!["uploading", "failed"].includes(asset.status)) {
    res.writeHead(409, headers);
    return res.end(
      JSON.stringify({
        error: "This upload has already been handed off for processing.",
      }),
    );
  }
  const mediaConfig = getMediaConfig(asset.media_type);
  if (!mediaConfig) {
    res.writeHead(503, headers);
    return res.end(
      JSON.stringify({ error: "Media hosting is not configured yet." }),
    );
  }
  if (asset.media_type === "image") {
    if (!(await originalExists(mediaConfig, asset.r2_key, asset))) {
      await markFailed(
        supabase,
        asset.id,
        "The private R2 original was not found after upload.",
      );
      res.writeHead(422, headers);
      return res.end(
        JSON.stringify({
          error:
            "The private original was not found after upload. Please upload the photo again.",
        }),
      );
    }
    const deliveryUrl = createImageDeliveryTemplate(
      mediaConfig,
      asset.id,
      asset.r2_key,
    );
    const delivery = await fetch(deliveryUrl.replace("{width}", "480"), {
      signal: AbortSignal.timeout(12000),
    });
    if (
      !delivery.ok ||
      !delivery.headers.get("content-type")?.startsWith("image/")
    ) {
      await markFailed(
        supabase,
        asset.id,
        "The original is stored, but photo delivery failed. Retry processing after checking image hosting.",
      );
      return reply(res, headers, 422, {
        error:
          "Photo uploaded but could not be displayed. Check image hosting, then retry processing.",
      });
    }
    await delivery.body?.cancel();
    const { data: updated, error } = await supabase
      .from(MEDIA_ASSETS_TABLE)
      .update({
        status: "ready",
        // The immutable R2 key is reconstructed only inside the Cloudflare
        // Worker. A new upload never overwrites a live image, so a slot swap
        // remains an atomic metadata change and cached old imagery cannot win.
        delivery_url: createImageDeliveryTemplate(
          mediaConfig,
          asset.id,
          asset.r2_key,
        ),
        ready_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        processing_error: "",
      })
      .eq("id", asset.id)
      .select("*")
      .single();
    if (error) throw error;
    res.writeHead(200, headers);
    return res.end(JSON.stringify({ asset: toMediaSummary(updated, []) }));
  }

  if (!(await originalExists(mediaConfig, asset.r2_key, asset)))
    return reply(res, headers, 422, {
      error: "The complete original was not found. Retry this upload.",
    });
  // An atomic claim prevents repeated Complete clicks creating two Mux assets.
  const { data: claimed, error: claimError } = await supabase
    .from(MEDIA_ASSETS_TABLE)
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", asset.id)
    .in("status", ["uploading", "failed"])
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return reply(res, headers, 202, { status: "processing" });
  const sourceUrl = await createDownloadUrl(mediaConfig, asset.r2_key);
  const response = await fetch("https://api.mux.com/video/v1/assets", {
    method: "POST",
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: muxAuthHeader(mediaConfig),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [{ url: sourceUrl }],
      playback_policies: ["public"],
      video_quality: "plus",
      passthrough: asset.id,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.data?.id) {
    await markFailed(
      supabase,
      asset.id,
      "Mux could not start processing this video.",
    );
    res.writeHead(422, headers);
    return res.end(
      JSON.stringify({
        error:
          "Mux could not start processing this video. Check the video format and try again.",
      }),
    );
  }
  const { data: updated, error } = await supabase
    .from(MEDIA_ASSETS_TABLE)
    .update({
      status: "processing",
      mux_asset_id: payload.data.id,
      updated_at: new Date().toISOString(),
      processing_error: "",
    })
    .eq("id", asset.id)
    .select("*")
    .single();
  if (error) throw error;
  res.writeHead(202, headers);
  return res.end(JSON.stringify({ asset: toMediaSummary(updated, []) }));
}

async function syncVideo(res, headers, supabase, asset) {
  if (asset.media_type !== "video" || asset.status !== "processing") {
    res.writeHead(409, headers);
    return res.end(
      JSON.stringify({
        error: "This item is not waiting for video processing.",
      }),
    );
  }
  const mediaConfig = getMediaConfig(asset.media_type);
  if (!mediaConfig) {
    res.writeHead(503, headers);
    return res.end(
      JSON.stringify({ error: "Media hosting is not configured yet." }),
    );
  }
  if (!asset.mux_asset_id) {
    // Recover an accepted Mux create whose response was lost, without another
    // create request. The original remains stored and unpublished throughout.
    const recent = await fetch(
      "https://api.mux.com/video/v1/assets?limit=100",
      {
        headers: { Authorization: muxAuthHeader(mediaConfig) },
        signal: AbortSignal.timeout(12000),
      },
    );
    const payload = await recent.json();
    if (!recent.ok) throw new Error("Could not check video processing");
    const recovered = payload.data?.find(
      (entry) => entry.passthrough === asset.id,
    );
    if (!recovered) {
      const { error } = await supabase
        .from(MEDIA_ASSETS_TABLE)
        .update({
          processing_error:
            "Video handoff could not yet be verified. No duplicate processing request will be sent. Refresh processing, or ask support to check this original.",
        })
        .eq("id", asset.id);
      if (error) throw error;
      return reply(res, headers, 202, { status: "processing" });
    }
    const { error } = await supabase
      .from(MEDIA_ASSETS_TABLE)
      .update({ mux_asset_id: recovered.id, processing_error: "" })
      .eq("id", asset.id);
    if (error) throw error;
    asset = { ...asset, mux_asset_id: recovered.id };
  }
  const response = await fetch(
    `https://api.mux.com/video/v1/assets/${asset.mux_asset_id}`,
    {
      headers: { Authorization: muxAuthHeader(mediaConfig) },
      signal: AbortSignal.timeout(12000),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.data) throw new Error("Mux asset lookup failed");
  if (payload.data.status === "errored") {
    await markFailed(supabase, asset.id, "Mux could not process this video.");
    res.writeHead(422, headers);
    return res.end(
      JSON.stringify({
        error:
          "Mux could not process this video. The original remains safely stored in R2.",
      }),
    );
  }
  if (payload.data.status !== "ready") {
    res.writeHead(202, headers);
    return res.end(JSON.stringify({ status: "processing" }));
  }
  const playbackId = payload.data.playback_ids?.find(
    (entry) => entry.policy === "public",
  )?.id;
  if (!playbackId) throw new Error("Mux ready asset has no public playback ID");
  const { data: updated, error } = await supabase
    .from(MEDIA_ASSETS_TABLE)
    .update({
      status: "ready",
      mux_playback_id: playbackId,
      ready_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      processing_error: "",
    })
    .eq("id", asset.id)
    .select("*")
    .single();
  if (error) throw error;
  res.writeHead(200, headers);
  return res.end(JSON.stringify({ asset: toMediaSummary(updated, []) }));
}

function sortedAssignments(rows) {
  return [...rows]
    .map((row) => ({
      assetId: row.assetId || row.asset_id,
      role: row.role || row.media_role,
    }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

async function assignMedia(res, headers, supabase, asset, body, adminId) {
  if (
    !["gallery", "website"].includes(body.targetType) ||
    !validMediaUuid(body.targetId)
  )
    return reply(res, headers, 400, { error: "Choose a valid position." });
  const targetColumn =
    body.targetType === "gallery" ? "gallery_slot_id" : "website_slot_id";
  const { data: target, error: targetError } = await supabase
    .from(
      body.targetType === "gallery"
        ? MEDIA_GALLERY_SLOTS_TABLE
        : MEDIA_WEBSITE_SLOTS_TABLE,
    )
    .select("*")
    .eq("id", body.targetId)
    .maybeSingle();
  if (targetError || !target)
    return reply(res, headers, 404, { error: "Position not found." });
  const { data: current, error: currentError } = await supabase
    .from(MEDIA_ASSIGNMENTS_TABLE)
    .select("asset_id,media_role")
    .eq(targetColumn, body.targetId);
  if (currentError) throw currentError;
  let selections = body.assignments;
  if (body.historyId) {
    if (!validMediaUuid(body.historyId))
      return reply(res, headers, 400, { error: "Invalid history item." });
    const { data: history, error } = await supabase
      .from("media_publication_history")
      .select("previous_assignments")
      .eq("id", body.historyId)
      .eq("target_type", body.targetType)
      .eq("target_id", body.targetId)
      .maybeSingle();
    if (error || !history)
      return reply(res, headers, 404, { error: "History item not found." });
    selections = history.previous_assignments;
  }
  if (
    !Array.isArray(selections) ||
    selections.length !== (target.slot_kind === "before_after" ? 2 : 1) ||
    selections.some(
      (row) =>
        !validMediaUuid(row.assetId) ||
        !["before", "after", "primary"].includes(row.role),
    )
  )
    return reply(res, headers, 400, {
      error:
        "Select the complete position, including both photographs for a pair.",
    });
  const next = sortedAssignments(selections);
  if (
    target.slot_kind === "before_after"
      ? next[0].role !== "after" ||
        next[1].role !== "before" ||
        next[0].assetId === next[1].assetId
      : next[0].role !== "primary"
  )
    return reply(res, headers, 400, { error: "Check the position roles." });
  const { data: chosen, error: chosenError } = await supabase
    .from(MEDIA_ASSETS_TABLE)
    .select("*")
    .in(
      "id",
      next.map((row) => row.assetId),
    );
  if (chosenError) throw chosenError;
  const category =
    target.topic_key === "sofa" ? "sofa-upholstery" : target.topic_key;
  if (
    chosen?.length !== next.length ||
    chosen.some(
      (row) =>
        row.status !== "ready" ||
        !row.title ||
        !row.alt_text ||
        (category && row.category !== category),
    )
  )
    return reply(res, headers, 409, {
      error:
        "Choose ready media for this service with a caption and accessibility description.",
    });
  if (
    chosen.some(
      (row) =>
        (target.slot_kind === "video" && row.media_type !== "video") ||
        (["photo", "before_after"].includes(target.slot_kind) &&
          row.media_type !== "image") ||
        (target.slot_kind === "before_after" &&
          row.before_after !==
            next.find((entry) => entry.assetId === row.id)?.role),
    )
  )
    return reply(res, headers, 400, {
      error: "Check each file type and its before/after stage.",
    });
  const { data: references, error: referencesError } = await supabase
    .from(MEDIA_REFERENCES_TABLE)
    .select("reference_key,page_key,page_label,component_label")
    .eq(targetColumn, body.targetId)
    .eq("active", true)
    .order("sort_order");
  if (referencesError) throw referencesError;
  const expected = sortedAssignments(current || []);
  const impact = (references || []).map((row) => ({
    key: row.reference_key,
    pageKey: row.page_key,
    pageLabel: row.page_label,
    componentLabel: row.component_label,
  }));
  if (body.preview === true)
    return reply(res, headers, 200, {
      replacement: expected.length > 0,
      expected,
      impact,
      selections: next,
      assets: chosen.map((row) => toMediaSummary(row, [])),
    });
  if (body.confirm !== true || !Array.isArray(body.expected))
    return reply(res, headers, 409, {
      error: "Review the affected pages before publishing.",
    });
  const { data, error } = await supabase.rpc("publish_media_position", {
    p_target_type: body.targetType,
    p_target_id: body.targetId,
    p_assignments: next,
    p_expected: sortedAssignments(body.expected),
    p_admin_id: adminId,
  });
  if (error)
    return reply(res, headers, error.code === "40001" ? 409 : 422, {
      error:
        error.code === "40001"
          ? "This position changed. Review it again before publishing."
          : "Publication did not complete. Check the selected media and the media migration.",
    });
  return reply(res, headers, 200, { ...data, impact });
}

async function markFailed(supabase, assetId, message) {
  const { error } = await supabase
    .from(MEDIA_ASSETS_TABLE)
    .update({
      status: "failed",
      processing_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId);
  if (error)
    console.error("[admin/media] failed status write failed:", error.code);
}
