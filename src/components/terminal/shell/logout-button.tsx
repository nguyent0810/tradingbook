import { logout } from "@/app/actions/auth";

/** Nút đăng xuất trên thanh trên — server action sẵn có, chỉ đổi lớp trình bày. */
export function TerminalLogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="tm-btn tm-btn--sm" data-testid="nav-signout">
        ĐĂNG XUẤT
      </button>
    </form>
  );
}
