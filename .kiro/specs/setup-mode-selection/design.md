# Design Document: Setup Mode Selection

## Overview

Fitur ini menambahkan sistem pemilihan mode setup interaktif pada bot FiiCruzh. Saat Administrator menjalankan command `/fiicruzh`, bot akan menampilkan wizard interaktif yang memungkinkan pemilihan antara Manual Setup dan Automatic Setup, dengan kemampuan seleksi komponen granular.

## Architecture

### Komponen Utama

```
┌─────────────────────────────────────────────────────┐
│                  Setup Wizard Flow                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  /fiicruzh command                                   │
│       │                                              │
│       ▼                                              │
│  ┌──────────────┐                                    │
│  │ Detect Config│──── Config exists? ────┐           │
│  └──────────────┘                        │           │
│       │ No                               ▼           │
│       │                         ┌────────────────┐   │
│       │                         │ Update/Fresh?  │   │
│       │                         └────────────────┘   │
│       ▼                                  │           │
│  ┌──────────────┐                        │           │
│  │ Role Input   │◄──────────────────────-┘           │
│  │ (5 roles)    │                                    │
│  └──────────────┘                                    │
│       │                                              │
│       ▼                                              │
│  ┌──────────────┐                                    │
│  │ Mode Select  │                                    │
│  │Manual/Auto   │                                    │
│  └──────────────┘                                    │
│       │                    │                         │
│       ▼                    ▼                         │
│  ┌──────────┐      ┌────────────┐                   │
│  │  Manual  │      │  Automatic │                    │
│  │  Setup   │      │   Setup    │                    │
│  └──────────┘      └────────────┘                   │
│       │                    │                         │
│       │                    ▼                         │
│       │            ┌────────────┐                    │
│       │            │ Component  │                    │
│       │            │ Selection  │                    │
│       │            └────────────┘                    │
│       │                    │                         │
│       ▼                    ▼                         │
│  ┌──────────────────────────────┐                    │
│  │     Execute Setup Process    │                    │
│  │  (Create/Assign + Deploy)    │                    │
│  └──────────────────────────────┘                    │
│       │                                              │
│       ▼                                              │
│  ┌──────────────┐                                    │
│  │ Save Config  │                                    │
│  │ + Summary    │                                    │
│  └──────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

### File Structure

```
index.js (modified)
├── Setup Wizard Handler (refactored slash command)
│   ├── setupModeSelection()     - Tampilkan pilihan mode
│   ├── setupRoleInput()         - Kumpulkan input role
│   ├── setupManualMode()        - Handler manual setup
│   ├── setupAutomaticMode()     - Handler automatic setup
│   ├── setupComponentSelect()   - Seleksi komponen (auto mode)
│   ├── executeSetup()           - Eksekusi proses setup
│   └── setupSummary()           - Tampilkan ringkasan
└── Utility Functions
    ├── detectExistingConfig()   - Deteksi config lama
    ├── backupBeforeSetup()      - Backup sebelum setup
    └── validateChannelType()    - Validasi tipe channel
```

## Detailed Design

### 1. Setup Wizard State Machine

Bot menggunakan pendekatan **collector-based state machine** dengan `MessageComponentCollector` dari discord.js untuk mengelola flow interaktif multi-step.

```javascript
// State tracking per guild setup session
const setupSessions = new Map();

// Session structure:
{
  guildId: String,
  userId: String,
  mode: 'manual' | 'automatic' | null,
  selectedCategories: ['statistics', 'main', 'ticket', 'admin'],
  roles: {
    verify: null,
    man: null,
    woman: null,
    admin: null,
    dev: null
  },
  channelMappings: {},  // For manual mode
  step: 'mode_select' | 'role_input' | 'category_select' | 'channel_assign' | 'executing' | 'complete',
  startedAt: Date,
  message: InteractionMessage  // Reference to reply message for editing
}
```

### 2. Mode Selection Interface

Menggunakan `ButtonBuilder` dengan dua tombol utama:

```javascript
const modeEmbed = new EmbedBuilder()
  .setTitle("⚙️ FiiCruzh Setup Wizard")
  .setDescription("Pilih mode setup yang diinginkan:")
  .addFields(
    { name: "🔧 Manual Setup", value: "Pilih channel yang sudah ada untuk penempatan panel bot" },
    { name: "🚀 Automatic Setup", value: "Bot membuat channel & kategori secara otomatis" }
  );

const modeRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("setup_manual").setLabel("🔧 Manual Setup").setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId("setup_auto").setLabel("🚀 Automatic Setup").setStyle(ButtonStyle.Success)
);
```

### 3. Manual Mode - Channel Selection

Untuk setiap kategori, bot menampilkan `ChannelSelectMenuBuilder` yang memungkinkan Administrator memilih channel existing:

```javascript
// Step-by-step channel assignment
const categories = [
  {
    id: 'statistics',
    name: '📊 Server Statistics',
    channels: [
      { key: 'STATS_TOTAL_CH_ID', label: 'Total Member (Voice)', type: ChannelType.GuildVoice },
      { key: 'STATS_MAN_CH_ID', label: 'Total Man (Voice)', type: ChannelType.GuildVoice },
      // ...
    ]
  },
  {
    id: 'main',
    name: '︱𝕄𝕒𝕚𝕟︱',
    channels: [
      { key: 'WELCOME_CHANNEL', label: 'Welcome-GoodBye (Text)', type: ChannelType.GuildText },
      { key: 'VERIFY_CHANNEL_ID', label: 'Verification (Text)', type: ChannelType.GuildText },
      // ...
    ]
  }
];
```

### 4. Automatic Mode - Component Selection

Menggunakan `StringSelectMenuBuilder` dengan multi-select untuk pemilihan kategori:

```javascript
const categorySelect = new StringSelectMenuBuilder()
  .setCustomId("setup_category_select")
  .setPlaceholder("Pilih kategori yang ingin di-setup")
  .setMinValues(1)
  .setMaxValues(4)
  .addOptions([
    { label: "📊 Server Statistics", value: "statistics", default: true, description: "Voice channels untuk statistik member" },
    { label: "︱𝕄𝕒𝕚𝕟︱", value: "main", default: true, description: "Channel utama (Welcome, Verify, Rules, dll)" },
    { label: "𝕋𝕚𝕔𝕜et-𝕊𝕦𝕡𝕡𝕠𝕣𝕥", value: "ticket", default: true, description: "Sistem tiket support" },
    { label: "ℙ𝕒𝕟𝕖𝕝-𝔸𝕕𝕞𝕚𝕟", value: "admin", default: true, description: "Panel admin dan log system" }
  ]);
