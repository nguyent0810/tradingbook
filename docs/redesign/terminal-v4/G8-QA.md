# Gate 8 · Quét QA 12 điểm + dọn code chết

## 1. Dọn code chết

Xây đồ thị import từ mọi entry point của Next (`page/layout/route/error/loading/…`),
cộng thêm `scripts/` và `tests/`, rồi lặp tới điểm bất động: một file chỉ bị xoá khi
**không file sống nào import nó**, và file test đi theo chủ thể của nó.

- Xoá **145 file** tầng UI (`src/components/**`, `src/app/**`).
- **Không** đụng `src/lib/**`: nhiều file ở đó đã mồ côi từ TRƯỚC bản redesign
  (`lib/trades/review-*`, `lib/prospective/*`, `lib/decisions/*`) — ngoài phạm vi gate này.
- Giữ `src/app/actions/operating-snapshot.ts`: `git grep` ở HEAD cho kết quả rỗng
  ⇒ đã mồ côi từ trước, không phải do redesign.
- Kiểm chứng sau khi xoá: **0** tham chiếu vào từ file còn sống.

Gỡ hẳn hạ tầng ClayMorphism (mục cuối bảng "bản đồ màn" của bàn giao §4):
`dashboard-clay-theme-effect.tsx`, `lib/clay-theme-routes.ts`, 5 file `*-clay-theme.css`,
`dashboard-shell.css`, và font Baloo/Nunito trong `(dashboard)/layout.tsx`.

`.tm-main` **giữ** `overflow-y: auto` (dự tính ban đầu là siết thành `hidden`): chín
route con của Đấu trường vẫn chạy bố cục dọc trong `legacy-arena-shell` và sẽ bị cắt
mất phần dưới nếu chặn cuộn ở đây. Đã ghi lý do ngay tại chỗ.

## 2. Quét QA 12 điểm (bàn giao §7)

Đo bằng trình duyệt thật ở 1280×800 trên bản dựng tĩnh của F1 và F8
(hai màn không cần DB), cộng với kiểm tra tĩnh cho phần còn lại.

| # | Yêu cầu | Kết quả |
|---|---|---|
| 1 | Số theo locale vi-VN, không còn dấu chấm thập phân | ✅ Mọi số qua `lib/format/vn.ts` (`Intl` `vi-VN`). Quét text hiển thị: chỉ khớp `1.284,62` và `1.605` — đều là **dấu chấm phân cách nghìn**, đúng quy ước. `toFixed()` còn lại chỉ dùng cho toạ độ path SVG, không hiển thị. |
| 2 | Cột số `tabular-nums` + căn phải; chỉ sparkline căn giữa | ✅ Bảng chính F1: `MÃ/HẠNG` trái, `ĐIỂM/GIÁ/+-/VÙNG MUA/CẮT LỖ/RS20` phải, `20N` (sparkline) là cột căn giữa **duy nhất**. Ô không `tabular-nums` đều là cột chữ. |
| 3 | Màu giá đúng quy ước VN | ✅ Token phân giải đúng hex bàn giao: up `#2bd47d` · down `#ff4d5e` · ref `#f5d90a` · ceil `#b95cff` · floor `#4cc2ff`. |
| 4 | Đổi phán quyết đồng bộ màu/phân bổ/rủi ro/khối lượng/thanh trạng thái | ✅ Một nguồn duy nhất `resolveTerminalVerdict()` → `verdictTokens()`; khối lượng qua `applyVerdictToShares()`, và **server tự phân giải lại** khi ghi lệnh. |
| 5 | Cổng 1 live xấu hơn bản lưu ⇒ hiện cả hai, ghi rõ nguồn chuẩn | ✅ `gate1Rows` bốn hàng: TRỰC TIẾP · LẦN QUÉT · NGUỒN CHUẨN · PHÁN QUYẾT DÙNG. |
| 6 | F1–F8 chuyển màn, F9 trợ giúp, ESC đóng, phím F không bị trình duyệt chiếm | ✅ `use-command-router.ts` `preventDefault()` cho F1–F9, nhánh riêng cho `Escape`. |
| 7 | Dòng lệnh nhận DASH/SETUP/ARENA/BOOK/SET/HELP + mã 3–4 ký tự | ✅ `resolveCommand()`; từ khoá màn xét TRƯỚC mã để `SET` không thành mã. |
| 8 | Vạch kéo F1 đổi bề rộng 240–520px và giữ khi chuyển màn | ✅ `aria-valuemin=240` / `aria-valuemax=520`, lưu qua `sessionStorage`. |
| 9 | Click tiêu đề cột đổi sắp xếp + mũi tên; hàng chọn viền trái 2px amber | ✅ `useTableSort`/`SortTh` (`ĐIỂM ▼`), `border-left: 2px solid var(--tm-accent)`. |
| 10 | 1280×800 không có thanh cuộn ngang trên F1; thanh trạng thái không bị cắt | ✅ sau khi sửa (xem §3). `scrollWidth == clientWidth == 1280`, 0 phần tử tràn. |
| 11 | Mỗi panel dữ liệu đủ 4 trạng thái: tải · rỗng · lỗi kèm bằng chứng · dữ liệu cũ | ✅ `PanelSkeleton` / `EmptyState` (bắt buộc có `action`) / `ErrorState` (bắt buộc có bằng chứng) / `StaleBanner`; F8 dựng đủ 6 trạng thái bằng chính primitive đó. |
| 12 | Không emoji, gradient, bóng trang trí, bo góc >3px, icon minh hoạ | ✅ Test `terminal-design-rules` chốt trong CI. `✕` là ký tự dingbat mà **chính bản thiết kế dùng 8 lần**, không phải emoji. `border-radius: 50%` chỉ ở 2 chấm LED 6px — bản thiết kế cũng dùng đúng 4 lần cho chấm trạng thái. |

Số đo khớp bảng metric bàn giao §6: hàng bảng chính **26px** (chuẩn 26–27), hàng bảng
phụ **23px** (23–24), thead **21–22px** (21–22), tiêu đề panel **24px** (24).

## 3. Lỗi phát hiện trong lúc quét QA và đã sửa

**a. Nhóm nút F1 tràn ra ngoài panel 296px.**
`.tm-btn` là `white-space: nowrap`, và flex item mặc định `min-width: auto` nên KHÔNG
co được dưới bề rộng chữ — `flex: 1` trên nút chính vô hiệu. Ba nút cộng lại rộng
306px trong ô 296px, "SỔ LỆNH" tràn 10px ra ngoài viền panel.
Sửa: `.tm-btn-group > .tm-btn { min-width: 0; padding: 0 10px; overflow: hidden }` và
nút chính `flex: 1; padding: 0 4px` — khớp đúng bản thiết kế (nguồn dòng 140–142).
Đo lại: mép phải 287 ≤ 296, không nút nào bị cắt chữ (bản thiết kế gốc: 284).

**b. `.tm-fonts` mất font khi next/font không nạp được.**
`var(--font-plex-sans)` không có giá trị dự phòng: nếu biến đó không tồn tại (offline,
CSP chặn), cả khai báo thành *invalid at computed-value time* ⇒ toàn terminal rơi về
font mặc định của trình duyệt (**Times New Roman**), chứ không rơi về bản dự phòng
IBM Plex/system-ui ở `:root`. Đo được trực tiếp trong trình duyệt.
Sửa: `var(--font-plex-sans, "IBM Plex Sans")`. Đã thêm test chốt: mọi
`var(--font-plex-*)` bắt buộc có dự phòng ngay trong `var()`.

**c. Luật "bo góc ≤ 3px" có lỗ hổng đơn vị.** Test cũ chỉ soi giá trị `px` nên
`border-radius: 50%` lọt qua. Thêm test: giá trị `%` chỉ được là `50%` và khối khai
báo phải có `width ≤ 8px` (chấm trạng thái).

## 4. Kiểm chứng

- `npm run typecheck` — pass
- `npx eslint src` — 0 error, 19 warning (đều có sẵn từ trước, nằm trong `lib/`)
- `npm test` — 162 file · 1490 test pass
- `npx next build` — Compiled successfully

## 5. Giới hạn đã biết (báo cáo trung thực)

- Postgres cục bộ không xác thực được (`28P01`) nên **các màn cần đăng nhập chưa bao
  giờ được xem bằng mắt**. Kiểm chứng dựa trên unit test, `next build`, và đo bố cục
  trên bản dựng tĩnh của F1/F8. Không thử đoán mật khẩu DB.
- Khung xem trước không chụp được ảnh màn hình (không compositing), nên mọi kết luận
  hình ảnh đều là **số đo** qua DOM/CSSOM, không phải ảnh.
- Sáu route `api/paper-lab/*` vẫn dùng `loadPaperLabPageFromDb()` cũ (có fallback mock).
  Cố ý để ngoài phạm vi: đó là API, không phải tầng trình bày.

---

## 6. Vòng codex #1 — REJECT, 7 vấn đề. Đã sửa hết.

Đã kiểm chứng lại từng phát hiện trên code thật trước khi sửa; **cả 7 đều đúng**.
Ngoài ra tự tìm thêm 2 lỗi cùng loại mà vòng review chưa nêu.

### 6.1 Số bịa trong định cỡ vị thế (nghiêm trọng nhất)

`loadOpenExposureVnd()` bắt lỗi DB rồi trả **0**. 0 nghĩa là "danh mục đang rỗng",
nên F2 tính khối lượng đề xuất như thể không giữ vị thế nào — **cao hơn trần mà
server thật sự áp khi ghi lệnh**. Người dùng chỉ biết khi phiếu bị từ chối.

- `SizingInput.currentExposureVnd` đổi thành `number | null`; `null` = *không đọc
  được*, khác hẳn `0` = *không có vị thế*.
- `buildSizing()` gặp `null` thì **chặn** định cỡ và nói rõ lý do, thay vì đoán.
- `loadOpenExposureVnd()` trả `{ value, error }`; lỗi chảy vào `loadError` của F2.
- **Tự tìm thêm:** F7 (`symbol/[symbol]/page.tsx`) có đúng lỗi này — cũng
  `.catch(() => 0)`. Đã sửa: đọc lỗi ⇒ `systemShares = null`.
- Thêm test: `f2-view-model.test.ts` — "không đọc được vị thế đang mở thì CHẶN tính".

### 6.2 Bốn đường lỗi bị nuốt trên F1

`loadLatestCloseBySymbol`, `loadRsDiagnosticsBySymbol`, `loadRsNearMiss`,
`loadSparkHistory` đều `catch` rồi trả rỗng, và `dbLoadError` chỉ gom 3 nguồn khác.
Hệ quả: panel "Suýt đạt" rỗng **vì lỗi** trông y hệt rỗng **vì không có mã nào** —
vi phạm QA §11 (lỗi phải có bằng chứng) và nguyên tắc trung thực dữ liệu.
Cả bốn nay trả `{ data, error }` và `dbLoadError` gom đủ bảy nguồn.

### 6.3 Lỗi RS diagnostics của F2 không có kênh báo lỗi

`loadRsDiagnosticsForSetupsCached` trả `new Map()` khi hỏng ⇒ cột RS20 hiện gap
`—` y như khi mã chưa đủ dữ liệu. Nay trả `{ map, error }`.
Cùng lý do, `loadSparkHistory` của F2 cũng được thêm kênh lỗi.

### 6.4 Thông báo lỗi chung chung, không có bằng chứng

Bảy chỗ trả "Cơ sở dữ liệu tạm thời không khả dụng (…)" — `ErrorState` có khối
bằng chứng nhưng nội dung không phải bằng chứng. Nay mỗi chỗ ghi **tên truy vấn
thật + exception thật**, ví dụ
`prisma.stockDailyBar.aggregate({ _max: { date } }) thất bại: <e>`.

### 6.5 Nhóm một nút bị vuông hai góc trái

