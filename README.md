# 🎮 Chaos Discord Bot

<p align="center">
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/License-Private-red?style=for-the-badge" />
</p>

Bot Discord all-in-one untuk manajemen komunitas clan/gang dengan sistem registrasi member, panel admin, leveling, dan keamanan server otomatis.

---

## ✨ Fitur Utama

### 📋 Panel Member System
- **Input Data** — Member mendaftar dengan Nama Roblox, Panggilan, dan Alamat
- **Change Name** — Ubah nama Roblox (otomatis ubah nickname server)
- **Input Manual** — Staff mendaftarkan member secara manual
- **Search** — Cari data member terdaftar
- **Edit** — Edit nama Roblox member
- **Delete** — Hapus member dari list
- **Title** — Ubah judul list member (contoh: "MARA SALVATRUCHA")
- Validasi wajib nama diakhiri **CHAOS** (huruf kapital)
- Cooldown 1 jam per aksi
- Log otomatis ke channel khusus + file `log_member.txt`

### 🔒 Verification & Role System
- Sistem verifikasi dengan tombol
- Role bertingkat: Verify → Input Data → Member → MAN/WOMAN
- Validasi: tidak bisa ambil gender role tanpa registrasi + role Member
- Request Admin dengan approval system

### 🛡️ Admin Control Panel
- **Moderation**: Mute, Unmute, Warn (auto-mute 3x), Kick, Ban
- **Role Management**: Create Role, Add/Remove Role ke member
- **Configuration**: Edit Rules, Social Media, Welcome Message

### 📊 Server Statistics (Real-time)
- Total Member, Man, Woman, Bot, Online
- Ditampilkan di Voice Channel names (auto-update)

### 🆙 Leveling & XP System
- XP dari chatting (cooldown 60 detik)
- Level Up card dengan gambar custom
- Role rewards di Level 5, 10, 20
- Command `/rank` dan `/leaderboard`

### 🎫 Ticket Support System
- Kategori: Bug Report, General, Partnership, Other
- Claim ticket, transcript otomatis, auto-close

### 🛡️ Auto-Moderation & Security
- Anti-Raid (lockdown otomatis jika 8+ join dalam 10 detik)
- Anti-Spam (5+ pesan dalam 5 detik)
- Anti-Invite (hapus link invite server lain)
- Anti-Phishing (deteksi link scam)
- Bad Word Filter

### 👋 Welcome & Goodbye
- Welcome card dengan avatar (Canvas)
- Goodbye card
- DM welcome message
- AI-generated greeting

### 💡 Suggestion System
- Voting dengan tombol 👍/👎
- Anti-duplicate vote

---

## 🚀 Setup Wizard

Jalankan `/fiicruzh` untuk setup otomatis. Bot akan membuat:

| Kategori | Channel |
|----------|---------|
| 📊 Server Statistics | 5 Voice channels (stats real-time) |
| ︱𝕄𝕒𝕚𝕟︱ | Welcome, Verify, Rules, Social, Role, Chat, Boost, Level-Up, Suggestion |
| 𝕋𝕚𝕔𝕜et-𝕊𝕦𝕡𝕡𝕠𝕣𝕥 | Ticket System |
| ℙ𝕒𝕟𝕖𝕝-𝔸𝕕𝕞𝕚𝕟 | Admin Panel, Log System |
| ℂ𝕝𝕒𝕟-𝕄𝕖𝕞𝕓𝕖𝕣 | Panel Member, List Member, Log Member |

**Mode Setup:**
- 🚀 **Automatic** — Bot buat semua channel & kategori otomatis
- 🔧 **Manual** — Pilih channel yang sudah ada

---

## 📦 Instalasi Lokal

### Prerequisites
- Node.js 18+
- Discord Bot Token
- Supabase Project (gratis)

### 1. Clone Repository
```bash
git clone https://github.com/FiiXhub/Chaos-Discord.git
cd Chaos-Discord
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Konfigurasi Environment
Buat file `.env`:
```env
# Discord Bot
TOKEN=your_discord_bot_token

# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key

# Optional
BACKGROUND_URL=https://your-background-image-url
AI_API=https://api.quotable.io/random
```

### 4. Setup Database Supabase
Jalankan SQL berikut di Supabase SQL Editor:
```sql
CREATE TABLE guild_configs (
  guild_id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE members (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  roblox_name TEXT,
  nickname TEXT,
  address TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, user_id)
);

CREATE TABLE guild_member_settings (
  guild_id TEXT PRIMARY KEY,
  title TEXT DEFAULT 'MEMBER LIST',
  list_message_id TEXT,
  list_channel_id TEXT,
  panel_message_id TEXT,
  panel_channel_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE levels (
  user_id TEXT PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE warns (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT,
  moderator TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_members_guild ON members(guild_id);
CREATE INDEX idx_members_guild_user ON members(guild_id, user_id);
CREATE INDEX idx_warns_guild_user ON warns(guild_id, user_id);
```

### 5. Jalankan Bot
```bash
npm start
```

---

## ☁️ Deploy (Railway)

1. Push ke GitHub
2. Buka [railway.app](https://railway.app) → Login with GitHub
3. New Project → Deploy from GitHub Repo → pilih repo ini
4. Tambah environment variables di tab Variables
5. Done! Bot online 24/7

---

## 🏗️ Arsitektur

```
┌─────────────────────────────────────────────┐
│              Discord Bot (Node.js)           │
├─────────────────────────────────────────────┤
│  In-Memory Cache (instant response)         │
│  ├── guildsCache (guild configs)            │
│  ├── membersCache (member data)             │
│  ├── levelsCache (XP & levels)             │
│  └── warnsCache (warnings)                  │
├─────────────────────────────────────────────┤
│  Persistence Layer                          │
│  ├── Local JSON (fallback/backup)           │
│  └── Supabase PostgreSQL (primary)          │
└─────────────────────────────────────────────┘
```

**Data Flow:**
```
User Action → Update Cache (instant) → Save Local JSON → Async Sync to Supabase
Bot Start → Load Local JSON → Async Load from Supabase (override)
```

---

## 📁 Struktur Project

```
Chaos-Discord/
├── index.js              # Main bot code (single file)
├── package.json          # Dependencies
├── .env                  # Environment variables (not in repo)
├── .gitignore            # Git ignore rules
├── README.md             # This file
└── .kiro/specs/          # Feature specifications (dev docs)
```

---

## 🔐 Role Hierarchy

| Role | Akses |
|------|-------|
| Developer | Full access + approval |
| Owner | Full access + approval |
| Admin | Panel admin + moderation |
| Staff | Panel admin + moderation |
| Guard | View admin panel |
| Member | Input Data, Change Name, ambil gender role |
| Verified | Akses channel utama |
| Unverified | Hanya lihat verification channel |

---

## 📝 Commands

| Command | Deskripsi |
|---------|-----------|
| `/fiicruzh` | Setup wizard (Admin only) |
| `/rank` | Lihat rank & level |
| `/leaderboard` | Top 10 member |

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Discord Library**: discord.js v14
- **Database**: Supabase (PostgreSQL)
- **Image Generation**: node-canvas
- **HTTP Client**: axios

---

## 📄 License

Private — All rights reserved. Unauthorized copying or distribution is prohibited.

---

<p align="center">
  <b>Built with ❤️ by FiiCruzh</b>
</p>
