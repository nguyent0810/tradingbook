# Đánh giá mức sẵn sàng giao dịch tiền thật (live trading readiness)

**Ngày:** 2026-09-25 · **HEAD:** `a2e3904` (commit gần nhất 2026-08-26)
**Câu hỏi:** Dự án này đã dùng được để giao dịch thật, bằng tiền thật, chưa?
**Phạm vi:** đánh giá phần mềm và bằng chứng mà repo đang có. Đây không phải lời khuyên đầu tư cá nhân.

---

## 1. Kết luận ngắn

### Verdict: **CHƯA SẴN SÀNG**

Không có điều kiện nào trong ngắn hạn biến câu trả lời thành "có". Lý do nằm ở chính nghiên cứu của repo, không phải ở thiếu tính năng:

1. **Phần mềm không đặt lệnh thật.** Không có tích hợp broker nào. Mọi "lệnh" đều ghi vào bảng `paper_orders`.
2. **Chưa chứng minh được edge sau chi phí.** Repo tự kết luận `NO_EDGE`/`INCONCLUSIVE` cho baseline, `M2 NO-GO`, `FEASIBILITY NO-GO`, `NO TRUE OUT-OF-SAMPLE DATA AVAILABLE`, rồi đóng hướng nghiên cứu lịch sử (`RESEARCH CLOSED — PROSPECTIVE VALIDATION ONLY`).
3. **Bằng chứng tương lai (prospective) đang là 0.** Registry có tồn tại nhưng không được lên lịch chạy. Checkpoint đầu tiên (N = 100) dự kiến phải mất khoảng 1,2–1,7 năm *sau khi* bắt đầu ghi.

Repo đang tự định vị mình là **công cụ watchlist/lập kế hoạch EOD và phòng thí nghiệm paper-trading**. Cách dùng đó phù hợp với bằng chứng hiện có. Dùng tín hiệu hoặc stance của nó để đặt tiền thật thì không.

---

## 2. Bằng chứng theo từng hạng mục

### 2.1 Thực thi lệnh: không có broker, mọi thứ đều là paper/shadow/journal

| Phát hiện | Nguồn |
|---|---|
| Tìm `vndirect\|tcbs\|dnse\|fireant\|ssi-fc/iboard/fastconnect\|entrade\|placeOrder\|submitOrder\|broker_api` trong `src/`, `scripts/`, `prisma/` thì chỉ có 2 kết quả, đều là mã cổ phiếu `MBS` trong bảng map ngành | `src/lib/dashboard/rs-sector-display.ts:37`, `scripts/audit/early-entry-sector-map.ts:35` |
| Trong `src/` chỉ có một host `fetch` ra ngoài là `api.openai.com` (LLM, mặc định tắt) | grep `fetch(` trong `src/**/*.ts`; `TRADING-DATA-REMEDIATION-PLAN.md` §1.1 dòng 6 của bảng |
| Route "orders" chỉ đọc `prisma.paperOrder` | `src/app/api/paper-lab/orders/route.ts:13` |
| Các model lệnh/vị thế đều là paper: `PaperOrder`, `PaperPosition`, `PaperTrade` (`@@map("paper_orders")`…). `Trade` là nhật ký nhập tay | `prisma/schema.prisma:748-831`, `:47` |
| Allocation review luôn ghi `applied=false`, ngay cả khi có `force` | `src/lib/paper-lab/dna/allocation-review-job.ts:11-16`, `:153`, `:181` |
| Shadow pipeline M1 và prospective registry có **0 call site trong production** | `docs/trading/replay/RESEARCH-CLOSURE-RECORD.md:26-30`; `PROSPECTIVE-SHADOW-READINESS.md:61-68` |
| Nguồn dữ liệu là API private không công bố của Vietcap, lấy qua `vnstock`. Đây là nguồn dữ liệu, không phải kênh đặt lệnh | `TRADING-DATA-REMEDIATION-PLAN.md` §1.1 |

### 2.2 Bằng chứng chiến lược: không có edge out-of-sample sau chi phí

