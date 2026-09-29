import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";
import { SESSION_COOKIE } from "@/server/nafath/config";
import { proxy } from "./proxy";

function call(path: string, cookies: Record<string, string> = {}) {
  const request = new NextRequest(new URL(path, "http://localhost:3000"));
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  return proxy(request);
}

/** A redirect to /login, or null when the request was let through. */
function redirectedTo(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("proxy — request files for admin reviewers", () => {
  it("lets an admin-only session reach a request's attachment list", () => {
    const response = call("/api/requests/54/attachments", { [ADMIN_SESSION_COOKIE]: "x" });
    expect(redirectedTo(response)).toBeNull();
  });

  it("lets an admin-only session open one attachment", () => {
    const response = call("/api/requests/54/attachments/85", { [ADMIN_SESSION_COOKIE]: "x" });
    expect(redirectedTo(response)).toBeNull();
  });

  it("still sends a caller with no session to /login", () => {
    expect(redirectedTo(call("/api/requests/54/attachments"))).toBe("/login");
  });

  it("does not open any OTHER app route to an admin-only session", () => {
    expect(redirectedTo(call("/", { [ADMIN_SESSION_COOKIE]: "x" }))).toBe("/login");
    expect(redirectedTo(call("/api/requests/54", { [ADMIN_SESSION_COOKIE]: "x" }))).toBe(
      "/login",
    );
  });

  it("keeps letting an office session through, as before", () => {
    const response = call("/api/requests/54/attachments", { [SESSION_COOKIE]: "x" });
    expect(redirectedTo(response)).toBeNull();
  });
});
