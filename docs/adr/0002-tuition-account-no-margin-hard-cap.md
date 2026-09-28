---
status: accepted
---

# Tài khoản học phí: không margin, trần lỗ cứng −15% thì đóng tài khoản

Tài khoản học phí tồn tại để luyện phán đoán và kỷ luật, không phải để kiếm lời. Vì vậy tài khoản này không dùng margin hay ứng trước tiền bán, và khi chạm trần lỗ cứng −15% vốn thì tài khoản bị đóng, quay về paper. Lý do: ở VN, các nhịp giải chấp dây chuyền (4–6/2022, 10–11/2022) khiến giá nằm sàn liên tiếp và bị force-sell, nên mức stop không còn tác dụng. Mất tiền vì call margin không dạy được gì về phán đoán. Sai lầm điển hình khác là tăng size để "gỡ" đúng lúc thị trường đang downtrend, và một trần lỗ cứng chặn được điều đó. Kể cả khi tài khoản đạt tiêu chí để tăng vốn (ít nhất 30 lệnh, `FOLLOWED_PLAN` từ 80% trở lên, lãi kỳ vọng sau phí thuế lớn hơn 0), vẫn không được giao dịch theo tín hiệu app trước checkpoint kiểm định (ADR 0001).

## Consequences

Luồng tạo lệnh tiền thật phải có khoá khi chạm ngưỡng dừng mềm hoặc trần lỗ cứng, và mở khoá chỉ bằng thao tác thủ công có ghi lý do. Hiện chưa có khoá này.
