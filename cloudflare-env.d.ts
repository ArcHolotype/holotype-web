declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    HOLO_MIND_URL?: string;
  }
}
