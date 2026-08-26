import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Chốt các điều CẤM của bản thiết kế (bàn giao §1 · QA §12) ngay trong CSS
 * terminal, để gate sau không vô tình mang lại đổ bóng / gradient / bo góc lớn.
 *
 * Chỉ soi CSS của terminal. Lớp da ClayMorphism cũ đã bị gỡ hẳn ở Gate 8; phần
 * CSS di sản còn lại chỉ phục vụ các route con của Arena, không thuộc phạm vi
 * bản thiết kế này.
 */

const STYLES_DIR = path.join(process.cwd(), "src", "styles");

function terminalStylesheets(): { name: string; css: string }[] {
  return fs
    .readdirSync(STYLES_DIR)
    .filter((f) => f.startsWith("terminal") && f.endsWith(".css"))
    .map((name) => ({ name, css: fs.readFileSync(path.join(STYLES_DIR, name), "utf8") }));
}

/** Bỏ comment để quy tắc soi khai báo thật, không soi phần giải thích. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("CSS terminal tuân thủ điều cấm của bản thiết kế", () => {
  const sheets = terminalStylesheets();

  it("có ít nhất một stylesheet để soi", () => {
    expect(sheets.length).toBeGreaterThan(0);
  });

  it("không dùng gradient", () => {
    for (const { name, css } of sheets) {
      expect(stripComments(css), name).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/);
    }
  });

  it("không đổ bóng — kể cả bóng modal; phân tách bằng viền và nền", () => {
    for (const { name, css } of sheets) {
      const declarations = stripComments(css).match(/box-shadow\s*:[^;}]+/g) ?? [];
      // Ngoại lệ duy nhất: vòng focus bàn phím amber 1px, là yêu cầu a11y của
      // chính bản thiết kế (bàn giao §6), không phải bóng trang trí.
      const decorative = declarations.filter((d) => !d.includes("var(--tm-accent)"));
      expect(decorative, `${name}: ${decorative.join(" | ")}`).toEqual([]);
    }
  });

  it("bo góc dạng phần trăm chỉ dành cho chấm trạng thái ≤ 8px", () => {
    // Bản thiết kế dùng `border-radius: 50%` đúng 4 lần, đều là chấm LED 6px.
    // Không có % nào khác được phép, và ô mang % phải thật sự là chấm nhỏ —
    // nếu không thì luật "bo góc ≤ 3px" ở dưới sẽ bị lách bằng đơn vị %.
    for (const { name, css } of sheets) {
      const blocks = stripComments(css).match(/\{[^{}]*\}/g) ?? [];
      for (const block of blocks) {
        const decl = block.match(/border-radius\s*:\s*([^;}]+)/)?.[1]?.trim();
        if (decl === undefined || !decl.includes("%")) continue;
        expect(decl, `${name}: ${decl}`).toBe("50%");
        const width = Number(block.match(/(?:^|[;{\s])width\s*:\s*(\d+(?:\.\d+)?)px/)?.[1]);
        expect(width, `${name}: ${block.trim()}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("bo góc không vượt 3px", () => {
    for (const { name, css } of sheets) {
      const radii = stripComments(css).match(/border-radius\s*:[^;}]+/g) ?? [];
      for (const decl of radii) {
        const pixels = [...decl.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
        for (const px of pixels) {
          expect(px, `${name}: ${decl}`).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it("không có emoji trong CSS", () => {
    // Dải Emoji Presentation + Misc Symbols; ký hiệu hình học mono (◴ ∅ ▤ ◇ ✕)
    // nằm ngoài dải này nên vẫn được phép.
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    for (const { name, css } of sheets) {
      expect(emoji.test(css), name).toBe(false);
    }
  });

  it("mọi hoạt ảnh đều tôn trọng prefers-reduced-motion", () => {
    const all = sheets.map((s) => stripComments(s.css)).join("\n");
    const animated = (all.match(/^\s*animation\s*:/gm) ?? []).length;
    if (animated === 0) return;
    expect(all).toContain("prefers-reduced-motion");
  });
});

describe("token màu giá VN không bị đảo ngược", () => {
  const tokens = fs.readFileSync(path.join(STYLES_DIR, "terminal.css"), "utf8");

  it("giữ đúng hex của bảng token bàn giao", () => {
    const expected: [string, string][] = [
      ["--tm-bg-base", "#0a0e11"],
      ["--tm-bg-panel", "#0e1216"],
      ["--tm-bg-head", "#141b21"],
      ["--tm-bg-cell", "#111720"],
      ["--tm-bg-sel", "#16212a"],
      ["--tm-bg-btn", "#1a222a"],
      ["--tm-line-panel", "#1c242b"],
      ["--tm-line-row", "#161d23"],
      ["--tm-line-input", "#29333c"],
      ["--tm-text-hi", "#f2f7fa"],
      ["--tm-text-base", "#dbe4ea"],
      ["--tm-text-mute", "#9dabb6"],
      ["--tm-text-dim", "#69757f"],
      ["--tm-accent", "#ffa62b"],
      ["--tm-up", "#2bd47d"],
      ["--tm-down", "#ff4d5e"],
      ["--tm-ref", "#f5d90a"],
      ["--tm-ceil", "#b95cff"],
      ["--tm-floor", "#4cc2ff"],
    ];
    for (const [token, hex] of expected) {
      expect(tokens, token).toMatch(new RegExp(`${token}\\s*:\\s*${hex}\\s*;`));
    }
  });
});

describe("biến font terminal", () => {
  const tokens = fs.readFileSync(path.join(STYLES_DIR, "terminal.css"), "utf8");

  it(":root KHÔNG tham chiếu biến next/font — nếu tham chiếu thì cả biến thành rỗng", () => {
    // `--font-plex-*` nằm trên phần tử bao sâu hơn `:root`. Viết `var(--font-plex-sans)`
    // ngay trong khối `:root` khiến khai báo invalid-at-computed-value-time, và
    // giá trị rỗng đó kế thừa xuống toàn app ⇒ mất font trên MỌI màn.
    // Bỏ comment trước khi cắt: phần giải thích ngay trong khối `:root` có nhắc
    // tới tên biến của next/font và sẽ làm phép kiểm dưới đây báo nhầm.
    const css = stripComments(tokens);
    const start = css.indexOf(":root {");
    const rootBlock = css.slice(start, css.indexOf("\n}", start));
    expect(rootBlock).toContain("--tm-font-sans");
    expect(rootBlock).not.toContain("var(--font-plex-sans)");
    expect(rootBlock).not.toContain("var(--font-plex-mono)");
  });

  it(".tm-fonts mới là nơi nối vào font đã subset của next/font", () => {
    expect(tokens).toMatch(/\.tm-fonts\s*\{[^}]*var\(--font-plex-sans[,)]/);
    expect(tokens).toMatch(/\.tm-fonts\s*\{[^}]*var\(--font-plex-mono[,)]/);
  });

  it("var(--font-plex-*) luôn có dự phòng ngay trong var()", () => {
    // Không có dự phòng thì khi next/font hỏng (offline, CSP chặn), khai báo
    // thành invalid-at-computed-value-time và toàn terminal rơi về font mặc
    // định của trình duyệt — chứ KHÔNG rơi về bản dự phòng ở `:root`.
    const css = stripComments(tokens);
    for (const m of css.matchAll(/var\(\s*--font-plex-(sans|mono)\s*([,)])/g)) {
      expect(m[2], `var(--font-plex-${m[1]}) thiếu giá trị dự phòng`).toBe(",");
    }
  });
});
