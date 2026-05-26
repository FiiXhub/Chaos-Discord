# Tasks: Setup Mode Selection

## Task 1: Refactor Setup Command Foundation

### Description
Refactor slash command `/fiicruzh` dari single-execution menjadi wizard-based flow. Hapus required options dari command registration dan tambahkan session management system.

### Steps
- [ ] 1.1 Ubah registrasi slash command `/fiicruzh` — hapus semua required options (verify_role, man_role, dll) karena input akan dikumpulkan via wizard interaktif
- [ ] 1.2 Tambahkan `setupSessions` Map di bagian atas file untuk tracking session per guild
- [ ] 1.3 Buat struktur session object dengan fields: `guildId`, `userId`, `mode`, `selectedCategories`, `roles`, `channelMappings`, `step`, `startedAt`, `message`
- [ ] 1.4 Buat fungsi `cleanupSession(guildId)` untuk membersihkan session yang expired (timeout 5 menit)
- [ ] 1.5 Tambahkan interval cleanup setiap 60 detik untuk menghapus stale sessions

## Task 2: Existing Config Detection & Update/Fresh Option

### Description
Implementasi deteksi konfigurasi existing dan tampilkan opsi Update Setup atau Fresh Setup sebelum wizard dimulai.

### Steps
- [ ] 2.1 Buat fungsi `detectExistingConfig(guildId)` yang mengembalikan object berisi: `exists`, `channelCount`, `roleCount`, `hasStats`, `hasTicket`, `hasAdmin`
- [ ] 2.2 Di handler slash command, panggil `detectExistingConfig()` — jika config exists, tampilkan embed dengan 2 button: "🔄 Update Setup" dan "🆕 Fresh Setup"
- [ ] 2.3 Jika "Fresh Setup" dipilih, tampilkan konfirmasi "Apakah Anda yakin?" dengan button Confirm/Cancel
- [ ] 2.4 Jika "Fresh Setup" dikonfirmasi, panggil `backupConfig()` sebelum melanjutkan
- [ ] 2.5 Jika config tidak exists atau "Update Setup" dipilih, langsung lanjut ke step Role Input

## Task 3: Role Input Wizard

### Description
Implementasi sequential role input menggunakan RoleSelectMenu untuk mengumpulkan 5 role wajib.

### Steps
- [ ] 3.1 Buat fungsi `setupRoleInput(interaction, session)` yang menampilkan embed dengan instruksi role input
- [ ] 3.2 Implementasi sequential RoleSelectMenu — tampilkan satu role select per step: Verify → Man → Woman → Admin → Dev
- [ ] 3.3 Setelah setiap role dipilih, update embed untuk menampilkan role yang sudah terpilih dan role berikutnya
- [ ] 3.4 Tambahkan validasi duplikat — jika role yang sama dipilih untuk 2 input berbeda, tampilkan warning embed dengan opsi "Lanjutkan" atau "Pilih Ulang"
- [ ] 3.5 Setelah semua 5 role terkumpul, simpan ke session dan lanjut ke Mode Selection
- [ ] 3.6 Buat role tambahan otomatis (Unverified, Level Five, Level Ten, Level Twenty) menggunakan `getOrCreateRole()` pattern yang sudah ada

## Task 4: Mode Selection Interface

### Description
Implementasi tampilan pemilihan mode setup (Manual/Automatic) dengan embed informatif.

### Steps
- [ ] 4.1 Buat fungsi `setupModeSelection(interaction, session)` yang menampilkan embed dengan deskripsi kedua mode
- [ ] 4.2 Tambahkan 2 button: "🔧 Manual Setup" (Primary) dan "🚀 Automatic Setup" (Success)
- [ ] 4.3 Buat collector dengan timeout 60 detik — jika timeout, edit embed menjadi pesan "Setup dibatalkan (timeout)" dan cleanup session
- [ ] 4.4 Handle button click — set `session.mode` dan route ke handler yang sesuai (manual/automatic)

## Task 5: Automatic Setup - Component Selection

### Description
Implementasi seleksi komponen untuk Automatic Mode menggunakan StringSelectMenu multi-select.

### Steps
- [ ] 5.1 Buat fungsi `setupComponentSelect(interaction, session)` yang menampilkan StringSelectMenu dengan 4 kategori
- [ ] 5.2 Definisikan constant `SETUP_CATEGORIES` yang berisi mapping kategori ke channel definitions (nama, tipe, permissions)
- [ ] 5.3 Set semua kategori sebagai `default: true` di select menu options
- [ ] 5.4 Handle selection — simpan `selectedCategories` ke session
- [ ] 5.5 Validasi minimal 1 kategori dipilih — jika kosong, tampilkan error dan minta pilih ulang
- [ ] 5.6 Tampilkan konfirmasi dengan daftar kategori terpilih dan button "✅ Mulai Setup" / "↩️ Pilih Ulang"

