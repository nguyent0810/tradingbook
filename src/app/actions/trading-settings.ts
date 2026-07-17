"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { parsePositiveMoney } from "@/lib/trading-account-risk-config";

const TradingSettingsSchema = z.object({
  accountEquityVnd: z
    .string()
    .transform((raw, ctx) => {
      const parsed = parsePositiveMoney(raw);
      if (parsed == null) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a positive VND amount (e.g. 500000000).",
        });
        return z.NEVER;
      }
      return parsed;
    }),
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
    return { message: "Your session has expired — please sign in again." };
  }

  const parsed = TradingSettingsSchema.safeParse({
    accountEquityVnd: formData.get("accountEquityVnd"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { prisma } = await import("@/lib/prisma");
  await prisma.userTradingSettings.upsert({
    where: { userId: session.userId },
    update: { accountEquityVnd: parsed.data.accountEquityVnd },
    create: { userId: session.userId, accountEquityVnd: parsed.data.accountEquityVnd },
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");

  return { success: true, message: "Account equity updated." };
}