| Nghiên cứu | Kết luận (trích) | Nguồn |
|---|---|---|
| Baseline replay 2010–2026 (498 tín hiệu) | "No — the baseline strategy does not have a demonstrated edge." Mã verdict là `INCONCLUSIVE`, còn Codex đọc là `NO_EDGE`. Trung vị −2,47%/lệnh, 58% lệnh bị stop. 59,6% tổng R đến từ riêng REE | `docs/trading/replay/BASELINE-EDGE-VERDICT.md:11`, `:26-41` |
| Theo năm | 2022–2024 đi ngang hoặc âm. **2026: n=15, win 6,7%, stop 93,3%, trung bình −4,59%** | `BASELINE-EDGE-VERDICT.md:49-60` |
| Mô hình giao dịch của replay | Không có slippage, phí, T+2, biên độ giá hay sizing, nên kết quả là "UPPER BOUND on what live trading would return" | `src/lib/replay/trade-model.ts:19-22`; `BASELINE-EDGE-VERDICT.md:149-151` |
| Dữ liệu OOS | `NO TRUE OUT-OF-SAMPLE DATA AVAILABLE`. Một forward holdout cần khoảng 10 năm | `docs/trading/replay/OOS-DATA-AUDIT.md:9`, `:524`, `:558` |
| Scanner production (3 tháng) | "Verdict: not battle-ready". 6 setup trong 3 tháng, 0 dòng `SetupOutcome` | `docs/trading/SCANNER-EDGE-REALITY-CHECK.md:7-8`, `:15-22` |
| M2 visibility | `M2 NO-GO`. Nhóm hidden→visible có T+5 −0,13% so với control +0,80% | `docs/trading/replay/POST-BACKFILL-M2-DECISION.md:10`; `RESEARCH-CLOSURE-RECORD.md:32-47` |
| Feasibility gate | `FEASIBILITY NO-GO` dù C1–C4 đều pass. Không có hiệu ứng trước 2022, âm ở 3/12 năm, **cận dưới CI 0,13% thấp hơn phí khứ hồi 0,40% mà chính repo đặt** | `FEASIBILITY-GATE-RESULT.md:10`, `:242`; `RESEARCH-CLOSURE-RECORD.md:53-77` |
| Đóng nghiên cứu | `RESEARCH CLOSED — PROSPECTIVE VALIDATION ONLY`. Cấm dùng thêm dữ liệu lịch sử để "cứu" giả thuyết | `RESEARCH-CLOSURE-RECORD.md:5-10`, `:130-141` |
| Audit thuật toán | "It is not yet safe to rely on for serious position sizing… Do not treat score, tier, or 'TRADE/NORMAL' stance as an independently validated buy signal." Tier A n=2, Tier B n=0 (F02) | `docs/audits/trading-algorithm-audit.md:7-9`, `:77-78` |
| Stance "NORMAL 50-70%" | Có thể sinh ra chỉ từ Gate 1 PASS cộng một setup A/B, không phụ thuộc expectancy hay chi phí (F03, P0) | `trading-algorithm-audit.md:79`; `src/lib/scanner/trading-decision.ts:35` |

**Các giới hạn chưa được giải quyết** (repo tự ghi): suy luận in-sample, survivorship, giá back-adjusted nhưng volume raw, so sánh bội qua 17 pha, và D4 capacity chưa đánh giá được vì `portfolioOpenRiskVnd` không tồn tại trong production. Nguồn: `RESEARCH-CLOSURE-RECORD.md:91-105`.

### 2.3 Bằng chứng prospective và các lịch review

| Phát hiện | Nguồn |
|---|---|
| Registry bắt đầu sau ngày 2026-08-24. Lúc freeze có **0 quan sát** | `PROSPECTIVE-SHADOW-READINESS.md:18-23` |
| Recorder **phải được lên lịch thủ công**. Lỡ một ngày là mất quan sát vĩnh viễn, không được dựng lại | `PROSPECTIVE-SHADOW-READINESS.md:69-71`, `:128-130` |
| **Hôm nay (2026-09-25) không có scheduler nào gọi recorder**: `vercel.json` có 4 cron, không cron nào là prospective; `.github/workflows` chỉ có `ci.yml` và `production-bar-import.yml` | `vercel.json`; `.github/workflows/production-bar-import.yml` |
| Thư mục dữ liệu mặc định `docs/trading/replay/prospective/` **không tồn tại** trong working tree, tức là không có `decisions.ndjson` | `src/lib/prospective/registry-store.ts:32-34` |
| Checkpoint đã freeze: N=100 mất khoảng 1,2–1,7 năm, N=250 khoảng 3–4 năm. Tốc độ tích lũy khoảng 60–90 setup/năm | `PROSPECTIVE-REGISTRY-PLAN.md:150-167`; `PROSPECTIVE-SHADOW-READINESS.md:137-139` |
| Shadow Allocation: cron chạy hàng tháng `0 16 1 * *`, luôn read-only và `applied=false`. Cần tối thiểu 20 phiên track record, cửa sổ 63 phiên | `vercel.json`; `src/lib/paper-lab/dna/allocation.ts:16-19` |
| **Kết quả review 2026-08-01 và 2026-09-01: repo không có bằng chứng.** Không doc hay report nào nhắc đến hai kỳ này. Kết quả, nếu có, chỉ nằm trong bảng `allocation_reviews` của DB production, và audit này không truy vấn DB đó. Riêng DNA engine chỉ bắt đầu chạy từ 2026-07-10, nên kỳ review tháng 7 khó có đủ 20 phiên DNA | grep `2026-08-01\|2026-09-01` trong `docs/`, `reports/` |

