import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MediaManagerPage from "./MediaManagerPage";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), upload: vi.fn() }));
vi.mock("../lib/authFetch", () => ({ authFetch: mocks.fetch }));
vi.mock("../lib/mediaUpload", () => ({ uploadMediaFile: mocks.upload }));
const library = {
  assets: [],
  assignedAssets: [],
  topics: [],
  gallerySlots: [],
  websiteSlots: [],
  references: [],
  nextPage: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockImplementation(async (_url, init) =>
    init
      ? {
          id: "11111111-2222-3333-4444-555555555555",
          uploadUrl: "https://upload.example",
        }
      : library,
  );
});
describe("media manager recovery", () => {
  it("retains a useful upload failure after refreshing the library", async () => {
    mocks.upload.mockRejectedValue(
      new Error("Connection interrupted. Retry this file."),
    );
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Choose a shared position" });
    fireEvent.click(screen.getByRole("button", { name: "Upload & library" }));
    fireEvent.change(screen.getByLabelText("Photos or videos"), {
      target: {
        files: [new File(["photo"], "carpet.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Upload selected files" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection interrupted",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Upload selected files" }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Retry this file");
    expect(mocks.fetch).toHaveBeenCalledWith(
      expect.stringContaining("&id="),
      expect.objectContaining({ body: JSON.stringify({ action: "fail" }) }),
    );
  });
});