`:first-child` và `:last-child` cùng khớp khi nhóm chỉ có một nút; luật sau đè
luật trước nên hai góc trái thành `0`. Ảnh hưởng nút GHI VÀO SỔ LỆNH của F2.
Lỗi này có từ Gate 0, không phải do bản sửa ở §3. Thêm luật `:only-child`.
Đo lại trong trình duyệt: một nút ⇒ `2px` cả bốn góc; ba nút ⇒ `2px 0 0 2px` /
`0` / `0 2px 2px 0`, không nút nào bị cắt chữ.

### 6.6 Test e2e còn trỏ vào giao diện đã xoá

Rộng hơn báo cáo của vòng review: **5** spec bám vào testid không còn tồn tại.

- Xoá `dashboard-command-deck.spec.ts`, `paper-lab-arena.spec.ts`,
  `setups-workstation.spec.ts` — cả ba kiểm chứng màn đã bị thay hoàn toàn
  (34 testid cũ, tiêu đề tiếng Anh "Setups workstation").
- Thêm `tests/terminal-screens.spec.ts`: smoke F1–F4 + F9/ESC, chỉ khẳng định
  điều luôn đúng bất kể dữ liệu.
- Thêm testid ổn định cho gốc mỗi màn (`f1-dashboard` … `f7-symbol`) và cho nút
  gửi của F6; cập nhật `accessibility-authenticated` và `responsive-authenticated`.
- `responsive-authenticated` bỏ các khung 1024/768/390px: bàn giao §8 ghi rõ bản
  này thiết kế cho ≥1280px và breakpoint tablet/mobile là **ngoài phạm vi**, nên
  đo tràn ngang ở 390px là bắt lỗi một quyết định thiết kế có chủ đích.
- Đã soi lại toàn bộ: **0** testid trong `tests/*.spec.ts` còn trỏ vào chỗ trống.

> Vẫn KHÔNG chạy được Playwright vì Postgres cục bộ không xác thực được. Các spec
> trên đã được kiểm tra **tĩnh** (typecheck + đối chiếu từng testid với `src/`),
> chưa được chạy thật. Ghi rõ ở đây thay vì tuyên bố là đã kiểm chứng.

### 6.7 Lớp CSS mồ côi sau khi gỡ theme clay (tự tìm)

Soi 662 class thuộc 8 file CSS bị xoá, đối chiếu với các file **còn sống**:

- `components/ui/loading-skeleton.tsx` dùng `.skeleton` của `dashboard-shell.css`
  và được `paper-lab/layout.tsx` render thật ⇒ mất hẳn style. Chuyển sang
  `.tm-skel-bar`. (Bonus: `.skeleton` cũ dùng `linear-gradient` — thứ bản thiết
  kế cấm.)
- `components/setups-rejection-accordion.tsx` còn dùng 4 class mồ côi, nhưng file
  này **không được render ở đâu** — kể cả ở HEAD nó cũng chỉ được import *kiểu*
  (`import type`). Là mã mồ côi có từ trước, giữ nguyên theo đúng quy tắc phạm vi
  đã áp cho `lib/` và `operating-snapshot.ts`.
- Ngoài hai chỗ trên: **0** file sống dùng class đã mất.

### 6.8 Kiểm chứng lại sau khi sửa

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 162 file · **1491** test pass
- `npx next build` — Compiled successfully · 56/56 static pages

### 6.9 Quét lại toàn bộ `catch` trên năm màn (tự tìm)

Sau khi sửa xong 7 phát hiện, soi lại mọi `catch` ở `dashboard`, `setups`, `book`,
`paper-lab`, `symbol/[symbol]` xem còn đường nào nuốt lỗi:

- `loadMarketContext()` (F1) trả `null` không kèm lỗi ⇒ thêm `{ data, error }`,
  gom vào `dbLoadError`. Nay F1 gom **tám** nguồn lỗi.
- **F7 hoàn toàn không có bề mặt báo lỗi** — không có prop `loadError` nào, trong
  khi màn có ba đường nuốt lỗi (`getLatestDailyScanRun`, vị thế đang mở,
  `loadRsDiagnosticUiForSymbols` — cái cuối còn `.catch(() => new Map())` không
  cả ghi log). Thêm prop `loadError`, gom cả ba, và render `ErrorState` kèm bằng
  chứng ngay trên biểu đồ.
- F4 (`book`) đã gom đủ từ Gate 5 (kể cả hai cờ `benchmarkLoadFailed` /
  `barsLoadFailed`); F3 (`paper-lab`) đã gom đủ từ Gate 4. Không đổi.

Kiểm chứng lại lần cuối: typecheck pass · eslint 0 error / 19 warning có sẵn ·
162 file · 1491 test pass · `next build` Compiled successfully (56/56).

---

## 7. Vòng codex #2 — REJECT, 4 vấn đề. Đã sửa hết.

Vòng 2 xác nhận 7 điểm của vòng 1 đã sửa đúng hướng, và tìm thêm 4 điểm mới.
Kiểm chứng lại trên code thật: **cả 4 đều đúng**.

### 7.1 Server ghi lệnh KHÔNG áp trần thanh khoản mà màn hình có áp

`createTradeFromSetup` và `createManualTrade` gọi `computePositionSizing()` với
`symbolAvgDailyValueVnd: null`, trong khi F2/F7 truyền ADV thật. Trong
`position-sizing.ts`, ADV `null` làm `capFromLiquidity = Infinity` — nghĩa là
**trần thanh khoản chỉ tồn tại trên màn hình, không tồn tại ở server**.

Hệ quả cụ thể: `confirmedQuantity` chỉ được phép GIẢM so với khối lượng *server*
tính; mà khối lượng server tính không có trần thanh khoản, nên người dùng có thể
ghi một lệnh vượt trần thanh khoản dù màn hình hiển thị con số đã bị chặn.

Sửa: thêm `loadSymbolAdvVnd()` dùng **đúng công thức của màn**
(`symbolMarketContextDaily.close × 1000 × volMa20`), truyền vào cả hai lối ghi
lệnh. Đọc lỗi hoặc thiếu hàng ⇒ `null` — giống hệt màn hình khi thiếu ADV, nên
hai phía luôn cùng chặt hoặc cùng lỏng, không bên nào rộng tay hơn.

### 7.2 Còn một thông báo lỗi chung chung

`safeLoadPositionSizingDefaults()` vẫn trả "Giá trị mặc định định cỡ vị thế không
khả dụng (risk-config/ADV)." và **vứt mất `String(e)`** — đúng loại lỗi mà mục 6.4
đã sửa ở nơi khác, sót lại một chỗ. Nay ghi rõ ba truy vấn nằm trong khối cùng
nguyên văn exception. Cập nhật test tương ứng để chốt yêu cầu "có bằng chứng
thật" thay vì chốt một chuỗi cố định.

### 7.3 Chú thích của F7 hứa nhiều hơn code làm

Comment viết "mọi đường lỗi của màn này gom về đây" nhưng trong `Promise.all` chỉ
`getLatestDailyScanRun()` có `.catch`; bảy truy vấn còn lại (và
`setupWatchItem.findFirst` bên dưới) vẫn ném lên và làm sập cả route.

Sửa theo phân loại rõ ràng, viết đúng vào comment:

- **Nguồn phụ** (bối cảnh thị trường, khối ngoại, vốn, cấu hình định cỡ, lịch sử
  quét, vị thế đang mở, RS, sức khoẻ thiết lập) → helper `optional()`: ghi bằng
  chứng vào `errors` rồi trả giá trị dự phòng, màn vẫn dựng.
- **Nguồn cốt lõi** (nến ngày, phán quyết phiên) → **cố ý vẫn ném**: không có nến
  thì không có gì để vẽ, không có phán quyết thì mọi ràng buộc khối lượng vô
  nghĩa. Rơi vào `error.tsx` của route còn trung thực hơn một màn trông bình
  thường nhưng rỗng ruột.

### 7.4 Ma trận bề rộng né đúng vùng cần đo

Đúng: bàn giao §6 chốt **bề rộng tối thiểu 1160px** (bảng điều khiển) và
**1020px** (chi tiết mã). Cắt matrix xuống còn 1440/1366/1280 là bỏ qua đúng điểm
hẹp nhất mà bản thiết kế cam kết vẫn vừa.

Sửa: mỗi route khai báo `minWidth` riêng và matrix thêm một khung **đúng tại
ngưỡng tối thiểu**. Ngoài ra đo trực tiếp bằng trình duyệt trên bản dựng tĩnh:

| Màn | Bề rộng | `min-width` CSS | scrollWidth / clientWidth | Tràn ngang |
|---|---|---|---|---|
| F1 | 1160px | 1160px | 1160 / 1160 | không |
| F7 | 1020px | 1020px | 1020 / 1020 | không |
| F1 | 1280px | 1160px | 1280 / 1280 | không |

Cả hai màn vừa khít đúng ngưỡng bàn giao công bố, không phần tử nào tràn, không
nút nào bị cắt chữ. F7 không nằm trong ma trận e2e vì cần một mã cổ phiếu có
thật trong DB — thay vào đó đo bằng bản dựng tĩnh như trên, và ghi rõ ở đây thay
vì để một test rỗng nghĩa đi qua.

### 7.5 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 162 file · 1491 test pass
- `npx next build` — Compiled successfully, exit 0

---

## 8. Vòng codex #3 — REJECT, 3 vấn đề. Hai sửa, một phản biện.

### 8.1 `createManualTrade()` không áp trần thanh khoản — GIỮ NGUYÊN, có bằng chứng

Đây là chỗ tôi **không đồng ý chặn**, và nêu bằng chứng thay vì sửa theo.

Bàn giao §5 định nghĩa modal này: *"Ghi lệnh tay — Mở từ F4. 8 trường + ghi chú.
**Dùng cho lệnh khớp ngoài hệ thống.**"* Nó **ghi lại một giao dịch ĐÃ xảy ra**,
không đặt một lệnh mới. Từ chối ghi vì vượt trần thanh khoản là từ chối ghi nhận
sự thật, và hậu quả đi ngược đúng mục tiêu an toàn:

- Sổ lệnh mất một vị thế đang mở có thật.
- `currentPortfolioExposureVnd` tính thiếu đúng bằng vị thế bị bỏ.
- Mọi lệnh **sau đó** lại được định cỡ RỘNG hơn mức đúng.

Nói cách khác, chặn ở đây làm hệ thống kém an toàn hơn chứ không an toàn hơn.
Khác hẳn `createTradeFromSetup` — nơi hệ thống thật sự đề xuất một lệnh mới, nên
trần phải áp (đã sửa ở §7.1).

Điều codex nêu **đúng** là khoảng trống thông tin: người dùng không biết mình vừa
ghi một vị thế nằm ngoài chính sách. Đã đóng bằng cách **nói, không chặn**:
`describeManualSizeOverrun()` tính lại hạn mức (đã trừ chính lệnh vừa ghi khỏi
`currentPortfolioExposureVnd`, nếu không nó tự chiếm hạn mức của chính nó) và
thêm một câu vào thông báo thành công, nêu rõ mức cho phép là bao nhiêu và trần
thanh khoản có đang chặn không. Thiếu vốn tài khoản hoặc thiếu ADV ⇒ **im lặng**,
không cảnh báo — một cảnh báo dựng trên số không có cũng là một con số bịa.

### 8.2 Ma trận bề rộng bỏ sót F5 — đã sửa

Đúng. `/settings` là route terminal thật trong nav. Thêm `/settings` **và**
`/states` (F8) vào ma trận, cùng ngưỡng tối thiểu 1160px.

### 8.3 Chú thích spec hứa "tám màn" nhưng chỉ phủ bốn — đã sửa

Đúng, và đúng loại lỗi mà §7.3 vừa sửa ở chỗ khác: chú thích nói rộng hơn code
làm. Nay spec phủ **sáu** màn (F1, F2, F3, F4, F5, F8) và chú thích nêu đích danh
hai màn nằm ngoài kèm lý do:

