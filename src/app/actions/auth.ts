"use server";

import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ─── Validation Schemas ───

const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

const RegisterSchema = z.object({
  email: z.string().email("Please enter a valid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  name: z.string().min(1, "Name is required.").optional(),
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
    return { message: "Invalid email or password." };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { message: "Invalid email or password." };
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
    return { message: "An account with this email already exists." };
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
