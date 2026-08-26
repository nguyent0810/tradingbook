# TradeLog VN Terminal v4 — Redesign gate plan

Nguồn thiết kế: `D:\UserFiles\Downloads\Redesign Project Bloomberg Style\`
- `TradeLog Terminal.dc.html` — bản thiết kế đầy đủ (8 màn · 7 modal · trạng thái)
- `TradeLog Terminal - Handoff.dc.html` — tài liệu bàn giao (token · bản đồ màn · QA)

Nguyên tắc bất biến (từ bàn giao §1):
1. **Mật độ trước hết** — hàng bảng 24–27px, chữ 11–12px, đọc hết ở 1440×900.
2. **Phán quyết dẫn dắt** — panel phán quyết góc trên-trái; mức NO_TRADE/PROBE/TRADE chi phối màu + phân bổ + khối lượng ở mọi màn.
3. **Số là công dân hạng nhất** — IBM Plex Mono + `tabular-nums`, căn phải, locale vi-VN.
4. **Viền thay vì bóng** — 1px border, không shadow/gradient, bo góc 2px (nút/ô) · 3px (panel/modal).
5. **Bàn phím là chính** — F1–F8 màn, F9 trợ giúp, ESC đóng, dòng lệnh dưới cùng.
6. **Không trang trí** — không emoji, không icon minh hoạ, không ảnh.

## Gate

| Gate | Phạm vi | Trạng thái |
|---|---|---|
| G0 | Nền tảng: token CSS, font IBM Plex, formatter vi-VN, primitives (Panel/Table/State/Num/Verdict) | ✅ APPROVE |
| G1 | Shell: thanh trên · ticker · nav F · dòng lệnh · thanh trạng thái · F-keys/ESC · trợ giúp F9 | ✅ APPROVE |
| G2 | F1 Điều khiển (`/dashboard`) | ✅ APPROVE |
| G3 | F2 Thiết lập (`/setups`) | ✅ APPROVE |
| G4 | F3 Đấu trường (`/paper-lab`) | ✅ APPROVE |
| G5 | F4 Sổ lệnh (`/book`) + modal lệnh | ✅ APPROVE |
| G6 | F5 Cài đặt (`/settings`) + F6 Phiên (`/login`,`/register`) | ✅ APPROVE |
| G7 | F7 Chi tiết mã (`/symbol/[symbol]` — MỚI) + F8 Trạng thái (trang tham chiếu DEV/QA) | ✅ APPROVE |
| G8 | Quét QA 12 điểm · dọn code chết · typecheck/lint/test toàn bộ | ✅ APPROVE — 28 vòng codex ([G8-QA.md](G8-QA.md)) |

Mỗi gate: implement → `npm run typecheck` + `lint` + `test` → **codex review** → chỉ khi APPROVE mới sang gate kế.

## Ràng buộc kỹ thuật
- Giữ nguyên tầng dữ liệu (DTO/query/server action). Chỉ thay tầng trình bày.
- Không đổi schema Prisma, không đổi API route.
- Next.js 16 App Router — đọc `node_modules/next/dist/docs/` trước khi dùng API mới.
