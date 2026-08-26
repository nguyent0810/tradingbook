import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { F1ViewModel } from "@/lib/dashboard/terminal/f1-view-model";
import { F1Screen } from "./f1-screen";

const MODEL: F1ViewModel = {
  verdict: {
    level: "PROBE",
    code: "PROBE",
    color: "var(--tm-accent)",
    headBg: "var(--tm-head-probe)",
    headline: "Thăm dò khối lượng nhỏ",
    bookStance: "PROBE · giới hạn thăm dò",
    explanation: "Độ rộng thị trường suy yếu.",
    allocation: "20-40%",
    perTrade: "0,5%",
    confidenceLabel: "TRUNG BÌNH",
    confidenceBars: 3,
    provenance: "derived",
    untrusted: null,
  },
  blockers: [
    {
      tag: "THỊ TRƯỜNG",
      title: "Độ rộng suy yếu",
      note: "42% mã trên MA20",
      color: "var(--tm-down)",
    },
  ],
  blockersEmptyReason: null,
  gate1Rows: [
    { key: "CỔNG 1 · TRỰC TIẾP", value: "CẢNH BÁO", color: "var(--tm-accent)" },
    { key: "CỔNG 1 · LẦN QUÉT", value: "ĐẠT", color: "var(--tm-up)" },
    { key: "NGUỒN CHUẨN", value: "TRỰC TIẾP (XẤU HƠN)", color: "var(--tm-down)" },
    { key: "PHÁN QUYẾT DÙNG", value: "CẢNH BÁO", color: "var(--tm-accent)" },
  ],
  gate1Note: "Chế độ trực tiếp xấu hơn lần quét.",
  setups: [
    {
      symbol: "FPT",
      tier: "A",
      rankScore: 92.4,
      close: 138.2,
      changePct: 1.62,
      zoneLow: 133.5,
      zoneHigh: 136.8,
      stop: 129.4,
      rs20: 18.6,
      rsColor: "var(--tm-up)",
      healthLabel: "TỐT",
      healthScore: 88,
      healthColor: "var(--tm-up)",
      actionHint: "Chờ về vùng mua",
      spark: [130, 132, 136, 138.2],
    },
  ],
  setupsEmptyReason: null,
  nearMiss: [
    {
      symbol: "SSI",
      status: "Gần thiết lập, chưa xác thực",
      statusColor: "var(--tm-accent)",
      reason: "RS20 chưa đủ ngưỡng",
      distancePct: -1.8,
      rs20: 4.2,
      rsColor: "var(--tm-ref)",
      waitFor: "RS20 ≥ 6",
    },
  ],
  nearMissEmptyReason: null,
  funnel: [
    { key: "VŨ TRỤ ĐÃ QUÉT", value: 1605, pctOfUniverse: 100, barWidth: 100, color: "var(--tm-floor)" },
    { key: "ĐẠT CỔNG 2 · A/B", value: 5, pctOfUniverse: 0.31, barWidth: 6, color: "var(--tm-up)" },
  ],
  index: {
    latestClose: 1284.62,
    changePct: 0.84,
    points: [1273.88, 1284.62],
    firstLabel: "2026-08-24",
    lastLabel: "2026-08-25",
    error: null,
  },
  plan: [{ n: "1", title: "Theo dõi FPT", note: "Chờ về 133,5–136,8" }],
  watch: [
    {
      symbol: "FPT",
      state: "SẴN SÀNG",
      stateColor: "var(--tm-up)",
      close: 138.2,
      changePct: null,
    },
  ],
  watchTruncated: false,
  evidence: [
    { id: "e1", label: "VNINDEX vs MA50", display: "+3,5%", hint: null, provenance: "real" },
  ],
  scanRunId: "run_4182",
};

function render(over: Partial<Parameters<typeof F1Screen>[0]> = {}) {
  return renderToStaticMarkup(
    <F1Screen model={MODEL} stale={null} loadError={null} {...over} />
  );
}

