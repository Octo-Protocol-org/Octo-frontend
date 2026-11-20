import { describe, it, expect } from "vitest";
import { buildCsv, escapeCsvCell } from "./csv";

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
