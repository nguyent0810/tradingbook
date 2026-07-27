import type { Metadata } from "next";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingFooter } from "@/components/marketing/landing-footer";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng — TradeLog",
  description: "Các điều khoản áp dụng khi bạn sử dụng TradeLog.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "2026-07-27";

export default function TermsPage() {
  return (
    <div className="cd-landing">
      <a href="#main" className="cd-landing__skip">
        Chuyển đến nội dung chính
      </a>
      <LandingHeader />

      <main className="cd-landing__main" id="main" tabIndex={-1}>
        <section className="cd-landing__container cd-legal-hero" aria-labelledby="terms-title">
          <p className="cd-landing-section__eyebrow">Pháp lý</p>
          <h1 id="terms-title" className="cd-landing-section__title">
            Điều khoản sử dụng
          </h1>
          <p className="cd-legal-meta">Cập nhật lần cuối: {LAST_UPDATED}</p>
        </section>

        <section className="cd-landing__container">
          <div className="cd-legal-body">
            <p>
              Các điều khoản này áp dụng cho việc bạn truy cập và sử dụng TradeLog (&ldquo;dịch
              vụ&rdquo;). Bằng việc tạo tài khoản hoặc sử dụng dịch vụ, bạn đồng ý với các điều
              khoản dưới đây.
            </p>

            <h2>1. Mô tả dịch vụ</h2>
            <p>
              TradeLog là công cụ nghiên cứu và hỗ trợ quyết định dành cho giao dịch chứng khoán:
              quét thị trường, phát hiện thiết lập kèm bằng chứng, và mô phỏng chiến lược trong
              Đấu trường (Arena). TradeLog{" "}
              <strong>không phải là công ty chứng khoán, không phải cố vấn đầu tư được cấp
              phép</strong>, và <strong>không thực hiện đặt lệnh mua/bán</strong> thay bạn dưới
              bất kỳ hình thức nào.
            </p>

            <h2>2. Không phải lời khuyên đầu tư</h2>
            <p>
              Mọi phán quyết, thiết lập, chỉ số sức mạnh tương đối, và kết quả mô phỏng trên
              TradeLog chỉ mang tính chất thông tin và hỗ trợ ra quyết định — đây{" "}
              <strong>không phải</strong> lời khuyên đầu tư, khuyến nghị mua/bán, hay bảo đảm kết
              quả trong tương lai. Kết quả mô phỏng trong Đấu trường không đại diện cho kết quả
              giao dịch thực tế. Mọi quyết định giao dịch và hậu quả tài chính là trách nhiệm của
              riêng bạn.
            </p>

            <h2>3. Tài khoản người dùng</h2>
            <ul>
              <li>Bạn chịu trách nhiệm bảo mật thông tin đăng nhập của mình.</li>
              <li>Bạn phải từ 18 tuổi trở lên để sử dụng dịch vụ.</li>
              <li>
                Thông tin bạn cung cấp khi đăng ký phải chính xác và được cập nhật khi có thay
                đổi.
              </li>
            </ul>

            <h2>4. Hành vi bị cấm</h2>
            <ul>
              <li>Sử dụng dịch vụ cho mục đích bất hợp pháp.</li>
              <li>Cố gắng truy cập trái phép vào hệ thống hoặc tài khoản của người khác.</li>
              <li>
                Sao chép, phân phối lại, hoặc khai thác thương mại nội dung/công cụ của TradeLog
                mà không được phép.
              </li>
            </ul>

            <h2>5. Giới hạn trách nhiệm</h2>
            <p>
              Dịch vụ được cung cấp &ldquo;nguyên trạng&rdquo;, không có bảo đảm dưới bất kỳ hình
              thức nào. Trong phạm vi pháp luật cho phép, TradeLog không chịu trách nhiệm cho bất
              kỳ tổn thất tài chính, trực tiếp hay gián tiếp, phát sinh từ quyết định giao dịch
              dựa trên thông tin của nền tảng.
            </p>

            <h2>6. Quyền sở hữu trí tuệ</h2>
            <p>
              Toàn bộ mã nguồn, giao diện, và thương hiệu TradeLog thuộc quyền sở hữu của chúng
              tôi. Bạn được cấp quyền sử dụng cá nhân, không độc quyền, không được chuyển nhượng.
            </p>

            <h2>7. Chấm dứt tài khoản</h2>
            <p>
              Chúng tôi có thể tạm ngừng hoặc chấm dứt tài khoản vi phạm các điều khoản này. Bạn
              có thể ngừng sử dụng dịch vụ và yêu cầu xoá tài khoản bất kỳ lúc nào.
            </p>

            <h2>8. Thay đổi điều khoản</h2>
            <p>
              Chúng tôi có thể cập nhật các điều khoản này theo thời gian. Ngày cập nhật gần nhất
              được hiển thị ở đầu trang. Việc tiếp tục sử dụng dịch vụ sau khi thay đổi có hiệu
              lực đồng nghĩa bạn chấp nhận điều khoản mới.
            </p>

            <h2>9. Luật áp dụng</h2>
            <p>
              <em>
                [Cần bổ sung: luật và cơ quan tài phán áp dụng — hiện chưa được xác định cho phiên
                bản này.]
              </em>
            </p>

            <h2>10. Liên hệ</h2>
            <p>
              Nếu bạn có câu hỏi về các điều khoản này, vui lòng liên hệ:{" "}
              <a href="mailto:legal@tradelog.app">legal@tradelog.app</a>{" "}
              <em>(địa chỉ tạm thời — cần được thay bằng email liên hệ thật trước khi phát hành
              chính thức)</em>.
            </p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
