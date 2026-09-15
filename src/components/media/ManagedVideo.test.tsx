import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ManagedVideo from "./ManagedVideo";

describe("managed video loading", () => {
  it("does not create an external player until Play is selected", () => {
    const { container } = render(
      <ManagedVideo
        playerUrl="https://player.mux.com/test"
        poster="/poster.jpg"
        title="Carpet extraction"
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Play Carpet extraction" }),
    );
    const url = new URL(screen.getByTitle("Carpet extraction").getAttribute("src")!);
    expect(url.origin + url.pathname).toBe("https://player.mux.com/test");
    expect(url.searchParams.get("muted")).toBe("true");
  });
});
