---
status: accepted
---

# App là công cụ gợi ý tham khảo, không phải công cụ đặt lệnh

Người dùng muốn app đưa ra gợi ý lệnh (lý do, rủi ro, vùng vào, vùng SL, mốc chốt theo R) để tham khảo, còn việc giao dịch diễn ra ở nơi khác, do người quyết định. App không bao giờ gửi lệnh, không kết nối broker, và mọi gợi ý lệnh đều mang trạng thái kiểm chứng. Cho tới checkpoint kiểm định của ADR 0001, trạng thái đó là "Chưa kiểm chứng", và lời văn chỉ mô tả, không thúc giục (audit F08). Quyết định này không mâu thuẫn với ADR 0001: gợi ý được phép hiển thị, còn việc có dùng nó cho tiền thật hay không vẫn thuộc về người dùng, dựa trên bằng chứng được hiển thị cạnh nó.

## Considered Options

- Ẩn mọi gợi ý cho tới checkpoint: bị loại, vì app mất giá trị tham khảo trong 1–2 năm và người dùng vẫn cần một bản plan có cấu trúc.
- Hiển thị gợi ý như tín hiệu mua không kèm trạng thái: bị loại, vì tín hiệu scanner đã NO-GO trên dữ liệu lịch sử.
