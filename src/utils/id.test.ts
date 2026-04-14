import { describe, it, expect } from "vite-plus/test";
import { nextId } from "./id";

describe("nextId", () => {
  it("should return a string", () => {
    const id = nextId();
    expect(typeof id).toBe("string");
  });

  it("should return incrementing values", () => {
    const id1 = nextId();
    const id2 = nextId();
    const id3 = nextId();

    expect(Number(id2)).toBe(Number(id1) + 1);
    expect(Number(id3)).toBe(Number(id2) + 1);
  });

  it("should generate unique IDs", () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const id = nextId();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
    expect(ids.size).toBe(100);
  });
});
