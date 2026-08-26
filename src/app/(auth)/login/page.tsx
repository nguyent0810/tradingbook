import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/terminal/auth-panel";
import { isDatabaseReachable } from "@/lib/terminal/db-reachable";

export const metadata: Metadata = {
  title: "F6 Phiên · Đăng nhập — TradeLog VN Terminal",
  description: "Xác thực phiên làm việc để vào terminal.",
};

export default async function LoginPage() {
  return <AuthPanel mode="login" dbReachable={await isDatabaseReachable()} />;
}
