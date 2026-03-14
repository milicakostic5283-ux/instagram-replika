function isSelfAction(currentId, targetId) {
  return Number(currentId) === Number(targetId);
}

function followStatusForPrivacy(isPrivate) {
  return isPrivate ? "pending" : "accepted";
}

function decisionToStatus(action) {
  if (action === "accept") return "accepted";
  if (action === "reject") return "rejected";
  return "pending";
}

module.exports = {
  isSelfAction,
  followStatusForPrivacy,
  decisionToStatus
};
