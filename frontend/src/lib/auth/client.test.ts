import { describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../testing";
import { fetchCurrentUser, signIn, signOut, signUp } from "./client";

const credentials = { email: "ada@example.com", password: "correct horse" };

describe("account requests", () => {
  it.each([
    ["signUp", signUp, "/api/auth/signup"],
    ["signIn", signIn, "/api/auth/signin"],
  ] as const)("%s posts the credentials and returns the user", async (_, request, url) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, { email: "ada@example.com" }));

    expect(await request(credentials, fetchImpl)).toEqual({ email: "ada@example.com" });

    expect(fetchImpl.mock.calls[0][0]).toBe(url);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify(credentials) });
  });

  it("signOut posts to /api/auth/signout", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    await signOut(fetchImpl);
    expect(fetchImpl.mock.calls[0]).toMatchObject(["/api/auth/signout", { method: "POST" }]);
  });
});

describe("fetchCurrentUser", () => {
  it("returns the signed-in user", async () => {
    expect(await fetchCurrentUser(async () => jsonResponse(200, { email: "ada@example.com" }))).toEqual({
      email: "ada@example.com",
    });
  });

  it("returns null when no one is signed in", async () => {
    expect(await fetchCurrentUser(async () => jsonResponse(401, { detail: "Please sign in to continue." }))).toBeNull();
  });

  it("fails on other errors, rather than pretending no one is signed in", async () => {
    await expect(fetchCurrentUser(async () => jsonResponse(500, {}))).rejects.toThrow();
  });
});
