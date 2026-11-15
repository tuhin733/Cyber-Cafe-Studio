import { describe, expect, it } from "vitest";
import { formatSavedTime } from "./autoSaveStatus";

describe("formatSavedTime", () => {
  it("shows a recent save as just now", () => {
    expect(formatSavedTime(10_000, 69_999)).toBe("just now");
  });

  it("shows elapsed minutes and hours", () => {
    expect(formatSavedTime(0, 3 * 60_000)).toBe("3 min ago");
    expect(formatSavedTime(0, 2 * 60 * 60_000)).toBe("2 hr ago");
  });

  it("uses the saved date for older sessions and clamps future timestamps", () => {
    const savedAt = new Date("2025-01-02T03:04:05").getTime();
    expect(formatSavedTime(savedAt, savedAt + 25 * 60 * 60_000))
      .toBe(new Date(savedAt).toLocaleString());
    expect(formatSavedTime(20_000, 10_000)).toBe("just now");
  });
});
