const { normalizeEmail, normalizeUsername, isPasswordValid } = require("../../services/auth-service/validators");

describe("auth validators", () => {
  test("normalizeEmail trims and lowercases", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  test("normalizeUsername trims and lowercases", () => {
    expect(normalizeUsername("  Test_User ")).toBe("test_user");
  });

  test("isPasswordValid returns true for 6+ chars", () => {
    expect(isPasswordValid("123456")).toBe(true);
  });

  test("isPasswordValid returns false for short password", () => {
    expect(isPasswordValid("12345")).toBe(false);
  });
});
