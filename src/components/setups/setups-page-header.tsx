import Link from "next/link";
import { V3PageHeader } from "@/components/trading-os-v3/shared/v3-page-header";

export function SetupsPageHeader() {
  return (
    <V3PageHeader
      kicker="Đường ống"
      title="Thiết lập & ứng viên"
      lead="Thiết lập đạt chuẩn, hàng chờ suýt đạt và thông tin lý do bị loại từ lần quét gần nhất."
      testId="setups-page-header"
      actions={
        <Link href="/dashboard" className="tosv3-btn tosv3-btn--secondary">
          Sở chỉ huy
        </Link>
      }
    />
  );
}
