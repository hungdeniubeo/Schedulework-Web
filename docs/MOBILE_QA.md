# Mobile QA

Kiểm tra trong Chrome DevTools Responsive ở `360x800`, `390x844` và `412x915`.

1. Đăng nhập nhân viên; với tài khoản mới, hoàn tất đổi mật khẩu lần đầu.
2. Mở **Đăng ký lịch**, chọn đủ 7 ngày với hỗn hợp Sáng / Trưa / Tối / Nghỉ và một khoảng giờ tùy chọn.
3. Nhấn Lưu một lần, xác nhận trạng thái đang lưu/đã lưu; tải lại và kiểm tra dữ liệu vẫn còn.
4. Sửa lại trước hạn; xác nhận sau hạn hoặc khóa thủ công thì form chỉ đọc và nút Lưu bị khóa.
5. Mở **Lịch của tôi** và **Lịch tổng**; cuộn ngang bảng lịch tổng, kiểm tra cột tên nhân viên vẫn dễ theo dõi.
6. Đăng xuất rồi đăng nhập lại.

Trong toàn bộ luồng, kiểm tra: không tràn ngang trang ngoài bảng Lịch tổng; không nút nào bị cắt hoặc bị bàn phím che; chữ và vùng chạm dễ đọc/bấm; không gửi lưu hai lần; không lỗi console; không có request lặp vô hạn.
