function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function isPasswordValid(value) {
  return String(value || "").length >= 6;
}

module.exports = {
  normalizeEmail,
  normalizeUsername,
  isPasswordValid
};
