import { describe, expect, it } from "vitest";
import {
  GAP,
  fmtAge,
  fmtDayMonth,
  fmtNum,
  fmtPct,
  fmtPctSigned,
  fmtR,
  fmtSessionDate,
  fmtShares,
  fmtSigned,
  fmtVnd,
  fmtVndCompact,
  fmtVndCompactSigned,
  fmtVndSigned,
  priceDirection,
  priceToneClass,
  priceToneVar,
  semanticTone,
} from "./vn";

/** vi-VN dùng dấu chấm phân cách nghìn và dấu phẩy thập phân. */
describe("locale vi-VN", () => {
  it("dùng dấu chấm nghìn và dấu phẩy thập phân", () => {
    expect(fmtNum(1284.62, 2)).toBe("1.284,62");
    expect(fmtNum(1605, 0)).toBe("1.605");
    expect(fmtNum(0.5, 1)).toBe("0,5");
  });

  it("giữ đúng số chữ số thập phân để cột thẳng hàng", () => {
    expect(fmtNum(27, 2)).toBe("27,00");
    expect(fmtNum(27.856, 2)).toBe("27,86");
  });

  it("không còn dấu chấm thập phân nào trong chuỗi kết quả", () => {
    // Dấu chấm chỉ được xuất hiện ở vị trí phân cách nghìn.
    expect(fmtNum(1234567.89, 2)).toBe("1.234.567,89");
  });
});

describe("fmtSigned", () => {
  it("luôn hiện dấu + khi không âm", () => {
    expect(fmtSigned(1.62, 2, "%")).toBe("+1,62%");
    expect(fmtSigned(0, 2, "%")).toBe("+0,00%");
  });

  it("giữ dấu - cho số âm", () => {
    expect(fmtSigned(-0.44, 2, "%")).toBe("-0,44%");
  });
});

describe("phần trăm và R", () => {
  it("fmtPct không thêm dấu", () => {
    expect(fmtPct(42.35, 1)).toBe("42,4%");
  });

  it("fmtPctSigned thêm dấu, 2 chữ số", () => {
    expect(fmtPctSigned(-1.02)).toBe("-1,02%");
  });

  it("fmtR gắn hậu tố R", () => {
    expect(fmtR(2.31)).toBe("+2,31R");
    expect(fmtR(-0.94)).toBe("-0,94R");
  });
});

describe("tiền đồng", () => {
  it("fmtVnd dùng phân cách nghìn vi-VN", () => {
    expect(fmtVnd(26_400_000)).toBe("26.400.000 ₫");
  });

  it("fmtVndSigned luôn có dấu", () => {
    expect(fmtVndSigned(5_590_000)).toBe("+5.590.000 ₫");
    expect(fmtVndSigned(-16_200_000)).toBe("-16.200.000 ₫");
  });

  it("fmtVndCompact dùng đơn vị tr / tỷ", () => {
    expect(fmtVndCompact(1_420_000_000)).toBe("1,42 tỷ ₫");
    expect(fmtVndCompact(48_200_000)).toBe("48,2 tr ₫");
    expect(fmtVndCompact(-16_200_000)).toBe("-16,2 tr ₫");
    expect(fmtVndCompact(892_000)).toBe("892.000 ₫");
  });

  it("fmtVndCompactSigned thêm dấu vào bản rút gọn", () => {
    expect(fmtVndCompactSigned(48_200_000)).toBe("+48,2 tr ₫");
    expect(fmtVndCompactSigned(-16_200_000)).toBe("-16,2 tr ₫");
  });

  it("fmtShares dùng phân cách nghìn", () => {
    expect(fmtShares(8600)).toBe("8.600");
  });
});

describe("ô thiếu dữ liệu (gap)", () => {
  it("hiện — chứ không hiện 0", () => {
    for (const fn of [fmtNum, fmtPct, fmtVnd, fmtVndCompact, fmtShares]) {
      expect(fn(null)).toBe(GAP);
      expect(fn(undefined)).toBe(GAP);
      expect(fn(Number.NaN)).toBe(GAP);
    }
    expect(fmtSigned(null, 2, "%")).toBe(GAP);
    expect(fmtVndSigned(Number.POSITIVE_INFINITY)).toBe(GAP);
  });

  it("phân biệt gap với giá trị 0 thật", () => {
    expect(fmtNum(0, 2)).toBe("0,00");
    expect(fmtVnd(0)).toBe("0 ₫");
  });
});

