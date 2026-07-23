"use server";

import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ─── Validation Schemas ───

const LoginSchema = z.object({
  email: z.string().email("Vui lòng nhập email hợp lệ."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});

const RegisterSchema = z.object({
  email: z.string().email("Vui lòng nhập email hợp lệ."),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự."),
  name: z.string().min(1, "Vui lòng nhập tên.").optional(),
});

// ─── Types ───

export type AuthState = {
  errors?: Record<string, string[]>;
  message?: string;
} | undefined;

// ─── Login ───

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    return { message: "Email hoặc mật khẩu không đúng." };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { message: "Email hoặc mật khẩu không đúng." };
  }

  await createSession(user.id, user.email);
  redirect("/dashboard");
}

// ─── Register ───

export async function register(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = RegisterSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    return { message: "Đã tồn tại tài khoản với email này." };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name || null,
    },
  });

  await createSession(user.id, user.email);
  redirect("/dashboard");
}

// ─── Logout ───

export async function logout() {
  await deleteSession();
  redirect("/login");
}
