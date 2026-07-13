# Daftar Template Chat & Pesan Bot Telegram

Dokumen ini berisi daftar seluruh template pesan, petunjuk chat, notifikasi, dan respon interaktif yang digunakan di dalam sistem Bot Telegram "TopUpGames".

---

## 1. Template Chat Utama Pelanggan

### A. Selamat Datang (Welcome Message)
*   **Nama Variabel**: `customerStartTemplate`
*   **Isi Teks**:
    ```text
    🎮 Selamat datang di TopUpGames!

    Saya adalah bot customer service. Saya akan menghubungkan Anda dengan tim CS kami.

    📌 Pilih menu di bawah:
    ├── 💬 Hubungi CS → Kirim pesan ke admin
    ├── 📦 Cek Status Transaksi → Masukkan Transaction ID
    ├── ❓ FAQ → Pertanyaan umum
    └── 🔙 Kembali ke Website → topupgames.com

    ⚠️ Jam operasional CS: 09:00 - 22:00 WIB
    Respon tercepat di jam operasional.

    Ticket aktif Anda: {ticketId}
    ```

### B. CS Offline
*   **Nama Variabel**: `csOfflineTemplate`
*   **Isi Teks**:
    ```text
    ⏰ Maaf, tim CS kami sedang off.

    Tetapi Anda tetap bisa:
    1. Kirim pesan sekarang → akan dibalas besok pagi
    2. Cek FAQ di website: topupgames.com/faq
    3. Cek status transaksi: topupgames.com/status

    Terima kasih! 🙏
    ```

### C. Petunjuk Cara Hubungi CS
*   **Nama Variabel**: `buildCustomerPromptTemplate`
*   **Isi Teks**:
    ```text
    Format chat yang disarankan:
    1. Nama lengkap
    2. Nomor order / email
    3. Detail keluhan atau pertanyaan

    Contoh:
    Nama: Joni
    Order: #1234
    Masalah: Top up belum masuk
    ```

### D. FAQ (Frequently Asked Questions)
*   **Nama Variabel**: `faqTemplate`
*   **Isi Teks**:
    ```text
    ❓ FAQ TopUpGames

    1. Top up belum masuk? Cek transaction ID Anda.
    2. Apakah refund bisa? Ya, CS akan menghubungi Anda jika perlu.
    3. Kunjungi website: topupgames.com/faq
    ```

---

## 2. Template Alur Komunikasi Tiket CS

### A. Tiket Masuk ke Grup Admin (Terusan Pesan Customer)
*   **Nama Variabel**: `userToAdminTemplate`
*   **Isi Teks**:
    ```text
    📩 PESAN DARI USER

    👤 Nama: {userName}
    🆔 User ID: {userId}
    📱 Platform: Website / Telegram
    📝 Pesan:
    "{message}"

    📎 Informasi tambahan:
    - WIB: saat ini
    - User aktif: ✅
    - Total transaksi user: 12

    📌 Ticket: {ticketId}
    📌 [Balas pesan ini untuk membalas user]
    ```

### B. Balasan CS ke Customer
*   **Nama Variabel**: `customerReplyTemplate`
*   **Isi Teks**:
    ```text
    📩 BALASAN DARI CS

    Halo Kak {name}! 👋

    {replyText}

    ---

    💬 Balas pesan ini untuk membalas CS kembali.

    Ticket: {ticketId}
    ```

### C. Pemuatan & Perubahan Status Tiket
*   **Tiket Berhasil Diambil CS (ke CS)**:
    `🙋‍♂️ Anda telah mengambil tiket *#{ticketId}* milik customer *{customerName}*.\nKetik pesan di sini untuk membalas mereka secara langsung.`
*   **Tiket Berhasil Diambil CS (ke Customer)**:
    `🙋‍♂️ Tiket Anda #{ticketId} telah diambil oleh CS *${csName}*.\nPercakapan Anda selanjutnya dialihkan ke CS secara langsung!`
