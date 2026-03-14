const { toBytes, isMediaTypeAllowed, validateMediaItems } = require("../../services/post-service/validation");

describe("post validation", () => {
  test("toBytes converts MB to bytes", () => {
    expect(toBytes(1.5)).toBe(1572864);
  });

  test("isMediaTypeAllowed supports image/video", () => {
    expect(isMediaTypeAllowed("image")).toBe(true);
    expect(isMediaTypeAllowed("video")).toBe(true);
    expect(isMediaTypeAllowed("audio")).toBe(false);
  });

  test("validateMediaItems rejects empty list", () => {
    const res = validateMediaItems([]);
    expect(res.ok).toBe(false);
  });

  test("validateMediaItems rejects >20", () => {
    const media = Array.from({ length: 21 }, () => ({ type: "image", sizeMb: 1 }));
    const res = validateMediaItems(media);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("20");
  });

  test("validateMediaItems rejects invalid type", () => {
    const res = validateMediaItems([{ type: "gif", sizeMb: 1 }]);
    expect(res.ok).toBe(false);
  });

  test("validateMediaItems rejects oversized file", () => {
    const res = validateMediaItems([{ type: "image", sizeMb: 51 }]);
    expect(res.ok).toBe(false);
  });

  test("validateMediaItems accepts valid payload", () => {
    const res = validateMediaItems([
      { type: "image", sizeMb: 1.2 },
      { type: "video", sizeMb: 49.9 }
    ]);
    expect(res.ok).toBe(true);
  });
});
