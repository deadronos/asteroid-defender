// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import OnboardingDialog from "./OnboardingDialog";

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

const renderDialog = (canStartFromOverlay: boolean) => {
  const onDismiss = vi.fn();
  const onStart = vi.fn();
  const { container } = render(
    <OnboardingDialog
      canStartFromOverlay={canStartFromOverlay}
      onDismiss={onDismiss}
      onStart={onStart}
    />,
  );
  return { onDismiss, onStart, backdrop: container.firstElementChild as HTMLElement };
};

describe("OnboardingDialog", () => {
  it("starts the run from the briefing", () => {
    const { onDismiss, onStart } = renderDialog(true);

    expect(screen.getByRole("dialog", { name: "How to play" })).toBeTruthy();
    expect(screen.getByText("Mission Brief")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start Defense (Enter)" }));

    expect(onStart).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("only closes when opened during play", () => {
    const { onDismiss, onStart } = renderDialog(false);

    fireEvent.click(screen.getByRole("button", { name: "Close Help" }));

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("closes from the ✕ button and the backdrop, but not from the card", () => {
    const { onDismiss, backdrop } = renderDialog(false);

    fireEvent.click(screen.getByRole("dialog", { name: "How to play" }));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close help" }));
    expect(onDismiss).toHaveBeenCalledOnce();

    fireEvent.click(backdrop);
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
