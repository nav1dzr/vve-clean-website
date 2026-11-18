import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WebsitePhotoInventory from "./WebsitePhotoInventory";
import type { MediaLibrary } from "../../types/media";

const library: MediaLibrary = { assets: [], topics: [], gallerySlots: [], websiteSlots: [{ id: "hero", key: "homepage-hero", pageLabel: "Homepage", purposeLabel: "Hero", description: "", sortOrder: 1, assignments: [], usages: [{ key: "home-hero", pageKey: "homepage-hero-image", pageLabel: "Homepage", componentLabel: "Hero" }] }], references: [] };

describe("website media page browser", () => {
  it("shows built-in photos and opens the exact supported position without pretending static cards are editable", () => {
    const onReplaceWebsite = vi.fn();
    render(<WebsitePhotoInventory library={library} assets={new Map()} onReplaceGallery={vi.fn()} onReplaceWebsite={onReplaceWebsite} />);
    const hero = within(screen.getByRole("article", { name: /Homepage · Opening slideshow · Carpet cleaning/ }));
    expect(hero.getByRole("img")).toHaveAttribute("src", "https://www.vveclean.co.uk/images/carpet-cleaning-hero.webp");
    fireEvent.click(hero.getByRole("button", { name: /Change photo: Homepage/ }));
    expect(onReplaceWebsite).toHaveBeenCalledTimes(1);
    expect(onReplaceWebsite).toHaveBeenCalledWith(library.websiteSlots[0]);
    const serviceCard = within(screen.getByRole("article", { name: /Homepage · Service card · Carpet cleaning/ }));
    expect(serviceCard.queryByRole("button")).not.toBeInTheDocument();
    expect(serviceCard.getByText(/Setup needed to change this/)).toBeInTheDocument();
  });

  it("filters full built-in galleries and makes video playback an explicit action", () => {
    render(<WebsitePhotoInventory library={library} assets={new Map()} onReplaceGallery={vi.fn()} onReplaceWebsite={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Website page"), { target: { value: "Gallery" } });
    fireEvent.change(screen.getByLabelText("Find a photo or video"), { target: { value: "Stair carpet, tread by tread" } });
    const clip = within(screen.getByRole("article", { name: /Gallery · Carpet cleaning · Cleaning videos · Stair carpet/ }));
    expect(clip.queryByLabelText("Stair carpet, tread by tread")).not.toBeInTheDocument();
    fireEvent.click(clip.getByRole("button", { name: "Play video: Stair carpet, tread by tread" }));
    expect(clip.getByLabelText("Stair carpet, tread by tread")).toHaveAttribute("src", "https://www.vveclean.co.uk/carpet/video/web/carpet-1.mp4");
    expect(clip.getByLabelText("Stair carpet, tread by tread")).toHaveAttribute("controls");
  });

  it("shows empty builders positions without pretending there are published photos", () => {
    render(<WebsitePhotoInventory library={library} assets={new Map()} onReplaceGallery={vi.fn()} onReplaceWebsite={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Website page"), { target: { value: "After builders" } });
    expect(screen.getAllByText("Empty").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ready for your first/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not offer a replacement when that named service position is not configured", () => {
    render(<WebsitePhotoInventory library={library} assets={new Map()} onReplaceGallery={vi.fn()} onReplaceWebsite={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Website page"), { target: { value: "Carpet cleaning" } });
    const hero = within(screen.getByRole("article", { name: /Carpet cleaning · Opening photograph/ }));
    expect(hero.getByText(/Setup needed to change this/)).toBeInTheDocument();
    expect(hero.queryByRole("button")).not.toBeInTheDocument();
  });

  it("starts with only page and search controls, then combines and clears optional filters", () => {
    render(<WebsitePhotoInventory library={library} assets={new Map()} onReplaceGallery={vi.fn()} onReplaceWebsite={vi.fn()} />);
    expect(screen.getByLabelText("Website page")).toHaveValue("Homepage");
    expect(screen.getByText("More filters").closest("details")).not.toHaveAttribute("open");
    fireEvent.change(screen.getByLabelText("Website page"), { target: { value: "Gallery" } });
    fireEvent.click(screen.getByText("More filters"));
    fireEvent.change(screen.getByLabelText("Media type"), { target: { value: "video" } });
    expect(screen.getAllByRole("button", { name: /^Play video:/ }).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Media source"), { target: { value: "crm" } });
    expect(screen.getByText("No matching media")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Website page")).toHaveValue("Gallery");
    expect(screen.getByLabelText("Media type")).toHaveValue("all");
    expect(screen.getByLabelText("Media source")).toHaveValue("all");
    fireEvent.change(screen.getByLabelText("Find a photo or video"), { target: { value: "no-such-caption" } });
    expect(screen.getByText("No matching media")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Find a photo or video")).toHaveValue("");
    expect(screen.queryByText("No matching media")).not.toBeInTheDocument();
  });

  it("loads more cards only on request and resets the page limit for a new search", () => {
    render(<WebsitePhotoInventory library={library} assets={new Map()} onReplaceGallery={vi.fn()} onReplaceWebsite={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Website page"), { target: { value: "Gallery" } });
    expect(screen.getAllByRole("article")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Show more photos & videos" }));
    expect(screen.getAllByRole("article")).toHaveLength(24);
    fireEvent.change(screen.getByLabelText("Find a photo or video"), { target: { value: "Carpet" } });
    expect(screen.getAllByRole("article").length).toBeLessThanOrEqual(12);
  });
});
