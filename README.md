## WhatsApp API Gateway (Baileys + Next.js)

Proyek ini adalah sistem WhatsApp Gateway multi-user berbasis _Node.js_ (Next.js) dan pustaka _Baileys_. Aplikasi ini memungkinkan pengguna (User) untuk masuk, menghubungkan perangkat WhatsApp mereka melalui pemindaian QR Code, serta menyediakan fitur _Cron Job_ cerdas di belakang layar untuk memproses antrean pesan (Anti-Spam).

## 🚀 Panduan Deployment ke VPS (menggunakan PM2)

Berikut adalah langkah-langkah lengkap untuk meng-hosting dan menjalankan aplikasi ini secara terus-menerus di VPS (Ubuntu/Debian) Anda.

### 1\. Persiapan Kebutuhan (Prerequisites)

Pastikan VPS Anda sudah terpasang perangkat lunak berikut:

*   **Node.js** (Versi 18 atau 20 direkomendasikan)
*   **npm** (Node Package Manager)
*   **Git**

Jika Anda belum menginstal **PM2** (Process Manager), instal terlebih dahulu secara global:

```plaintext
sudo npm install -g pm2
```

### 2\. Pindahkan atau Clone Proyek ke VPS

Anda bisa mengunggah folder proyek ini ke VPS menggunakan Git, FileZilla (SFTP), atau `scp`.  
Misalnya, letakkan proyek di folder `/var/www/wa`.

Masuk ke dalam direktori proyek:

```plaintext
cd /var/www/wa
```

### 3\. Instalasi Dependensi

Instal semua pustaka _Node.js_ yang dibutuhkan oleh aplikasi:

```plaintext
npm install
```

### 4\. Konfigurasi Environment (Lingkungan)

Salin atau buat file `.env` di dalam folder proyek Anda:

```plaintext
nano .env
```

Isi dengan variabel lingkungan Anda (sesuaikan rahasianya):

```plaintext
DATABASE_URL="file:./dev.db"
JWT_SECRET="ganti_dengan_kunci_rahasia_anda_yang_sangat_panjang"
PORT=3000
NODE_ENV="production"
```

_(Simpan dan keluar, misalnya di nano tekan_ `_Ctrl+X_` _lalu_ `_Y_` _dan_ `_Enter_`_)_

### 5\. Inisialisasi Database (Prisma)

Karena menggunakan Prisma dengan SQLite, Anda perlu mem-push skema ke database dan membuat tabel-tabelnya:

```plaintext
npx prisma db push
```

_(Catatan: Jika Anda menggunakan VPS Linux, Prisma akan otomatis membuatkan file_ `_dev.db_` _di folder_ `_prisma/_`_)_

### 6\. Build Frontend Next.js

Karena ini adalah lingkungan Production, Anda harus mem-_build_ file antarmuka Next.js agar dapat dimuat dengan sangat cepat:

```plaintext
npm run build
```

### 7\. Jalankan Aplikasi dengan PM2

Agar aplikasi dapat berjalan di latar belakang (dan otomatis menyala ulang jika server VPS direstart), gunakan perintah PM2 untuk menjalankan `server.js`:

```plaintext
pm2 start server.js --name "wa"
```

Jika sukses, aplikasi Anda akan berjalan di port `3000` (atau sesuai konfigurasi di `.env`).

### 8\. Simpan Konfigurasi PM2

Jalankan dua perintah berikut agar _wa_ otomatis berjalan (Auto-Start) setiap kali VPS di-reboot:

```plaintext
pm2 startup
# (Jalankan perintah yang dihasilkan oleh pm2 startup tersebut di terminal Anda)

pm2 save


# Perintah Gabung 
git pull && pm2 stop wa && rm -rf .next && npm run build && pm2 start wa
```

### 9\. Perintah PM2 yang Berguna

Untuk mengelola aplikasi, Anda dapat menggunakan perintah berikut:

*   **Melihat status aplikasi:** `pm2 status`
*   **Melihat log (pesan error/cron job):** `pm2 logs wa`
*   **Merestart aplikasi:** `pm2 restart wa`
*   **Mematikan aplikasi:** `pm2 stop wa`

## 🔒 Konfigurasi Tambahan: Nginx Reverse Proxy (Opsional tapi Direkomendasikan)

Jika Anda memiliki domain (misal: `api.domainanda.com`), sangat disarankan memasang **Nginx** sebagai _reverse proxy_ dan menggunakan SSL (Let's Encrypt).

Contoh konfigurasi Nginx (`/etc/nginx/sites-available/wa`):

```plaintext
server {
    listen 80;
    server_name api.domainanda.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Selamat! WhatsApp API Gateway Anda sudah sepenuhnya berjalan di awan (VPS).