---
status: accepted
---

# Trần size khi ghi lệnh từ gợi ý là trần cứng

Khi ghi một lệnh từ gợi ý lệnh, server tự tính lại trần số cổ theo đúng quy tắc của size tham khảo: rủi ro mỗi lệnh áp lên R cộng đệm gap, sau đó là các trần thanh khoản và exposure, rồi phán quyết phiên. Số cổ vượt trần bị từ chối, và modal hiện trần này ngay khi giá vào hoặc SL thay đổi. Người dùng chọn giữ đây là trần cứng thay vì chỉ cảnh báo kèm ghi lý do vượt, vì mục đích của tài khoản học phí là rèn kỷ luật (ADR 0002). Một lệnh lớn hơn trần vẫn ghi được qua F4 (nhập tay), nhưng lệnh đó không có snapshot gợi ý, nên không được tính là "làm theo plan". Ngưỡng cảnh báo thanh khoản của vị thế được giữ ở 1% ADV.

## Considered Options

- Chỉ cảnh báo và ghi lại lý do vượt trần, vẫn giữ snapshot: bị loại. Cách này hợp với một công cụ tham khảo thuần túy, nhưng làm yếu kỷ luật size mà tài khoản học phí cần.