*   **Tiket Selesai (ke Customer & Form Rating)**:
    `✅ Pesan dari CS: Tiket bantuan Anda #{ticketId} telah diselesaikan.\n\nSeberapa puas Anda dengan pelayanan kami?` *(diikuti tombol bintang 1-5)*
*   **Respons Setelah Memberi Rating**:
    `{originalText}\n\n🙏 Terima kasih! Anda memberikan penilaian {rating} Bintang.`

---

## 3. Template Alur Transaksi & Pembayaran

### A. Panduan Cek Status Transaksi
*   **Nama Variabel**: `transactionStatusTemplate`
*   **Isi Teks**:
    ```text
    📦 Cek Status Transaksi

    Silakan masukkan Transaction ID Anda.
    Contoh: TRX-987

    Atau kirimkan ID Game Anda, kami akan cari di sistem.
    ```

### B. Detail Riwayat Transaksi
*   **Nama Variabel**: `transactionDetailsTemplate`
*   **Isi Teks**:
    ```text
    📦 DETAIL TRANSAKSI

    🆔 ID Transaksi: {trx.trxId}
    🎮 Game: {trx.game.name}
    📦 Produk: {trx.product.name}
    👤 ID Game User: {trx.userGameId}
    💰 Nominal: Rp {amountFormatted}
    🚦 Status: {STATUS}
    📅 Waktu: {dateFormatted}
    ```

### C. Notifikasi Perubahan Status Transaksi (Direct Message Customer)
*   **Transaksi Sukses**:
    ```text
    🔔 *UPDATE TRANSAKSI*

    Halo Kak {customerName}! 👋
    Transaksi Anda dengan ID *{trxId}* telah *BERHASIL* diproses!

    🎮 *Game*: {gameName}
    📦 *Produk*: {productName}
    💰 *Nominal*: Rp {amountFormatted}
    🚦 *Status*: SUKSES

    Terima kasih sudah berbelanja di TopUpGames! 🙏
    ```
*   **Transaksi Gagal**:
    ```text
    🔔 *UPDATE TRANSAKSI*

    Halo Kak {customerName}!
    Transaksi Anda dengan ID *{trxId}* *GAGAL* diproses.

    🎮 *Game*: {gameName}
    📦 *Produk*: {productName}
    🚦 *Status*: GAGAL

    Silakan hubungi Customer Service kami untuk info lebih lanjut.
    ```

### D. Pesanan Transaksi Baru ke Grup Admin (Dari Web / Telegram)
*   **Isi Teks**:
    ```text
    💸 *PESANAN TRANSAKSI BARU* (atau *VIA TELEGRAM*)

    🆔 ID: {trxId}
    🎮 Game: {gameName}
    📦 Produk: {productName}
    👤 ID Game User: {userGameId}
    💰 Nominal: Rp {amountFormatted}
    🚦 Status: PENDING

    Silakan proses pesanan ini:
    ```
    *(dilengkapi tombol inline [✅ Proses (Sukses)] dan [❌ Tolak (Gagal)])*

---

## 4. Pesan Menu & Command Bot

### A. Menu Admin (`/admin`)
*   `Halo Admin 👋\nSilakan pilih menu.` *(dilengkapi tombol inline dashboard, semua tiket, dll)*
*   **Statistik Dashboard Admin**:
    ```text
    📊 *DASHBOARD STATISTIK HARI INI*

    📈 *Transaksi Sukses*: {totalTrxCount} order
    💰 *Pendapatan*: Rp {totalRevenueFormatted}

    🎫 *Tiket Aktif*: {openTicketsCount} tiket
    ⭐ *Rata-rata Performa CS*: {avgCsRating} Bintang

    _Data diperbarui secara real-time_
    ```

### B. Menu CS (`/cs`)
*   `Halo CS 👋\nSilakan pilih tugas.` *(dilengkapi tombol inline tiket terbuka, tiket saya)*

### C. Command Help (`/help`)
*   `Perintah yang tersedia:\n/start - mulai chat\n/help - bantuan\n/status - cek status tiket Anda\n/menu - tampilkan template menu\n/admin - masuk ke menu admin\n/cs - masuk ke menu CS`

---

## 5. Respon Sistem, Validasi, dan Pesan Error

