import { afterEach, describe, expect, it, vi } from "vitest";
import { updateTradingSettings } from "./trading-settings";

const getSessionMock = vi.hoisted(() => vi.fn());
const upsertMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userTradingSettings: {
      upsert: upsertMock,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

function formData(
  accountEquityVnd: string,
  percentFields: { riskPerTradePct?: string; maxPositionPct?: string; liquidityCapPct?: string } = {}
): FormData {
  const fd = new FormData();
  fd.set("accountEquityVnd", accountEquityVnd);
  if (percentFields.riskPerTradePct != null) fd.set("riskPerTradePct", percentFields.riskPerTradePct);
  if (percentFields.maxPositionPct != null) fd.set("maxPositionPct", percentFields.maxPositionPct);
  if (percentFields.liquidityCapPct != null) fd.set("liquidityCapPct", percentFields.liquidityCapPct);
  return fd;
}

afterEach(() => {
  getSessionMock.mockReset();
  upsertMock.mockReset();
  revalidatePathMock.mockReset();
});

describe("updateTradingSettings", () => {
  it("returns a message and does not touch the DB when there is no session", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const result = await updateTradingSettings(undefined, formData("500000000"));

    expect(result?.message).toMatch(/đăng nhập/i);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects non-positive or garbage input with a field error", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1", email: "a@b.com" });

    const zero = await updateTradingSettings(undefined, formData("0"));
    expect(zero?.errors?.accountEquityVnd).toBeTruthy();

    const garbage = await updateTradingSettings(undefined, formData("not a number"));
    expect(garbage?.errors?.accountEquityVnd).toBeTruthy();

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("upserts equity with the percent fields left blank (null — system defaults apply)", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1", email: "a@b.com" });
    upsertMock.mockResolvedValueOnce({});

    const result = await updateTradingSettings(undefined, formData("500,000,000"));

    const values = {
      accountEquityVnd: 500_000_000,
      riskPerTradePct: null,
      maxPositionPct: null,
      liquidityCapPct: null,
    };
    expect(upsertMock).toHaveBeenCalledWith({
      where: { userId: "u1" },
      update: values,
      create: { userId: "u1", ...values },
    });
    // Mọi màn định cỡ vị thế từ các tham số này đều phải được làm mới, nếu
    // không màn sẽ hiện khối lượng cũ trong khi server đã dùng tham số mới.
    for (const p of ["/dashboard", "/settings", "/setups", "/book"]) {
      expect(revalidatePathMock, p).toHaveBeenCalledWith(p);
    }
    expect(revalidatePathMock).toHaveBeenCalledWith("/symbol/[symbol]", "page");
    expect(result?.success).toBe(true);
  });

  it("converts whole-percent inputs to decimal fractions before storing", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1", email: "a@b.com" });
    upsertMock.mockResolvedValueOnce({});

    await updateTradingSettings(
      undefined,
      formData("500000000", {
        riskPerTradePct: "0.75",
        maxPositionPct: "15",
        liquidityCapPct: "5",
      })
    );

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          accountEquityVnd: 500_000_000,
          riskPerTradePct: 0.0075,
          maxPositionPct: 0.15,
          liquidityCapPct: 0.05,
        },
      })
    );
  });

  it("rejects a percent field out of the 0-100 range", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1", email: "a@b.com" });

    const result = await updateTradingSettings(
      undefined,
      formData("500000000", { riskPerTradePct: "150" })
    );

    expect(result?.errors?.riskPerTradePct).toBeTruthy();
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
