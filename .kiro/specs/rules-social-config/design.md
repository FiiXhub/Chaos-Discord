# Design Document

## Overview

Dokumen ini menjelaskan implementasi teknis untuk fitur Rules Configuration saat Setup Wizard dan Social Media Panel Management dari Admin Panel pada FiiCruzh Ecosystem Bot.

## Architecture

### Perubahan pada Guild Config Schema

```json
{
  "GUILD_ID": {
    "CUSTOM_RULES": "string | empty",
    "SOCIAL_BUTTONS": [
      { "label": "Instagram", "url": "https://instagram.com/..." },
      { "label": "TikTok", "url": "https://tiktok.com/..." },
      { "label": "YouTube", "url": "https://youtube.com/..." }
    ],
    "SOCIAL_DESCRIPTION": "string | null",
    "MSG_SOCIAL_ID": "message_id",
    "MSG_RULES_ID": "message_id"
  }
}
```

### Backward Compatibility

Jika `SOCIAL_BUTTONS` tidak ada di config, sistem akan fallback ke format lama menggunakan `INSTAGRAM_URL`, `TIKTOK_URL`, dan `YOUTUBE_URL` untuk membuat array buttons secara dinamis.

## Component Design

### 1. Setup Wizard — Rules Step

**Lokasi:** Setelah channel assignment selesai, sebelum deploy panels.

**Flow:**
```
[Channel Assignment Done] 
    → [Rules Type Selection: Custom / Default]
        → [Custom] → Modal Input → Save CUSTOM_RULES → Continue
        → [Default] → CUSTOM_RULES = "" → Continue
    → [Deploy Panels]
```

**Implementasi:**
- Tambahkan step baru `rules_config` di setup wizard flow
- Gunakan `ButtonBuilder` untuk opsi "📝 Custom Rules" dan "📋 Default Rules"
- Modal untuk Custom Rules menggunakan `TextInputStyle.Paragraph`
- Session menyimpan pilihan di `session.rulesChoice` dan `session.customRules`

### 2. Admin Panel — Config Editor Enhancement

**Perubahan pada `select_edit_config` dropdown:**

Tambahkan opsi baru:
- `add_social` — "➕ Add Social Media"
- `remove_social` — "➖ Remove Social Media"  
- `edit_social_desc` — "📝 Edit Social Description"

**Flow Add Social:**
```
[Select "Add Social Media"]
    → [Validasi: jumlah buttons < 5]
    → [Modal: Label + URL]
    → [Validasi URL]
    → [Push ke SOCIAL_BUTTONS array]
    → [Save Config]
    → [Update Social Panel Message]
```

**Flow Remove Social:**
```
[Select "Remove Social Media"]
    → [StringSelectMenu: daftar buttons aktif]
    → [User pilih button]
    → [Splice dari SOCIAL_BUTTONS array]
    → [Save Config]
    → [Update Social Panel Message]
```

**Flow Edit Description:**
```
[Select "Edit Social Description"]
    → [Modal: Paragraph input, prefilled current description]
    → [Save SOCIAL_DESCRIPTION ke config]
    → [Update Social Panel Message]
```

### 3. Social Panel Update Function

**Helper function baru: `updateSocialPanel(guild, config)`**

```javascript
async function updateSocialPanel(guild, config) {
  const socialChId = config.SOCIAL_CHANNEL_ID;
  const socialMsgId = config.MSG_SOCIAL_ID;
  if (!socialChId) return;
  
  const channel = guild.channels.cache.get(socialChId);
  if (!channel) return;
  
  // Get or create social buttons
  const buttons = getSocialButtons(config);
  const description = config.SOCIAL_DESCRIPTION || DEFAULT_SOCIAL_DESCRIPTION;
  
  // Build embed
  const embed = new EmbedBuilder()
    .setColor("#E1306C")
    .setTitle("🌐 Connect With Us")
    .setDescription(description)
    .setThumbnail(guild.iconURL())
    .setFooter({ text: "Official Social Hub", iconURL: guild.iconURL() })
    .setTimestamp();
  
  // Build button row (max 5)
  const row = new ActionRowBuilder();
  for (const btn of buttons) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel(btn.label)
        .setStyle(ButtonStyle.Link)
        .setURL(btn.url)
    );
  }
  
  // Update or create message
  if (socialMsgId) {
    const msg = await channel.messages.fetch(socialMsgId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed], components: buttons.length > 0 ? [row] : [] });
      return;
    }
  }
  
  // Message not found, create new
  const newMsg = await channel.send({ embeds: [embed], components: buttons.length > 0 ? [row] : [] });
  config.MSG_SOCIAL_ID = newMsg.id;
  saveGuildConfig(guild.id, config);
}
```

