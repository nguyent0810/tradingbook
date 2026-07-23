import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "TradeLog — Nền tảng Trí tuệ Thiết lập Giao dịch",
  description:
    "TradeLog là nền tảng trí tuệ thiết lập giao dịch: quét thị trường, phát hiện các thiết lập chất lượng cao kèm đầy đủ bằng chứng, và kiểm nghiệm mọi quyết định trước khi bạn xuống tiền.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "TradeLog",
    title: "TradeLog — Nền tảng Trí tuệ Thiết lập Giao dịch",
    description:
      "Biết chính xác cơ hội nào xứng đáng với vốn của bạn. Quét thị trường, phát hiện các thiết lập chất lượng cao kèm đầy đủ bằng chứng, và kiểm nghiệm mọi quyết định trước khi xuống tiền.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "TradeLog — Nền tảng Trí tuệ Thiết lập Giao dịch",
    description:
      "Biết chính xác cơ hội nào xứng đáng với vốn của bạn. Hỗ trợ quyết định dựa trên bằng chứng dành cho nhà đầu tư.",
  },
};

const YEAR = 2026;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tradelog.app";

// Structured data — factual only (no fabricated ratings, prices, or reviews).
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TradeLog",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "TradeLog là nền tảng trí tuệ thiết lập giao dịch: quét thị trường, phát hiện các thiết lập chất lượng cao kèm đầy đủ bằng chứng, và kiểm nghiệm mọi quyết định trước khi bạn xuống tiền.",
};

function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="cd-landing__brand-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

/* ── Faithful, static product previews rendered in the app's own language ── */

function DecisionMock() {
  return (
    <div className="cd-mock" role="img" aria-label="Xem trước phán quyết Dashboard: nhận định hôm nay là Vào lệnh với khối lượng chuẩn, chế độ thị trường thuận lợi rủi ro, cổng vào lệnh đang mở.">
      <div className="cd-mock__head">
        <span className="cd-mock__eyebrow">Phán quyết hôm nay</span>
        <span className="cd-mock__chip cd-mock__chip--go">
          <span className="cd-mock__dot" />
          Vào lệnh · Chuẩn
        </span>
      </div>
      <div className="cd-mock__verdict">Vào lệnh — khối lượng chuẩn</div>
      <div className="cd-mock__sub">Độ tin cậy 68% · bối cảnh thuận lợi rủi ro</div>
      <div className="cd-mock__meter" aria-hidden="true">
        <div className="cd-mock__meter-fill" style={{ width: "68%" }} />
      </div>
      <div className="cd-mock__rows">
        <div className="cd-mock__row">
          <span className="cd-mock__row-label">Chế độ thị trường</span>
          <span className="cd-mock__row-val">Thuận lợi rủi ro</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-label">Cổng vào lệnh</span>
          <span className="cd-mock__row-val">Đang mở</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-label">Sức mạnh tương đối</span>
          <span className="cd-mock__row-val">Nhóm dẫn dắt đồng thuận</span>
        </div>
      </div>
      <p className="cd-mock__evidence">
        Điều kiện thị trường ủng hộ vào lệnh mới với khối lượng chuẩn — không có gì trong danh sách theo dõi đang cản trở.
      </p>
    </div>
  );
}

function SetupsMock() {
  return (
    <div className="cd-mock" role="img" aria-label="Xem trước Thiết lập: danh sách ứng viên đã xếp hạng, FPT sẵn sàng vào lệnh và MWG đang chờ bứt phá, mỗi mã đều kèm bằng chứng.">
      <div className="cd-mock__head">
        <span className="cd-mock__eyebrow">Danh sách đã xác thực</span>
        <span className="cd-mock__chip cd-mock__chip--cyan">5 ứng viên</span>
      </div>
      <div className="cd-mock__rows">
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">FPT</span>
          <span className="cd-mock__chip cd-mock__chip--go">Sẵn sàng</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">MWG</span>
          <span className="cd-mock__chip cd-mock__chip--watch">Theo dõi · chờ bứt phá</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">HPG</span>
          <span className="cd-mock__chip cd-mock__chip--watch">Theo dõi · chờ hồi kỹ thuật</span>
        </div>
      </div>
      <p className="cd-mock__evidence">
        FPT: giá đang trong vùng vào lệnh · sức mạnh tương đối dẫn đầu · chỉ còn một xác nhận nữa.
      </p>
    </div>
  );
}

