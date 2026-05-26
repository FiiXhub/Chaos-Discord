# Requirements Document

## Introduction

Fitur ini menambahkan dua kemampuan utama pada FiiCruzh Ecosystem Bot:

1. **Rules Configuration saat Setup Wizard** — Admin dapat memilih antara "Custom Rules" (menulis rules sendiri) atau "Default Rules" (menggunakan template bawaan) selama proses setup wizard.

2. **Social Media Panel Management dari Admin Panel** — Admin dapat menambah, menghapus, dan mengedit tombol social media serta deskripsi embed secara dinamis dari Admin Panel, dengan perubahan yang langsung diterapkan ke panel Social Media secara real-time.

## Glossary

- **Setup_Wizard**: Proses interaktif berbasis slash command `/setup` yang memandu admin dalam mengkonfigurasi bot untuk guild mereka
- **Admin_Panel**: Channel khusus yang berisi tombol-tombol moderasi dan konfigurasi untuk staff server
- **Social_Panel**: Pesan embed di channel Social Media yang menampilkan tombol-tombol link ke platform social media guild
- **Rules_Panel**: Pesan embed di channel Rules yang menampilkan peraturan server kepada member
- **Guild_Config**: File JSON (`guilds_config.json`) yang menyimpan konfigurasi per-guild termasuk URL social media, custom rules, dan channel ID
- **Social_Button**: Tombol bertipe Link pada Social Panel yang mengarahkan user ke URL social media tertentu
- **Config_Editor**: Menu dropdown di Admin Panel yang memungkinkan staff mengedit konfigurasi server

## Requirements

### Requirement 1: Pemilihan Tipe Rules saat Setup Wizard

**User Story:** Sebagai admin server, saya ingin memilih antara menulis rules sendiri atau menggunakan template default saat setup, sehingga saya bisa mengkonfigurasi rules server dengan cepat sesuai kebutuhan.

#### Acceptance Criteria

1. WHEN admin mencapai tahap konfigurasi rules dalam Setup_Wizard, THE Setup_Wizard SHALL menampilkan dua opsi: "📝 Custom Rules" dan "📋 Default Rules" dalam bentuk tombol interaktif
2. WHEN admin memilih opsi "Custom Rules", THE Setup_Wizard SHALL menampilkan modal dengan text input bertipe Paragraph untuk memasukkan teks rules
3. WHEN admin memilih opsi "Default Rules", THE Setup_Wizard SHALL menyimpan string kosong sebagai CUSTOM_RULES di Guild_Config dan menggunakan template rules bawaan
4. WHEN admin mengirimkan modal Custom Rules dengan teks valid, THE Setup_Wizard SHALL menyimpan teks tersebut sebagai CUSTOM_RULES di Guild_Config
5. IF admin mengirimkan modal Custom Rules dengan teks kosong, THEN THE Setup_Wizard SHALL menampilkan pesan error dan meminta input ulang

### Requirement 2: Tampilan Rules pada Rules Panel

**User Story:** Sebagai member server, saya ingin melihat rules server yang sudah dikonfigurasi admin, sehingga saya memahami peraturan yang berlaku.

#### Acceptance Criteria

1. WHEN member menekan tombol "VIEW RULES" pada Rules_Panel, THE Rules_Panel SHALL menampilkan template default rules diikuti custom rules dari Guild_Config jika tersedia
2. WHILE CUSTOM_RULES di Guild_Config berisi teks, THE Rules_Panel SHALL menampilkan section "Additional Rules" yang berisi teks custom tersebut di bawah default rules
3. WHILE CUSTOM_RULES di Guild_Config kosong atau tidak ada, THE Rules_Panel SHALL menampilkan hanya template default rules tanpa section tambahan

### Requirement 3: Penambahan Social Media Button dari Admin Panel

**User Story:** Sebagai admin server, saya ingin menambahkan tombol social media baru dari Admin Panel, sehingga saya bisa mempromosikan platform social media tambahan kepada member.

#### Acceptance Criteria

