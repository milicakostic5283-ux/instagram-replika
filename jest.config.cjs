module.exports = {
  testEnvironment: "node",
  collectCoverage: true,
  collectCoverageFrom: [
    "services/auth-service/validators.js",
    "services/post-service/validation.js",
    "services/social-service/rules.js"
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
