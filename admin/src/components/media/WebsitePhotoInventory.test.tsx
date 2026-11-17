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
    fireEvent.click(hero.getByRole("button", { name: "Manage this position" }));
    expect(onReplaceWebsite).toHaveBeenCalledTimes(1);
    expect(onReplaceWebsite).toHaveBeenCalledWith(library.websiteSlots[0]);
    const serviceCard = within(screen.getByRole("article", { name: /Homepage · Service card · Carpet cleaning/ }));
    expect(serviceCard.queryByRole("button")).not.toBeInTheDocument();
    expect(serviceCard.getByText(/Website edit needed/)).toBeInTheDocument();
  });

  it("filters full built-in galleries and makes video playback an explicit action", () => {
    render(<WebsitePhotoInventory library={library} assets={new Map()} onReplaceGallery={vi.fn()} onReplaceWebsite={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Website page"), { target: { value: "Gallery" } });
    const clip = within(screen.getByRole("article", { name: /Gallery · Carpet cleaning · Cleaning videos · Stair carpet/ }));
    expect(clip.queryByLabelText("Stair carpet, tread by tread")).not.toBeInTheDocument();
    fireEvent.click(clip.getByRole("button", { name: "Preview this video" }));
    expect(clip.getByLabelText("Stair carpet, tread by tread")).toHaveAttribute("src", "https://www.vveclean.co.uk/carpet/video/web/carpet-1.mp4");
    expect(clip.getByLabelText("Stair carpet, tread by tread")).toHaveAttribute("controls");
  });

  it("explains absent builders photography without displaying empty photo placeholders", () => {
    render(<WebsitePhotoInventory library={library} assets={new Map()} onReplaceGallery={vi.fn()} onReplaceWebsite={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Website page"), { target: { value: "After builders" } });
    expect(screen.getByText(/empty photo sections stay hidden/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not call a service hero code-managed when publishing the first service result can replace it", () => {
    render(<WebsitePhotoInventory library={library} assets={new Map()} onReplaceGallery={vi.fn()} onReplaceWebsite={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Website page"), { target: { value: "Carpet cleaning" } });
    const hero = within(screen.getByRole("article", { name: /Carpet cleaning · Opening photograph/ }));
    expect(hero.getByText(/Choose a first service result in Shared gallery positions/)).toBeInTheDocument();
    expect(hero.queryByText(/Website edit needed/)).not.toBeInTheDocument();
  });
});