1. WHEN admin memilih opsi "Add Social Media" dari Config_Editor, THE Config_Editor SHALL menampilkan modal dengan dua field: "Label" (nama platform, maks 80 karakter) dan "URL" (link social media)
2. WHEN admin mengirimkan modal Add Social Media dengan label dan URL valid, THE Guild_Config SHALL menyimpan tombol baru ke dalam array SOCIAL_BUTTONS
3. WHEN tombol baru berhasil disimpan, THE Social_Panel SHALL diperbarui secara real-time dengan menambahkan tombol link baru sesuai label dan URL yang diberikan
4. IF admin mengirimkan URL yang tidak valid (tidak dimulai dengan http:// atau https://), THEN THE Config_Editor SHALL menampilkan pesan error "URL tidak valid"
5. IF jumlah Social_Button sudah mencapai 5 (batas maksimum Discord per ActionRow), THEN THE Config_Editor SHALL menampilkan pesan error "Maksimum 5 tombol social media tercapai"

### Requirement 4: Penghapusan Social Media Button dari Admin Panel

**User Story:** Sebagai admin server, saya ingin menghapus tombol social media yang tidak diperlukan lagi, sehingga panel social media tetap relevan dan rapi.

#### Acceptance Criteria

1. WHEN admin memilih opsi "Remove Social Media" dari Config_Editor, THE Config_Editor SHALL menampilkan dropdown berisi daftar semua Social_Button yang aktif saat ini
2. WHEN admin memilih tombol dari dropdown dan mengkonfirmasi penghapusan, THE Guild_Config SHALL menghapus tombol tersebut dari array SOCIAL_BUTTONS
3. WHEN tombol berhasil dihapus, THE Social_Panel SHALL diperbarui secara real-time dengan menghilangkan tombol yang dihapus
4. IF tidak ada Social_Button yang tersisa setelah penghapusan, THEN THE Social_Panel SHALL menampilkan embed tanpa tombol link

### Requirement 5: Edit Deskripsi Social Media Embed dari Admin Panel

**User Story:** Sebagai admin server, saya ingin mengedit teks deskripsi pada embed Social Panel, sehingga saya bisa menyesuaikan pesan yang ditampilkan kepada member.

#### Acceptance Criteria

1. WHEN admin memilih opsi "Edit Social Description" dari Config_Editor, THE Config_Editor SHALL menampilkan modal dengan text input bertipe Paragraph berisi deskripsi embed saat ini
2. WHEN admin mengirimkan modal dengan deskripsi baru, THE Guild_Config SHALL menyimpan teks tersebut sebagai SOCIAL_DESCRIPTION
3. WHEN deskripsi baru berhasil disimpan, THE Social_Panel SHALL diperbarui secara real-time dengan menampilkan deskripsi baru pada embed
4. IF admin mengirimkan deskripsi kosong, THEN THE Social_Panel SHALL menggunakan deskripsi default bawaan

### Requirement 6: Penyimpanan Data Social Buttons di Guild Config

**User Story:** Sebagai developer, saya ingin data social buttons tersimpan secara persisten di Guild Config, sehingga konfigurasi tidak hilang saat bot restart.

#### Acceptance Criteria

1. THE Guild_Config SHALL menyimpan social buttons dalam format array SOCIAL_BUTTONS yang berisi objek dengan properti "label" (string) dan "url" (string)
2. WHEN bot melakukan restart, THE Social_Panel SHALL memuat konfigurasi social buttons dari Guild_Config dan menampilkan tombol sesuai data yang tersimpan
3. WHEN terjadi perubahan pada SOCIAL_BUTTONS atau SOCIAL_DESCRIPTION, THE Guild_Config SHALL langsung menyimpan perubahan ke file guilds_config.json
4. WHILE SOCIAL_BUTTONS tidak ada atau kosong di Guild_Config, THE Social_Panel SHALL menggunakan konfigurasi default (Instagram, TikTok, YouTube) dengan URL dari INSTAGRAM_URL, TIKTOK_URL, dan YOUTUBE_URL

### Requirement 7: Real-time Update Social Panel

**User Story:** Sebagai admin server, saya ingin perubahan pada konfigurasi social media langsung terlihat di panel tanpa perlu deploy ulang, sehingga member selalu melihat informasi terbaru.

#### Acceptance Criteria

1. WHEN admin melakukan perubahan apapun pada konfigurasi social media (tambah, hapus tombol, atau edit deskripsi), THE Social_Panel SHALL memperbarui pesan embed dalam waktu kurang dari 3 detik
2. THE Social_Panel SHALL menggunakan MSG_SOCIAL_ID dari Guild_Config untuk mengidentifikasi pesan yang perlu diperbarui
3. IF pesan Social Panel tidak ditemukan (dihapus manual), THEN THE Config_Editor SHALL mengirim pesan Social Panel baru dan menyimpan MSG_SOCIAL_ID yang baru ke Guild_Config
