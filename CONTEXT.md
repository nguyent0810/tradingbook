# Trading Book

Công cụ hỗ trợ quyết định cho swing trading cổ phiếu Việt Nam (HOSE/HNX/UPCoM): lọc watchlist cuối ngày, lập kế hoạch, ghi nhật ký, và kiểm chứng tín hiệu bằng paper/prospective. App không đặt lệnh thật.

## Language

### Giao dịch

**Giao dịch thực chiến** (Live trading):
Người tự đặt lệnh bằng tiền thật trên app của broker; app chỉ cung cấp dữ liệu, bộ lọc và nhật ký.
_Avoid_: auto-trading, "trade theo app"

**Tài khoản học phí** (Tuition account):
Tài khoản tiền thật tách riêng, vốn nhỏ, không margin, có trần lỗ cố định, vào lệnh theo phán đoán của người; kết quả của nó không bao giờ được dùng làm bằng chứng cho tín hiệu app.
_Avoid_: tài khoản thử, live test

**Phán đoán của trader** (Discretionary decision):
Quyết định vào/ra lệnh do người đưa ra, dùng output của app làm đầu vào chứ không làm mệnh lệnh.

### Rủi ro

**Rủi ro lệnh** (Trade risk):
Số tiền mất nếu lệnh thoát ở stop cộng đệm gap, tính theo phần trăm vốn tài khoản.
_Avoid_: exposure (khi ý là rủi ro), size

**Đệm gap** (Gap buffer):
Khoảng lỗ vượt quá mức stop, bằng một biên độ sàn của sàn niêm yết. Nó tồn tại vì ở VN giá thường mở gap xuyên qua stop.

**Tổng rủi ro mở** (Open risk):
Tổng rủi ro lệnh của mọi vị thế tiền thật đang mở.
_Avoid_: exposure, tổng tỷ trọng

**Exposure**:
Giá trị danh nghĩa của vị thế đang mở. Đây là thước đo tỷ trọng, không phải rủi ro.

**Kịch bản sàn liên tiếp** (Limit-down run):
Giả định vị thế không thoát được qua N phiên giảm sàn liên tiếp, dùng để kiểm tra size lúc vào lệnh.

**Trần lỗ cứng** (Hard loss cap):
Mức sụt giảm của tài khoản học phí mà khi chạm thì tài khoản bị đóng và quay về paper.
_Avoid_: stop tài khoản

**Ngưỡng dừng mềm** (Soft halt):
Mức sụt giảm, lỗ tuần hoặc chuỗi thua mà khi chạm thì tạm ngừng mở lệnh mới cho tới khi review xong nhật ký.
_Avoid_: kill switch (dùng riêng cho thao tác khoá thủ công)

**Kill switch**:
Thao tác khoá thủ công ngăn mở lệnh tiền thật mới; chỉ mở lại bằng thao tác có ghi lý do.

### Kỷ luật

**Plan trước phiên** (Pre-session plan):
Entry, stop, size và lý do của một lệnh, chốt trước ATO từ dữ liệu cuối ngày hôm trước và không sửa được sau khi vào lệnh.

**Tuân thủ** (Discipline outcome):
Phân loại lệnh đã đóng theo việc có đi đúng plan trước phiên hay không: `FOLLOWED_PLAN`, `EMOTIONAL_EXIT` hoặc `RULE_VIOLATION`.

### Tín hiệu và bằng chứng

**Gợi ý lệnh** (Trade suggestion):
Một setup của scanner được trình bày cho người đọc để tham khảo: lý do, rủi ro, vùng vào, vùng SL, các mốc chốt theo R, size tham khảo và trạng thái kiểm chứng. Nó là một dạng tín hiệu app, không phải lệnh hay lời khuyên đầu tư.
_Avoid_: khuyến nghị, lệnh, tín hiệu mua

**Vùng vào** (Entry zone):
Khoảng giá mua tham khảo, làm tròn tới bước giá gần nhất của sàn và cắt vào biên độ của phiên kế tiếp, tính từ giá đóng cửa của phiên mới nhất.

**Vùng SL** (Stop zone):
Khoảng giá mà setup bị coi là hỏng, nằm giữa mức vô hiệu theo cấu trúc giá và mức stop tối thiểu đủ xa khỏi nhiễu.
_Avoid_: điểm cắt lỗ (khi ý là một vùng)

**R**:
Rủi ro trên mỗi cổ phiếu, tính từ đầu trên của vùng vào (mức khớp xấu nhất) tới đầu dưới của vùng SL; có bản gộp và bản sau phí môi giới hai chiều cộng thuế bán 0,1%. Các mốc chốt được biểu diễn bằng bội số của R.
_Avoid_: R:R tính từ giữa vùng vào, là cách tính cũ mà modal đặt lệnh vẫn dùng tới #17 (F2 đã bỏ)

**Mốc chốt** (Take-profit ladder):
Các mức giá 1R, 2R, 3R tính từ vùng vào, kèm kháng cự gần nhất nếu có.

**Trạng thái kiểm chứng** (Evidence status):
Mức bằng chứng đứng sau một tín hiệu app. Hiện luôn là "Chưa kiểm chứng" kèm tiến độ tới checkpoint kiểm định (N/100).

**Tín hiệu app** (App signal):
Bất kỳ output nào của app gợi ý hành động: setup của scanner, điểm, tier, stance (TRADE/NORMAL/"Go"), hay phân bổ của Arena/Shadow Allocation. Chưa tín hiệu nào được kiểm chứng.
_Avoid_: buy signal, khuyến nghị

**Prospective observation**:
Một quyết định của tín hiệu app được ghi lại trước khi kết quả của nó tồn tại; là loại bằng chứng duy nhất còn được chấp nhận sau khi nghiên cứu lịch sử đã đóng.
_Avoid_: forward test, backtest mới

**Checkpoint kiểm định** (Validation checkpoint):
Mốc được xét xem tín hiệu app có edge sau chi phí hay không: đủ N=100 prospective observation và mẫu đã đi qua ít nhất một nhịp VN-Index giảm hơn 15%.
_Avoid_: "đủ dữ liệu", review

**Paper trade**:
Lệnh mô phỏng không dùng tiền, dùng để quan sát hành vi hệ thống; không phải bằng chứng edge, vì mô phỏng hiện lạc quan hơn thực tế.
_Avoid_: shadow trade (khi ý là paper)