## Task 6: Automatic Setup - Execution

### Description
Implementasi eksekusi automatic setup yang membuat channel/kategori berdasarkan komponen yang dipilih.

### Steps
- [ ] 6.1 Buat fungsi `executeAutomaticSetup(interaction, session, guild)` yang menjalankan pembuatan channel berdasarkan `selectedCategories`
- [ ] 6.2 Implementasi progress tracking — buat embed yang di-update setiap kali sebuah channel/role berhasil dibuat
- [ ] 6.3 Gunakan pattern `getOrCreateChannel()` dan `getOrCreateRole()` yang sudah ada untuk setiap komponen
- [ ] 6.4 Implementasi error recovery — jika satu channel gagal dibuat, catat error dan lanjutkan ke channel berikutnya
- [ ] 6.5 Setelah semua channel dibuat, deploy panel (embed + button) ke channel yang sesuai menggunakan logic existing
- [ ] 6.6 Simpan semua ID ke Guild_Config menggunakan `saveGuildConfig()`
- [ ] 6.7 Tampilkan ringkasan akhir dengan daftar komponen berhasil (✅) dan gagal (❌)

## Task 7: Manual Setup - Channel Assignment

### Description
Implementasi Manual Mode di mana Administrator memilih channel existing untuk setiap komponen.

### Steps
- [ ] 7.1 Buat fungsi `setupManualMode(interaction, session)` yang menampilkan daftar kategori sebagai button untuk navigasi
- [ ] 7.2 Untuk setiap kategori yang dipilih, tampilkan `ChannelSelectMenuBuilder` per komponen channel
- [ ] 7.3 Implementasi validasi tipe channel — voice channel untuk Statistics, text channel untuk panel lainnya
- [ ] 7.4 Jika tipe channel tidak sesuai, tampilkan error embed dan minta pilih ulang
- [ ] 7.5 Simpan channel mapping ke session setelah setiap channel dipilih
- [ ] 7.6 Setelah semua channel ter-assign, deploy panel ke channel yang dipilih
- [ ] 7.7 Simpan konfigurasi lengkap ke Guild_Config

## Task 8: Progress Feedback & Logging

### Description
Implementasi sistem progress real-time dan logging untuk seluruh proses setup.

### Steps
- [ ] 8.1 Buat fungsi `updateProgress(interaction, steps, currentStep, status)` yang mengedit embed dengan progress bar visual
- [ ] 8.2 Integrasikan `updateProgress()` ke dalam `executeAutomaticSetup()` dan manual setup flow
- [ ] 8.3 Buat fungsi `createSetupSummary(results, mode)` yang menghasilkan embed ringkasan akhir
- [ ] 8.4 Tambahkan logging ke Log Channel setelah setup selesai — kirim embed berisi: mode yang digunakan, komponen yang di-setup, timestamp, dan user yang menjalankan
- [ ] 8.5 Implementasi partial save — setiap kali sebuah komponen berhasil, langsung simpan ke config (jangan tunggu semua selesai)

## Task 9: Timeout & Error Handling

### Description
Implementasi timeout handling dan error recovery untuk seluruh wizard flow.

### Steps
- [ ] 9.1 Tambahkan timeout 60 detik per step interaction menggunakan collector options `{ time: 60000 }`
- [ ] 9.2 Handle collector 'end' event — jika reason === 'time', edit embed menjadi timeout message dan cleanup session
- [ ] 9.3 Wrap seluruh setup execution dalam try-catch — jika error fatal terjadi, simpan partial progress dan tampilkan error message
- [ ] 9.4 Tambahkan permission check di awal command — jika bot tidak memiliki `ManageChannels` atau `ManageRoles`, tampilkan error sebelum wizard dimulai
- [ ] 9.5 Handle edge case: user menjalankan `/fiicruzh` saat session lain masih aktif — tampilkan pesan "Setup sedang berjalan, tunggu selesai atau tunggu timeout"

## Task 10: Testing & Integration

### Description
Testing menyeluruh dan integrasi dengan sistem existing.

### Steps
- [ ] 10.1 Test Manual Mode end-to-end — jalankan wizard, pilih manual, assign channel, verifikasi panel ter-deploy
- [ ] 10.2 Test Automatic Mode end-to-end — jalankan wizard, pilih auto, select categories, verifikasi channel dibuat dan panel ter-deploy
- [ ] 10.3 Test Update Setup — jalankan setup pada server yang sudah memiliki config, verifikasi channel lama tetap ada
- [ ] 10.4 Test timeout handling — biarkan wizard idle selama 60 detik, verifikasi pesan timeout muncul
- [ ] 10.5 Test error recovery — simulate permission error, verifikasi partial config tersimpan
- [ ] 10.6 Verifikasi backward compatibility — pastikan semua fitur existing (welcome, verify, level, ticket, admin panel) tetap berfungsi setelah refactor
