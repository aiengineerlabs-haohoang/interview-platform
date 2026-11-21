export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  ENVIRONMENT: string;
  SITE_URL: string;
  LOG_LEVEL?: string;
}
