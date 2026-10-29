import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, GENERIC_ERROR, NETWORK_ERROR, setUnauthorizedHandler } from "./api";
import { jsonResponse } from "./testing";

afterEach(() => setUnauthorizedHandler(() => {}));

describe("apiRequest", () => {
  it("sends JSON to /api and returns the JSON answer", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, { ok: true }));

    expect(await apiRequest("/things/1", { method: "PUT", body: { name: "x" }, keepalive: true, fetchImpl })).toEqual({ ok: true });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/things/1");
    expect(init).toMatchObject({ method: "PUT", body: '{"name":"x"}', keepalive: true });
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("sends GETs without a body", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, []));
    await apiRequest("/things", { fetchImpl });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "GET", body: undefined, headers: undefined });
  });

  it("returns undefined for 204 No Content", async () => {
    expect(await apiRequest("/things/1", { method: "DELETE", fetchImpl: async () => new Response(null, { status: 204 }) })).toBeUndefined();
  });

  it("fails with the backend's message and the status", async () => {
    const error = await apiRequest("/things", { fetchImpl: async () => jsonResponse(409, { detail: "Taken." }) }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: "Taken." });
  });

  it("falls back to a generic message for validation errors and non-JSON answers", async () => {
    for (const response of [
      jsonResponse(422, { detail: [{ msg: "Field required" }] }),
      new Response("Bad Gateway", { status: 502 }),
      new Response("<html>Proxy page</html>", { status: 200 }),
    ]) {
      await expect(apiRequest("/things", { fetchImpl: async () => response })).rejects.toThrow(GENERIC_ERROR);
    }
  });

  it("reports a network failure with status 0", async () => {
    const error = await apiRequest("/things", {
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    }).catch((e) => e);
    expect(error).toMatchObject({ status: 0, message: NETWORK_ERROR });
  });

  it("tells the unauthorized handler when the session has ended", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(apiRequest("/things", { fetchImpl: async () => jsonResponse(500, {}) })).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();

    await expect(
      apiRequest("/things", { fetchImpl: async () => jsonResponse(401, { detail: "Please sign in to continue." }) }),
    ).rejects.toThrow("Please sign in to continue.");
    expect(handler).toHaveBeenCalledOnce();
  });
});
