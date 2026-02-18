// Schema expectations for public/data/latest.json
export const LATEST_SCHEMA_VERSION = "2.3"; // bump when fields/meaning change

export const REQUIRED_LATEST_KEYS = ["asOf", "featuresZ"];

export function checkLatestSchema(latest) {
  if (!latest || typeof latest !== "object") {
    return { ok: false, error: "latest.json is not an object", expected: LATEST_SCHEMA_VERSION, got: null };
  }

  for (const k of REQUIRED_LATEST_KEYS) {
    if (!(k in latest)) return { ok: false, error: `latest.json missing key: ${k}`, expected: LATEST_SCHEMA_VERSION, got: latest?.schemaVersion ?? "legacy" };
  }

  // If a schemaVersion is present, enforce it.
  const got = latest.schemaVersion ?? "legacy";
  if (latest.schemaVersion && latest.schemaVersion !== LATEST_SCHEMA_VERSION) {
    return { ok: false, error: `schema mismatch (expected ${LATEST_SCHEMA_VERSION}, got ${latest.schemaVersion})`, expected: LATEST_SCHEMA_VERSION, got };
  }

  return { ok: true, error: null, expected: LATEST_SCHEMA_VERSION, got };
}
