import { createApp } from "@/app";

export const hasDatabase = Boolean(process.env.TEST_DATABASE_URL_API);
export const API_KEY = "test-api-key-0123456789";

const app = createApp();

export function get(path: string, headers: Record<string, string> = {}) {
  return app.request(path, { headers });
}

export function post(path: string, headers: Record<string, string> = {}) {
  return app.request(path, { method: "POST", headers });
}
