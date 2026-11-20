import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadImage } from "./uploads";

vi.mock("./api", () => ({
  apiFetch: vi.fn(async () => ({
    cloud_name: mockCloud.name,
    api_key: "k",
    timestamp: 1,
    folder: "f",
    signature: "s",
  })),
}));

const mockCloud = { name: "demo" };
const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" });

function mockFetch(body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("uploadImage URL validation", () => {
  it("rejects a bad cloud name before any request", async () => {
    mockCloud.name = "../../x";
    const fn = mockFetch({});
    await expect(uploadImage("t", file)).rejects.toThrow(/cloud name/);
    expect(fn).not.toHaveBeenCalled();
  });

  it("rejects an untrusted or foreign-cloud secure_url", async () => {
    mockCloud.name = "demo";
    mockFetch({ secure_url: "https://evil.example/demo/a.png" });
    await expect(uploadImage("t", file)).rejects.toThrow(/untrusted/);
    mockFetch({ secure_url: "https://res.cloudinary.com/other/a.png" });
    await expect(uploadImage("t", file)).rejects.toThrow(/untrusted/);
  });

  it("rejects a missing secure_url and accepts a valid one", async () => {
    mockCloud.name = "demo";
    mockFetch({});
    await expect(uploadImage("t", file)).rejects.toThrow(/no URL/);
    mockFetch({ secure_url: "https://res.cloudinary.com/demo/image/upload/a.png" });
    await expect(uploadImage("t", file)).resolves.toContain("/demo/");
  });
});

describe("uploadImage timeout", () => {
  it("times out with a friendly message when fetch never resolves", async () => {
    mockCloud.name = "demo";
    vi.useFakeTimers();
    vi.stubGlobal("fetch", (_u: string, init: RequestInit) =>
      new Promise((_res, rej) =>
        init.signal!.addEventListener("abort", () => rej(init.signal!.reason)),
      ),
    );
    const p = uploadImage("t", file, { timeoutMs: 50 });
    const assertion = expect(p).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
    vi.useRealTimers();
  });
});
