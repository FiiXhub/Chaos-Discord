# Requirements Document

## Introduction

Fitur Setup Mode Selection memberikan fleksibilitas kepada administrator server Discord untuk memilih metode setup bot FiiCruzh Ecosystem. Administrator dapat memilih antara **Manual Setup** (memilih channel penempatan secara manual) atau **Automatic Setup** (bot membuat channel/kategori secara otomatis). Pada mode otomatis, administrator juga dapat memilih kategori dan channel mana saja yang ingin di-setup, memberikan kontrol granular terhadap proses konfigurasi.

## Glossary

- **Bot**: Bot Discord FiiCruzh yang menjalankan sistem setup ecosystem
- **Administrator**: User Discord yang memiliki permission `ADMINISTRATOR` di server
- **Setup_Wizard**: Sistem interaktif yang memandu Administrator melalui proses setup
- **Manual_Mode**: Mode setup di mana Administrator memilih channel yang sudah ada untuk penempatan panel bot
- **Automatic_Mode**: Mode setup di mana Bot membuat channel dan kategori secara otomatis
- **Setup_Category**: Grup channel yang dapat dipilih untuk di-setup (contoh: Server Statistics, Main, Ticket-Support, Panel-Admin)
- **Setup_Component**: Channel individual dalam sebuah Setup_Category yang dapat dipilih atau di-deselect
- **Selection_Menu**: Antarmuka interaktif (Select Menu/Button) yang digunakan untuk memilih opsi setup
- **Guild_Config**: File konfigurasi JSON yang menyimpan ID channel dan role untuk setiap server

## Requirements

### Requirement 1: Inisiasi Setup Mode Selection

**User Story:** Sebagai Administrator, saya ingin memilih mode setup saat menjalankan command setup, sehingga saya dapat mengontrol bagaimana bot dikonfigurasi di server saya.

#### Acceptance Criteria

1. WHEN Administrator menjalankan slash command `/fiicruzh`, THE Setup_Wizard SHALL menampilkan embed interaktif dengan dua pilihan mode: "Manual Setup" dan "Automatic Setup"
2. THE Setup_Wizard SHALL menampilkan deskripsi singkat untuk setiap mode setup agar Administrator memahami perbedaannya
3. WHEN Administrator tidak memilih mode dalam waktu 60 detik, THE Setup_Wizard SHALL membatalkan proses setup dan menampilkan pesan timeout
4. IF Administrator tidak memiliki permission `ADMINISTRATOR`, THEN THE Setup_Wizard SHALL menolak akses dan menampilkan pesan error

### Requirement 2: Manual Setup Mode

**User Story:** Sebagai Administrator, saya ingin memilih channel yang sudah ada di server untuk penempatan panel bot, sehingga saya dapat menggunakan struktur server yang sudah ada tanpa membuat channel baru.

#### Acceptance Criteria

1. WHEN Administrator memilih "Manual Setup", THE Setup_Wizard SHALL menampilkan daftar kategori setup yang tersedia untuk dikonfigurasi
2. WHEN Administrator memilih sebuah Setup_Category, THE Setup_Wizard SHALL menampilkan Channel Select Menu untuk setiap Setup_Component dalam kategori tersebut
3. THE Setup_Wizard SHALL memvalidasi bahwa channel yang dipilih memiliki tipe yang sesuai (text channel untuk panel, voice channel untuk statistik)
4. IF Administrator memilih channel yang tidak sesuai tipe, THEN THE Setup_Wizard SHALL menampilkan pesan error dan meminta pemilihan ulang
5. WHEN Administrator telah menyelesaikan pemilihan semua channel yang diperlukan, THE Setup_Wizard SHALL menyimpan konfigurasi ke Guild_Config
6. WHEN konfigurasi tersimpan, THE Setup_Wizard SHALL melakukan deploy panel (embed + button) ke channel yang telah dipilih

### Requirement 3: Automatic Setup Mode

**User Story:** Sebagai Administrator, saya ingin bot membuat channel dan kategori secara otomatis, sehingga proses setup menjadi cepat dan tidak perlu konfigurasi manual.

#### Acceptance Criteria

1. WHEN Administrator memilih "Automatic Setup", THE Setup_Wizard SHALL menampilkan daftar Setup_Category yang tersedia dengan checkbox untuk seleksi
2. THE Setup_Wizard SHALL menandai semua Setup_Category sebagai terpilih secara default
3. WHEN Administrator mengonfirmasi pilihan kategori, THE Bot SHALL membuat kategori dan channel sesuai dengan Setup_Category yang dipilih
4. THE Bot SHALL mengatur permission overwrites yang sesuai untuk setiap channel yang dibuat secara otomatis
5. WHEN semua channel berhasil dibuat, THE Bot SHALL melakukan deploy panel (embed + button) ke channel yang telah dibuat
6. WHEN proses automatic setup selesai, THE Setup_Wizard SHALL menyimpan seluruh ID channel dan kategori ke Guild_Config
7. IF terjadi error saat pembuatan channel, THEN THE Bot SHALL melaporkan channel mana yang gagal dibuat dan melanjutkan proses untuk channel lainnya

