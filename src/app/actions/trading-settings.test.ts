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

function formData(accountEquityVnd: string): FormData {
  const fd = new FormData();
  fd.set("accountEquityVnd", accountEquityVnd);
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

    expect(result?.message).toMatch(/sign in/i);
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

  it("upserts the validated equity for the current user and revalidates the dashboard", async () => {
    getSessionMock.mockResolvedValue({ userId: "u1", email: "a@b.com" });
    upsertMock.mockResolvedValueOnce({});

    const result = await updateTradingSettings(undefined, formData("500,000,000"));

    expect(upsertMock).toHaveBeenCalledWith({
      where: { userId: "u1" },
      update: { accountEquityVnd: 500_000_000 },
      create: { userId: "u1", accountEquityVnd: 500_000_000 },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
    expect(result?.success).toBe(true);
  });
});
