# Tasks

## Task 1: Tambah Helper Functions dan Constants

- [ ] 1.1 Tambahkan constants `DEFAULT_SOCIAL_DESCRIPTION`, `DEFAULT_RULES`, dan `MAX_SOCIAL_BUTTONS` di bagian atas file index.js
- [ ] 1.2 Buat helper function `isValidURL(str)` yang memvalidasi URL dimulai dengan http:// atau https://
- [ ] 1.3 Buat helper function `getSocialButtons(config)` yang mengembalikan array social buttons dari config (dengan fallback ke format lama INSTAGRAM_URL/TIKTOK_URL/YOUTUBE_URL)
- [ ] 1.4 Buat helper function `updateSocialPanel(guild, config)` yang memperbarui pesan Social Panel secara real-time (edit existing message atau buat baru jika tidak ditemukan)

## Task 2: Implementasi Rules Configuration di Setup Wizard

- [ ] 2.1 Tambahkan step `rules_config` di setup wizard flow setelah channel assignment selesai, menampilkan dua tombol: "📝 Custom Rules" dan "📋 Default Rules"
- [ ] 2.2 Tambahkan handler untuk button `setup_rules_custom` yang menampilkan modal dengan TextInput Paragraph untuk input rules
- [ ] 2.3 Tambahkan handler untuk button `setup_rules_default` yang menyimpan CUSTOM_RULES sebagai string kosong dan melanjutkan ke step berikutnya
- [ ] 2.4 Tambahkan handler untuk modal `modal_setup_rules` yang memvalidasi input tidak kosong dan menyimpan teks ke session.customRules
- [ ] 2.5 Integrasikan session.customRules ke dalam `executeAutomaticSetup()` dan `executeManualSetup()` agar CUSTOM_RULES tersimpan di Guild_Config saat deploy

## Task 3: Perluas Config Editor di Admin Panel

- [ ] 3.1 Tambahkan 3 opsi baru pada dropdown `select_edit_config`: "➕ Add Social Media" (add_social), "➖ Remove Social Media" (remove_social), "📝 Edit Social Description" (edit_social_desc)
- [ ] 3.2 Tambahkan handler untuk opsi `add_social`: validasi jumlah buttons < 5, lalu tampilkan modal dengan field "Label" dan "URL"
- [ ] 3.3 Tambahkan handler untuk opsi `remove_social`: tampilkan StringSelectMenu berisi daftar social buttons aktif dari config
- [ ] 3.4 Tambahkan handler untuk opsi `edit_social_desc`: tampilkan modal dengan TextInput Paragraph berisi deskripsi embed saat ini

## Task 4: Implementasi Modal dan Select Handlers untuk Social Media

- [ ] 4.1 Tambahkan handler modal `modal_add_social`: validasi URL, push button baru ke SOCIAL_BUTTONS array, save config, panggil updateSocialPanel()
- [ ] 4.2 Tambahkan handler select `select_remove_social`: hapus button yang dipilih dari SOCIAL_BUTTONS array, save config, panggil updateSocialPanel()
- [ ] 4.3 Tambahkan handler modal `modal_edit_social_desc`: simpan SOCIAL_DESCRIPTION ke config, panggil updateSocialPanel()

## Task 5: Update Existing Social Panel Logic

- [ ] 5.1 Refactor handler `modal_edit_config` untuk menggunakan `updateSocialPanel()` saat URL social media diubah (menggantikan logic inline yang ada)
- [ ] 5.2 Refactor `deployPanels()` untuk menggunakan `getSocialButtons()` dan `DEFAULT_SOCIAL_DESCRIPTION` saat membuat Social Panel baru
- [ ] 5.3 Pastikan backward compatibility: jika SOCIAL_BUTTONS tidak ada di config, gunakan fallback ke INSTAGRAM_URL/TIKTOK_URL/YOUTUBE_URL

## Task 6: Migrasi Otomatis dan Edge Cases

- [ ] 6.1 Implementasi auto-migration: saat admin pertama kali menggunakan Add/Remove Social, konversi format lama ke SOCIAL_BUTTONS array
- [ ] 6.2 Handle edge case: jika MSG_SOCIAL_ID tidak valid (pesan dihapus), buat pesan baru dan update MSG_SOCIAL_ID di config
- [ ] 6.3 Handle edge case: jika SOCIAL_BUTTONS array kosong setelah penghapusan, tampilkan embed tanpa tombol

## Task 7: Testing dan Validasi

- [ ] 7.1 Test setup wizard flow: pilih Custom Rules → input teks → verifikasi tersimpan di config
- [ ] 7.2 Test setup wizard flow: pilih Default Rules → verifikasi CUSTOM_RULES kosong di config
- [ ] 7.3 Test Add Social Media: tambah button baru → verifikasi panel terupdate real-time
- [ ] 7.4 Test Remove Social Media: hapus button → verifikasi panel terupdate real-time
- [ ] 7.5 Test Edit Social Description: ubah deskripsi → verifikasi embed terupdate real-time
- [ ] 7.6 Test backward compatibility: bot dengan config lama (tanpa SOCIAL_BUTTONS) tetap berfungsi normal
- [ ] 7.7 Test validasi: URL invalid ditolak, maks 5 buttons ditolak, input kosong ditolak