### Requirement 4: Seleksi Komponen Setup

**User Story:** Sebagai Administrator, saya ingin memilih komponen spesifik yang ingin di-setup pada mode otomatis, sehingga saya hanya menginstal fitur yang dibutuhkan server saya.

#### Acceptance Criteria

1. THE Setup_Wizard SHALL menyediakan opsi seleksi untuk setiap Setup_Category berikut: Server Statistics, Main, Ticket-Support, dan Panel-Admin
2. WHEN Administrator memilih Setup_Category "Server Statistics", THE Bot SHALL membuat voice channel untuk: Total Member, Total Man, Total Woman, Total Bot, dan Total Online
3. WHEN Administrator memilih Setup_Category "Main", THE Bot SHALL membuat text channel untuk: Welcome-GoodBye, Verification, Rules, SocialMedia, Role, Room-Chat, Boost-Server, Level-UP, dan Content-Suggestion
4. WHEN Administrator memilih Setup_Category "Ticket-Support", THE Bot SHALL membuat text channel Ticket-System dalam kategori tersebut
5. WHEN Administrator memilih Setup_Category "Panel-Admin", THE Bot SHALL membuat text channel Panel-Admin dan Log-System dalam kategori tersebut
6. THE Setup_Wizard SHALL memperbolehkan Administrator untuk men-deselect Setup_Category yang tidak diinginkan sebelum konfirmasi
7. IF tidak ada Setup_Category yang dipilih, THEN THE Setup_Wizard SHALL menampilkan pesan bahwa minimal satu kategori harus dipilih

### Requirement 5: Input Role pada Setup

**User Story:** Sebagai Administrator, saya ingin memasukkan role yang diperlukan sebelum proses setup dimulai, sehingga bot dapat mengatur permission channel dengan benar.

#### Acceptance Criteria

1. WHEN Administrator telah memilih mode setup, THE Setup_Wizard SHALL meminta input untuk lima role wajib: Verify Role, Man Role, Woman Role, Admin Role, dan Dev Role
2. THE Setup_Wizard SHALL menyediakan Role Select Menu untuk setiap input role yang diperlukan
3. IF Administrator memilih role yang sama untuk dua input berbeda, THEN THE Setup_Wizard SHALL menampilkan peringatan konfirmasi
4. WHEN semua role telah dipilih, THE Setup_Wizard SHALL melanjutkan ke proses setup sesuai mode yang dipilih
5. THE Bot SHALL membuat role tambahan (Unverified, Level Five, Level Ten, Level Twenty) secara otomatis pada kedua mode setup

### Requirement 6: Progress Feedback dan Logging

**User Story:** Sebagai Administrator, saya ingin melihat progress setup secara real-time, sehingga saya mengetahui status proses yang sedang berjalan.

#### Acceptance Criteria

1. WHILE proses setup sedang berjalan, THE Setup_Wizard SHALL memperbarui pesan embed dengan status terkini untuk setiap langkah yang diselesaikan
2. THE Setup_Wizard SHALL menampilkan indikator visual (emoji checkmark/cross) untuk setiap komponen yang berhasil atau gagal di-setup
3. WHEN seluruh proses setup selesai, THE Setup_Wizard SHALL menampilkan ringkasan lengkap berisi daftar channel dan role yang telah dikonfigurasi
4. THE Bot SHALL mencatat aktivitas setup ke Log Channel setelah proses selesai
5. IF proses setup gagal di tengah jalan, THEN THE Bot SHALL menyimpan progress yang sudah berhasil dan menginformasikan komponen yang gagal

### Requirement 7: Kompatibilitas dengan Setup Existing

**User Story:** Sebagai Administrator, saya ingin menjalankan setup ulang tanpa kehilangan konfigurasi yang sudah ada, sehingga saya dapat menambah atau memperbarui komponen tanpa memulai dari awal.

#### Acceptance Criteria

1. WHEN server sudah memiliki Guild_Config sebelumnya, THE Setup_Wizard SHALL mendeteksi konfigurasi existing dan menampilkan opsi "Update Setup" atau "Fresh Setup"
2. WHEN Administrator memilih "Update Setup", THE Bot SHALL mempertahankan channel dan role yang sudah ada dan hanya menambah komponen baru
3. WHEN Administrator memilih "Fresh Setup", THE Setup_Wizard SHALL meminta konfirmasi sebelum menimpa konfigurasi lama
4. THE Bot SHALL melakukan backup Guild_Config sebelum menjalankan proses setup baru