describe("bố cục F1", () => {
  it("dựng đủ ba cột và vạch kéo", () => {
    const html = render();
    expect(html).toContain("f1__rail-left");
    expect(html).toContain("f1__center");
    expect(html).toContain("f1__rail-right");
    expect(html).toContain("f1__grip");
  });

  it("panel phán quyết nằm đầu cột trái — thứ đầu tiên mắt gặp", () => {
    const html = render();
    const leftRail = html.slice(html.indexOf("f1__rail-left"));
    expect(leftRail.indexOf("PHÁN QUYẾT PHIÊN")).toBeLessThan(leftRail.indexOf("YẾU TỐ CHẶN"));
  });

  it("vạch kéo là separator có nhãn và khoảng giá trị cho bàn phím", () => {
    const html = render();
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-valuemin="240"');
    expect(html).toContain('aria-valuemax="520"');
    expect(html).toContain('tabindex="0"');
  });
});

describe("số liệu F1", () => {
  it("mọi số dùng locale vi-VN", () => {
    const html = render();
    expect(html).toContain("138,20"); // giá
    expect(html).toContain("+1,62%"); // biến động
    expect(html).toContain("133,50–136,80"); // vùng mua
    expect(html).toContain("1.284,62"); // VNINDEX
    expect(html).toContain("1.605"); // phễu
  });

  it("ô thiếu dữ liệu hiện — chứ không hiện 0", () => {
    const html = render();
    // Danh mục theo dõi không có phiên liền trước ⇒ cột biến động là gap.
    expect(html).toContain("—");
  });

  it("cột số dùng tabular-nums qua class tm-t-num", () => {
    expect(render()).toContain("tm-t-num");
  });
});

describe("trạng thái bắt buộc", () => {
  it("banner dữ liệu cũ nêu rõ phiên và hệ quả", () => {
    const html = render({
      stale: {
        sessionLabel: "22/08/2026",
        consequence: "Phán quyết và định cỡ vị thế tính trên phiên này.",
      },
    });
    expect(html).toContain("DỮ LIỆU CŨ");
    expect(html).toContain("22/08/2026");
    expect(html).toContain("định cỡ vị thế");
  });

  it("lỗi nạp luôn kèm bằng chứng trong khối mono", () => {
    const html = render({ loadError: "prepareSurfacedCandidatesHealthView() thất bại: EPERM" });
    expect(html).toContain("tm-evidence");
    expect(html).toContain("EPERM");
    expect(html).toContain('role="alert"');
  });

  it("bảng thiết lập rỗng nêu lý do cụ thể kèm mã lần quét", () => {
    const html = render({
      model: {
        ...MODEL,
        setups: [],
        setupsEmptyReason: "612 mã qua thanh khoản, 0 mã đạt đủ tiêu chí.",
      },
    });
    expect(html).toContain("Không có ứng viên đạt Cổng 2");
    expect(html).toContain("612 mã qua thanh khoản");
    expect(html).toContain("run_4182");
  });

  it("phán quyết không có cơ sở thì chặn nút CHỐT KẾ HOẠCH và hiện bằng chứng", () => {
    const html = render({
      model: {
        ...MODEL,
        verdict: {
          ...MODEL.verdict,
          code: "—",
          allocation: "—",
          perTrade: "—",
          headline: "Chưa đánh giá được phán quyết",
          untrusted: { reason: "chỉ có 31 bar VNINDEX, cần tối thiểu 50" },
        },
      },
    });
    expect(html).toContain("Chưa đánh giá được phán quyết");
    expect(html).toContain("31 bar VNINDEX");
    expect(html).toContain("disabled");
    // Nút bị vô hiệu là <button>, không phải <a> — không dẫn người dùng đi đâu.
    expect(html).not.toContain('href="/setups"');
  });

  it("lỗi VNINDEX hiện NGUYÊN VĂN lỗi thay vì một câu viết cứng", () => {
    const evidence = "fetchVnindexHistoryCached(30) thất bại (…): Error: connection reset";
    const html = render({
      model: { ...MODEL, index: { ...MODEL.index, error: evidence } },
    });
    // Bằng chứng phải là chuỗi lỗi THẬT do loader trả về; một nhãn truy vấn viết
    // cứng trong component sẽ hiện y hệt nhau dù lỗi là gì.
    expect(html).toContain("connection reset");
  });
});

describe("không trang trí", () => {
  it("không có emoji trong bản dựng", () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    expect(emoji.test(render())).toBe(false);
  });

  it("không có bóng hay gradient nội tuyến", () => {
    const html = render();
    expect(html).not.toMatch(/box-shadow/);
    expect(html).not.toMatch(/gradient/);
  });
});
