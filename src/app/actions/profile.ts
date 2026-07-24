"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deleteSession, getSession } from "@/lib/session";

export type ProfileState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      success?: boolean;
    }
  | undefined;

// ─── Display name ───

const DisplayNameSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, "Tên hiển thị tối đa 80 ký tự.")
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function updateDisplayName(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await getSession();
  if (!session) {
    return { message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const parsed = DisplayNameSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { name: parsed.data.name },
  });

  revalidatePath("/settings");

  return { success: true, message: "Đã cập nhật tên hiển thị." };
}

// ─── Change password ───

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
    newPassword: z.string().min(6, "Mật khẩu mới phải có ít nhất 6 ký tự."),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp.",
    path: ["confirmPassword"],
  });

export async function updatePassword(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await getSession();
  if (!session) {
    return { message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return { message: "Không tìm thấy tài khoản." };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!valid) {
    return { errors: { currentPassword: ["Mật khẩu hiện tại không đúng."] } };
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: session.userId },
    data: { password: hashed },
  });

  return { success: true, message: "Đã đổi mật khẩu." };
}

// ─── Delete account ───

const CONFIRM_WORD = "XÓA";

const DeleteAccountSchema = z.object({
  password: z.string().min(1, "Vui lòng nhập mật khẩu để xác nhận."),
  confirmText: z.string().refine((v) => v.trim().toUpperCase() === CONFIRM_WORD, {
    message: `Nhập chính xác "${CONFIRM_WORD}" để xác nhận.`,
  }),
});

export async function deleteAccount(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await getSession();
  if (!session) {
    return { message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const parsed = DeleteAccountSchema.safeParse({
    password: formData.get("password"),
    confirmText: formData.get("confirmText"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return { message: "Không tìm thấy tài khoản." };
  }

  const valid = await bcrypt.compare(parsed.data.password, user.password);
  if (!valid) {
    return { errors: { password: ["Mật khẩu không đúng."] } };
  }

  await prisma.user.delete({ where: { id: session.userId } });
  await deleteSession();
  redirect("/login");
}