describe("ngày giờ theo giờ Việt Nam", () => {
  const t = new Date("2026-08-25T02:15:02.000Z"); // 09:15:02 ICT

  it("fmtSessionDate dạng dd/MM/yyyy", () => {
    expect(fmtSessionDate(t)).toBe("25/08/2026");
  });

  it("fmtDayMonth dạng dd/MM", () => {
    expect(fmtDayMonth(t)).toBe("25/08");
  });

  it("trả — cho ngày không hợp lệ", () => {
    expect(fmtSessionDate(null)).toBe(GAP);
    expect(fmtSessionDate("không phải ngày")).toBe(GAP);
  });
});

describe("fmtAge", () => {
  it("hiện giờ và phút", () => {
    expect(fmtAge(4 * 3_600_000 + 47 * 60_000)).toBe("4g 47ph");
  });

  it("dưới một giờ chỉ hiện phút", () => {
    expect(fmtAge(12 * 60_000)).toBe("12ph");
  });

  it("dưới một phút hiện giây", () => {
    expect(fmtAge(38_000)).toBe("38s");
  });

  it("trả — khi không có dữ liệu", () => {
    expect(fmtAge(null)).toBe(GAP);
    expect(fmtAge(-1)).toBe(GAP);
  });
});

describe("quy ước màu giá VN", () => {
  it("xanh tăng · đỏ giảm · vàng tham chiếu — không đảo ngược", () => {
    expect(priceDirection(1.62)).toBe("up");
    expect(priceDirection(-1.02)).toBe("down");
    expect(priceDirection(0)).toBe("ref");
    expect(priceDirection(null)).toBe("gap");

    expect(priceToneClass(1.62)).toBe("tm-up");
    expect(priceToneClass(-1.02)).toBe("tm-down");
    expect(priceToneClass(0)).toBe("tm-ref");
    expect(priceToneClass(null)).toBe("tm-gap");
  });
});

describe("priceToneVar", () => {
  it("gap là màu mờ trung tính, KHÔNG phải xanh", () => {
    // Ô chưa có dữ liệu hiện "—"; tô xanh là nói "lãi" ở nơi ta không biết gì.
    expect(priceToneVar(null)).toBe("var(--tm-text-faint)");
    expect(priceToneVar(undefined)).toBe("var(--tm-text-faint)");
    expect(priceToneVar(Number.NaN)).toBe("var(--tm-text-faint)");
  });

  it("0 là tham chiếu (vàng) theo quy ước bảng giá VN, không phải tăng", () => {
    expect(priceToneVar(0)).toBe("var(--tm-ref)");
  });

  it("dương xanh, âm đỏ", () => {
    expect(priceToneVar(1.2)).toBe("var(--tm-up)");
    expect(priceToneVar(-1.2)).toBe("var(--tm-down)");
  });

  it("khớp đúng hướng mà priceToneClass dùng", () => {
    for (const v of [null, 0, 1, -1]) {
      expect(priceToneVar(v).includes("faint")).toBe(priceToneClass(v) === "tm-gap");
    }
  });
});

describe("semanticTone", () => {
  it("có số thì giữ màu vai trò, thiếu số thì mờ", () => {
    // Màu vai trò (cắt lỗ, mục tiêu, bậc phễu…) nói "ô này đã có số". Gán nó cho
    // một ô đang hiện "—" là nói thay dữ liệu.
    expect(semanticTone(25.8, "var(--tm-down-soft)")).toBe("var(--tm-down-soft)");
    expect(semanticTone(0, "var(--tm-down-soft)")).toBe("var(--tm-down-soft)");
    expect(semanticTone(null, "var(--tm-down-soft)")).toBe("var(--tm-text-faint)");
    expect(semanticTone(undefined, "var(--tm-up-soft)")).toBe("var(--tm-text-faint)");
    expect(semanticTone(Number.NaN, "var(--tm-up)")).toBe("var(--tm-text-faint)");
  });
});