**Helper function: `getSocialButtons(config)`**

```javascript
function getSocialButtons(config) {
  // New format
  if (config.SOCIAL_BUTTONS && Array.isArray(config.SOCIAL_BUTTONS)) {
    return config.SOCIAL_BUTTONS;
  }
  // Legacy fallback
  const buttons = [];
  if (config.INSTAGRAM_URL) buttons.push({ label: "Instagram", url: config.INSTAGRAM_URL });
  if (config.TIKTOK_URL) buttons.push({ label: "TikTok", url: config.TIKTOK_URL });
  if (config.YOUTUBE_URL) buttons.push({ label: "YouTube", url: config.YOUTUBE_URL });
  return buttons;
}
```

### 4. Interaction Handlers Baru

| Custom ID | Tipe | Deskripsi |
|-----------|------|-----------|
| `setup_rules_custom` | Button | Pilih Custom Rules di setup wizard |
| `setup_rules_default` | Button | Pilih Default Rules di setup wizard |
| `modal_setup_rules` | Modal | Input custom rules text |
| `modal_add_social` | Modal | Input label + URL social baru |
| `select_remove_social` | StringSelect | Pilih social button untuk dihapus |
| `modal_edit_social_desc` | Modal | Edit deskripsi embed social |

### 5. Validasi

**URL Validation:**
```javascript
function isValidURL(str) {
  return /^https?:\/\/.+/.test(str);
}
```

**Button Limit:**
- Discord membatasi 5 buttons per ActionRow
- Validasi dilakukan sebelum menampilkan modal Add Social

## Data Flow

```
Admin Panel → Config Editor → Modal/Select → Validate → Save Config → Update Panel
                                                                          ↓
                                                              Edit Discord Message
```

## Error Handling

| Skenario | Penanganan |
|----------|------------|
| URL tidak valid | Tampilkan error ephemeral, minta input ulang |
| Maks 5 buttons tercapai | Tampilkan error ephemeral sebelum modal |
| Pesan Social Panel dihapus | Buat pesan baru, simpan MSG_SOCIAL_ID baru |
| Channel tidak ditemukan | Log error, tampilkan pesan ke admin |
| Modal timeout | Discord handle otomatis (15 menit) |

## Migration Strategy

- Config lama (`INSTAGRAM_URL`, `TIKTOK_URL`, `YOUTUBE_URL`) tetap didukung via `getSocialButtons()` fallback
- Saat admin pertama kali menggunakan Add/Remove Social, sistem akan migrasi otomatis ke format `SOCIAL_BUTTONS` array
- Field lama tidak dihapus untuk backward compatibility

## Constants

```javascript
const DEFAULT_SOCIAL_DESCRIPTION = 
  "Stay updated and support our journey by following our official social media channels!\n\n" +
  "📸 **Instagram**        🎬 **TikTok**        🎥 **YouTube**\n" +
  "Daily updates & stories    Short & fun content    Full length videos";

const DEFAULT_RULES = 
  "🛡️ **1. Respect Everyone | Hormati Semua Orang**\n" +
  "Perlakukan semua anggota dengan hormat.\n\n" +
  "🚫 **2. No Spamming | Dilarang Spam**\n" +
  "Jangan mengirim pesan berlebihan.\n\n" +
  "🔞 **3. No NSFW Content | Tidak Ada Konten Dewasa**\n" +
  "Konten dewasa tidak diizinkan.\n\n" +
  "👮 **4. Follow Staff | Ikuti Instruksi Staff**\n" +
  "Keputusan staff adalah mutlak.";

const MAX_SOCIAL_BUTTONS = 5;
```