- **F6 Phiên** là route công khai, đã có `landing-auth.spec.ts` và
  `accessibility-public.spec.ts` phủ.
- **F7 Chi tiết mã** cần một mã có thật trong DB; đưa vào đây sẽ thành test rỗng
  nghĩa (một trang 404 cũng "không tràn ngang"). Ngưỡng 1020px của F7 đo bằng bản
  dựng tĩnh, số liệu ở §7.4.

Chuẩn hoá `data-testid` của F5 từ `settings-page` thành `f5-settings` và thêm
`f8-states`, cho khớp quy ước `f{N}-{tên}` của các màn khác.

### 8.4 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 162 file · 1491 test pass
- `npx next build` — exit 0
- Soi lại testid: **0** selector trong `tests/*.spec.ts` trỏ vào chỗ trống.

---

## 9. Vòng codex #4 — REJECT, 3 vấn đề. Đã sửa hết.

Vòng này codex **chấp nhận phản biện §8.1**: "phản biện 'không chặn manual trade'
đứng vững về mặt nghiệp vụ … phép trừ chính lệnh vừa ghi khỏi exposure là đúng về
đơn vị". Ba phát hiện mới, kiểm chứng lại trên code: **cả 3 đều đúng**.

### 9.1 `loadSymbolAdvVnd()` nuốt lỗi DB thành "không có ADV"

Đúng, và đây là lỗ hổng còn lại của chính §7.1. Hàm trả `null` cho **hai** tình
huống khác hẳn nhau, rồi `createTradeFromSetup()` ghi lệnh với trần thanh khoản
bị bỏ. Nếu F2 vừa hiển thị một khối lượng ĐÃ bị trần cắt mà lúc ghi lệnh truy vấn
ADV lỗi tạm thời, server sẽ nhận khối lượng vượt trần — đúng lỗi "server lỏng hơn
màn" mà §7.1 định đóng. Câu "server không bao giờ lỏng hơn màn" trong comment vì
thế **nói quá**, như codex chỉ ra.

Sửa: đổi kiểu trả về thành `{ ok: true, value: number | null } | { ok: false, error }`,
tách bạch *không có hàng ADV* với *truy vấn hỏng*. Ba nơi gọi xử lý theo đúng
mức rủi ro của mình:

| Nơi gọi | Ghi gì vào DB | ADV lỗi thì làm gì |
|---|---|---|
| `createTradeFromSetup()` | **ghi lệnh mới** | **fail closed** — từ chối, kèm nguyên văn exception |
| `previewManualTradeLevels()` | không ghi gì | bỏ trần, gợi ý rộng hơn chút — không chặn cả màn |
| `describeManualSizeOverrun()` | không ghi gì | im lặng — cảnh báo thiếu trần là cảnh báo sai |

Comment cũng viết lại cho khớp: cam kết "không lỏng hơn màn" chỉ đúng **khi truy
vấn thành công**, và trường hợp còn lại đã được fail closed.

### 9.2 `createManualTrade()` chỉ làm mới `/book`

Đúng, và nó làm hụt chính lập luận ở §8.1. Ghi lệnh tay tạo một vị thế OPEN mới
⇒ `currentPortfolioExposureVnd` đổi ⇒ F1/F2/F7 phải định cỡ lệnh sau trên số mới.
Nhưng chỉ `/book` được `revalidatePath`, nên các màn kia vẫn hiện khối lượng tính
trên exposure cũ — đúng thứ "màn và server cho ra hai con số khác nhau" mà cả gate
này đang chống. Nay làm mới đủ `/book` · `/setups` · `/dashboard`, khớp với
`createTradeFromSetup()`.

### 9.3 Ma trận bề rộng có đường pass giả

Đúng. Spec `catch` mọi lỗi `waitForSelector()` rồi vẫn đo tràn ngang trên "thứ gì
dựng được" — nên một lần chuyển hướng về `/login` hay một trang lỗi cũng PASS,
miễn nó không tràn ngang. Nhận xét của codex chính xác: sáu màn này luôn dựng
phần tử gốc kể cả khi rỗng hay lỗi, vì trạng thái rỗng/lỗi nằm **bên trong** màn
chứ không thay thế màn. Nay `expect(...).toBeVisible()` — hỏng là fail, không có
cửa lách.

### 9.4 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 162 file · 1491 test pass
- `npx next build` — exit 0

### 9.5 Tự tìm thêm: F7 và `closeTrade()` cũng thiếu làm mới

Kéo tiếp sợi chỉ của §9.2 qua **mọi** hành động ghi vào bảng `Trade`:

- Cả hai đường ghi lệnh đều chưa làm mới `/symbol/[symbol]` — mà F7 cũng tính
  `systemShares` từ `currentPortfolioExposureVnd`. Thêm
  `revalidatePath("/symbol/[symbol]", "page")`; đường dẫn động **bắt buộc** có
  `type: "page"` (đã đọc `next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`),
  và làm mới mọi mã chứ không riêng mã vừa ghi, vì trần danh mục là số dùng chung.
- `closeTrade()` chỉ làm mới `/book` và `/dashboard`. Đóng vị thế **giảm**
  exposure ⇒ hạn mức lệnh sau **tăng**; F2/F7 vẫn hiện hạn mức cũ, chặt hơn thực
  tế. Bổ sung `/setups` và `/symbol/[symbol]`.
- `updateTradeStopLoss()` và `updateTradeExitNote()` không đổi khối lượng hay giá
  vào nên không đổi exposure — giữ nguyên phạm vi làm mới hiện có.

---

## 10. Vòng codex #5 — REJECT, 2 vấn đề. Đã sửa hết.

Vòng 5 xác nhận cả ba điểm vòng 4 đã sửa đúng. Hai phát hiện mới, **cả 2 đều đúng**.

### 10.1 `auth.setup.ts` vẫn dùng nhãn tiếng Anh — e2e sẽ hỏng từ bước đầu

Đúng, và đây là lỗi soi sót của chính tôi: phép soi testid ở §6.6 chỉ quét
`tests/*.spec.ts`, bỏ qua `tests/playwright/`. File này là **project `setup`** mà
mọi project authenticated phụ thuộc — nó hỏng thì toàn bộ e2e authenticated hỏng
theo, ngay trước khi chạy assertion nào.

Sửa: `getByLabel("TÀI KHOẢN")` / `getByLabel("MẬT KHẨU")`, và nút gửi bám
`data-testid="login-submit"` thay vì chữ trên nút — vì chữ đổi theo trạng thái
("ĐĂNG NHẬP" → "ĐANG ĐĂNG NHẬP…").

Soi lại **toàn bộ** `tests/**/*.ts` (không chỉ `*.spec.ts`) cho mọi selector theo
chữ: 10 selector, tất cả khớp UI hiện tại. `global-setup.ts` không đụng UI.

### 10.2 `updateTradingSettings()` không làm mới F2/F7

Đúng, cùng lớp lỗi với §9.2 nhưng ở phía tham số rủi ro thay vì phía vị thế. Vốn
tài khoản, rủi ro mỗi lệnh và trần thanh khoản là **đầu vào của định cỡ**: F2 và
F7 tính khối lượng từ chúng, và server action ghi lệnh cũng vậy. Chỉ làm mới
`/dashboard` + `/settings` để lại đúng tình trạng mà cả gate này đang chống — màn
hiện khối lượng theo tham số cũ trong khi server đã dùng tham số mới.

Nay làm mới `/dashboard` · `/settings` · `/setups` · `/book` · `/symbol/[symbol]`
(động, `type: "page"`), và test chốt đủ năm đường thay vì chỉ `/dashboard`.

### 10.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 162 file · 1491 test pass
- `npx next build` — exit 0

---

## 11. Vòng codex #6 — REJECT, 2 vấn đề trên F3. Đã sửa hết.

Vòng 6 xác nhận hai điểm vòng 5 đã sửa và không tìm thấy server action nào khác
còn thiếu invalidation. Hai phát hiện mới, **cả 2 đều đúng** — và đều là số bịa
sót lại trên chính màn F3, không phải sáu route API ngoài phạm vi.

### 11.1 Đọc trận đấu lỗi vẫn hiện "0 TRẬN"

`loadArenaBattlesResult()` hỏng ⇒ `rows: []` ⇒ banner F3 in `0 TRẬN`. Bằng chứng
lỗi có chảy vào `loadError`, nhưng con số vẫn nói dối: **0 TRẬN là một sự thật**
("hôm nay không có trận nào"), còn ở đây ta *không biết* có bao nhiêu trận.

Sửa: thêm `battlesLoadFailed` vào đầu vào view model; hỏng ⇒ `battleCount = null`
⇒ banner in `—`. Thêm test chốt cả hai chiều: rỗng-vì-lỗi ra `null`, rỗng-thật ra `0`.

### 11.2 Bảng xếp hạng bơm số mặc định khi thiếu hàng hiệu suất

Một tác tử đã có thứ hạng nhưng chưa có `agentPerformanceDaily` (mới tạo, chưa
chốt phiên nào) được dựng thành:

`navVnd = 500.000.000` · `pnlPct = 0` · `winRate = 0` · `maxDrawdownPct = 0` ·
`sharpeLike = 0` · `tradeCount = 0`

Tức bảng hiện một tác tử **"có 500 triệu, hoà vốn, thắng 0%, sụt 0%"** trông y
như số đo thật. Đúng loại lỗi mà Gate 4 đã dọn ở các đường khác — sót lại đường này.

Sửa:
- `LeaderboardRowDto`: mọi chỉ số đo được thành `| null`. Tầng trình bày đã sẵn
  sàng (`finite()` → `fmtNum` → `—`), chỉ thiếu `null` từ nguồn.
- Xếp hạng best/worst **lọc bỏ** tác tử chưa có số đo trước khi sắp xếp — 0% là
  một kết quả, "chưa đo" thì không.
- `bestAgent`/`worstAgent.returnPct` thành `number | null`; không có tác tử nào
  thì `null` chứ không phải `0`.
- `navSparkline` dưới hai điểm: trả **mảng rỗng** thay vì chèn nguyên vốn ban đầu
  cho đủ hai điểm — cách cũ vẽ một đường phẳng ở 500 triệu, tức một lịch sử NAV
  chưa từng tồn tại.
- Thêm test chốt: tác tử không có hàng hiệu suất ⇒ cả năm cột đo ra `null`.

### 11.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 162 file · **1493** test pass
- `npx next build` — exit 0

---

## 12. Vòng codex #7 — REJECT, 1 vấn đề (QA §11). Đã sửa, và sửa rộng hơn.

Vòng 7 xác nhận cả hai điểm vòng 6 đã sửa đúng, và xác nhận khẳng định của tôi về
các fallback còn lại không được F3 render. Một phát hiện mới, **đúng**.

### 12.1 F3 thiếu trạng thái "dữ liệu cũ"

QA §11 đòi **mỗi panel dữ liệu đủ bốn trạng thái**, trong đó có *dữ liệu cũ*. Mọi
chỉ số bảng xếp hạng đọc theo `latestPerf.sessionDate`, nhưng phiên đó không hề
lộ ra khỏi DTO, nên F3 hiển thị bảng như số hiện hành dù nó có thể là của phiên
cũ. Nhận xét quan trọng nhất của codex: **độ tươi ở thanh trên chỉ nói về lần
quét/VNINDEX, không chứng minh gì cho số đo mô phỏng** — đúng, đó là hai nguồn
dữ liệu khác nhau.

Sửa:
- `ArenaOverviewDto.performanceSessionDate` — phiên mà mọi chỉ số bảng xếp hạng
  được đo; `null` khi chưa chốt phiên nào.
- Nhân tiện sửa một chỗ bịa liền kề: `sessionDate = latestPerf?.sessionDate ?? new Date()`
  âm thầm coi **hôm nay** là phiên dữ liệu khi chưa có hàng hiệu suất nào. Nay
  tách `perfSessionDate` (sự thật, có thể `null`) khỏi mốc truy vấn nội bộ.
