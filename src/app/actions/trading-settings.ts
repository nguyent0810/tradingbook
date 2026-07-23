"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { parsePositiveMoney } from "@/lib/trading-account-risk-config";

/** Optional whole-percent field (e.g. "0.75" = 0.75%) — blank means "use the system default". */
function optionalPercentField(label: string) {
  return z
    .string()
    .nullish()
    .transform((raw, ctx) => {
      const trimmed = (raw ?? "").trim();
      if (!trimmed) return null;
      const n = Number(trimmed.replace(/,/g, ""));
      if (!Number.isFinite(n) || n <= 0 || n > 100) {
        ctx.addIssue({
          code: "custom",
          message: `${label} phải là phần trăm từ 0 đến 100 (ví dụ: 0.75), hoặc để trống để dùng mặc định.`,
        });
        return z.NEVER;
      }
      return n / 100;
    });
}

const TradingSettingsSchema = z.object({
  accountEquityVnd: z
    .string()
    .transform((raw, ctx) => {
      const parsed = parsePositiveMoney(raw);
      if (parsed == null) {
        ctx.addIssue({
          code: "custom",
          message: "Nhập số tiền VND dương (ví dụ: 500000000).",
        });
        return z.NEVER;
      }
      return parsed;
    }),
  riskPerTradePct: optionalPercentField("Rủi ro mỗi lệnh"),
  maxPositionPct: optionalPercentField("Kích thước vị thế tối đa"),
  liquidityCapPct: optionalPercentField("Trần thanh khoản"),
});

export type TradingSettingsState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      success?: boolean;
    }
  | undefined;

export async function updateTradingSettings(
  _prevState: TradingSettingsState,
  formData: FormData
): Promise<TradingSettingsState> {
  const session = await getSession();
  if (!session) {
    return { message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const parsed = TradingSettingsSchema.safeParse({
    accountEquityVnd: formData.get("accountEquityVnd"),
    riskPerTradePct: formData.get("riskPerTradePct"),
    maxPositionPct: formData.get("maxPositionPct"),
    liquidityCapPct: formData.get("liquidityCapPct"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const values = {
    accountEquityVnd: parsed.data.accountEquityVnd,
    riskPerTradePct: parsed.data.riskPerTradePct,
    maxPositionPct: parsed.data.maxPositionPct,
    liquidityCapPct: parsed.data.liquidityCapPct,
  };

  const { prisma } = await import("@/lib/prisma");
  await prisma.userTradingSettings.upsert({
    where: { userId: session.userId },
    update: values,
    create: { userId: session.userId, ...values },
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");

  return { success: true, message: "Đã cập nhật vốn tài khoản." };
}
