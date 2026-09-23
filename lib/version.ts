// Build stamp for the public /api/version route, so anyone can verify the deployed
// site matches a specific source commit. The committed values are fallbacks that keep
// local builds, preview, and CI working; at deploy time scripts/stamp-version.mjs
// rewrites them from the public repository commit and the file is restored to these
// placeholders afterwards, so the tree stays clean while the deployed bundle carries
// the real stamp.
export const COMMIT = "dev";
export const COMMIT_SHORT = "dev";
export const DEPLOYED_AT = "unknown";
