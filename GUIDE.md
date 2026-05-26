# 📖 Panduan Lengkap Bot Chaos Discord

Dokumen ini menjelaskan secara detail seluruh fungsi dan menu yang tersedia di bot.

---

## 📑 Daftar Isi

1. [Flow Member Baru](#-flow-member-baru)
2. [Slash Commands](#-slash-commands)
3. [Panel Verification](#-panel-verification)
4. [Panel Role (Select Identity)](#-panel-role-select-identity)
5. [Panel Member FII](#-panel-member-fii)
6. [Admin Control Panel](#-admin-control-panel)
7. [Ticket Support System](#-ticket-support-system)
8. [Leveling & XP System](#-leveling--xp-system)
9. [Auto-Moderation](#-auto-moderation)
10. [Server Statistics](#-server-statistics)
11. [Suggestion System](#-suggestion-system)
12. [Setup Wizard](#-setup-wizard)

---

## 🚶 Flow Member Baru

Urutan yang harus dilalui member baru:

```
Join Server
    │
    ▼
┌─────────────────────┐
│ Dapat role Unverified│
│ Hanya lihat #verify │
└─────────┬───────────┘
          │
          ▼ Klik "✅ Verify Me"
┌─────────────────────┐
│ Dapat role Verified  │
│ Bisa lihat channel  │
└─────────┬───────────┘
          │
          ▼ Pergi ke #Panel-Member
┌─────────────────────┐
│ Klik "Input Data"    │
│ Isi: Nama Roblox,   │
│ Panggilan, Alamat    │
└─────────┬───────────┘
          │
          ▼ Pergi ke #Role
┌─────────────────────┐
│ Klik "MEMBER 📋"    │
│ Dapat role Member    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Klik "MAN 💪" atau  │
│ "WOMAN 🌸"          │
│ Dapat role gender    │
│ Bisa chatting!       │
└─────────────────────┘
```

---

## ⌨️ Slash Commands

### `/fiicruzh`
| Item | Detail |
|------|--------|
| Fungsi | Menjalankan Setup Wizard untuk konfigurasi server |
| Akses | Administrator only |
| Output | Wizard interaktif (pilih role, mode, kategori) |

### `/rank`
| Item | Detail |
|------|--------|
| Fungsi | Menampilkan rank, level, dan XP |
| Akses | Semua member |
| Opsi | `user` (opsional) — lihat rank user lain |
| Output | Embed dengan progress bar, rank position, total XP |

### `/leaderboard`
| Item | Detail |
|------|--------|
| Fungsi | Menampilkan top 10 member dengan level tertinggi |
| Akses | Semua member |
| Output | Embed dengan daftar 10 member + posisi kamu |

---

## 🔒 Panel Verification

**Lokasi:** Channel #Verification

### Tombol: ✅ Verify Me
| Item | Detail |
|------|--------|
| Fungsi | Verifikasi member untuk mendapat akses server |
| Akses | Semua member (sekali pakai) |
| Aksi | Hapus role Unverified → Tambah role Verified |
| Response | "✅ Verifikasi Berhasil! Silakan ambil role gender di #Role" |

---

## 🎭 Panel Role (Select Identity)

**Lokasi:** Channel #Role

### Tombol: MEMBER 📋
| Item | Detail |
|------|--------|
| Fungsi | Mengambil role Member |
| Syarat | Harus sudah Input Data di Panel Member |
| Aksi | Tambah role Member |
| Gagal | "❌ Kamu harus Input Data terlebih dahulu" |

### Tombol: MAN 💪
| Item | Detail |
|------|--------|
| Fungsi | Mengambil role Man (laki-laki) |
| Syarat | 1. Sudah Input Data ✅ 2. Sudah punya role Member ✅ |
| Aksi | Tambah role Man, hapus role Woman (jika ada) |
| Gagal | "❌ Kamu harus mengambil role MEMBER terlebih dahulu" |

### Tombol: WOMAN 🌸
| Item | Detail |
|------|--------|
| Fungsi | Mengambil role Woman (perempuan) |
| Syarat | 1. Sudah Input Data ✅ 2. Sudah punya role Member ✅ |
| Aksi | Tambah role Woman, hapus role Man (jika ada) |
| Gagal | "❌ Kamu harus mengambil role MEMBER terlebih dahulu" |

### Tombol: ADMIN 👑
| Item | Detail |
|------|--------|
| Fungsi | Request menjadi Admin |
| Aksi | Kirim request ke Admin Panel, menunggu approval Developer |
| Response | "✅ Permintaan telah dikirim ke Staff" |

### Tombol: MY PROFILE 👤
| Item | Detail |
|------|--------|
| Fungsi | Menampilkan profile card dengan avatar, level, roles |
| Akses | Semua member |
| Output | Gambar profile card (Canvas) |

---

## 📁 Panel Member FII

**Lokasi:** Channel #Panel-Member (kategori Clan Member)

### Row 1 — Tombol Utama

#### 🔵 Input Data
| Item | Detail |
|------|--------|
| Fungsi | Mendaftarkan data member baru |
| Akses | Semua member |
| Cooldown | 1 jam setelah berhasil |
| Modal | Nama Roblox, Nama Panggilan, Alamat |
| Validasi | Nama Roblox wajib diakhiri "CHAOS" (kapital), min 6 char, max 20 char |
| Aksi Sukses | 1. Simpan data 2. Ubah nickname server 3. Update list member 4. Kirim log |
| Response | "✅ Berhasil! Data kamu telah disimpan" |

#### ⚪ Change Name
| Item | Detail |
|------|--------|
| Fungsi | Mengubah nama Roblox yang sudah terdaftar |
| Akses | Semua member (harus sudah terdaftar) |
| Cooldown | 1 jam setelah berhasil |
| Modal | Nama Roblox (baru) |
| Validasi | Sama seperti Input Data |
| Aksi Sukses | 1. Update nama 2. Ubah nickname server 3. Update list member |
| Gagal | "❌ Kamu belum terdaftar! Gunakan Input Data terlebih dahulu" |

#### 🔴 Input Manual
| Item | Detail |
|------|--------|
| Fungsi | Staff mendaftarkan member secara manual |
| Akses | Staff only (Dev, Owner, Admin, Staff, Guard) |
| Flow | 1. Pilih target member (dropdown) 2. Isi modal (Nama Roblox, Panggilan) |
| Aksi Sukses | 1. Simpan data target 2. Ubah nickname target 3. Update list 4. Kirim log |
| Gagal (non-staff) | "❌ Hanya admin!" |

#### 🟢 Search
| Item | Detail |
|------|--------|
| Fungsi | Mencari dan menampilkan data member terdaftar |
| Akses | Staff only |
| Flow | 1. Pilih member (dropdown) 2. Tampil data |
| Output | Embed: Nama Roblox, Panggilan, Alamat, Tanggal Daftar |
| Gagal (tidak terdaftar) | "❌ Member ini belum terdaftar" |
| Gagal (non-staff) | "❌ Hanya admin!" |

#### ⚪ Edit
| Item | Detail |
|------|--------|
| Fungsi | Mengedit nama Roblox member |
| Akses | Staff only |
| Flow | 1. Pilih target (dropdown) 2. Isi nama baru (modal) |
| Aksi Sukses | 1. Update nama 2. Ubah nickname target 3. Update list |
| Gagal (non-staff) | "❌ Hanya admin!" |

### Row 2 — Tombol Admin

#### 🔴 🗑️ Delete
| Item | Detail |
|------|--------|
| Fungsi | Menghapus member dari list |
| Akses | Staff only |
| Flow | 1. Pilih target (dropdown) 2. Hapus data |
| Aksi Sukses | 1. Hapus dari database 2. Update list member |
| Gagal (non-staff) | "❌ Hanya admin!" |

#### ⚪ 📝 Title
| Item | Detail |
|------|--------|
| Fungsi | Mengubah judul list member |
| Akses | Staff only |
| Modal | Judul baru (1-50 karakter) |
| Aksi Sukses | Update judul → Refresh list embed |
| Contoh | "MARA SALVATRUCHA" → `[ ‼️ LIST MEMBER MARA SALVATRUCHA ‼️ ]` |

---

## 🛠️ Admin Control Panel

**Lokasi:** Channel #Panel-Admin (kategori Panel-Admin)

### Row 1 — Moderation

#### Mute
| Item | Detail |
|------|--------|
| Fungsi | Mute member selama 24 jam |
| Modal | User ID, Reason |
| Aksi | Timeout 24 jam + log |

#### Unmute
| Item | Detail |
|------|--------|
| Fungsi | Unmute member |
| Modal | User ID, Reason |
| Aksi | Hapus timeout + log |

#### Warn
| Item | Detail |
|------|--------|
| Fungsi | Memberikan peringatan ke member |
| Modal | User ID, Reason |
| Aksi | Tambah warn + DM member + log |
| Auto-Mute | Jika sudah 3 warnings → auto-mute 24 jam |

#### Kick
| Item | Detail |
|------|--------|
| Fungsi | Kick member dari server |
| Modal | User ID, Reason |
| Aksi | Kick + log |

#### Ban
| Item | Detail |
|------|--------|
| Fungsi | Ban member dari server |
| Modal | User ID, Reason |
| Aksi | Ban permanen + log |

### Row 2 — Management

#### Create Role 🎭
| Item | Detail |
|------|--------|
| Fungsi | Membuat role baru |
| Modal | Role Name, Hex Color, Permissions (admin/mod/none) |
| Aksi | Buat role dengan warna dan permission yang dipilih |

#### Manage Role 👤
| Item | Detail |
|------|--------|
| Fungsi | Tambah/hapus role dari member |
| Flow | 1. Pilih member (dropdown) 2. Pilih role (dropdown) 3. Klik Add/Remove |
| Aksi | Tambah atau hapus role dari member target |

#### Edit Config ⚙️
| Item | Detail |
|------|--------|
| Fungsi | Edit konfigurasi server |
| Opsi | Add Social Media, Remove Social Media, Edit Social Description, Edit Rules, Welcome Message |

---

## 🎫 Ticket Support System

**Lokasi:** Channel #Ticket-System

### Membuka Ticket
| Item | Detail |
|------|--------|
| Trigger | Pilih kategori dari dropdown |
| Kategori | 🐛 Bug Report, 💬 General, 🤝 Partnership, 📝 Other |
| Aksi | Buat channel private (hanya member + staff bisa lihat) |
| Limit | 1 ticket per member |

### Di Dalam Ticket

#### ✋ Claim Ticket
| Item | Detail |
|------|--------|
| Fungsi | Staff mengklaim ticket untuk ditangani |
| Akses | Staff only |

#### 🔒 Close Ticket
| Item | Detail |
|------|--------|
| Fungsi | Menutup ticket |
| Aksi | 1. Konfirmasi 2. Generate transcript 3. Kirim ke log 4. Hapus channel (5 detik) |

---

## 🆙 Leveling & XP System

### Cara Mendapat XP
| Kondisi | Detail |
|---------|--------|
| Channel | Hanya di #Room-Chat |
| XP per pesan | 10-25 (random) |
| Cooldown | 60 detik per pesan |
| Level Up | XP >= `5*(level²) + 50*level + 100` |

### Role Rewards
| Level | Role |
|-------|------|
| 5 | 🥉 Level Five |
| 10 | 🥈 Level Ten |
| 20 | 🥇 Level Twenty |

### Level Up Notification
- Gambar Level Up card (Canvas) dikirim ke #Level-UP
- Mention member yang naik level

---

## 🛡️ Auto-Moderation

### Anti-Raid
| Item | Detail |
|------|--------|
| Trigger | 8+ member join dalam 10 detik |
| Aksi | Lockdown 60 detik — semua member baru otomatis di-kick |
| Log | Notifikasi ke log channel |

### Anti-Spam
| Item | Detail |
|------|--------|
| Trigger | 5+ pesan dalam 5 detik |
| Aksi | Hapus pesan + warning |
| Bypass | Member dengan permission Manage Messages |

### Anti-Invite
| Item | Detail |
|------|--------|
| Trigger | Kirim link invite Discord (discord.gg, dll) |
| Aksi | Hapus pesan + warning + log |
| Bypass | Member dengan permission Manage Messages |

### Anti-Phishing
| Item | Detail |
|------|--------|
| Trigger | Link scam (free-nitro, steam-community, dll) |
| Aksi | Hapus pesan + warning + log |

### Bad Word Filter
| Item | Detail |
|------|--------|
| Trigger | Kata kasar terdeteksi |
| Aksi | Hapus pesan + warning + log |

---

## 📊 Server Statistics

**Lokasi:** Kategori "📊 SERVER STATISTICS" (Voice Channels)

| Channel | Menampilkan |
|---------|-------------|
| ⬩➤┃👥┃Total Member: X | Jumlah total member server |
| ⬩➤┃👦┃Total Man: X | Jumlah member dengan role Man |
| ⬩➤┃👧┃Total Woman: X | Jumlah member dengan role Woman |
| ⬩➤┃🤖┃Total Bot: X | Jumlah bot di server |
| ⬩➤┃🟢┃Total Online: X | Jumlah member online/idle/dnd |

**Update:** Otomatis setiap 10 detik setelah ada perubahan member/presence.

---

## 💡 Suggestion System

**Lokasi:** Channel #Content-Suggestion

### Cara Kerja
1. Member kirim pesan di channel suggestion
2. Bot hapus pesan asli → buat embed suggestion
3. Tombol voting: 👍 (Setuju) dan 👎 (Tolak)
4. Setiap member hanya bisa vote 1x per suggestion

---

## ⚙️ Setup Wizard

### Cara Menjalankan
Ketik `/fiicruzh` di server (butuh permission Administrator)

### Flow Setup

```
/fiicruzh
    │
    ▼
┌─────────────────────────┐
│ Konfigurasi terdeteksi? │
├────────┬────────────────┤
│ Ya     │ Tidak          │
│        │                │
▼        ▼                │
Update   Fresh            │
Setup    Setup            │
│        │                │
└────────┴────────────────┘
    │
    ▼ Pilih 9 Role (satu per satu)
┌─────────────────────────┐
│ Verify, Member, Man,    │
│ Woman, Owner, Staff,    │
│ Guard, Admin, Dev       │
└─────────┬───────────────┘
          │
          ▼ Pilih Mode
┌─────────────────────────┐
│ 🔧 Manual │ 🚀 Automatic│
└─────────┬───────────────┘
          │
          ▼ Pilih Kategori (1-5)
┌─────────────────────────┐
│ ☑ Server Statistics     │
│ ☑ Main                  │
│ ☑ Ticket-Support        │
│ ☑ Panel-Admin           │
│ ☑ Clan Member           │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ Bot membuat channel,    │
│ deploy panel, set       │
│ permissions             │
│                         │
│ ✅ Setup Selesai!       │
└─────────────────────────┘
```

### Kategori yang Dibuat

| Kategori | Channel | Permission |
|----------|---------|------------|
| 📊 Server Statistics | 5 Voice channels | Everyone: deny Connect |
| ︱𝕄𝕒𝕚𝕟︱ | Welcome, Verify, Rules, Social, Role, Chat, Boost, Level-Up, Suggestion | Role-based |
| 𝕋𝕚𝕔𝕜et-𝕊𝕦𝕡𝕡𝕠𝕣𝕥 | Ticket System | Everyone: view |
| ℙ𝕒𝕟𝕖𝕝-𝔸𝕕𝕞𝕚𝕟 | Admin Panel, Log System | Staff only |
| ℂ𝕝𝕒𝕟-𝕄𝕖𝕞𝕓𝕖𝕣 | Panel Member, List Member, Log Member | Verified: view, Staff: full |

---

## 📋 Log System

Semua aksi penting dicatat ke channel log:

| Event | Warna | Detail |
|-------|-------|--------|
| Member Join | 🔵 Blue | User tag, ID, timestamp |
| Member Leave | 🔴 Red | Goodbye card |
| Message Edit | 🟡 Yellow | Before/After content |
| Message Delete | 🔴 Dark Red | Content, author, channel |
| Ghost Ping | 🔴 Red | Deleted mention detected |
| Moderation | 🟤 Dark Red | Target, moderator, reason |
| Admin Request | 🔵 Blue | Requester info |
| Anti-Raid | 🔴 Red | Lockdown notification |
| Anti-Invite | 🔴 Red | User, deleted content |
| Auto-Mod | 🟠 Orange | User, reason, content |
| Member Registration | 🟢 Green | Nama Roblox, Panggilan, Alamat + file |
| Manual Registration | 🟠 Orange | Target, staff, data |
| Setup Complete | 🟢 Green | Mode, categories, by |

---

## ⚠️ Error Messages

| Pesan | Penyebab | Solusi |
|-------|----------|--------|
| "❌ Hanya admin!" | Non-staff klik tombol restricted | Hanya staff yang bisa akses |
| "❌ Kamu harus Input Data terlebih dahulu" | Belum registrasi di Panel Member | Klik Input Data dulu |
| "❌ Kamu harus mengambil role MEMBER terlebih dahulu" | Belum ambil role Member | Klik MEMBER 📋 di panel Role |
| "❌ Kamu belum terdaftar!" | Klik Change Name tanpa registrasi | Klik Input Data dulu |
| "❌ Nama Roblox harus diakhiri dengan CHAOS" | Nama tidak valid | Pastikan nama diakhiri CHAOS (kapital) |
| "❌ Nama Roblox minimal 6 karakter" | Nama terlalu pendek | Minimal 1 huruf + CHAOS = 6 char |
| "❌ Nama Roblox maksimal 20 karakter" | Nama terlalu panjang | Kurangi panjang nama |
| "⏳ Tunggu X menit" | Cooldown aktif | Tunggu 1 jam sejak aksi terakhir |
| "⚠️ Nickname tidak bisa diubah" | Bot tidak punya izin | Naikkan role bot di atas member |
| "⚠️ Slow down!" | Klik tombol terlalu cepat | Tunggu 3 detik |

---

## 🔑 Daftar Role yang Dibutuhkan

| Role | Key Config | Fungsi |
|------|-----------|--------|
| Verify | `VERIFY_ROLE_ID` | Diberikan setelah verifikasi |
| Member | `MEMBER_ROLE_ID` | Diberikan setelah Input Data |
| Man | `MAN_ROLE_ID` | Gender laki-laki |
| Woman | `WOMAN_ROLE_ID` | Gender perempuan |
| Owner | `OWNER_ROLE_ID` | Pemilik server |
| Staff | `STAFF_ROLE_ID` | Moderator |
| Guard | `GUARD_ROLE_ID` | Security |
| Admin | `ADMIN_ROLE_ID` | Administrator |
| Developer | `DEV_ROLE_ID` | Developer bot |
| Unverified | `UNVERIFIED_ROLE_ID` | Auto-assign saat join |
| Level 5 | `LEVEL_5_ROLE_ID` | Reward level 5 |
| Level 10 | `LEVEL_10_ROLE_ID` | Reward level 10 |
| Level 20 | `LEVEL_20_ROLE_ID` | Reward level 20 |

---

<p align="center">
  <b>📖 Panduan ini dibuat untuk Chaos Discord Bot v1.0</b><br>
  <i>Last updated: May 2026</i>
</p>
