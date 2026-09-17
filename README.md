# Olympia Realtime — Vercel + Supabase

Bộ source gồm bốn loại màn hình:

- `/admin`: điều khiển chương trình, đồng hồ, chấm điểm và chọn câu hỏi.
- `/trinh-chieu`: màn hình trình chiếu đồng bộ, không có nút admin.
- `/nhom/1`, `/nhom/2`, `/nhom/3`: trang của ba nhóm để nhập đáp án Vượt Chướng Ngại Vật/Tăng Tốc và bấm chuông Về Đích.
- `/`: trang chọn nhanh các màn hình.

Hai khung câu hỏi Tăng Tốc và Về Đích đã được dựng bằng CSS, không còn phụ thuộc kích thước ảnh nền. Khi nhóm chính trả lời sai ở Về Đích, hệ thống mở 5 giây cho hai nhóm còn lại bấm chuông; bản ghi đầu tiên trong database thắng quyền trả lời.

## 1. Tạo database Supabase

1. Tạo project tại [Supabase](https://supabase.com/dashboard).
2. Mở **SQL Editor**.
3. Sao chép toàn bộ nội dung `supabase/schema.sql` và bấm **Run**.
4. Vào **Project Settings → API** và lấy:
   - Project URL.
   - Publishable key hoặc anon key.
   - Secret service-role key.

Schema bật Row Level Security và chỉ cho trình duyệt đọc trạng thái realtime. Mọi thao tác ghi đều đi qua Vercel Functions bằng service-role key. Không đưa service-role key vào thư mục `public` hoặc JavaScript phía trình duyệt. Tham khảo [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) và [Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## 2. Khai báo biến môi trường

Tạo `.env.local` khi chạy trên máy, dựa theo `.env.example`:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_SERVICE_ROLE_KEY
OLYMPIA_GAME_ID=main
ADMIN_PASSWORD=mat-khau-admin-rat-kho-doan
TEAM_1_PIN=1111
TEAM_2_PIN=2222
TEAM_3_PIN=3333
```

`OLYMPIA_GAME_ID` phải trùng với dòng được tạo trong `game_state`. Mặc định schema dùng `main`.

## 3. Chạy thử trên máy

Yêu cầu Node.js và Vercel CLI:

```bash
npm install
npm install -g vercel
vercel link
vercel dev
```

Mở URL mà Vercel CLI hiển thị, sau đó kiểm tra `/admin`, `/trinh-chieu` và ba URL `/nhom/1` đến `/nhom/3`.

## 4. Đưa source lên Vercel

### Cách A — qua GitHub

1. Giải nén source và đẩy toàn bộ thư mục lên một repository GitHub.
2. Trong Vercel, chọn **Add New → Project → Import Git Repository**.
3. Framework Preset chọn **Other**. `vercel.json` đã đặt Output Directory là `public`.
4. Trong **Settings → Environment Variables**, nhập đủ 8 biến trong `.env.example` cho Production, Preview và Development.
5. Bấm **Deploy**.

### Cách B — dùng Vercel CLI

```bash
vercel
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OLYMPIA_GAME_ID
vercel env add ADMIN_PASSWORD
vercel env add TEAM_1_PIN
vercel env add TEAM_2_PIN
vercel env add TEAM_3_PIN
vercel --prod
```

Vercel tự nhận các file trong thư mục `api` là Node.js Functions và cài dependencies từ `package.json`. Xem thêm [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [cấu hình build/output directory](https://vercel.com/docs/builds/configure-a-build) và [triển khai Vercel](https://vercel.com/docs/deployments).

## 5. Cách vận hành

1. Máy điều khiển mở `/admin`, nhập `ADMIN_PASSWORD`.
   Dùng nút biểu tượng bút ở thanh điều khiển để mở **Câu hỏi & đáp án**. Chọn phần thi, nhóm và số câu, sau đó bấm **Lưu & đồng bộ**. Nội dung được lưu trong trạng thái chương trình và cập nhật sang màn hình trình chiếu.
2. Máy chiếu mở `/trinh-chieu` và bật toàn màn hình.
   Nhấn **Bật trình chiếu** một lần trước khi bắt đầu để trình duyệt cho phép phát video và âm thanh. Realtime là kênh đồng bộ chính; hệ thống còn kiểm tra dự phòng mỗi 700 ms nếu kết nối WebSocket bị gián đoạn.
3. Ba máy đội thi mở `/nhom/1`, `/nhom/2`, `/nhom/3`, nhập PIN tương ứng.
   PIN được kiểm tra ngay khi bấm **Vào phòng**. Nếu trang báo chưa cấu hình PIN, hãy kiểm tra ba biến `TEAM_1_PIN`, `TEAM_2_PIN`, `TEAM_3_PIN` trên Vercel và Redeploy.
4. Khi admin chọn câu Vượt Chướng Ngại Vật hoặc bắt đầu câu Tăng Tốc, trang đội thi tự hiện ô nhập đáp án.
5. Đáp án và thời gian gửi hiện realtime trên trang admin/trình chiếu khi chuyển sang màn hình đáp án.
   Nhóm chưa gửi đáp án sẽ để trống; hệ thống không còn hiển thị nội dung mẫu trong ô kết quả.
6. Ở Về Đích, nếu nhóm chính trả lời sai, hai nhóm còn lại thấy nút **BẤM CHUÔNG** trong 5 giây. Database chỉ chấp nhận lượt bấm đầu tiên.

## 6. Dữ liệu và bảo mật

- `game_state`: trạng thái slide, điểm, đồng hồ và tiến trình phần thi.
- `team_answers`: đáp án Vượt Chướng Ngại Vật/Tăng Tốc và thời gian phản hồi.
- `buzzes`: lượt bấm chuông Về Đích; unique constraint bảo đảm chỉ một nhóm thắng mỗi câu.
- Publishable/anon key có thể xuất hiện phía trình duyệt vì RLS giới hạn quyền. Service-role key chỉ nằm trong biến môi trường của Vercel.
- Nên đổi toàn bộ mật khẩu/PIN trước chương trình và không chia sẻ URL `/admin` công khai.

## 7. Chỉnh câu hỏi và đồ họa

- Nội dung câu hỏi mẫu nằm trong `public/app.js` ở các mảng `privateQuestions`, `commonQuestions`, `obstacleQuestions`, `speedQuestions` và hàm `finishQuestionText`.
- Video nằm trong `public/media`.
- Hình nền và đồ họa nằm trong `public/assets`.
- Màu sắc, kích thước khung nằm trong `public/styles.css`.

Sau khi sửa source và push lên nhánh production, Vercel sẽ tự triển khai lại nếu project đã nối Git.
