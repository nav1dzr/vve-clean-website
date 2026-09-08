import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./api/_lib/fakeSupabase.js";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  client: vi.fn(),
  config: vi.fn(),
  exists: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("../api/_lib/adminAuth.js", () => ({
  verifyMediaAdminRequest: mocks.auth,
}));
vi.mock("../api/_lib/supabaseAdmin.js", () => ({
  getMediaServiceClient: mocks.client,
}));
vi.mock("../api/_lib/mediaConfig.js", () => ({
  getMediaConfig: mocks.config,
  originalExists: mocks.exists,
  createUploadUrl: mocks.upload,
  createDownloadUrl: vi.fn(),
  createImageDeliveryTemplate: vi.fn(
    () => "https://media.example/image/{width}/test.jpg",
  ),
  muxAuthHeader: () => "Basic test",
}));
import { mediaAssetHandler } from "../api/_lib/mediaAssetActions.js";
const A = "11111111-2222-3333-4444-555555555555",
  B = "22222222-2222-3333-4444-555555555555",
  T = "33333333-2222-3333-4444-555555555555";
const asset = (id, stage = "before") => ({
  id,
  media_type: "image",
  status: "ready",
  title: "Carpet cleaning",
  alt_text: "Carpet fibres",
  category: "carpet",
  before_after: stage,
  updated_at: "2026-09-08T10:00:00Z",
  website_visible: false,
  delivery_url: "https://example.test/{width}/photo.jpg",
});
let db;
async function call(body, method = "POST", id = A) {
  const raw = JSON.stringify(body);
  const req = {
    method,
    query: { id },
    headers: {},
    on(event, cb) {
      if (event === "data") cb(Buffer.from(raw));
      if (event === "end") cb();
    },
  };
  const res = {
    statusCode: 0,
    body: "",
    writeHead(status) {
      this.statusCode = status;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
  await mediaAssetHandler(req, res);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, admin: { id: A } });
  db = createFakeSupabase({
    media_assets: [asset(A), asset(B, "after")],
    media_gallery_slots: [
      { id: T, topic_key: "carpet", slot_kind: "before_after" },
    ],
    media_assignments: [],
    media_page_references: [
      {
        gallery_slot_id: T,
        active: true,
        reference_key: "carpet-one",
        page_key: "carpet-page",
        page_label: "Carpet service",
        component_label: "First pair",
      },
    ],
  });
  db.rpc = vi
    .fn()
    .mockResolvedValue({ data: { published: true }, error: null });
  mocks.client.mockReturnValue(db);
  mocks.config.mockReturnValue({});
});
const assignment = {
  action: "assign",
  targetType: "gallery",
  targetId: T,
  assignments: [
    { assetId: A, role: "before" },
    { assetId: B, role: "after" },
  ],
};
describe("authenticated atomic media publication", () => {
  it("rejects unauthenticated callers before storage access", async () => {
    mocks.auth.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorised",
    });
    expect((await call(assignment)).statusCode).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("rejects invalid asset IDs", async () => {
    expect(
      (await call(assignment, "POST", "------------------------------------"))
        .statusCode,
    ).toBe(400);
  });
  it("previews all uses without publishing or making assets visible", async () => {
    const result = await call({ ...assignment, preview: true });
    expect(result.statusCode).toBe(200);
    expect(result.body.impact[0].pageLabel).toBe("Carpet service");
    expect(result.body.expected).toEqual([]);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db._tables.media_assets.every((row) => !row.website_visible)).toBe(
      true,
    );
  });
  it("rejects half a pair and duplicate pair photos", async () => {
    expect(
      (
        await call({
          ...assignment,
          assignments: [assignment.assignments[0]],
          preview: true,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call({
          ...assignment,
          assignments: [
            { assetId: A, role: "before" },
            { assetId: A, role: "after" },
          ],
          preview: true,
        })
      ).statusCode,
    ).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("rejects a during photo labelled as an after result", async () => {
    db._tables.media_assets[1].before_after = "during";
    expect((await call({ ...assignment, preview: true })).statusCode).toBe(400);
  });
  it("requires ready media with actual captions", async () => {
    db._tables.media_assets[1].alt_text = "";
    expect((await call({ ...assignment, preview: true })).statusCode).toBe(409);
  });
  it("requires review and submits both replacements to one transaction", async () => {
    expect((await call(assignment)).statusCode).toBe(409);
    const result = await call({ ...assignment, confirm: true, expected: [] });
    expect(result.statusCode).toBe(200);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("publish_media_position", {
      p_target_type: "gallery",
      p_target_id: T,
      p_assignments: [
        { assetId: B, role: "after" },
        { assetId: A, role: "before" },
      ],
      p_expected: [],
      p_admin_id: A,
    });
  });
  it("does not overwrite a position changed by another staff member", async () => {
    db.rpc.mockResolvedValue({ error: { code: "40001" } });
    expect(
      (await call({ ...assignment, confirm: true, expected: [] })).statusCode,
    ).toBe(409);
    expect(db._tables.media_assignments).toEqual([]);
  });
  it("metadata does not change publication flags and rejects stale edits", async () => {
    expect(
      (
        await call(
          { title: "Caption", altText: "Description", updatedAt: "old" },
          "PATCH",
        )
      ).statusCode,
    ).toBe(409);
    const result = await call(
      {
        title: "Caption",
        altText: "Description",
        category: "carpet",
        beforeAfter: "before",
        updatedAt: asset(A).updated_at,
        websiteVisible: true,
      },
      "PATCH",
    );
    expect(result.statusCode).toBe(200);
    expect(db._tables.media_assets[0].website_visible).toBe(false);
  });
  it("does not relabel media used by a published pair", async () => {
    db._tables.media_assignments.push({
      asset_id: A,
      gallery_slot_id: T,
      media_role: "before",
    });
    expect(
      (
        await call(
          {
            title: "Caption",
            altText: "Description",
            category: "carpet",
            beforeAfter: "during",
            updatedAt: asset(A).updated_at,
          },
          "PATCH",
        )
      ).statusCode,
    ).toBe(409);
  });
  it("completed retries are idempotent and cannot overwrite a ready original", async () => {
    expect((await call({ action: "complete" })).statusCode).toBe(200);
    expect(mocks.config).not.toHaveBeenCalled();
    expect((await call({ action: "retry-upload" })).statusCode).toBe(409);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("keeps a failed transfer recoverable in the saved library", async () => {
    db._tables.media_assets[0].status = "uploading";
    expect((await call({ action: "fail" })).statusCode).toBe(200);
    expect(db._tables.media_assets[0].status).toBe("failed");
    expect(db._tables.media_assets[0].processing_error).toContain("retry");
  });
});