Berikut adalah daftar teks respons pendek, pesan validasi, dan peringatan *error* yang di-trigger oleh aksi tertentu di dalam bot:

### A. Sisi Pelanggan (Customer Side Validation)
*   **Pesan Kosong**: `Pesan Anda kosong.`
*   **Transaksi Tidak Ditemukan (Cek Status)**:
    `🔍 Transaksi dengan ID "{text}" tidak ditemukan.\nSilakan periksa kembali ID Transaksi Anda atau hubungi CS jika Anda butuh bantuan.`
*   **Tiket Aktif Kosong**: `Anda belum memiliki tiket aktif.`
*   **Game Kosong Saat Order**: `Maaf, saat ini belum ada game yang tersedia.`
*   **Game Tidak Ditemukan**: `Game tidak ditemukan.` *(Callback Alert)*
*   **Sesi Order Kedaluwarsa/Tidak Valid**: `Sesi pemesanan Anda tidak valid, silakan ulangi pesanan dari awal.` *(Callback Alert)*
*   **Produk Tidak Ditemukan**: `Produk tidak ditemukan.` *(Callback Alert)*
*   **Game Belum Memiliki Produk**: `Maaf, belum ada produk untuk game ini.`
*   **Status Kosong pada Tiket Sendiri**: `Belum ada tiket aktif untuk akun Anda.`

### B. Sisi Customer Service (CS Side Validation)
*   **Peringatan Belum Memilih Tiket saat Mengirim Chat**:
    `Anda belum memilih tiket. Pilih tiket dari daftar terbuka terlebih dahulu.`
*   **Gagal Meneruskan Chat ke Pelanggan**:
    *   `Gagal mengirim: User tidak ditemukan.`
    *   `Gagal mengirim: User tidak terhubung.`
*   **Mengonfirmasi Balasan Terkirim**:
    `✅ Balasan berhasil dikirim ke customer.`
*   **Tiket Terbuka Kosong**: `Belum ada tiket yang tersedia.`
*   **Pilihan Ambil Tiket Kosong**: `Tidak ada tiket yang bisa diambil.`
*   **Notifikasi Sukses Ambil Tiket**:
    `Tiket {ticketId} berhasil diambil oleh Anda.\nSilakan balas tiket tersebut.`

### C. Sisi Admin (Admin Side Validation)
*   **Peringatan Belum Memilih Tiket saat Mengirim Chat**:
    `Anda belum memilih tiket. Gunakan menu admin untuk melihat daftar tiket.`
*   **Mengonfirmasi Pesan Admin Masuk ke Tiket**:
    `Pesan admin masuk ke tiket {ticketId}.`
*   **Mengonfirmasi Balasan Terkirim dari Grup Admin**:
    `✅ Balasan berhasil dikirim ke user.`
*   **Ekspor CSV Kosong**: `Belum ada transaksi di database untuk diekspor.`
*   **Ekspor CSV Gagal**: `Gagal mengekspor file CSV. Silakan periksa log server.`

### D. Notifikasi Alert Tombol (Callback Query Answer Alert)
*   `Format cek status ditampilkan`
*   `Template chat customer ditampilkan`
*   `FAQ ditampilkan`
*   `Website ditampilkan`
*   `Menampilkan tiket Anda`
*   `Daftar tiket terbuka ditampilkan`
*   `Daftar tiket Anda ditampilkan`
*   `Tiket berhasil diambil`
*   `Menampilkan semua tiket`
*   `Menampilkan tiket urgent`
*   `Dashboard admin ditampilkan`
*   `Tiket tidak ditemukan.`
*   `Tiket ini sudah ditutup.`
*   `Tiket ini sudah diambil CS lain.`
*   `Tiket ini sudah ditutup sebelumnya.`
*   `Transaksi tidak ditemukan.`
*   `Transaksi ini sudah diproses ({status}).`
*   `Transaksi berhasil diproses ({status}).`
*   `File CSV berhasil dikirim.`
*   `Terima kasih atas penilaian Anda!`
*   `Perintah tidak dikenali`

