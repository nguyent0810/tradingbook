import type { Metadata } from "next";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingFooter } from "@/components/marketing/landing-footer";

export const metadata: Metadata = {
  title: "Chính sách bảo mật — TradeLog",
  description:
    "TradeLog thu thập, sử dụng và bảo vệ thông tin của bạn như thế nào.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "2026-07-27";

export default function PrivacyPage() {
  return (
    <div className="cd-landing">
      <a href="#main" className="cd-landing__skip">
        Chuyển đến nội dung chính
      </a>
      <LandingHeader />

      <main className="cd-landing__main" id="main" tabIndex={-1}>
        <section className="cd-landing__container cd-legal-hero" aria-labelledby="privacy-title">
          <p className="cd-landing-section__eyebrow">Pháp lý</p>
          <h1 id="privacy-title" className="cd-landing-section__title">
            Chính sách bảo mật
          </h1>
          <p className="cd-legal-meta">Cập nhật lần cuối: {LAST_UPDATED}</p>
        </section>

        <section className="cd-landing__container">
          <div className="cd-legal-body">
            <p>
              Chính sách này giải thích TradeLog (&ldquo;chúng tôi&rdquo;) thu thập, sử dụng, chia
              sẻ và bảo vệ thông tin của bạn như thế nào khi bạn sử dụng nền tảng. Bằng việc tạo
              tài khoản và sử dụng dịch vụ, bạn đồng ý với chính sách này.
            </p>

            <h2>1. Thông tin chúng tôi thu thập</h2>
            <ul>
              <li>
                <strong>Thông tin tài khoản</strong> — email và mật khẩu (được lưu dưới dạng đã
                mã hoá/băm, chúng tôi không bao giờ lưu mật khẩu ở dạng văn bản thuần).
              </li>
              <li>
                <strong>Dữ liệu bạn nhập vào nền tảng</strong> — lệnh giao dịch bạn tự ghi nhận,
                cấu hình quản lý rủi ro, danh sách theo dõi, và các chiến lược mô phỏng bạn tạo ra
                trong Đấu trường (Arena).
              </li>
              <li>
                <strong>Dữ liệu sử dụng &amp; kỹ thuật</strong> — nhật ký đăng nhập, địa chỉ IP,
                loại trình duyệt, và các sự kiện tương tác cơ bản phục vụ vận hành và bảo mật hệ
                thống.
              </li>
              <li>
                <strong>Cookie phiên đăng nhập</strong> — dùng để giữ bạn ở trạng thái đã đăng
                nhập; chúng tôi không dùng cookie quảng cáo hay theo dõi bên thứ ba.
              </li>
            </ul>

            <h2>2. Cách chúng tôi sử dụng thông tin</h2>
            <ul>
              <li>Vận hành và duy trì tài khoản, phiên đăng nhập của bạn.</li>
              <li>
                Tính toán và hiển thị các phán quyết, thiết lập, và kết quả mô phỏng dựa trên dữ
                liệu thị trường và dữ liệu bạn tự nhập.
              </li>
              <li>Phát hiện, ngăn chặn sự cố kỹ thuật, gian lận, hoặc truy cập trái phép.</li>
              <li>Cải thiện chất lượng và độ ổn định của nền tảng.</li>
            </ul>
            <p>
              Chúng tôi <strong>không</strong> sử dụng dữ liệu giao dịch hay danh mục của bạn cho
              mục đích quảng cáo, và không bán dữ liệu cá nhân cho bên thứ ba.
            </p>

            <h2>3. Chia sẻ thông tin</h2>
            <p>
              Chúng tôi chỉ chia sẻ thông tin với các nhà cung cấp hạ tầng cần thiết để vận hành
              dịch vụ (ví dụ: nhà cung cấp lưu trữ máy chủ và cơ sở dữ liệu), theo các thoả thuận
              bảo mật phù hợp — hoặc khi luật pháp yêu cầu. Chúng tôi không chia sẻ dữ liệu cá
              nhân của bạn cho mục đích tiếp thị của bên thứ ba.
            </p>

            <h2>4. Bảo mật dữ liệu</h2>
            <p>
              Chúng tôi áp dụng các biện pháp kỹ thuật hợp lý (mã hoá khi truyền tải, băm mật
              khẩu, kiểm soát truy cập) để bảo vệ thông tin của bạn. Tuy nhiên, không có phương
              thức truyền tải hay lưu trữ nào an toàn tuyệt đối — chúng tôi không thể đảm bảo an
              toàn 100%.
            </p>

            <h2>5. Lưu trữ &amp; xoá dữ liệu</h2>
            <p>
              Chúng tôi lưu trữ thông tin của bạn trong suốt thời gian tài khoản còn hoạt động.
              Bạn có thể yêu cầu xoá tài khoản và dữ liệu liên quan bất kỳ lúc nào theo thông tin
              liên hệ bên dưới, trừ khi pháp luật yêu cầu lưu giữ lâu hơn.
            </p>

            <h2>6. Quyền của bạn</h2>
            <p>
              Bạn có quyền truy cập, chỉnh sửa, hoặc yêu cầu xoá thông tin cá nhân của mình. Liên
              hệ với chúng tôi theo thông tin bên dưới để thực hiện các quyền này.
            </p>

            <h2>7. Đối tượng sử dụng</h2>
            <p>
              Dịch vụ không dành cho người dưới 18 tuổi. Chúng tôi không cố ý thu thập thông tin
              từ trẻ em.
            </p>

            <h2>8. Thay đổi chính sách</h2>
            <p>
              Chúng tôi có thể cập nhật chính sách này theo thời gian. Ngày cập nhật gần nhất
              được hiển thị ở đầu trang. Việc tiếp tục sử dụng dịch vụ sau khi thay đổi có hiệu
              lực đồng nghĩa bạn chấp nhận chính sách mới.
            </p>

            <h2>9. Liên hệ</h2>
            <p>
              Nếu bạn có câu hỏi về chính sách này hoặc muốn thực hiện quyền của mình, vui lòng
              liên hệ: <a href="mailto:privacy@tradelog.app">privacy@tradelog.app</a>{" "}
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