Nếu registry không được chạy ở nơi nào ngoài repo, thì khoảng **20 phiên đủ điều kiện từ 2026-08-25 đến nay (ước tính, đã trừ nghỉ lễ 2/9) đã mất vĩnh viễn**. Đồng hồ 1,2–1,7 năm cũng chưa thực sự bắt đầu chạy.

### 2.4 Độ tin cậy dữ liệu

| Vấn đề | Trạng thái | Nguồn |
|---|---|---|
| Bar production đóng băng từ khoảng 2026-05-05 vì import chưa tự động | **Đã khắc phục**: workflow GitHub Actions chạy Mon–Fri 12:30 UTC | `docs/integration/PRODUCTION_DATA_INTEGRITY_INVESTIGATION.md:12-18`; `PRODUCTION_BAR_FRESHNESS_RECOVERY.md`; `.github/workflows/production-bar-import.yml:1-14` |
| Symbol smoke `P0DEXIT` lọt vào Best Setups | Đã điều tra, có kế hoạch cleanup | `PRODUCTION_DATA_INTEGRITY_INVESTIGATION.md:18`, `:55-110` |
| Scan chạy 2 lần mỗi ngày | Đã sửa | `SCANNER-EDGE-REALITY-CHECK.md:158` |
| Giá back-adjusted nhưng volume raw, làm traded value lẫn cơ sở tính | **Chưa sửa**: remediation plan mới là *Plan*, mới làm được mục pin dependency | `TRADING-DATA-REMEDIATION-PLAN.md:4`, `:17-19`; `RESEARCH-CLOSURE-RECORD.md:99-100` |
| Schema không có cột hay bảng adjustment/corporate action | Chưa có (grep `adjust\|corporate` trong `prisma/schema.prisma` rỗng) | `trading-algorithm-audit.md:77` (F01) |
| Chưa có guard nến chưa hoàn tất và lịch sàn | Chưa thấy khắc phục | `trading-algorithm-audit.md:80` (F04) |
| 6.844 dòng có open/close nằm ngoài [low, high] (2018–2021) | Vẫn còn | `RESEARCH-CLOSURE-RECORD.md:104-105` |
| 76,9% symbol (1.182/1.537) không có bar lưu trữ | Vẫn còn | `BASELINE-EDGE-VERDICT.md:144-148` |
| **Giấy phép `vnstock`: "Personal, research, non-commercial"**, trong khi app đang chạy production. Dữ liệu lấy từ API private của Vietcap | Chưa giải quyết | `OPENBB_FEASIBILITY_AUDIT.md:66-70`; `TRADING-DATA-REMEDIATION-PLAN.md` §1.1 |

### 2.5 Kiểm soát rủi ro trong code

**Đã có (chỉ áp dụng cho paper/planning):**
- Paper engine: vốn ảo 500 triệu VND mỗi agent. Mỗi lệnh tối đa 20% NAV, tổng exposure tối đa 70%, rủi ro 1%/lệnh, tối đa 3 vị thế mới mỗi ngày (`src/lib/paper-lab/constants.ts:2-10`).
- Validator: bắt buộc có stop và TP, lô 100 cổ, không vượt tiền mặt, biên độ ±7%, chặn giá lệch hơn 15% so với giá đóng cửa (`src/lib/paper-lab/engine/order-validator.ts:60-99`).
- Journal/planning: `UserTradingSettings` có `accountEquityVnd`, `riskPerTradePct`, `maxPositionPct`, `liquidityCapPct` (`prisma/schema.prisma:29-46`). Trade Gate chặn "Go" khi NO_TRADE hoặc Gate 1 FAIL (`trading-algorithm-audit.md:128-134`).

