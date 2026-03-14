function toBytes(sizeMb) {
  return Math.round(Number(sizeMb || 0) * 1024 * 1024);
}

function isMediaTypeAllowed(type) {
  const normalized = String(type || "").toLowerCase();
  return normalized === "image" || normalized === "video";
}

function validateMediaItems(items) {
  const media = Array.isArray(items) ? items : [];
  if (media.length < 1) return { ok: false, error: "Objava mora imati bar jedan media element" };
  if (media.length > 20) return { ok: false, error: "Maksimalno 20 media elemenata" };

  for (const item of media) {
    const type = String(item.type || item.mediaType || "").toLowerCase();
    if (!isMediaTypeAllowed(type)) return { ok: false, error: "Dozvoljen je samo image/video" };

    const sizeBytes = toBytes(item.sizeMb || 0);
    if (sizeBytes <= 0 || sizeBytes > 52428800) {
      return { ok: false, error: "Maksimalna velicina fajla je 50MB" };
    }
  }

  return { ok: true };
}

module.exports = {
  toBytes,
  isMediaTypeAllowed,
  validateMediaItems
};
