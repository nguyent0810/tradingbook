import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBar } from "./status-bar";
import type { TerminalShellStatus } from "@/lib/terminal/shell-status";

const BASE: TerminalShellStatus = {
  gate1: "WARNING",
  gate1Resolution: null,
  verdict: "PROBE",
  persistedDecision: "PROBE",
  candidateCountAb: 5,
  nearMissCount: 12,
  openTradeCount: 3,
  scanRunAt: new Date("2026-08-25T02:15:02.000Z"),
  scanRunId: "run_4182",
  scanSessionDate: new Date("2026-08-25T00:00:00.000Z"),
  latestIndexSessionDate: new Date("2026-08-25T00:00:00.000Z"),
  scanMatchesLatestSession: true,
  errors: [],
};

describe("StatusBar", () => {
  it("hiện đủ sáu ô chỉ số phiên", () => {
    const html = renderToStaticMarkup(<StatusBar status={BASE} />);
    for (const key of ["CỔNG 1", "PHÁN QUYẾT", "A/B", "SUÝT ĐẠT", "LỆNH MỞ", "QUÉT"]) {
      expect(html).toContain(key);
    }
  });

  it("ô PHÁN QUYẾT lấy màu từ token phán quyết — đổi mức là đổi màu", () => {
    const probe = renderToStaticMarkup(<StatusBar status={BASE} />);
    expect(probe).toContain("PROBE");
    expect(probe).toContain("var(--tm-accent)");

    const noTrade = renderToStaticMarkup(
      <StatusBar status={{ ...BASE, verdict: "NO_TRADE" }} />
    );
    expect(noTrade).toContain("NO-TRADE");
    expect(noTrade).toContain("var(--tm-down)");

    const trade = renderToStaticMarkup(<StatusBar status={{ ...BASE, verdict: "TRADE" }} />);
    expect(trade).toContain(">TRADE<");
    expect(trade).toContain("var(--tm-up)");
  });

  it("Cổng 1 hiện nhãn tiếng Việt đúng mức", () => {
    expect(renderToStaticMarkup(<StatusBar status={BASE} />)).toContain("CẢNH BÁO");
    expect(
      renderToStaticMarkup(<StatusBar status={{ ...BASE, gate1: "PASS" }} />)
    ).toContain("ĐẠT");
    expect(
      renderToStaticMarkup(<StatusBar status={{ ...BASE, gate1: "FAIL" }} />)
    ).toContain("FAIL");
  });

  it("số dùng phân cách nghìn vi-VN", () => {
    const html = renderToStaticMarkup(
      <StatusBar status={{ ...BASE, candidateCountAb: 1605 }} />
    );
    expect(html).toContain("1.605");
  });

  it("thiếu dữ liệu hiện — chứ không hiện 0", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status={{
          ...BASE,
          gate1: null,
          verdict: null,
          candidateCountAb: null,
          nearMissCount: null,
          openTradeCount: null,
          scanRunAt: null,
        }}
      />
    );
    expect(html).not.toContain(">0<");
    expect(html.match(/—/g)?.length).toBe(6);
  });

  it("phân biệt 0 thật với thiếu dữ liệu", () => {
    const html = renderToStaticMarkup(
      <StatusBar status={{ ...BASE, candidateCountAb: 0, openTradeCount: 0 }} />
    );
    expect(html).toContain(">0<");
  });
});