**Thiếu hoặc lạc quan:**
- **Không có kill switch, max-drawdown halt hay giới hạn lỗ theo ngày ở tầng thực thi.** `maxDrawdown` chỉ xuất hiện trong analytics và metrics (`src/lib/paper-lab/performance/metrics.ts`, `src/lib/analytics.ts`), không có ở đường ra lệnh.
- **Stop được khớp đúng giá stop dù phiên gap xuống qua stop.** Kết quả lỗ vì vậy bị làm đẹp (`src/lib/paper-lab/engine/paper-trading-engine.ts:411-415`).
- **Không mô phỏng T+2.** Grep `T+2\|settle\|sellable` trong paper engine không có kết quả, nên có thể bán ngay trong phiên kế tiếp.
- Phí 15 bps áp cho cả chiều mua lẫn bán. **Thuế bán 0,1% không được tính riêng** (`paper-trading-engine.ts:129`, `:263`, `:425`). `PAPER_DEFAULT_SLIPPAGE_BPS = 10` được khai báo nhưng không được dùng ở đâu (`constants.ts:8`; grep toàn `src`).
- Biên độ cố định 7% là của HOSE. HNX (±10%) và UPCoM (±15%) không được phân biệt (`constants.ts:9`).
- Gate 1 chỉ dùng VNINDEX so với MA50 và động lượng. Không có breadth, khối ngoại, biến động hay tập trung ngành làm hard gate (`trading-algorithm-audit.md:82`, F06, `:136-142`).

### 2.6 Kiểm thử và vận hành

| Phát hiện | Nguồn |
|---|---|
| CI chạy typecheck, test và lint trên mỗi push | `.github/workflows/ci.yml:17-21` |
| 159 file test (65 file trong paper-lab/scanner/replay/prospective). Doc readiness ghi 1.301 test pass | `find -name '*.test.ts'`; `PROSPECTIVE-SHADOW-READINESS.md` §Verification |
| Test tốt ở tầng công thức, nhưng thiếu test cho adjusted/raw, corporate action, nến dở, ngày sốc (F12) | `trading-algorithm-audit.md:89`, `:168-183` |
| Cron: daily-scan 14:00 UTC, paper-lab-daily 14:15 UTC, lab-analytics 14:45 UTC, shadow-allocation ngày 1 hàng tháng. Import bar chạy trên GitHub Actions | `vercel.json`; `production-bar-import.yml:12-13` |
| Không có một doc hay report nào sau 2026-08-26 ghi lại tình trạng các cron hay kết quả review | `git log -1` = 2026-08-26 |

### 2.7 Bảo mật và vận hành (các điểm liên quan nếu dùng tiền thật)

- **Không có file secret nào bị track trong git.** `git ls-files` và `git log --all` cho `local.env`, `.env`, `.env.local`, `.env.prod.local` đều rỗng. Tất cả được bỏ qua bởi `.gitignore:40` (`.env*`) và `.gitignore:66` (`local.env`). Chỉ `.secrets/vercel.env.example` được track.
- **Có secret dạng plaintext trên máy local** (chỉ liệt kê tên biến, không đọc giá trị): `local.env` chứa `GITHUB_TOKEN`; `.env.prod.local` chứa `DATABASE_URL` và `CRON_SECRET` của production; `.env` chứa `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`; ngoài ra có `.secrets/vercel.env`. Nếu sau này thêm API key của broker thì mô hình lưu secret kiểu này không đủ.
- Có một tiền lệ: app từng chạy trên dữ liệu mock/fallback trong production khi thiếu migration (bảng fixtures FPT 98.5) mà không báo lỗi. Hardening migration đã được thêm sau đó. Nguồn là ghi chú vận hành, không phải doc trong repo, nên chỉ dùng làm bối cảnh.

---

## 3. Những gì còn thiếu trước khi dùng tiền thật (theo thứ tự)

