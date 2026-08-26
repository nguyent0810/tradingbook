import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TickerTape } from "./ticker-tape";

describe("TickerTape", () => {
  it("hiện giá và biến động theo locale vi-VN", () => {
    const html = renderToStaticMarkup(
      <TickerTape items={[{ symbol: "VNINDEX", close: 1284.62, changePct: 0.84 }]} />
    );
    expect(html).toContain("1.284,62");
    expect(html).toContain("+0,84%");
  });

  it("tô màu theo quy ước VN: xanh tăng, đỏ giảm, vàng tham chiếu", () => {
    const html = renderToStaticMarkup(
      <TickerTape
        items={[
          { symbol: "FPT", close: 138.2, changePct: 1.62 },
          { symbol: "SSI", close: 34.15, changePct: -1.02 },
          { symbol: "GAS", close: 76.2, changePct: 0 },
        ]}
      />
    );
    expect(html).toContain("tm-up");
    expect(html).toContain("tm-down");
    expect(html).toContain("tm-ref");
  });

  it("mã thiếu biến động hiện — chứ không hiện 0%", () => {
    const html = renderToStaticMarkup(
      <TickerTape items={[{ symbol: "NEW", close: 12.5, changePct: null }]} />
    );
    expect(html).toContain("—");
    expect(html).not.toContain("0,00%");
  });

  it("nhân đôi danh sách để chạy vòng, bản sao ẩn khỏi trình đọc màn hình", () => {
    const html = renderToStaticMarkup(
      <TickerTape items={[{ symbol: "FPT", close: 138.2, changePct: 1.62 }]} />
    );
    expect(html.match(/FPT/g)).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
  });

  it("không có mã thì để trống và nói rõ lý do, không bịa số", () => {
    const html = renderToStaticMarkup(<TickerTape items={[]} />);
    expect(html).toContain("tm-tape__empty");
    expect(html).not.toContain("tm-tape__run");
  });
});
