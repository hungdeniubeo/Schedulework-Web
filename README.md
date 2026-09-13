# ScheduleWork Web

Ứng dụng nội bộ để tối đa 20 nhân viên đăng ký thời gian có thể làm và để quản lý xếp, công bố, xem và xuất lịch làm việc hằng tuần.

ScheduleWork Web là sản phẩm chính dùng React, TypeScript, Vite và Supabase. Dự án desktop tiền nhiệm vẫn được lưu tại [hungdeniubeo/Schedulework](https://github.com/hungdeniubeo/Schedulework) để tham khảo.

## Luồng sử dụng

Nhân viên đăng nhập, đổi mật khẩu tạm ở lần đầu, đăng ký `Sáng / Trưa / Tối / Nghỉ`, xem lịch của mình và lịch tổng đã công bố. Nhân viên không thấy availability của người khác hoặc lịch nháp.

Admin tạo tài khoản nhân viên, nhận mật khẩu tạm một lần, quản lý nhóm/ca, xem availability, kéo-thả xếp lịch, kiểm tra trùng ca, công bố và xuất JPG.

Mỗi tuần mặc định:

```text
Thứ 2: bắt đầu đăng ký
Thứ 2–Thứ 6: nhân viên được chỉnh sửa
Thứ 6 22:00 Asia/Ho_Chi_Minh: tự khóa
Cuối tuần: admin xếp lịch và công bố
```

Deadline thực tế luôn lấy từ `registration_weeks.lock_at` và admin có thể thay đổi.

## Kiến trúc

- Supabase Auth cho `admin` và `employee`; không có public signup.
- PostgreSQL/RLS là nguồn dữ liệu và phân quyền.
- `auth.users.id` tách biệt với domain ID `employees.id`.
- Availability và official schedule là hai loại dữ liệu riêng.
- Edge Function `admin-users` chỉ xử lý thao tác cần Auth Admin API: tạo/reset mật khẩu tạm và đổi mật khẩu đã xác thực.
- Draft schedule chỉ admin thấy; employee chỉ đọc published schedule.

Stack triển khai dự kiến không yêu cầu dịch vụ trả phí: GitHub + Cloudflare Pages + Supabase Free.

## Chạy local

```bash
npm install
copy .env.example .env
npm run dev
```

`.env` chỉ chứa cấu hình public dành cho browser:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Không bao giờ đặt service-role key, database password hoặc JWT secret trong biến `VITE_*`.

## Supabase setup

1. Tạo hoặc link một Supabase project.
2. Apply `supabase/migrations/202609130001_initial.sql` bằng `supabase db push` hoặc SQL Editor.
3. Deploy function:

   ```bash
   supabase functions deploy admin-users
   ```

4. Hosted Edge Functions có sẵn `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` ở server. Không thêm các giá trị này vào frontend.
5. Tắt public signup trong Auth settings.
6. Tạo Auth user admin đầu tiên bằng Supabase Dashboard, sau đó bootstrap profile:

   ```sql
   insert into public.profiles (user_id, role)
   values ('AUTH_USER_UUID', 'admin');
   ```

Sau đó dùng `/admin/employees` để tạo nhân viên. Mật khẩu tạm được sinh bằng Web Crypto, không lưu plaintext trong database và chỉ trả về một lần. Reset password sinh mật khẩu tạm mới và bật lại yêu cầu đổi mật khẩu.

## Cloudflare Pages

Kết nối repository GitHub với Cloudflare Pages:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output: `dist`
- Environment variables: hai biến public `VITE_SUPABASE_*` ở trên

`public/_redirects` cung cấp SPA fallback để refresh trực tiếp `/login`, `/app/*` và `/admin/*` hoạt động trên URL `*.pages.dev`.

## Kiểm tra

```bash
npm test
npm run build
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/_shared/*_test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/admin-users/index.ts
```

Nếu có local Supabase stack, chạy thêm:

```bash
supabase test db
```
