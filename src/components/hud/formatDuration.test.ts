import { describe, expect, it } from "vite-plus/test";
import { formatDuration } from "./formatDuration";

describe("formatDuration", () => {
  it("should return '0:00' for zero input", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("should return '0:00' for negative input", () => {
    expect(formatDuration(-1000)).toBe("0:00");
  });

  it("should return '0:00' for values less than a second", () => {
    expect(formatDuration(500)).toBe("0:00");
  });

  it("should return '0:01' for exactly one second (1000 ms)", () => {
    expect(formatDuration(1000)).toBe("0:01");
  });

  it("should return '1:00' for exactly one minute (60000 ms)", () => {
    expect(formatDuration(60000)).toBe("1:00");
  });

  it("should return '2:05' for 125000 ms", () => {
    expect(formatDuration(125000)).toBe("2:05");
  });

  it("should return '60:00' for 3,600,000 ms (1 hour)", () => {
    expect(formatDuration(3600000)).toBe("60:00");
  });
});
