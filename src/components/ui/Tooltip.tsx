import { useState, ReactNode, ReactElement } from "react";
import "./Tooltip.css";

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  position?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({ content, children, position = "bottom" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="tooltip-wrapper"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`tooltip-content tooltip-${position}`} role="tooltip">
          {content}
        </div>
      )}
    </div>
  );
}
