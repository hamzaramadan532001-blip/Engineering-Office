import { apiFetch } from "./api";

/** End the session — clears the cookie on the backend (or the dev mock). */
export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}
