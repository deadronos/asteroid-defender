import type { CSSProperties, ReactNode } from "react";
import { fullscreenOverlay } from "./hudStyles";

interface OverlayBackdropProps {
  children: ReactNode;
  backgroundColor: string;
  zIndex: number;
  onClick?: () => void;
  style?: CSSProperties;
}

export default function OverlayBackdrop({
  children,
  backgroundColor,
  zIndex,
  onClick,
  style,
}: OverlayBackdropProps) {
  return (
    <div
      onClick={onClick}
      style={{
        ...fullscreenOverlay,
        backgroundColor,
        zIndex,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
