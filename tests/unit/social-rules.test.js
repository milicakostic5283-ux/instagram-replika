const { isSelfAction, followStatusForPrivacy, decisionToStatus } = require("../../services/social-service/rules");

describe("social rules", () => {
  test("isSelfAction detects same id", () => {
    expect(isSelfAction(3, 3)).toBe(true);
    expect(isSelfAction(3, 4)).toBe(false);
  });

  test("followStatusForPrivacy returns pending for private", () => {
    expect(followStatusForPrivacy(true)).toBe("pending");
  });

  test("followStatusForPrivacy returns accepted for public", () => {
    expect(followStatusForPrivacy(false)).toBe("accepted");
  });

  test("decisionToStatus maps accept/reject", () => {
    expect(decisionToStatus("accept")).toBe("accepted");
    expect(decisionToStatus("reject")).toBe("rejected");
    expect(decisionToStatus("other")).toBe("pending");
  });
});