function ArenaMock() {
  return (
    <div className="cd-mock" role="img" aria-label="Xem trước Đấu trường: các chiến lược được xếp hạng theo kết quả mô phỏng trước khi có bất kỳ khoản vốn thực nào được sử dụng.">
      <div className="cd-mock__head">
        <span className="cd-mock__eyebrow">Chỉ mô phỏng</span>
        <span className="cd-mock__chip cd-mock__chip--cyan">Không dùng vốn thực</span>
      </div>
      <div className="cd-mock__rows">
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">Momentum-A</span>
          <span className="cd-mock__row-val cd-mock__row-val--pos">+12.4%</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">Pullback-B</span>
          <span className="cd-mock__row-val cd-mock__row-val--pos">+7.1%</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">Breakout-C</span>
          <span className="cd-mock__row-val">+2.0%</span>
        </div>
      </div>
      <p className="cd-mock__evidence">
        Các chiến lược cạnh tranh trên cùng phiên giao dịch — xem điều gì thực sự hiệu quả trước khi bạn đặt cược vào nó.
      </p>
    </div>
  );
}

/** Session check is a Request-time API (cookies()) — isolated in its own component so
 *  the rest of this marketing page can still be part of the static prerendered shell. */
async function HomeAuthGate() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  return null;
}