1. **Lên lịch ngay prospective recorder** (sau import EOD, trước phiên kế tiếp), kèm cảnh báo khi một phiên bị bỏ lỡ. Nếu không có bước này, đồng hồ bằng chứng không chạy.
2. **Chờ checkpoint N = 100 theo plan đã freeze** (khoảng 1,2–1,7 năm) và chỉ đọc kết quả tại checkpoint. Cho tới lúc đó, mọi con số chỉ là mô tả.
3. **Cần một chiến lược có kết quả dương sau chi phí thực**: phí hai chiều + thuế bán 0,1% + slippage + gap qua stop + T+2 + biên độ theo sàn + giới hạn thanh khoản. Cận dưới CI phải lớn hơn chi phí, không chỉ ước lượng điểm.
4. **Sửa mô hình paper engine** cho trung thực: khớp stop ở `min(stop, open)` khi gap, áp T+2, tách thuế bán, dùng slippage, biên độ theo từng sàn.
5. **Kiểm soát rủi ro cấp danh mục**: max drawdown halt, giới hạn lỗ ngày/tuần, kill switch thủ công, giới hạn tập trung ngành, và `portfolioOpenRiskVnd` (hiện chưa tồn tại).
6. **Dữ liệu**: thống nhất cơ sở giá/volume (adjusted và raw), guard nến chưa hoàn tất và lịch sàn, job kiểm tra sức khỏe dữ liệu (F09). **Giải quyết giấy phép `vnstock`** hoặc chuyển sang nguồn có hợp đồng.
7. **Xác minh Shadow Allocation**: đọc các dòng `allocation_reviews` (08/2026, 09/2026), ghi kết quả vào repo, và đủ khoảng 6 kỳ tháng trước khi thiết kế phân bổ vốn thật.
8. **Sửa ngôn ngữ UI** để không gợi ý hành động: "Actionable now", "Go", "NORMAL 50-70%" (F03, F08).
9. **Chỉ khi 1–8 đã xong** mới cân nhắc tích hợp broker: có sandbox, xác nhận thủ công từng lệnh, idempotency, reconcile vị thế, audit log, và lưu secret trong secret manager thay vì file `.env`.
10. Nếu vẫn muốn dùng sớm: chỉ dùng như **watchlist hoặc checklist cho quyết định thủ công**, với vốn đã chấp nhận mất, và ghi journal mọi lệnh để có dữ liệu thật.

---

## 4. Nguồn

- `docs/trading/replay/RESEARCH-CLOSURE-RECORD.md`
- `docs/trading/replay/BASELINE-EDGE-VERDICT.md`
- `docs/trading/replay/FEASIBILITY-GATE-RESULT.md`
- `docs/trading/replay/POST-BACKFILL-M2-DECISION.md`
- `docs/trading/replay/OOS-DATA-AUDIT.md`
- `docs/trading/replay/PROSPECTIVE-REGISTRY-PLAN.md`
- `docs/trading/replay/PROSPECTIVE-SHADOW-READINESS.md`
- `docs/trading/SCANNER-EDGE-REALITY-CHECK.md`
- `docs/audits/trading-algorithm-audit.md`
- `docs/integration/PRODUCTION_DATA_INTEGRITY_INVESTIGATION.md`
- `docs/integration/PRODUCTION_BAR_FRESHNESS_RECOVERY.md`
- `TRADING-DATA-REMEDIATION-PLAN.md`
- `OPENBB_FEASIBILITY_AUDIT.md`
- `src/lib/paper-lab/constants.ts`
- `src/lib/paper-lab/engine/order-validator.ts`
- `src/lib/paper-lab/engine/paper-trading-engine.ts`
- `src/lib/replay/trade-model.ts`
- `src/lib/scanner/stop-feasibility.ts:52` (`ROUND_TRIP_FEE_FRAC = 0.004`)
- `src/lib/paper-lab/dna/allocation.ts`
- `src/lib/paper-lab/dna/allocation-review-job.ts`
- `src/lib/prospective/registry-store.ts`
- `src/app/api/paper-lab/orders/route.ts`
- `src/app/api/cron/shadow-allocation-review/route.ts`
- `prisma/schema.prisma`
- `vercel.json`
- `.github/workflows/ci.yml`
- `.github/workflows/production-bar-import.yml`
- `.gitignore`

**Chưa kiểm tra (ngoài phạm vi, không truy vấn production):** nội dung bảng `allocation_reviews`, `paper_*` và `DailyScanRun` trên Neon. Cũng chưa kiểm tra xem recorder có được chạy ở máy khác ngoài repo hay không.
