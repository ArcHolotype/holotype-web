import { COMMIT, COMMIT_SHORT, DEPLOYED_AT } from "../../../lib/version";

// Public build provenance: reports the source commit this deployed site was built
// from, so anyone can check it out in the public repository and compare. Carries no
// operational or personal data — only the build stamp.
export async function GET() {
  return new Response(
    JSON.stringify({
      site: "holotype-web",
      commit: COMMIT,
      commit_short: COMMIT_SHORT,
      deployed_at: DEPLOYED_AT,
      repository: "https://github.com/ArcHolotype/holotype-web",
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}
