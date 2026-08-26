import { fmtNum, fmtPctSigned, priceToneClass } from "@/lib/format/vn";
import type { TickerItem } from "@/lib/terminal/ticker-tape";

function TapeRun({ items, ariaHidden }: { items: readonly TickerItem[]; ariaHidden: boolean }) {
  return (
    <>
      {items.map((t) => (
        <span
          key={`${ariaHidden ? "b" : "a"}-${t.symbol}`}
          className="tm-tape__item"
          aria-hidden={ariaHidden || undefined}
        >
          <span className="tm-tape__sym">{t.symbol}</span>
          <span className="tm-tape__px">{fmtNum(t.close, 2)}</span>
          <span className={priceToneClass(t.changePct)}>{fmtPctSigned(t.changePct)}</span>
        </span>
      ))}
    </>
  );
}

/**
 * Băng giá 25px. Chạy vòng bằng cách nhân đôi danh sách rồi dịch trái 50% —
 * bản sao thứ hai chỉ để nối liền mạch nên bị ẩn khỏi trình đọc màn hình.
 */
export function TickerTape({ items }: { items: readonly TickerItem[] }) {
  return (
    <div className="tm-tape">
      <span className="tm-tape__label">HOSE</span>
      <div className="tm-tape__viewport">
        {items.length === 0 ? (
          // Không có bar thì để trống. Vẫn nêu lý do ngắn để người dùng biết
          // băng giá đang thiếu dữ liệu chứ không phải chỉ đứng yên.
          <span className="tm-tape__empty">CHƯA CÓ BAR GIÁ CHO DANH MỤC THEO DÕI</span>
        ) : (
          <div className="tm-tape__run">
            <TapeRun items={items} ariaHidden={false} />
            <TapeRun items={items} ariaHidden />
          </div>
        )}
      </div>
    </div>
  );
}
