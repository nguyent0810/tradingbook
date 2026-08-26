import { describe, expect, it } from "vitest";
import {
  SYMBOL_COMMAND_PATTERN,
  TERMINAL_SCREENS,
  findScreenByCommand,
  findScreenByKey,
  findScreenByPath,
  resolveCommand,
  symbolFromPath,
  symbolHref,
} from "./nav";

describe("bản đồ màn", () => {
  it("phím F duy nhất và đúng dạng F1…F9", () => {
    const keys = TERMINAL_SCREENS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^F[1-9]$/);
  });

  it("không có từ khoá lệnh nào trùng giữa hai màn", () => {
    const all = TERMINAL_SCREENS.flatMap((s) => s.commands);
    expect(new Set(all).size).toBe(all.length);
  });

  it("mọi màn có ít nhất một từ khoá lệnh", () => {
    for (const screen of TERMINAL_SCREENS) {
      expect(screen.commands.length).toBeGreaterThan(0);
    }
  });

  it("tra được theo phím và theo lệnh", () => {
    expect(findScreenByKey("F1")?.href).toBe("/dashboard");
    expect(findScreenByCommand("book")?.href).toBe("/book");
    expect(findScreenByKey("F99")).toBeUndefined();
  });
});

describe("findScreenByPath", () => {
  it("khớp đúng đường dẫn và đường dẫn con", () => {
    expect(findScreenByPath("/paper-lab")?.key).toBe("F3");
    expect(findScreenByPath("/paper-lab/battles/abc")?.key).toBe("F3");
  });

  it("không khớp nhầm đường dẫn chỉ trùng tiền tố chuỗi", () => {
    expect(findScreenByPath("/bookmarks")).toBeUndefined();
    expect(findScreenByPath("/settings-old")).toBeUndefined();
  });

  it("trả undefined cho đường dẫn ngoài bản đồ", () => {
    expect(findScreenByPath("/")).toBeUndefined();
  });
});

describe("resolveCommand", () => {
  it("nhận từ khoá màn, không phân biệt hoa thường", () => {
    expect(resolveCommand("dash")).toMatchObject({ kind: "screen" });
    expect(resolveCommand(" Arena ")).toMatchObject({ kind: "screen" });
    const book = resolveCommand("BOOK");
    expect(book.kind === "screen" && book.screen.href).toBe("/book");
  });

  it("ưu tiên từ khoá màn hơn mã cổ phiếu", () => {
    // SET, LAB, SYM đều là 3 ký tự nên khớp cả mẫu mã — từ khoá phải thắng.
    expect(resolveCommand("SET")).toMatchObject({ kind: "screen" });
    expect(resolveCommand("LAB")).toMatchObject({ kind: "screen" });
    expect(resolveCommand("SYM")).toMatchObject({ kind: "screen" });
  });

  it("nhận mã cổ phiếu 3–4 ký tự", () => {
    expect(resolveCommand("FPT")).toMatchObject({ kind: "symbol", symbol: "FPT" });
    expect(resolveCommand("hpg")).toMatchObject({ kind: "symbol", symbol: "HPG" });
  });

  it("từ chối chuỗi không phải mã hợp lệ", () => {
    for (const bad of ["AB", "ABCDE", "FP1", "FP-T"]) {
      expect(resolveCommand(bad)).toMatchObject({ kind: "unknown" });
    }
  });

  it("HELP và ? mở bảng trợ giúp", () => {
    expect(resolveCommand("help")).toEqual({ kind: "help" });
    expect(resolveCommand("?")).toEqual({ kind: "help" });
  });

  it("chuỗi rỗng không làm gì", () => {
    expect(resolveCommand("   ")).toEqual({ kind: "empty" });
  });
});

describe("symbolHref", () => {
  it("trỏ thẳng vào màn chi tiết mã F7 và viết hoa mã", () => {
    expect(symbolHref("fpt")).toBe("/symbol/FPT");
  });

  it("đọc ngược được mã từ đường dẫn", () => {
    expect(symbolFromPath("/symbol/FPT")).toBe("FPT");
    expect(symbolFromPath("/symbol/hpg")).toBe("HPG");
    expect(symbolFromPath("/symbol/FPT?tab=x")).toBe("FPT");
    expect(symbolFromPath("/setups")).toBeNull();
    expect(symbolFromPath("/symbol")).toBeNull();
  });

  it("mẫu mã khớp đúng 3–4 chữ cái", () => {
    expect(SYMBOL_COMMAND_PATTERN.test("FPT")).toBe(true);
    expect(SYMBOL_COMMAND_PATTERN.test("VNM")).toBe(true);
    expect(SYMBOL_COMMAND_PATTERN.test("AB")).toBe(false);
    expect(SYMBOL_COMMAND_PATTERN.test("ABCDE")).toBe(false);
  });
});
