---
status: accepted
---

# Không giao dịch tiền thật theo tín hiệu app trước checkpoint kiểm định

Tín hiệu scanner đã bị kết luận NO-GO trên dữ liệu lịch sử (`docs/trading/replay/BASELINE-EDGE-VERDICT.md`). Nghiên cứu lịch sử cũng đã đóng (`RESEARCH CLOSED — PROSPECTIVE VALIDATION ONLY`), và paper engine đang mô phỏng lạc quan hơn thực tế. Vì vậy, không đặt tiền thật theo bất kỳ tín hiệu app nào cho tới checkpoint kiểm định: đủ N=100 prospective observation và mẫu đã đi qua ít nhất một nhịp VN-Index giảm hơn 15%. Chỉ đếm N là chưa đủ, vì hệ breakout ở VN thường sống ở pha tăng rồi chết ở pha giải chấp (2018, 2022). Trong lúc chờ, giao dịch thực chiến chỉ diễn ra trong một tài khoản học phí, vào lệnh bằng phán đoán của trader, và kết quả của tài khoản đó không được dùng làm bằng chứng.

## Considered Options

- Trade theo tín hiệu app ngay, với vốn nhỏ: bị loại, vì kết quả sẽ làm bẩn phép kiểm chứng và tín hiệu đã NO-GO.
- Bỏ luật prospective: bị loại, vì luật được khoá ở commit `14fdbb4` chính là để chống việc tự thuyết phục mình bằng dữ liệu cũ.
- Checkpoint chỉ đếm N=100: bị loại, vì 100 quan sát trong 1–2 năm có thể chỉ rơi vào một pha thị trường.
