import { describe, it, expect, vi } from "vitest";
import { buildCsv, buildCsvParts, escapeCsvCell, fetchAllPages } from "./csv";

describe("escapeCsvCell", () => {
  it("neutralises formula-leading characters", () => {
    for (const c of ["=1+1", "+1", "-a", "@SUM(A1)", "|cmd"]) expect(escapeCsvCell(c)).toBe(`'${c}`);
  });
  it("keeps numbers unchanged", () => {
    expect(escapeCsvCell(-5)).toBe("-5");
    expect(escapeCsvCell("-0.25")).toBe("-0.25");
  });
  it("neutralises leading-whitespace and fullwidth payloads", () => {
    expect(escapeCsvCell(" =1+1")).toBe("' =1+1");
    expect(escapeCsvCell("＝cmd")).toBe("'＝cmd");
  });
  it("handles payer names with quotes and newlines", () => {
    expect(escapeCsvCell('=A "x"\nB')).toBe('"\'=A ""x""\nB"');
  });
  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
  });
  it("renders null as empty", () => {
    expect(escapeCsvCell(null)).toBe("");
  });
});

describe("buildCsv", () => {
  it("builds header and rows", () => {
    const csv = buildCsv([{ a: "x", b: 2 }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(csv).toBe("A,B\r\nx,2\r\n");
  });
});

describe("buildCsvParts", () => {
  it("yields the header and one string per row, joined later", () => {
    const parts = buildCsvParts([{ a: "x", b: 2 }, { a: "y", b: 3 }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(parts).toEqual(["A,B", "x,2", "y,3"]);
  });

  it("matches buildCsv when joined", () => {
    type Row = { a: string; b: number };
    const rows: Row[] = [{ a: "=SUM(1)", b: 2 }];
    const cols: { header: string; value: (r: Row) => string | number }[] = [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ];
    expect(buildCsvParts(rows, cols).join("\r\n") + "\r\n").toBe(buildCsv(rows, cols));
  });
});

describe("fetchAllPages", () => {
  it("walks pages via next_cursor and accumulates", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], next_cursor: "c1" })
      .mockResolvedValueOnce({ data: [3], next_cursor: null });
    await expect(fetchAllPages(fetchPage)).resolves.toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, null, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, "c1", undefined);
  });

  it("stops when the cursor repeats", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: [1], next_cursor: "same" });
    await expect(fetchAllPages(fetchPage)).resolves.toEqual([1, 1]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("reports accumulated rows per page", async () => {
    const seen: number[] = [];
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], next_cursor: "c1" })
      .mockResolvedValueOnce({ data: [3], next_cursor: "c2" })
      .mockResolvedValueOnce({ data: [4, 5], next_cursor: null });
    await fetchAllPages(fetchPage, { onProgress: (n) => seen.push(n) });
    expect(seen).toEqual([2, 3, 5]);
  });

  it("rejects before the first page when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchPage = vi.fn();
    await expect(fetchAllPages(fetchPage, { signal: controller.signal })).rejects.toThrow();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("forwards the signal to fetchPage and aborts the in-flight request", async () => {
    const controller = new AbortController();
    const fetchPage = vi
      .fn()
      .mockImplementationOnce(async (_b: string | null, sig?: AbortSignal) => {
        expect(sig).toBe(controller.signal);
        controller.abort(); // cancelled while the request was in flight
        return { data: [1], next_cursor: "c1" };
      });
    await expect(fetchAllPages(fetchPage, { signal: controller.signal })).rejects.toThrow();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("aborts the walk after a page resolves post-abort", async () => {
    const controller = new AbortController();
    const fetchPage = vi
      .fn()
      .mockImplementationOnce(async () => {
        controller.abort();
        return { data: [1], next_cursor: "c1" };
      });
    await expect(fetchAllPages(fetchPage, { signal: controller.signal })).rejects.toThrow();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("caps the number of pages", async () => {
    const fetchPage = vi
      .fn()
      .mockImplementation(async () => ({
        data: [1],
        next_cursor: `c${fetchPage.mock.calls.length}`,
      }));
    const rows = await fetchAllPages(fetchPage, { maxPages: 3 });
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(rows).toEqual([1, 1, 1]);
  });
});
