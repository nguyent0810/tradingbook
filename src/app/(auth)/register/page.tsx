import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/terminal/auth-panel";
import { isDatabaseReachable } from "@/lib/terminal/db-reachable";

export const metadata: Metadata = {
  title: "F6 Phiên · Đăng ký — TradeLog VN Terminal",
  description: "Tạo tài khoản mới cho TradeLog VN Terminal.",
};

export default async function RegisterPage() {
  return <AuthPanel mode="register" dbReachable={await isDatabaseReachable()} />;
}