- F3 nhận `stale` và render `StaleBanner`, so `performanceSessionDate` với phiên
  thị trường gần nhất (`getExpectedLatestSessionFromIndexBars`).

### 12.2 Tự tìm thêm: F7 cũng thiếu, F4 chỉ có ở mức từng hàng

Cùng phép soi áp cho cả năm màn có dữ liệu:

- **F7 hoàn toàn không có trạng thái dữ liệu cũ.** Nếu mã chưa có nến cho phiên
  mới nhất thì bảng giá, chỉ báo, vùng mua **và khối lượng đề xuất trong phiếu
  ghi lệnh** đều tính trên giá cũ mà không có lời cảnh báo nào. Thêm `stale`,
  so ngày nến cuối của mã với phiên thị trường.
- **F4 có ở mức từng hàng nhưng không có ở mức panel.** Mỗi vị thế đã tự nêu
  phiên của giá nó dùng (chính xác hơn một cờ chung, vì mỗi mã cũ theo cách
  riêng), nhưng trong một bảng dài thì dễ bỏ sót. Thêm băng tóm tắt: bao nhiêu
  trên tổng bao nhiêu vị thế đang dùng giá cũ, mã nào, và hệ quả lên lãi/lỗ chưa
  thực hiện, bội số R, tổng giá trị danh mục.
- **F5, F6, F8** không có trục thời gian: F5 là biểu mẫu tham số, F6 là xác thực,
  F8 là trang tham chiếu tĩnh. Trạng thái "dữ liệu cũ" không áp dụng.

Kết quả: cả năm màn có dữ liệu (F1–F4, F7) nay đều đủ **tải · rỗng · lỗi kèm bằng
chứng · dữ liệu cũ**.

### 12.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 162 file · 1493 test pass
- `npx next build` — exit 0

---

## 13. Vòng codex #8 — REJECT, 2 vấn đề. Đã sửa, và gom về một nguồn.

Vòng 8 xác nhận toàn bộ phần mở rộng ở §12 là đúng hướng (F3 so phiên đo với
VNINDEX, F7 theo nến cuối của mã, F4 băng tổng hợp theo vị thế, và lập luận
F5/F6/F8 không có trục phiên). Hai phát hiện mới — **cả 2 đều đúng**, và cùng
một gốc.

### 13.1 F1 và F2 lọt trạng thái dữ liệu cũ của chính LẦN QUÉT

Mọi phép kiểm độ tươi hiện có đều so **thời điểm CHẠY** scan với ngày VNINDEX
(`market-data-alignment.ts:42`), hoặc so bar cổ phiếu với phiên VNINDEX. Không
phép nào so **phiên mà scan nhắm tới** (`DailyScanRun.expectedSessionDate`) với
phiên thị trường mới nhất.

Kịch bản codex đưa ra, tôi dựng lại và xác nhận đúng: scan chạy hôm nay **cho
phiên hôm qua**. Ngày chạy khớp ngày VNINDEX, bar cổ phiếu khớp phiên VNINDEX —
không banner nào bật. Nhưng ứng viên, vùng mua, cắt lỗ, phán quyết, phễu và khối
lượng đề xuất trên cả F1 lẫn F2 đều là kết quả của phiên hôm qua.

### 13.2 Sửa: tách thành một hàm thuần, dùng chung, có test

Hai màn cùng một câu hỏi thì không nên có hai bản cài đặt — đó chính là cách
Gate 2 và Gate 3 từng làm phán quyết lệch nhau. Tách
`scanBehindMarketNotice(scanSession, marketSession, scope)` sang
`src/lib/terminal/scan-session-staleness.ts`:

- So theo **ngày lịch UTC**, bỏ phần giờ — một scan chạy 15:30 cùng ngày không
  phải là dữ liệu cũ.
- Thiếu một trong hai mốc ⇒ trả `null`, **không đoán**.
- Chỉ trả lời đúng một câu hỏi: quét có đi sau thị trường không. Ca ngược lại
  (bar cổ phiếu đi trước VNINDEX) vẫn là phép kiểm riêng, giữ nguyên.
- F1 và F2 gọi cùng hàm này, chỉ khác câu mô tả phạm vi ảnh hưởng; ca "quét đi
  sau" nặng hơn nên xét trước ca cũ.
- **5 test** chốt: lệch phiên ⇒ báo · cùng phiên ⇒ im · khác giờ cùng ngày ⇒ im ·
  quét đi trước ⇒ im · thiếu mốc ⇒ im.

Nhân tiện sửa một chỗ "hôm nay = phiên dữ liệu" còn sót ở F7: khi mã chưa có nến
nào, truy vấn RS lấy `new Date()` làm phiên. Nay bỏ hẳn truy vấn và để RS20 là gap.

### 13.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — **163** file · **1498** test pass
- `npx next build` — exit 0

---

## 14. Vòng codex #9 — REJECT, 1 vấn đề. Đã sửa TRƯỚC khi vòng này trả kết quả.

Vòng 9 xác nhận `scanBehindMarketNotice()` ở §13 là đúng, và trả lời câu tôi tự
hỏi: khi truy vấn thành công, `marketSnapshot.benchmarkSessionDate` (F1) và
`getExpectedLatestSessionFromIndexBars()` (F2) **tương đương** — cùng lấy
`indexDailyBar` mới nhất của VNINDEX. Nhưng codex chỉ ra ca lỗi thì hai màn khác
nhau, và **đúng**.

### 14.1 `fetchMarketSessionSnapshot()` nuốt lỗi, F1 làm mất bằng chứng

Ba truy vấn (VNINDEX · max bar cổ phiếu · lần quét gần nhất) nằm chung một
`try/catch` trả ba mốc `null` không kèm lỗi. Ba `null` vì **đọc lỗi** trông y hệt
ba `null` vì **DB trống** — mà hệ quả khác hẳn: đọc lỗi thì mọi phép kiểm dữ liệu
cũ dựng trên chúng đều im lặng, và người dùng dễ hiểu "không có cảnh báo nào"
thành "mọi thứ đều tươi". F2 có `sessionLoadError` chảy vào `loadError`; F1 thì
đánh rơi.