export default function Home() {
  return (
    <div className="cd-landing">
      <Suspense fallback={null}>
        <HomeAuthGate />
      </Suspense>
      {/* Static JSON-LD (no user input) — safe use of dangerouslySetInnerHTML */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <a href="#main" className="cd-landing__skip">
        Chuyển đến nội dung chính
      </a>
      <header className="cd-landing__header">
        <div className="cd-landing__container cd-landing__header-inner">
          <Link href="/" className="cd-landing__brand" aria-label="Trang chủ TradeLog">
            <BrandMark />
            TradeLog
          </Link>
          <nav className="cd-landing__nav" aria-label="Tài khoản">
            <Link href="/login" className="cd-landing-btn cd-landing-btn--ghost">
              Đăng nhập
            </Link>
            <Link href="/register" className="cd-landing-btn cd-landing-btn--primary">
              Tạo tài khoản
            </Link>
          </nav>
        </div>
      </header>

      <main className="cd-landing__main" id="main" tabIndex={-1}>
        {/* Hero */}
        <section className="cd-landing__container cd-landing-hero" aria-labelledby="hero-title">
          <div>
            <span className="cd-landing-hero__eyebrow">Nền tảng Trí tuệ Thiết lập Giao dịch</span>
            <h1 id="hero-title" className="cd-landing-hero__title">
              Biết chính xác cơ hội nào{" "}
              <span className="cd-landing-hero__title-accent">xứng đáng với vốn của bạn.</span>
            </h1>
            <p className="cd-landing-hero__lead">
              Quét thị trường, phát hiện các thiết lập chất lượng cao kèm đầy đủ bằng chứng,
              và kiểm nghiệm mọi quyết định trước khi bạn xuống tiền.
            </p>
            <div className="cd-landing-hero__cta">
              <Link href="/register" className="cd-landing-btn cd-landing-btn--primary cd-landing-btn--lg">
                Tạo tài khoản
              </Link>
              <Link href="/login" className="cd-landing-btn cd-landing-btn--ghost cd-landing-btn--lg">
                Đăng nhập
              </Link>
            </div>
            <p className="cd-landing-hero__note">
              Công cụ hỗ trợ quyết định — không phải sổ nhật ký giao dịch, không phải công ty chứng khoán. TradeLog không bao giờ đặt lệnh thay bạn.
            </p>
          </div>
          <div className="cd-landing-hero__visual">
            <DecisionMock />
          </div>
        </section>

        {/* The problem */}
        <section className="cd-landing-section" aria-labelledby="problem-title">
          <div className="cd-landing__container">
            <p className="cd-landing-section__eyebrow">Vấn đề</p>
            <h2 id="problem-title" className="cd-landing-section__title">
              Khó không phải là tìm ra cơ hội giao dịch. Khó là biết cơ hội nào xứng đáng với vốn của bạn.
            </h2>
            <p className="cd-landing-section__lead">
              Hầu hết công cụ chỉ ghi lại những gì bạn đã làm hoặc theo dõi những gì bạn đang nắm giữ.
              Không công cụ nào cho bạn biết liệu thiết lập hôm nay có đáng để hành động hay không —
              vì vậy sự tự tin đến từ cảm tính, và những sai lầm cũ cứ lặp lại.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="cd-landing-section" id="workflow" aria-labelledby="workflow-title">
          <div className="cd-landing__container">
            <p className="cd-landing-section__eyebrow">Cách vận hành</p>
            <h2 id="workflow-title" className="cd-landing-section__title">
              Một quy trình duy nhất, từ khi mở cửa thị trường đến khi ra quyết định.
            </h2>
            <p className="cd-landing-section__lead">
              Ba module liên kết đưa bạn từ nhận định trong ngày đến một quyết định bạn có thể bảo vệ được.
            </p>
            <ol className="cd-landing-steps">
              <li className="cd-landing-step">
                <span className="cd-landing-step__num">1</span>
                <p className="cd-landing-step__stage">Bảng điều khiển</p>
                <h3 className="cd-landing-step__title">Quét trong ngày</h3>
                <p className="cd-landing-step__copy">
                  Bắt đầu với nhận định trong ngày — chế độ thị trường, cổng vào lệnh và sức mạnh
                  tương đối, gói gọn trong một phán quyết duy nhất. Biết ngay hôm nay có nên hành động hay không.
                </p>
              </li>
              <li className="cd-landing-step">
                <span className="cd-landing-step__num">2</span>
                <p className="cd-landing-step__stage">Thiết lập</p>
                <h3 className="cd-landing-step__title">Xác thực lợi thế</h3>
                <p className="cd-landing-step__copy">
                  Làm việc với danh sách ứng viên đã xếp hạng theo dạng bứt phá và hồi kỹ thuật.
                  Mỗi ứng viên đều có bằng chứng đi kèm và điều kiện cụ thể còn cần xác nhận.
                </p>
              </li>
              <li className="cd-landing-step">
                <span className="cd-landing-step__num">3</span>
                <p className="cd-landing-step__stage">Đấu trường</p>
                <h3 className="cd-landing-step__title">Kiểm nghiệm áp lực</h3>
                <p className="cd-landing-step__copy">
                  Đưa chiến lược qua vòng thi đấu mô phỏng trước khi bạn dùng vốn thực. Xem điều gì
                  thực sự trụ vững.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* Three pillars */}
        <section className="cd-landing-section" id="pillars" aria-labelledby="pillars-title">
          <div className="cd-landing__container">
            <p className="cd-landing-section__eyebrow">Bên trong nền tảng</p>
            <h2 id="pillars-title" className="cd-landing-section__title">
              Ba module, một quyết định.
            </h2>
            <div className="cd-landing-pillars">
              <article className="cd-landing-pillar">
                <span className="cd-landing-pillar__name">Bảng điều khiển</span>
                <h3 className="cd-landing-pillar__title">Phán quyết hôm nay, nhìn là hiểu</h3>
                <p className="cd-landing-pillar__copy">
                  Chế độ thị trường, cổng vào lệnh và sức mạnh tương đối hội tụ thành một phán quyết
                  duy nhất — để bạn biết hôm nay có nên vào lệnh hay không trước khi nhìn vào bất kỳ biểu đồ nào.
                </p>
                <DecisionMock />
              </article>
              <article className="cd-landing-pillar">
                <span className="cd-landing-pillar__name">Thiết lập</span>
                <h3 className="cd-landing-pillar__title">Một quy trình đáng tin cậy</h3>
                <p className="cd-landing-pillar__copy">
                  Ứng viên bứt phá và hồi kỹ thuật, đã xếp hạng — mỗi mã đều có bằng chứng đủ điều
                  kiện và một điều kiện cụ thể còn cần xác nhận.
                </p>
                <SetupsMock />
              </article>
              <article className="cd-landing-pillar">
                <span className="cd-landing-pillar__name">Đấu trường</span>
                <h3 className="cd-landing-pillar__title">Chứng minh trước khi xuống tiền</h3>
                <p className="cd-landing-pillar__copy">
                  Các chiến lược cạnh tranh trong mô phỏng trên cùng phiên giao dịch — để bạn đặt
                  cược vào điều thực sự hiệu quả, không phải điều nghe có vẻ hay.
                </p>
                <ArenaMock />
              </article>
            </div>
          </div>
        </section>

        {/* Evidence-driven decision making */}
        <section className="cd-landing-section" id="evidence" aria-labelledby="evidence-title">
          <div className="cd-landing__container cd-landing-evidence">
            <div>
              <p className="cd-landing-section__eyebrow">Vì sao đáng tin</p>
              <h2 id="evidence-title" className="cd-landing-section__title">
                Mọi phán quyết đều có căn cứ rõ ràng.
              </h2>
              <p className="cd-landing-section__lead">
                Không hộp đen. Bạn hành động dựa trên lý lẽ có thể bảo vệ được — không phải một con số bí ẩn.
              </p>
              <ul className="cd-landing-evidence__list">
                <li className="cd-landing-evidence__item">
                  <svg className="cd-landing-evidence__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  <span><strong>Bằng chứng cho mọi thiết lập</strong> — chính xác những tín hiệu đã giúp nó đủ điều kiện.</span>
                </li>
                <li className="cd-landing-evidence__item">
                  <svg className="cd-landing-evidence__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  <span><strong>Điều kiện còn cần xác nhận</strong> — điều gì phải xảy ra trước khi có thể vào lệnh.</span>
                </li>
                <li className="cd-landing-evidence__item">
                  <svg className="cd-landing-evidence__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  <span><strong>Sức mạnh tương đối trong bối cảnh</strong> — nhóm dẫn dắt được đo lường so với chỉ số tham chiếu, không tách biệt.</span>
                </li>
                <li className="cd-landing-evidence__item">
                  <svg className="cd-landing-evidence__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  <span><strong>Mô phỏng trước khi thực chiến</strong> — được kiểm nghiệm tại Đấu trường trước tiên.</span>
                </li>
              </ul>
            </div>
            <div>
              <SetupsMock />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="cd-landing-section" aria-labelledby="cta-title">
          <div className="cd-landing__container">
            <div className="cd-landing-cta">
              <h2 id="cta-title" className="cd-landing-cta__title">
                Bắt đầu đưa ra những quyết định bạn có thể bảo vệ.
              </h2>
              <p className="cd-landing-cta__lead">
                Tạo tài khoản và đưa thị trường hôm nay vào thử nghiệm.
              </p>
              <div className="cd-landing-cta__actions">
                <Link href="/register" className="cd-landing-btn cd-landing-btn--primary cd-landing-btn--lg">
                  Tạo tài khoản
                </Link>
                <Link href="/login" className="cd-landing-btn cd-landing-btn--ghost cd-landing-btn--lg">
                  Đăng nhập
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="cd-landing-footer">
        <div className="cd-landing__container">
          <div className="cd-landing-footer__inner">
            <div className="cd-landing-footer__brand">
              <Link href="/" className="cd-landing__brand" aria-label="Trang chủ TradeLog">
                <BrandMark />
                TradeLog
              </Link>
              <p className="cd-landing-footer__tagline">
                Trí tuệ thiết lập giao dịch dành cho nhà đầu tư quyết đoán — hỗ trợ quyết định dựa
                trên bằng chứng, từ nhận định trong ngày đến thiết lập đã xác thực.
              </p>
            </div>
            <div className="cd-landing-footer__links">
              <div className="cd-landing-footer__col">
                <span className="cd-landing-footer__col-title">Khám phá</span>
                <a href="#workflow" className="cd-landing-footer__link">Cách vận hành</a>
                <a href="#pillars" className="cd-landing-footer__link">Nền tảng</a>
                <a href="#evidence" className="cd-landing-footer__link">Vì sao đáng tin</a>
              </div>
              <div className="cd-landing-footer__col">
                <span className="cd-landing-footer__col-title">Tài khoản</span>
                <Link href="/login" className="cd-landing-footer__link">Đăng nhập</Link>
                <Link href="/register" className="cd-landing-footer__link">Tạo tài khoản</Link>
              </div>
            </div>
          </div>
          <div className="cd-landing-footer__legal">
            <p className="cd-landing-footer__disclaimer">
              TradeLog cung cấp công cụ nghiên cứu và hỗ trợ quyết định. Đây không phải là lời
              khuyên đầu tư và không thực hiện đặt lệnh. Kết quả mô phỏng không đảm bảo kết quả
              trong tương lai.
            </p>
            <p>© {YEAR} TradeLog</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