```

### 5. Role Input System

Menggunakan sequential `RoleSelectMenuBuilder` untuk mengumpulkan 5 role:

```javascript
const roleSteps = [
  { key: 'verify', label: '✅ Verify Role', description: 'Role yang diberikan setelah verifikasi' },
  { key: 'man', label: '💪 Man Role', description: 'Role untuk Laki-laki' },
  { key: 'woman', label: '🌸 Woman Role', description: 'Role untuk Perempuan' },
  { key: 'admin', label: '👑 Admin Role', description: 'Role untuk Administrator' },
  { key: 'dev', label: '🔰 Dev Role', description: 'Role untuk Developer/Owner' }
];
```

### 6. Existing Config Detection

```javascript
function detectExistingConfig(guildId) {
  const config = getGuildConfig(guildId);
  if (!config) return { exists: false };
  
  return {
    exists: true,
    channelCount: Object.keys(config).filter(k => k.includes('CHANNEL') || k.includes('_CH_')).length,
    roleCount: Object.keys(config).filter(k => k.includes('ROLE')).length,
    hasStats: !!config.STATS_CATEGORY_ID,
    hasTicket: !!config.TICKET_CATEGORY_ID,
    hasAdmin: !!config.ADMIN_PANEL_CHANNEL_ID
  };
}
```

### 7. Progress Tracking

Setup progress ditampilkan dengan embed yang di-update secara real-time:

```javascript
async function updateProgress(interaction, steps, currentStep, status) {
  const progressEmbed = new EmbedBuilder()
    .setTitle("⚙️ Setup Progress")
    .setColor(status === 'error' ? 'Red' : 'Blue')
    .setDescription(steps.map((step, i) => {
      if (i < currentStep) return `✅ ${step}`;
      if (i === currentStep) return `⏳ ${step}...`;
      return `⬜ ${step}`;
    }).join('\n'));
    
  await interaction.editReply({ embeds: [progressEmbed] });
}
```

### 8. Error Recovery & Partial Save

```javascript
async function executeWithRecovery(guild, tasks, session) {
  const results = { success: [], failed: [] };
  
  for (const task of tasks) {
    try {
      const result = await task.execute(guild);
      results.success.push({ name: task.name, id: result.id });
      // Save partial progress
      saveGuildConfig(guild.id, buildPartialConfig(results.success));
    } catch (err) {
      results.failed.push({ name: task.name, error: err.message });
      logError(`Setup:${task.name}`, err, guild.id);
    }
  }
  
  return results;
}
```

## Data Flow

### Config Save Format (tidak berubah)

Format `guilds_config.json` tetap sama dengan yang existing. Fitur baru hanya mengubah cara data dikumpulkan (manual vs automatic), bukan format penyimpanannya.

### Session Timeout

- Timeout per step: 60 detik
- Total session timeout: 5 menit
- Cleanup otomatis saat timeout tercapai

## Correctness Properties

### Property 1: Channel Type Validation Consistency
- **Requirement:** 2.3, 2.4
- **Property:** Untuk semua channel yang dipilih dalam Manual Mode, tipe channel (text/voice) harus sesuai dengan requirement komponen. Voice channel hanya valid untuk Statistics, text channel untuk semua panel lainnya.
- **Test approach:** Property-based test - generate random channel selections dan verifikasi validasi selalu konsisten.

### Property 2: Config Persistence Round-Trip
- **Requirement:** 2.5, 3.6
- **Property:** Untuk semua konfigurasi yang disimpan melalui `saveGuildConfig()`, membaca kembali dengan `getGuildConfig()` harus menghasilkan data yang identik.
- **Test approach:** Property-based test - generate random config objects, save, load, dan bandingkan.

### Property 3: Duplicate Role Detection
- **Requirement:** 5.3
- **Property:** Untuk semua kombinasi 5 role input, jika ada dua atau lebih role dengan ID yang sama, sistem harus mendeteksi dan melaporkan duplikat.
- **Test approach:** Property-based test - generate random role ID combinations dan verifikasi deteksi duplikat.

### Property 4: Partial Config Validity
- **Requirement:** 6.5
- **Property:** Jika proses setup gagal di tengah jalan, config yang tersimpan (partial) harus tetap valid dan dapat dibaca tanpa error oleh sistem lainnya.
- **Test approach:** Property-based test - simulate random failure points dan verifikasi partial config tetap parseable.

### Property 5: Update Setup Preserves Existing
- **Requirement:** 7.2
- **Property:** Saat "Update Setup" dipilih, semua key yang sudah ada di Guild_Config sebelumnya dan tidak di-overwrite harus tetap ada setelah update selesai.
- **Test approach:** Property-based test - generate existing config, apply update dengan subset keys, verifikasi non-updated keys tetap intact.

### Property 6: Category Selection Completeness
- **Requirement:** 4.1 - 4.5
- **Property:** Untuk setiap Setup_Category yang dipilih, semua channel yang didefinisikan dalam kategori tersebut harus dibuat. Jumlah channel yang dibuat harus sama dengan jumlah channel yang didefinisikan untuk kategori terpilih.
- **Test approach:** Property-based test - generate random category selections dan verifikasi channel count matches definition.

## Technical Decisions

### Mengapa Collector-Based State Machine?

Discord.js `MessageComponentCollector` adalah pattern standar untuk multi-step interactions. Alternatif seperti modal chaining terbatas pada 5 input per modal dan tidak mendukung select menus.

### Mengapa Tidak Menggunakan Slash Command Options?

Command `/fiicruzh` saat ini menggunakan 5 role options. Dengan fitur baru, flow menjadi terlalu kompleks untuk single command options. Wizard interaktif memberikan UX yang lebih baik untuk proses multi-step.

### Backward Compatibility

- Command `/fiicruzh` yang existing akan di-refactor menjadi wizard
- Format `guilds_config.json` tidak berubah
- Semua fitur existing (welcome, verify, level, ticket, dll) tetap berfungsi normal
- Backup otomatis sebelum setiap setup baru

## Dependencies

- discord.js v14.x (sudah terinstall) — `MessageComponentCollector`, `ChannelSelectMenuBuilder`
- Tidak ada dependency baru yang diperlukan