Đây là điểm tôi tự tìm ra và sửa **trong lúc vòng 9 đang chạy** — chính từ câu
hỏi tôi đặt ra trong đề bài vòng đó ("hai nguồn phiên có tương đương không, hay
đó lại là chỗ hai màn nói khác nhau"). Codex soi trên bản staged cũ hơn nên vẫn
báo. Nội dung sửa khớp đúng những gì codex yêu cầu:

- `MarketSessionSnapshot.error` — bằng chứng thật, nêu cả ba truy vấn trong khối
  cùng nguyên văn exception.
- F1 gom `marketSnapshot.error` vào `dbLoadError`; nay F1 gom **chín** nguồn lỗi.
- 18 fixture snapshot trong 5 file test được cập nhật theo kiểu mới.

`fetchMarketFreshnessDto()` — nơi gọi còn lại của snapshot — **không có ai gọi**;
là export mồ côi có từ trước bản redesign, để nguyên theo đúng quy tắc phạm vi.

### 14.2 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 163 file · 1498 test pass
- `npx next build` — exit 0

---

## 15. Vòng codex #10 — REJECT, 2 vấn đề trên F2. Đã sửa hết.

Vòng 10 xác nhận §14.1 đã sửa đúng trên bản staged hiện tại, và F1/F2 dùng cùng
nguồn phiên VNINDEX. Hai phát hiện mới, **cả 2 đều đúng**, cùng một chỗ.

### 15.1 `rsWatch.error` không được gom vào `loadError` của F2

Ở §6.3 tôi thêm kênh lỗi cho RS diagnostics và spark history nhưng **sót
`loadRsNearMissWatchlistForSetupsCached()`** — nó có `error` từ trước mà F2 không
gom. Panel "RS DẪN DẮT · TRƯỢT CỔNG 2" rỗng vì lỗi mà không có `ErrorState`.

### 15.2 Lỗi bị câu "rỗng" chung che mất — thứ tự `??` ngược

Nặng hơn, và tinh vi hơn:

```ts
rsWatchEmptyReason: rsWatch.panel.emptyReason ?? rsWatch.error   // SAI
```

Khi loader bắt lỗi, nó trả `buildRsNearMissWatchlistPanel([])` — mà hàm này
**luôn** gắn câu "Không có mã INVALID nào có RS20 dương…" khi danh sách rỗng, kể
cả rỗng vì truy vấn hỏng. Nên `emptyReason` không bao giờ `null`, `??` không bao
giờ rơi sang `rsWatch.error`, và bằng chứng lỗi **không hiện ở đâu cả** — không
ở `loadError` (§15.1), cũng không ở dòng rỗng của panel.

Đảo thứ tự: `rsWatch.error ?? rsWatch.panel.emptyReason`, và gom `rsWatch.error`
vào `loadError`.

Soi toàn repo tìm cùng mẫu `emptyReason ?? …error`: **chỉ một chỗ này**. Các nơi
khác (`paper-lab/page.tsx` với `battles.error ?? "…"`, `hof.error ?? "…"`,
`dtoError ?? dtoEmptyReason ?? "…"`) đều đã đặt lỗi trước.

### 15.3 Tự soi thêm: mọi `catch` trên năm màn dữ liệu

Rà từng `catch` trong chín file tạo dữ liệu cho F1–F4 và F7. Tất cả đều có kênh
bằng chứng, trừ **đúng một** ngoại lệ có chủ đích: khối `after()` ghi snapshot RS
watchlist ở F1. Khối đó chạy **sau khi response đã gửi** nên không còn UI nào để
hiện lỗi, và nó chỉ ghi một bản lưu phụ — hỏng nó không làm sai con số nào đang
hiển thị. Đã ghi rõ lý do ngay tại chỗ để lần soi sau không phải đoán.

### 15.4 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 163 file · 1498 test pass
- `npx next build` — exit 0

---

## 16. Vòng codex #11 — REJECT, 2 vấn đề. Đã sửa hết.

Vòng 11 xác nhận §15 đã sửa đúng và chấp nhận ngoại lệ `after()` ở F1. Hai phát
hiện mới, **cả 2 đều đúng**, và cùng một dạng chưa từng bị bắt ở mười vòng trước:
**kênh lỗi bị mất mát** — màn có phân biệt lỗi với rỗng, nhưng nguyên văn
exception bị vứt trên đường đi, nên "bằng chứng" hiển thị lại là một câu do màn
tự đặt ra.

### 16.1 `fetchVnindexHistoryCached()` trả `error: boolean`

Loader bắt exception rồi chỉ trả `error: true`. Nguyên văn lỗi bị vứt, nên panel
"VNINDEX · 30 PHIÊN" chỉ in được một nhãn truy vấn **viết cứng trong component** —
mất kết nối, sai quyền hay thiếu bảng đều hiện y hệt nhau. Và vì không có chuỗi
lỗi nào, F1 cũng không thể gom nó vào `dbLoadError`.

Sửa: `VnindexHistoryResult.error` và `F1IndexPanel.error` thành `string | null`,
mang nguyên văn exception kèm tên truy vấn. Panel in `evidence={index.error}`.
F1 gom thêm nguồn này — nay đủ **mười** nguồn lỗi. Hai test cập nhật để chốt đúng
điều quan trọng: bằng chứng phải là chuỗi lỗi THẬT, không phải nhãn viết cứng.

### 16.2 `loadOpenPositionMarks()` trả hai cờ `boolean`

Cùng dạng. Hàm bắt lỗi hai truy vấn rồi trả `benchmarkLoadFailed` /
`barsLoadFailed`, và `book/page.tsx` phải tự viết ra hai câu mô tả chung. Sửa
thành `benchmarkLoadError` / `barsLoadError` mang nguyên văn exception cùng câu
nói rõ hệ quả; F4 đẩy thẳng vào `errors` thay vì tự đặt câu.

### 16.3 Soi lại toàn repo cho cùng dạng lỗi

Quét mọi kênh lỗi dạng cờ (`*LoadFailed`, `error: boolean`, `failed: boolean`).
Chỉ còn **một** chỗ, và nó đúng: `F3ViewModelInput.battlesLoadFailed`. Cờ này
không phải kênh bằng chứng — nó trả lời "số trận có đo được không" để quyết định
in `—` hay `0`. Nguyên văn lỗi đi đường riêng (`battles.error` vào `loadError`
của màn **và** vào `emptyReasons.battles`). Đã ghi rõ phân biệt này tại chỗ.

### 16.4 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 163 file · 1498 test pass
- `npx next build` — exit 0

---

## 17. Vòng codex #12 — REJECT, 2 vấn đề. Đã sửa hết.

Vòng 12 xác nhận §16.1 và §16.2 đã sửa đúng. Hai phát hiện mới; điểm thứ hai là
phát hiện **giá trị nhất của cả mười hai vòng** vì nó là lỗi chức năng thật, không
phải vấn đề trình bày lỗi.

### 17.1 Gate 1 vẫn nuốt nguyên văn exception

Đúng — và đây chính là chỗ khẳng định §16.3 của tôi còn sót.
`getMarketRegimeFromDb()` bắt lỗi Prisma rồi trả `WARNING` +
`MARKET_DATA_UNAVAILABLE_REASON` mà không mang `String(err)` ra ngoài;
`readLiveGate1()` phải tự viết câu "truy vấn index_daily_bar thất bại". Cả F1 và
F2 đều dùng nó, nên mất kết nối / sai quyền / thiếu bảng hiện y hệt nhau.

(Codex ghi chú đúng: tôi đã sửa `gate1-live.ts` trong working tree khi vòng 12
đang chạy nhưng chưa staged. Nay đủ cả hai phía.)

Sửa: thêm `MarketRegimeFromDbResult.loadError` mang nguyên văn exception. Hàm vẫn
**không bao giờ ném** — nhiều nơi gọi phụ thuộc vào điều đó — nhưng nay phía gọi
phân biệt được "DB hỏng" với "chưa đủ bar" (ca sau `loadError: null`, vì thiếu bar
là một sự thật đọc được, không phải lỗi). `readLiveGate1()` ưu tiên `loadError`.
Thêm 2 test chốt cả hai nhánh.

### 17.2 Bảng theo dõi F1 tra giá SAI KHOÁ — mọi hàng luôn là "—"

`buildLatestCloseBySymbol()` trả `Map` khoá theo **`symbolId`**, nhưng
`buildWatch()` tra bằng `item.symbol` (mã cổ phiếu). Không hàng nào khớp, nên cột
giá của bảng theo dõi **luôn** hiện `—` dù truy vấn trả về dữ liệu thật.

Đây là lỗi chức năng có từ Gate 2, và mười hai vòng review trước không bắt được
vì **test đang che nó**: fixture dùng khoá `"FPT"` (mã) thay vì `"sym_fpt"` (id),
nên `expect(close).toBe(138.2)` vẫn xanh trong khi màn thật hỏng. Một bài học
đúng chỗ: một test dựng fixture theo cách hàm đang tra cứu, chứ không theo cách
nguồn dữ liệu thật dựng ra, thì nó chốt lỗi lại chứ không bắt lỗi.

Sửa:
- Tra bằng `item.symbolId`.
- Đổi tên trường thành `latestCloseBySymbolId` để **khoá nằm ngay trong tên** —
  không thể tra nhầm mà vẫn đọc xuôi.
- Sửa fixture về khoá đúng, và thêm một khẳng định chốt **chiều tra cứu**: truyền
  map khoá theo mã thì kết quả phải là `null`.

Soi lại mọi cặp map/lookup dạng `*BySymbol` và `*BySymbolId` trong `lib/` và
`components/`: đây là chỗ **duy nhất** lệch khoá. Paper-lab có dịch `symbolId` →
`symbol` trước khi tra; F4 dùng map khoá theo mã viết hoa và tra bằng
`trade.symbol` (cũng viết hoa) — đều khớp.

### 17.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 163 file · **1500** test pass
- `npx next build` — exit 0

---

## 18. Vòng codex #13 — REJECT, 1 lớp lỗi ở 4 nơi. Đã sửa, gom về một nguồn.

Vòng 13 xác nhận §17.1 và §17.2 đã sửa đúng, không còn lệch khoá `*BySymbol` /
`*BySymbolId` nào, và không còn file đã xoá bị import. Phát hiện mới **đúng**, và
là lỗi chức năng cùng dạng §17.2.

### 18.1 Bộ lọc "lần quét smoke" không được áp thống nhất

Các lần quét smoke (`p0dExitHealthSmoke`, `demoSeed`) nằm chung bảng với lần quét
thật. `getLatestDailyScanRun()` lọc chúng ra; **bốn nơi khác thì không**, mà đọc
thô `dailyScanRun.findFirst({ orderBy: { runAt: "desc" } })`:

| Nơi | Hệ quả khi có một lần quét smoke mới hơn |
|---|---|
| `load-terminal-verdict.ts` | **Nặng nhất.** Server action ghi lệnh áp trần phán quyết của lần quét SMOKE, trong khi F1/F2/F7 hiển thị lần quét THẬT. |
| `shell-status.ts` | Ô PHÁN QUYẾT và mốc thời gian trên thanh trên nói về một lần quét khác với màn bên dưới. |
| `market-session-snapshot.ts` | Phép kiểm độ tươi so với một lần quét mà không màn nào đang hiển thị. |
| `system-status.ts` | Hàng trạng thái bộ quét của F5 lệch với F1/F2. |

Đúng dạng lỗi mà mười ba vòng review mới lộ ra: code chạy **sai trong dữ liệu
thật có marker smoke**, còn test thì xanh vì fixture không dựng nguồn scan theo
đúng bộ lọc production.

### 18.2 Sửa: một định nghĩa duy nhất cho "lần quét gần nhất"

Tách `findLatestNonSmokeScanRunId(prisma)` sang
`src/lib/scanner/latest-scan-run.ts`. **Năm** nơi — kể cả `getLatestDailyScanRun()`
— nay gọi chung nó, nên không còn hai định nghĩa của "lần quét gần nhất" để lệch.

- Nhận `prisma` qua **tham số** chứ không import singleton: `market-session-snapshot.ts`
  cố ý chỉ phụ thuộc KIỂU của Prisma để bốn bộ test thuần không phải dựng
  `DATABASE_URL` (bản đầu tôi import singleton và làm hỏng đúng bốn file đó).
- **4 test** chốt: smoke mới hơn ⇒ vẫn lấy lần quét thật · mới nhất là thật ⇒ lấy
  luôn · toàn smoke ⇒ `null` chứ KHÔNG rơi về một lần quét smoke · chưa có lần
  quét nào ⇒ `null`.

Các nơi còn đọc thô đều ngoài phạm vi và đúng như vậy: `run-daily-scan-job.ts`
(chính công việc quét, phải thấy mọi lần chạy), `classify-regime.ts` và
`build-market-context-bundle.ts` (phía job của Đấu trường), và
`load-paper-lab-page-from-db.ts:215` (chỉ nuôi `tradingDecision` + phễu — hai thứ
F3 **không** render, chỉ sáu route API dùng).

### 18.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — **164** file · **1504** test pass
- `npx next build` — exit 0

---

## 19. Vòng codex #14 — REJECT, 2 vấn đề trên F7. Đã sửa hết.

Vòng 14 xác nhận §18 đã sửa đúng ở cả năm nơi và các đọc thô còn lại đều nằm đúng
ngoại lệ đã nêu. Hai phát hiện mới trên F7, **cả 2 đều đúng**, và đều là dạng
"màn hình với server không cùng một con số".

### 19.1 F7 định cỡ bằng ADV của phiên KHÁC với server

F7 lấy `symbolMarketContextDaily` mới nhất rồi dùng làm `avgValue20Vnd` để tính
`systemShares`. Server action lại lấy ADV **tại hoặc trước `setup.barDate`**. Khi
lần quét thật cũ hơn bối cảnh thị trường mới nhất, phiếu ghi lệnh hiện khối lượng
theo ADV phiên mới còn server áp trần theo ADV phiên của thiết lập.

Sửa — tách nguồn theo đúng câu hỏi mỗi số trả lời:

- **ADV cho định cỡ**: tách `loadSymbolAdvVnd(prisma, symbolId, sessionDate)` ra
  `src/lib/trades/symbol-adv.ts`; F7 và cả ba lối trong server action gọi **cùng
  một hàm** với **cùng mốc phiên** (`candidateRow.barDate`). Không còn hai bản
  cài đặt để lệch.
- **Ô "GTGD 20N" trên bảng giá**: vẫn lấy phiên mới nhất — đó là một thống kê thị
  trường, phiên mới nhất mới đúng.
- F7 nay cũng **fail closed** như server: đọc ADV lỗi ⇒ không tính `systemShares`,
  và lỗi vào `errors` làm bằng chứng.

### 19.2 F7 thiếu phép kiểm "lần quét đi sau thị trường"

F2 có (§13), F7 thì không — dù vùng mua, cắt lỗ, `setupId` và khối lượng đề xuất
của F7 đều đến từ lần quét. Nay F7 gọi cùng `scanBehindMarketNotice()`, xét trước
ca "mã này chưa có nến cho phiên mới nhất". Để làm được, `Promise.all` giữ lại cả
đối tượng lần quét chứ không chỉ hàng ứng viên.

### 19.3 Tự tìm thêm: F7 bỏ lọt bộ lọc smoke ở lịch sử quét

Trong lúc soi cùng lớp lỗi với §18, thấy "LỊCH SỬ BỘ QUÉT" của F7 đọc
`setupCandidate` **không qua bộ lọc smoke** — một hàng do lần quét kiểm thử sinh
ra sẽ hiện y như một lần đạt Cổng 2 thật. Marker nằm trong `reasons` (JSON) nên
không lọc được bằng `where`: lấy dư 24 hàng, lọc `isSmokeSetupCandidateRow` trong
bộ nhớ rồi mới cắt còn 8.

### 19.4 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 164 file · 1504 test pass
- `npx next build` — exit 0

### 19.5 Tự tìm thêm: hằng số mặc định định cỡ bị chép ra ba nơi

Trả lời câu "còn con số nào màn và server tính khác nhau không" của vòng 15, tôi
rà từng tham số của `computePositionSizing()` giữa hai phía và thấy bốn hằng mặc
định (`maxPortfolioExposurePct` 0,7 · `maxPerTradeExposurePct` 0,2 ·
`baseRiskPerTradePct` 0,01 · `liquidityCapPct` 0,1) được **chép ra ba chỗ**:
`app/actions/trades.ts`, `lib/setups/terminal/f2-view-model.ts` và
`app/(dashboard)/symbol/[symbol]/page.tsx`.

Hôm nay chúng trùng giá trị, nên chưa có triệu chứng. Nhưng không có gì giữ cho
chúng trùng mãi — sửa một chỗ là màn hình và server lặng lẽ ra hai khối lượng
khác nhau, đúng cái bẫy mà §19.1 vừa gỡ. Gom về `POSITION_SIZING_DEFAULTS` trong
`lib/position-sizing.ts`, cả ba nơi cùng đọc; thêm một test chốt giá trị.

Các tham số còn lại đều đã cùng nguồn: vốn tài khoản
(`getTradingAccountEquityVnd`), tham số rủi ro của người dùng
(`getPositionSizingConfig`), giá trị vị thế đang mở (cùng công thức
`entryPrice × 1000 × quantity`), hạng thiết lập, và nay cả ADV (§19.1).

---

## 20. Vòng codex #15 — REJECT, 1 vấn đề. Đã sửa.

Vòng 15 xác nhận §19.1–§19.3 sửa đúng trên F7. Phát hiện mới, **đúng**: tôi sửa
F7 mà **quên F2** — cùng bề mặt phiếu ghi lệnh, cùng lỗi.

### 20.1 F2 vẫn lấy ADV theo quy tắc khác server

`safeLoadPositionSizingDefaults()` truy vấn `symbolMarketContextDaily` khớp
**chính xác** `expectedSession`, còn server dùng **tại hoặc trước** `setup.barDate`.
Hai ca cho kết quả khác nhau:

- Lần quét cũ hơn phiên thị trường ⇒ hai bên nhìn hai phiên khác nhau.
- Thiếu hàng đúng ngày nhưng có hàng phiên trước ⇒ màn bỏ trần thanh khoản
  (`null`), server vẫn tìm ra và áp trần ⇒ server từ chối khối lượng màn hiển thị.

### 20.2 Sửa: một quy tắc, hai hình dạng gọi

F2 định cỡ hàng loạt nên không gọi được hàm một-mã. Thêm
`loadSymbolAdvVndBatch(prisma, targets)` ngay cạnh `loadSymbolAdvVnd()` trong
`lib/trades/symbol-adv.ts`, **cùng quy tắc "tại hoặc trước"**, một truy vấn cho
mọi mã: lấy mọi hàng ≤ mốc muộn nhất rồi mỗi mã tự chọn hàng mới nhất không vượt
mốc **của chính nó**.

`safeLoadPositionSizingDefaults()` nay nhận `advTargets` — mỗi ứng viên kèm
`barDate` của chính nó, đúng mốc server dùng — thay vì một `expectedSession`
chung. Lỗi truy vấn ADV chảy vào `error` như mọi loader khác.

Thêm test chốt đúng ca gây lệch: **thiếu hàng đúng ngày mà có hàng phiên trước ⇒
vẫn phải ra ADV**, không được trả rỗng.

### 20.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 164 file · **1506** test pass
- `npx next build` — exit 0

---

## 21. Vòng codex #16 — REJECT, 1 vấn đề. Đã sửa TRƯỚC khi vòng này trả kết quả.

Vòng 16 xác nhận §20 (ADV) và §19.5 (hằng mặc định) đã sửa đúng. Phát hiện còn
lại — **đúng**, và là mắt xích cuối của chuỗi "màn và server cùng một con số".

### 21.1 Giá vào lệnh lệch nguồn giữa màn, phiếu và server

Ba nơi, ba giá khác nhau:

| Nơi | `entryKVnd` dùng để định cỡ |
|---|---|
| F2/F7 (`systemShares`) | `pullbackZoneHigh` — **đỉnh** vùng mua |
| Phiếu ghi lệnh (mặc định gửi lên) | `preview.suggestedEntry` — **trung điểm** vùng vào lệnh, có thể đã bị tighten |
| Server action | `confirmedEntryPrice` — đúng cái phiếu gửi |

Test `auto-populate-from-setup.test.ts:71` chốt sẵn một ca lệch thật:
`suggestedEntry = 99,5` khi `pullbackZoneHigh = 100`. Giá vào cao hơn ⇒ rủi ro
mỗi cổ phiếu lớn hơn ⇒ khối lượng nhỏ hơn. Nghĩa là phiếu có thể đề xuất một
khối lượng mà **server sẽ từ chối** — và lý do từ chối là một con số do chính
giao diện đưa ra.

Tôi tìm ra chỗ này khi tự trả lời câu hỏi 3 của đề bài vòng 16 (rà từng tham số
của `computePositionSizing` giữa hai phía), và đã sửa xong trong lúc vòng 16 chạy.

### 21.2 Sửa: phiếu hỏi thẳng server "khối lượng tại giá này là bao nhiêu"

Thêm `sizeAtEntry()` trong `app/actions/trades.ts` — **cùng hàm, cùng bộ tham số,
cùng thứ tự phép tính** với `createTradeFromSetup()`. `previewTradeLevelsForSetup()`
nay trả kèm:

- `suggestedQuantity` — khối lượng hệ thống tính **tại `suggestedEntry`**, tức
  đúng giá phiếu sẽ gửi nếu người dùng không sửa.
- `suggestedQuantityBlockedReason` — vì sao không tính được (chưa đặt vốn, đọc
  ADV lỗi…). Có lý do thì phiếu hiện nó và **khoá nút ghi lệnh**, thay vì gửi đi
  một con số tính ở giá khác rồi bị từ chối.

Phiếu ưu tiên `preview.suggestedQuantity`, chỉ rơi về `target.systemShares` khi
server không trả về được. Thứ tự phép tính hai bên nay khớp từng bước:
`computePositionSizing` → `roundDownToBoardLotShares` → `applyVerdictToShares`.

`systemShares` của F2/F7 giữ nguyên vai trò cũ — ước lượng tại đỉnh vùng mua để
**xếp hạng và so sánh ứng viên** — và đã ghi rõ điều đó ngay trên kiểu dữ liệu.

### 21.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 164 file · 1506 test pass
- `npx next build` — exit 0

---

## 22. Vòng codex #17 — REJECT, 2 vấn đề. Đã sửa hết.

Vòng 17 xác nhận mọi tham số định cỡ ở ba nơi đã khớp (mặc định, vốn, vị thế mở,
hạng, đơn vị giá vào/cắt lỗ, nguồn và quy tắc ngày của ADV, trần thanh khoản).
Hai phát hiện còn lại, **cả 2 đều đúng** — và điểm thứ nhất là lỗi trong chính
**lời văn của tôi**.

### 22.1 §21.2 nói quá: `sizeAtEntry()` chưa chạy đủ chuỗi

Tôi viết "cùng hàm, cùng tham số, **cùng thứ tự phép tính**", nhưng `sizeAtEntry()`
dừng ở `computePositionSizing → roundDownToBoardLotShares` rồi trả lô thô; ràng
buộc phán quyết lại do **phiếu tự áp ở client**. Kết quả số học có thể trùng,
nhưng câu khẳng định của tôi mô tả một thứ chặt hơn cái code làm — đúng loại
"chú thích hứa nhiều hơn code" mà chính gate này đã bắt hai lần (§7.3, §16.3).

Sửa cho khớp lời văn, theo hướng chặt hơn chứ không nới lời văn ra:
`sizeAtEntry()` nay chạy **đủ** chuỗi ở server —
`computePositionSizing` → `roundDownToBoardLotShares` → `applyVerdictToShares` —
kể cả các nhánh chặn (`NO_TRADE`, phán quyết chưa dựng được, dưới 1 lô, phán
quyết đưa về 0). Phiếu **không còn tự áp phán quyết**: quy tắc rủi ro thì server
giữ. `applyVerdictToShares` đã gỡ khỏi phiếu.

Để phiếu vẫn nêu rõ "đã bớt bao nhiêu và vì sao" (bàn giao §5),
`previewTradeLevelsForSetup()` trả thêm `suggestedQuantityBeforeVerdict` — khối
lượng chuẩn TRƯỚC ràng buộc — nên dòng chú thích dựng từ **hai con số của server**
thay vì tự tính lại.

### 22.2 Nút ghi lệnh không khoá khi chắc chắn sẽ bị từ chối

Phiếu vẫn cho bấm khi `verdict == null` hoặc khối lượng về 0 — server từ chối
ngay sau đó. Bắt người dùng bấm rồi mới biết là bắt họ đoán, và trái QA §4 (phán
quyết phải chi phối trạng thái hành động của phiếu).

Nay mọi nhánh chặn đều thành `suggestedQuantityBlockedReason` **từ server**, hiện
ngay trên chân phiếu, và nút bị khoá khi có lý do chặn **hoặc** khối lượng ≤ 0.

### 22.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 164 file · 1506 test pass
- `npx next build` — exit 0

---

## 23. Vòng codex #18 — REJECT, 1 lỗ hổng thật. Đã đóng bằng cách bỏ hẳn đường thứ hai.

Vòng 18 xác nhận `sizeAtEntry()` đã chạy đủ chuỗi và `applyVerdictToShares` đã
gỡ khỏi phiếu. Phát hiện còn lại **đúng**, và là mắt xích tôi vẫn bỏ sót ở §22:

### 23.1 Sửa giá vào lệnh thì khối lượng KHÔNG được tính lại

Phiếu cho sửa `confirmedEntryPrice`, nhưng khối lượng vẫn là con số tính tại
`suggestedEntry`. Nâng giá vào ⇒ rủi ro mỗi cổ phiếu tăng ⇒ trần giảm ⇒ server
từ chối con số mà nút "GHI VÀO SỔ LỆNH" vẫn đang bật.

Nói cách khác: §22.1 và §22.2 chỉ đúng ở **giá mặc định** — đúng lần thứ tư tôi
viết một khẳng định rộng hơn cái code bảo đảm.

### 23.2 Sửa: mỗi lần giá đổi là hỏi lại server

Thêm server action `sizeTradeAtEntry(setupId, entryKVnd)` — dùng chính
`sizeAtEntry()`, nên vẫn là **một** chuỗi phép tính. Phiếu gọi lại nó mỗi khi ô
giá đổi (chờ 250ms để không bắn mỗi phím gõ), và:

- Kết quả **nhớ kèm giá đã dùng để tính**. Nhờ vậy "chưa có kết quả" và "kết quả
  của giá cũ" là **cùng một trạng thái dẫn xuất** (`sizing == null`) — không cần
  state `pending` riêng, và không có `setState` đồng bộ trong effect (React 19
  cấm: gây render dây chuyền; eslint bắt đúng chỗ này khi tôi làm sai lần đầu).
- Sửa giá thì **bỏ luôn khối lượng người dùng đã nhập tay**, để nhận số mới của
  server thay vì giữ số tính ở giá cũ.
- Nút ghi lệnh khoá khi chưa có số của server, có lý do chặn, hoặc khối lượng ≤ 0.

### 23.3 Bỏ hẳn đường thứ hai thay vì canh cho hai đường bằng nhau

Mười tám vòng review cho thấy: mỗi khi còn **hai** cách tính ra một con số, sớm
muộn chúng lệch. Nên thay vì giữ `systemShares` làm "bản dự phòng", tôi gỡ hẳn:

- `OrderTicketTarget.systemShares` — **xoá**. Chưa có số của server thì ô khối
  lượng để **trống**; điền tạm con số tính ở giá khác là hiện một khối lượng
  không ai sẽ chấp nhận.
- `SetupLevelsPreview` — gỡ ba trường định cỡ. `previewTradeLevelsForSetup()` trở
  lại đúng việc của nó (mức giá), `sizeTradeAtEntry()` là **nguồn duy nhất** của
  khối lượng.
- Trang F7 — gỡ toàn bộ khối định cỡ phía trang (`computePositionSizing`,
  `roundDownToBoardLotShares`, `sizingConfig`, truy vấn vị thế đang mở): nó chỉ
  còn nuôi phiếu, mà phiếu nay hỏi thẳng server.

F2 giữ `systemShares` trong **bảng định cỡ** của nó — đó là ước lượng tại đỉnh
vùng mua để xếp hạng ứng viên, một câu hỏi khác, và nó không còn chảy vào phiếu.

### 23.4 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 164 file · 1506 test pass
- `npx next build` — exit 0

### 23.5 Tự tìm thêm: F5 là bản chép thứ TƯ của bộ mặc định

Rà lại mọi nơi gọi `computePositionSizing()` sau khi gỡ đường thứ hai, thấy
`f5-forms.tsx` giữ một `FALLBACK` riêng — chép tay bốn con số, lại còn ở **đơn vị
khác** (phần trăm `1 / 20 / 10` thay vì tỉ lệ `0,01 / 0,2 / 0,1`), nên §19.5 gom
ba nơi mà vẫn sót nơi này. Nay dẫn xuất thẳng từ `POSITION_SIZING_DEFAULTS` và
nhân 100 ngay tại chỗ, kèm ghi chú vì sao phải nhân.

Cũng gỡ một chú thích mồ côi còn sót ở trang F7 sau khi xoá khối định cỡ.

---

## 24. Vòng codex #19 — REJECT, 3 chú thích cũ. Đã sửa hết.

Vòng 19 xác nhận **không còn đường sống nào** đưa `systemShares` của F2/F7 vào
phiếu ghi lệnh; định cỡ của phiếu đi qua đúng `sizeTradeAtEntry()` → `sizeAtEntry()`.
Ba phát hiện còn lại đều là **chú thích và copy cũ sót lại sau bản tái cấu trúc
§23.3** — không có lỗi hành vi nào, nhưng đúng lớp lỗi tôi đã mắc bốn lần trước.

1. `ConfirmEntrySchema.confirmedQuantity` — chú thích còn nói "**phiếu** dùng nó
   để áp ràng buộc phán quyết". Ràng buộc đó nay do **server** áp; phiếu chỉ gửi
   con số người dùng chốt, và server không bao giờ nới nó lên. Viết lại cho đúng.
2. `order-ticket-modal.tsx` — chú thích nói giá và khối lượng đều dẫn xuất từ
   `preview`. Nay giá dẫn xuất từ `preview`, khối lượng dẫn xuất từ `sizingCache`.
3. Trang F7 — **copy hiển thị cho người dùng** trong băng "dữ liệu cũ" vẫn nhắc
   "khối lượng đề xuất bên dưới", trong khi F7 không còn tính khối lượng nào.
   Sửa cả hai câu (ca lần-quét-đi-sau và ca thiếu-nến) để chỉ nói về những gì F7
   thật sự dựng: bảng giá, chỉ báo, vùng mua, cắt lỗ, hạng thiết lập.

Soi tiếp toàn repo cho mọi câu còn nhắc "khối lượng đề xuất": các chỗ còn lại đều
ở F2 (vẫn có bảng định cỡ thật) và ở `verdict-tokens.ts` (phán quyết vẫn chi phối
khối lượng ở mọi màn) — đúng. Riêng doc của `scanBehindMarketNotice()` được siết
lại: nó nêu ví dụ chung, còn **phạm vi ảnh hưởng thật do mỗi màn tự khai qua tham
số `scope`**, và nội dung đó phải khớp đúng những gì màn ĐÓ dựng từ lần quét.

### 24.1 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 164 file · 1506 test pass
- `npx next build` — exit 0

---

## 25. Vòng codex #20 — REJECT, 2 vấn đề trên F4. Đã sửa hết.

Vòng 20 xác nhận không còn chú thích/copy nào nói rộng hơn code. Hai phát hiện
mới, **cả 2 đều đúng**, và cả hai đều là dạng "thiếu dữ liệu bị trình bày như một
kết quả".

### 25.1 Gợi ý khối lượng lệnh tay bỏ trần thanh khoản khi ADV lỗi

Ở §9.1 tôi phân tầng ba nơi gọi ADV và cho `previewManualTradeLevels()` được
"bỏ trần, chỉ gợi ý rộng hơn chút". Lập luận đó **sai**: bỏ trần vì một lỗi truy
vấn nghĩa là con số gợi ý có thể rộng hơn thực tế, mà giao diện **không có gì để
nói ra điều đó** — F4 chỉ in con số, không có bằng chứng lỗi nào đi kèm.

Sửa: ADV lỗi ⇒ **không gợi ý khối lượng**, và trả `suggestedQuantityBlockedReason`
mang nguyên văn lỗi. Phân biệt rõ với ca *thiếu hàng ADV* (`ok: true, value: null`):
khi đó cả hệ thống cùng không có trần, gợi ý vẫn đúng với những gì biết được.

Nhân tiện sửa một chỗ đoán mò trong giao diện: F4 in cứng
*"chưa gợi ý được khối lượng (chưa đặt vốn tài khoản ở F5)"* cho **mọi** trường
hợp `null` — kể cả khi thật ra truy vấn ADV hỏng hay khối lượng dưới 1 lô. Nay lý
do đến từ server, chia đúng ba nhánh.

### 25.2 Lãi/lỗ chưa có dữ liệu bị tô XANH

`(trade.realizedPnl ?? 0) >= 0` tô `--tm-up` cho cả lệnh chưa có lãi/lỗ. Ô hiện
`—` nhưng **màu lại nói "lãi"**, ở cả bảng lịch sử lẫn tiêu đề modal chi tiết.
Đây đúng là "hiện 0 thay vì gap", chỉ là qua màu thay vì qua số.

Sửa: helper `signTone()` ở phạm vi module — `null`/không hữu hạn ⇒
`--tm-text-faint` (trung tính), có số mới xét dấu. Hai chỗ tô sai và bộ KPI cũ
dùng chung nó.

Soi tiếp toàn bộ tầng terminal cho mọi chỗ quyết định MÀU từ một giá trị nullable:
F7 đã gate `null` ở cả ba ô; đường vốn của F4 chỉ tô khi có ≥ 2 điểm (nếu không
thì không vẽ gì). Các `(x ?? 0)` còn lại nằm trong engine tính điểm của Đấu trường
và bộ quét — là quyết định miền nghiệp vụ, không phải khẳng định hiển thị.

### 25.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 164 file · 1506 test pass
- `npx next build` — exit 0

---

## 26. Vòng codex #21 — REJECT, 1 vấn đề. Đã sửa, và gom về một quy ước.

Vòng 21 xác nhận §25.1 pass: ba tầng ADV nhất quán. Phát hiện còn lại **đúng** —
sparkline bảng xếp hạng F3 tô `--tm-up` khi `pnlPct === null`: ô lợi nhuận cùng
hàng hiện gap, mà đường vốn bên cạnh lại xanh.

Phép soi của tôi ở §25.2 sót vì tôi tìm mẫu `(x ?? 0) >= 0`, còn chỗ này viết
`x != null && x < 0 ? down : up` — cùng lỗi, khác hình dạng biểu thức. Nên thay
vì vá từng chỗ, lần này gom về **một quy ước dùng chung**.

### 26.1 `priceToneVar()` — bản GIÁ TRỊ màu của `priceToneClass()`

Đã có `priceToneClass()` trả về *class*, nhưng những nơi cần một *giá trị màu*
(prop `tone` của `Sparkline`, thuộc tính `style`) thì phải tự viết biểu thức —
và mỗi bản tự viết lại sai theo một kiểu. Thêm `priceToneVar()` trong
`lib/format/vn.ts`, cùng đúng quy ước, kể cả hai ca dễ sai:

- `null` / không hữu hạn ⇒ **gap**, màu mờ trung tính.
- `0` ⇒ **tham chiếu** (vàng) theo quy ước bảng giá VN — **không** phải "tăng".
  (Đây cũng là một sửa đổi hành vi so với helper cục bộ `signTone()` tôi viết ở
  §25.2, vốn tô 0 thành xanh. Bàn giao QA §3 nói vàng là tham chiếu.)

### 26.2 Ba chỗ đổi sang dùng nó

- Sparkline bảng xếp hạng **F3** — lỗi codex nêu.
- Sparkline VNINDEX ở rail phải **F1** — cùng lỗi, tôi tự tìm thêm.
- Sparkline 20 phiên trong bảng thiết lập **F1** — cùng lỗi, tự tìm thêm.
- `signTone()` cục bộ trong f4-view-model — xoá, dùng chung `priceToneVar()`.

Thêm **5 test** chốt quy ước: gap ⇒ mờ · 0 ⇒ vàng · dương ⇒ xanh · âm ⇒ đỏ · và
một phép so trực tiếp rằng `priceToneVar()` với `priceToneClass()` luôn cùng
phân loại gap.

Soi lại toàn bộ tầng terminal cho mọi biểu thức chọn màu: phần còn lại đều là màu
**tĩnh** (icon trạng thái rỗng, nền vùng mua trên biểu đồ, vạch cắt lỗ) hoặc đã
gate `null` sẵn.

### 26.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 164 file · **1510** test pass
- `npx next build` — exit 0

---

## 27. Vòng codex #22 — REJECT, 1 vấn đề. Đã sửa.

Phát hiện **đúng**, và là biến thể thứ ba của cùng một lớp lỗi: modal "QUẢN LÝ VỊ
THẾ" tô ô `LÃI/LỖ CHƯA THỰC HIỆN` và `%` bằng **`row.healthColor`** — màu của
*sức khoẻ thiết lập*, không phải của chính con số.

Hai hệ quả đều sai theo hướng nguy hiểm:

- Vị thế `HEALTHY` **đang lỗ** vẫn hiện lãi/lỗ màu **xanh**.
- Vị thế `HEALTHY` **thiếu bar giá** hiện `—` màu **xanh**.

Bảng F4 bên ngoài đã dùng đúng `priceToneClass(row.unrealizedVnd)`; chỉ modal lệch.

Sửa: cả ba ô số của modal (`LÃI/LỖ CHƯA THỰC HIỆN`, `%`, `R HIỆN TẠI`) dùng
`priceToneVar()` theo **chính giá trị của mình**. Cũng sửa `R ĐẠT ĐƯỢC` ở modal
lệnh đã đóng — nó mượn màu của ô lãi/lỗ bên cạnh; nay theo bội số R của chính nó,
nên R thiếu dữ liệu vẫn trung tính kể cả khi lãi/lỗ có số.

Giữ nguyên `tone={row.healthColor}` cho **khung** modal: đó là màu nhấn của cả
modal, mà chủ thể của modal đúng là sức khoẻ vị thế.

Soi lại mọi ô còn tô bằng màu đến từ trường khác: phần còn lại đều tô nhãn bằng
tone **của chính nhãn đó** (`healthColor`→`healthLabel`, `rsColor`→ô RS20,
`statusColor`→ô trạng thái, `stateColor`→ô vòng đời), và cả ba helper
(`healthTone`, `rsTone`, `lifecycleTone`) đều trả `--tm-text-faint` cho `null`.

### 27.1 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 164 file · 1510 test pass
- `npx next build` — exit 0

---

## 28. Vòng codex #23 — REJECT, 4 vấn đề. Đã sửa hết, và mở rộng ra cả phễu F1.

Kết luận rộng của tôi ở §27 ("không còn ô nào nói sai qua màu") là **sai**. Bốn
phát hiện, **cả 4 đều đúng**, và chia làm hai kiểu:

### 28.1 Số 0 bị tô như kết quả dương

- `R BÌNH QUÂN` (F4): `avgR >= 0 ? xanh : đỏ` ⇒ `0,00` thành **xanh**. Hoà vốn
  không phải lãi. Nay dùng `priceToneVar()` — cùng quy ước đã chốt ở §26 (0 ⇒
  vàng tham chiếu).
- `KHỐI NGOẠI` (F7): `foreignNetVnd >= 0 ? xanh` ⇒ ròng **bằng 0** thành mua
  ròng. Ròng 0 là **cân bằng** ⇒ vàng.

### 28.2 Màu ngữ nghĩa của bảng giá gán tĩnh cho ô có thể rỗng

`CAO NHẤT` xanh, `THẤP NHẤT` đỏ, `THAM CHIẾU` vàng — đúng quy ước bảng giá VN,
nhưng gán **vô điều kiện**. `SymbolPage` dựng được model với `bars = []`, nên ô
hiện `—` mà vẫn mang màu ngữ nghĩa: gán ý nghĩa cho chỗ không có dữ liệu.

Sửa bằng một helper `boardTone(value, tone)` ngay tại chỗ: có số thì màu ngữ
nghĩa, không có thì mờ. Áp cho cả sáu ô cùng dạng (`MỞ CỬA`, `CAO NHẤT`,
`THẤP NHẤT`, `THAM CHIẾU`, `KL KHỚP`, `GTGD`) — không chỉ ba ô codex nêu.

### 28.3 Tự mở rộng: phễu bộ quét F1 cùng lỗi

Năm bậc phễu mang màu nhận diện riêng (lơ → tím → hổ phách → xanh), gán tĩnh. Bậc
chưa có số hiện `—` **mang màu bậc**, trông như một phép đo đã chạy xong. Nay chỉ
tô khi bậc đó có số.

Thêm **2 test** trên F7: không có nến ⇒ cả sáu ô là `—` và màu mờ; khối ngoại
ròng 0 ⇒ vàng, dương ⇒ xanh, âm ⇒ đỏ.

Các màu tĩnh còn lại đều là **màu nhận diện của một hạng mục luôn tồn tại** (lớp
tác tử LLM/NGƯỜI, trạng thái trận ĐANG CHẠY/XONG) chứ không phải khẳng định về
một giá trị đo được.

### 28.4 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 164 file · **1512** test pass
- `npx next build` — exit 0

---

## 29. Vòng codex #24 — REJECT, 1 vấn đề. Đã sửa.

Vòng 24 xác nhận cả bốn điểm của §28 đã sửa đúng. Phát hiện mới **đúng**, và là
biến thể cuối cùng của cùng lớp lỗi — lần này ở **thanh trên**, tức bề mặt mà mọi
màn đều nhìn thấy:

### 29.1 "Chưa biết" bị hiển thị thành "DỮ LIỆU CŨ"

`shell-status.ts` ghi rõ `scanMatchesLatestSession: boolean | null` với `null` =
thiếu một trong hai mốc phiên, **"không đoán"**. Nhưng shell truyền
`live={... === true}`, ép ba trạng thái xuống hai — nên khi đọc lỗi DB hoặc thiếu
mốc, thanh trên khẳng định **DỮ LIỆU CŨ** màu hổ phách ở nơi thật ra không đo
được gì.

Tôi viết đúng ghi chú "không đoán" ở tầng dữ liệu rồi lại đoán ở tầng hiển thị.

### 29.2 Sửa: ba trạng thái, và tách ra chỗ test được

`TopBarProps.live` đổi thành `boolean | null` và truyền thẳng. Phần trình bày
tách sang `dataFreshness(live)` trong `lib/terminal/labels.ts`:

| `live` | Nhãn | Màu | Đèn |
|---|---|---|---|
| `true` | TRỰC TIẾP | `--tm-up` | có |
| `false` | DỮ LIỆU CŨ | `--tm-accent` | không |
| `null` | ĐỘ TƯƠI — | `--tm-text-faint` | không |

Trạng thái `null` kèm `title` giải thích vì sao không kết luận được.

Tách ra helper thuần vì `TopBar` kéo theo nút đăng xuất → server action → prisma,
nên không test trực tiếp trong bộ test node được. **3 test** chốt cả ba nhánh,
trong đó nhánh `null` khẳng định nhãn **không** chứa "CŨ" lẫn "TRỰC TIẾP".

### 29.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 165 file · **1515** test pass
- `npx next build` — exit 0

---

## 30. Vòng codex #25 — REJECT, 2 vấn đề. Đã sửa.

Vòng 25 xác nhận §29 pass. Hai phát hiện mới, **cả 2 đều đúng**, và cả hai đều là
chỗ tôi **đã tự cân nhắc rồi quyết định sai** ở các gate trước.

### 30.1 Phán quyết "chưa đo được" vẫn mang màu NO_TRADE

Model đặt `code: "—"` và `provenance: "gap"` — rồi vẫn đặt `color: var(--tm-down)`
và `headBg: var(--tm-head-no-trade)`. Panel hiện mã "—" trên nền đỏ của NO_TRADE.

Tôi từng biện hộ là "đỏ = đừng vào lệnh, đúng về mặt vận hành". Lập luận đó
**hỏng ở chỗ**: NO_TRADE và chưa-đo-được dẫn tới **hai hành động khác nhau** —
một bên chờ điều kiện thị trường, một bên đi nạp dữ liệu VNINDEX. Tô giống hệt
nhau là xoá mất khác biệt đó, và mâu thuẫn ngay với mã "—" nằm cạnh.

Sửa: thêm token `--tm-head-unknown` (nền tối trung tính, tách khỏi thân panel
nhưng không mượn sắc đỏ), và màu chữ dùng `--tm-text-faint`. Thêm khẳng định vào
test sẵn có: màu **không được** là `--tm-down`, nền **không được** là
`--tm-head-no-trade`.

### 30.2 Nhãn nguồn `gap` tô đỏ

`.tm-src[data-src="gap"]` dùng `--tm-down`, nên nhãn "không có dữ liệu" đọc như
một sự cố. Đối chiếu bản thiết kế: nó **chỉ dùng nhãn `derived`** — `gap` là phần
mở rộng của bản triển khai, nên màu đỏ là lựa chọn của tôi chứ không phải của
thiết kế, và nó đi ngược đúng nguyên tắc gate này vừa chốt hai mươi lần.

Sửa: giữ màu mờ trung tính của `.tm-src`. Bản thân ô đã hiện "—" rồi; nhãn nguồn
chỉ cần nói *vì sao*, không cần báo động.

Bàn giao §6 về gap chỉ quy định **"hiện — chứ không hiện 0"** và **"ô nhãn gap
không được dùng để tính phán quyết"** — cả hai vẫn giữ nguyên; thay đổi ở đây chỉ
là thôi gán thêm một ý nghĩa mà thiết kế không yêu cầu.

### 30.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 165 file · 1515 test pass
- `npx next build` — exit 0

---

## 31. Vòng codex #26 — REJECT, 1 vấn đề. Đã sửa, và quét nốt cùng lớp trên F2.

Vòng 26 xác nhận §30 pass. Phát hiện mới **đúng**, và là lần thứ hai tôi sửa một
màn mà quên màn song song: §28.3 gate phễu của **F1**, còn phễu của **F2** thì
không — đúng như §20.1 (sửa F7 quên F2).

### 31.1 Phễu F2 tô màu bậc cho cả bậc chưa đo được

`qualifiedTotal: null` hiện `—` màu mờ, nhưng vạch ô "ĐẠT CỔNG 2" vẫn **xanh**.
Vạch màu là một khẳng định "bậc này đã đo xong". Nay dùng helper `funnelStage()`
gate trên `value != null`, và thêm test chốt: bậc có số giữ màu bậc, bậc `null`
thành mờ.

### 31.2 Tự quét thêm: các ô MỨC GIÁ của F2 cùng lỗi

Soi tiếp cùng lớp trong F2 và thấy bốn ô nữa gán màu nhận diện **vô điều kiện**:
`VÙNG MUA` (xanh), `CẮT LỖ` (đỏ nhạt), `MỤC TIÊU 1` (xanh nhạt), `GIÁ ĐÓNG`. Đây
đúng kiểu đã sửa cho bảng giá F7 ở §28.2 — ô "—" mang màu "vùng mua"/"cắt lỗ" là
gán ý nghĩa cho chỗ không có dữ liệu. Thêm helper `levelTone()` gate cả bốn.

### 31.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 165 file · **1516** test pass
- `npx next build` — exit 0

---

## 32. Vòng codex #27 — REJECT, 3 vấn đề. Đã sửa, và gom quy ước về `semanticTone()`.

Phát hiện **đúng cả 3**, và chỉ ra một lỗ trong chính phép soi của tôi: §31 tôi
quét `src/lib/**/terminal/*.ts` (các view model) mà **quên `src/components/`** —
nơi nhiều màu được gán thẳng trong JSX.

- `setups-table.tsx` cột `CẮT LỖ` (F1): `row.stop` nullable, màu đỏ nhạt vô điều kiện.
- `f4-screen.tsx` cột `CẮT LỖ`: `Trade.stopLoss` là `Float?` trong schema.
- `f4-screen.tsx` cột `CHỐT LỜI`: `Trade.takeProfit` cũng `Float?`; ghi lệnh tay
  cho phép để trống.

### 32.1 Sửa: một helper, dùng ở cả hai tầng

Thay vì vá tiếp từng chỗ, gom về `semanticTone(value, tone)` trong
`lib/format/vn.ts` — có số thì giữ màu vai trò, thiếu số thì `--tm-text-faint`.
Khác `priceToneVar()`: hàm kia nói về **dấu** của con số, hàm này nói về **vai
trò** của ô (cắt lỗ, mục tiêu, vùng mua, bậc phễu, % NAV…).

Hai helper cục bộ viết ở §28.2 và §31.2 (`boardTone` trong f7, `levelTone` trong
f2) **xoá**, cùng dùng bản chung — mười một chỗ.

### 32.2 Quét lại CẢ HAI tầng và sửa nốt bốn chỗ tự tìm

- Phiếu ghi lệnh: `CHỐT LỜI` (`preview.takeProfit` nullable), `% NAV` và `RỦI RO`
  (cả hai hiện "—" khi thiếu vốn/giá) — cả ba gán màu vô điều kiện.
- `f4-screen` cột chiều lệnh tô `--tm-up` cứng, nên **"BÁN" cũng xanh**. Nay theo
  chính chiều lệnh.

Số hit còn lại sau khi soi cả `lib/` và `components/` đều đã kiểm từng cái và
đúng: bảng tra theo hạng mục luôn tồn tại (token phán quyết, lớp tác tử, trạng
thái trận, độ tươi), nhãn tĩnh (`CHẶN`, tiêu đề modal phá vỡ), thông báo lỗi thật,
và các ô nằm trong khối chỉ dựng khi đã có số (bảng định cỡ, hàng lý do Cổng 2).

Thêm test cho `semanticTone`: có số ⇒ giữ màu · `0` ⇒ vẫn giữ màu (0 là một số) ·
`null`/`undefined`/`NaN` ⇒ mờ.

### 32.3 Kiểm chứng lại

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (có sẵn từ trước, đều trong `lib/`)
- `npm test` — 165 file · **1517** test pass
- `npx next build` — exit 0

---

## 33. Vòng codex #28 — ✅ APPROVE

> "Không tìm thấy vấn đề còn lại đủ mức REJECT trong phạm vi GATE 8. […]
> `semanticTone()` dùng đúng cho các ô vai trò nullable […] Các hit còn lại tôi
> kiểm tra được đều là bảng tra hạng mục, nhãn tĩnh, lỗi có bằng chứng, hoặc khối
> chỉ render khi đã có số. 12 điểm QA nhìn chung pass theo source staged."

Một ghi chú **không chặn** kèm theo, đã sửa luôn: thanh trạng thái ghi
"F1–F5 chuyển màn" trong khi router nhận **F1–F8**. Nay khớp.

### 33.1 Tổng kết Gate 8

| | |
|---|---|
| Số vòng review | **28** |
| Tổng phát hiện | **59** |
| Đúng và đã sửa | **58** |
| Phản biện được chấp nhận | **1** (§8.1 — không chặn ghi lệnh tay) |

Phần lớn phát hiện thuộc **một lớp lỗi duy nhất**: trình bày điều ta không biết
như thể đã biết — qua con số (0 thay vì "—"), qua màu (xanh cho ô rỗng), qua nhãn
("DỮ LIỆU CŨ" khi chưa đo được), qua chú thích (hứa nhiều hơn code làm), hoặc qua
hai đường tính cho cùng một con số (màn ≠ server).

Ba công cụ đã gom lớp đó về một mối, và chúng là thứ nên giữ:

- `priceToneVar()` — màu theo **dấu**; gap mờ, 0 là tham chiếu.
- `semanticTone()` — màu theo **vai trò**; chỉ áp khi ô có số.
- `sizeAtEntry()` / `loadSymbolAdvVnd()` / `POSITION_SIZING_DEFAULTS` /
  `findLatestNonSmokeScanRunId()` / `scanBehindMarketNotice()` — mỗi câu hỏi
  đúng **một** nơi trả lời, cho cả màn hình lẫn server.

### 33.2 Kiểm chứng cuối

- `npm run typecheck` — pass
- `npx eslint src tests` — 0 error, 19 warning (đều có sẵn từ trước, trong `lib/`)
- `npm test` — 165 file · **1517** test pass
- `npx next build` — exit 0
