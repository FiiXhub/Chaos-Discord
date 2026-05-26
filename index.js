require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType
} = require("discord.js");

const { createClient } = require("@supabase/supabase-js");
const Canvas = require("canvas");
const axios = require("axios");
const fs = require("fs");

/* ================= SUPABASE CLIENT ================= */

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function dbSaveGuildConfig(guildId, config) {
  const { error } = await supabase.from("guild_configs").upsert({ guild_id: guildId, config, updated_at: new Date().toISOString() }, { onConflict: "guild_id" });
  if (error) console.error("[Supabase] Error saving guild config:", error.message);
}

async function dbLoadGuildConfigs() {
  const { data, error } = await supabase.from("guild_configs").select("*");
  if (error) { console.error("[Supabase] Error loading guild configs:", error.message); return {}; }
  const result = {};
  for (const row of data || []) { result[row.guild_id] = row.config; }
  return result;
}

async function dbSaveMember(guildId, userId, memberData) {
  const { error } = await supabase.from("members").upsert({
    guild_id: guildId, user_id: userId,
    roblox_name: memberData.robloxName || null,
    nickname: memberData.nickname || null,
    address: memberData.address || null,
    registered_at: memberData.registeredAt ? new Date(memberData.registeredAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: "guild_id,user_id" });
  if (error) console.error("[Supabase] Error saving member:", error.message);
}

async function dbDeleteMember(guildId, userId) {
  const { error } = await supabase.from("members").delete().eq("guild_id", guildId).eq("user_id", userId);
  if (error) console.error("[Supabase] Error deleting member:", error.message);
}

async function dbLoadMembers(guildId) {
  const { data, error } = await supabase.from("members").select("*").eq("guild_id", guildId);
  if (error) { console.error("[Supabase] Error loading members:", error.message); return {}; }
  const result = {};
  for (const row of data || []) {
    result[row.user_id] = { robloxName: row.roblox_name, nickname: row.nickname, address: row.address, registeredAt: new Date(row.registered_at).getTime(), updatedAt: new Date(row.updated_at).getTime() };
  }
  return result;
}

async function dbLoadAllMembers() {
  const { data, error } = await supabase.from("members").select("*");
  if (error) { console.error("[Supabase] Error loading all members:", error.message); return {}; }
  const result = {};
  for (const row of data || []) {
    if (!result[row.guild_id]) result[row.guild_id] = {};
    result[row.guild_id][row.user_id] = { robloxName: row.roblox_name, nickname: row.nickname, address: row.address, registeredAt: new Date(row.registered_at).getTime(), updatedAt: new Date(row.updated_at).getTime() };
  }
  return result;
}

async function dbSaveGuildMemberSettings(guildId, settings) {
  const { error } = await supabase.from("guild_member_settings").upsert({
    guild_id: guildId, title: settings.title || "MEMBER LIST",
    list_message_id: settings.listMessageId || null, list_channel_id: settings.channelId || null,
    panel_message_id: settings.panelMessageId || null, panel_channel_id: settings.panelChannelId || null,
    updated_at: new Date().toISOString()
  }, { onConflict: "guild_id" });
  if (error) console.error("[Supabase] Error saving guild member settings:", error.message);
}

async function dbLoadGuildMemberSettings() {
  const { data, error } = await supabase.from("guild_member_settings").select("*");
  if (error) { console.error("[Supabase] Error loading guild member settings:", error.message); return {}; }
  const result = {};
  for (const row of data || []) {
    result[row.guild_id] = { title: row.title || "MEMBER LIST", listMessageId: row.list_message_id, channelId: row.list_channel_id, panelMessageId: row.panel_message_id, panelChannelId: row.panel_channel_id };
  }
  return result;
}

async function dbSaveLevel(userId, levelData) {
  const { error } = await supabase.from("levels").upsert({ user_id: userId, xp: levelData.xp, level: levelData.level, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.error("[Supabase] Error saving level:", error.message);
}

async function dbLoadLevels() {
  const { data, error } = await supabase.from("levels").select("*");
  if (error) { console.error("[Supabase] Error loading levels:", error.message); return {}; }
  const result = {};
  for (const row of data || []) { result[row.user_id] = { xp: row.xp, level: row.level }; }
  return result;
}

async function dbAddWarn(guildId, userId, reason, moderator) {
  const { error } = await supabase.from("warns").insert({ guild_id: guildId, user_id: userId, reason, moderator, created_at: new Date().toISOString() });
  if (error) console.error("[Supabase] Error adding warn:", error.message);
}

async function dbGetWarns(guildId, userId) {
  const { data, error } = await supabase.from("warns").select("*").eq("guild_id", guildId).eq("user_id", userId).order("created_at", { ascending: true });
  if (error) { console.error("[Supabase] Error getting warns:", error.message); return []; }
  return data || [];
}

// Cache untuk menyimpan pilihan Manage Role sementara
const manageCache = new Map();

// Setup Wizard Sessions (per guild)
const setupSessions = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ]
});

const cooldown = new Map();
let cachedBackground = null;
const xpCooldown = new Map();

/* ================= ANTI-RAID SYSTEM ================= */

const raidTracker = new Map(); // guildId -> { joins: [], lockdown: false }
const RAID_THRESHOLD = 8; // Max joins in time window
const RAID_WINDOW = 10000; // 10 seconds
const RAID_LOCKDOWN_DURATION = 60000; // 1 minute lockdown

function checkRaid(guildId) {
  if (!raidTracker.has(guildId)) {
    raidTracker.set(guildId, { joins: [], lockdown: false, lockdownTimer: null });
  }
  const data = raidTracker.get(guildId);
  const now = Date.now();

  // Clean old entries
  data.joins = data.joins.filter(t => now - t < RAID_WINDOW);
  data.joins.push(now);

  // Check threshold
  if (data.joins.length >= RAID_THRESHOLD && !data.lockdown) {
    data.lockdown = true;
    data.lockdownTimer = setTimeout(() => {
      data.lockdown = false;
      data.joins = [];
    }, RAID_LOCKDOWN_DURATION);
    return true; // Raid detected
  }
  return false;
}

/* ================= WARN TRACKING SYSTEM ================= */

let warnsCache = {};

function loadWarns() {
  try {
    if (fs.existsSync("./warns.json")) {
      const data = fs.readFileSync("./warns.json", "utf8");
      warnsCache = data ? JSON.parse(data) : {};
    }
  } catch { warnsCache = {}; }
}

function saveWarns() {
  try { fs.writeFileSync("./warns.json", JSON.stringify(warnsCache, null, 2)); } catch { }
}

function addWarn(guildId, userId, reason, moderator) {
  if (!warnsCache[guildId]) warnsCache[guildId] = {};
  if (!warnsCache[guildId][userId]) warnsCache[guildId][userId] = [];
  warnsCache[guildId][userId].push({ reason, moderator, timestamp: Date.now() });
  saveWarns();
  // Async sync to Supabase
  dbAddWarn(guildId, userId, reason, moderator).catch(() => {});
  return warnsCache[guildId][userId].length;
}

function getWarns(guildId, userId) {
  return warnsCache[guildId]?.[userId] || [];
}

/* ================= MEMBER REGISTRATION SYSTEM ================= */

let membersCache = {};
const memberCooldown = new Map(); // `guildId-userId` -> timestamp

function loadMembers() {
  try {
    if (fs.existsSync("./members.json")) {
      const data = fs.readFileSync("./members.json", "utf8");
      membersCache = data ? JSON.parse(data) : {};
    }
  } catch { membersCache = {}; }
}

function saveMembers() {
  try { fs.writeFileSync("./members.json", JSON.stringify(membersCache, null, 2)); } catch { }
}

function getGuildMembers(guildId) {
  if (!membersCache[guildId]) membersCache[guildId] = { title: "MEMBER LIST", members: {}, listMessageId: null, panelMessageId: null, channelId: null };
  return membersCache[guildId];
}

function saveMemberData(guildId, userId, data) {
  const guildData = getGuildMembers(guildId);
  const existing = guildData.members[userId] || {};
  guildData.members[userId] = { ...existing, ...data, updatedAt: Date.now() };
  if (!guildData.members[userId].registeredAt) guildData.members[userId].registeredAt = Date.now();
  saveMembers();
  // Async sync to Supabase
  dbSaveMember(guildId, userId, guildData.members[userId]).catch(() => {});
  dbSaveGuildMemberSettings(guildId, guildData).catch(() => {});
}

function getMemberData(guildId, userId) {
  return getGuildMembers(guildId).members[userId] || null;
}

function validateRobloxName(name) {
  if (!name || !name.trim()) return { valid: false, error: "❌ Nama Roblox wajib diisi!" };
  const trimmed = name.trim();
  if (trimmed.length < 6) return { valid: false, error: "❌ Nama Roblox minimal 6 karakter (termasuk CHAOS)!" };
  if (trimmed.length > 20) return { valid: false, error: "❌ Nama Roblox maksimal 20 karakter!" };
  if (!trimmed.endsWith("CHAOS")) return { valid: false, error: "❌ Nama Roblox harus diakhiri dengan **CHAOS** (huruf kapital)!" };
  return { valid: true };
}

function hasStaffAccess(member, guildId) {
  const adminRoleId = getConfig(guildId, "ADMIN_ROLE_ID");
  const devRoleId = getConfig(guildId, "DEV_ROLE_ID");
  const ownerRoleId = getConfig(guildId, "OWNER_ROLE_ID");
  const staffRoleId = getConfig(guildId, "STAFF_ROLE_ID");
  const guardRoleId = getConfig(guildId, "GUARD_ROLE_ID");
  return member.roles.cache.has(adminRoleId) || member.roles.cache.has(devRoleId) || member.roles.cache.has(ownerRoleId) || member.roles.cache.has(staffRoleId) || member.roles.cache.has(guardRoleId);
}

async function updateMemberListEmbed(guild, guildId) {
  const guildData = getGuildMembers(guildId);
  if (!guildData.channelId) return;

  const channel = guild.channels.cache.get(guildData.channelId);
  if (!channel) return;

  const memberEntries = Object.entries(guildData.members)
    .sort((a, b) => (a[1].registeredAt || 0) - (b[1].registeredAt || 0));

  let description = "";
  if (memberEntries.length === 0) {
    description = "*Belum ada member terdaftar.*";
  } else {
    const lines = memberEntries.map(([userId, data], i) => `**${i + 1}.** ${data.robloxName} [${data.nickname}]`);
    description = lines.join("\n\n");
    // Truncate if exceeds 4096 chars
    if (description.length > 4096) {
      let truncated = "";
      let shown = 0;
      for (const line of lines) {
        const next = truncated ? truncated + "\n\n" + line : line;
        if (next.length > 3900) break;
        truncated = next;
        shown++;
      }
      const hidden = memberEntries.length - shown;
      description = truncated + `\n\n*...dan ${hidden} member lainnya tidak ditampilkan.*`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor("#FF0055")
    .setTitle(`[ ‼️ LIST MEMBER ${guildData.title} ‼️ ]`)
    .setDescription(description)
    .setFooter({ text: `Total: ${memberEntries.length} members` })
    .setTimestamp();

  if (guildData.listMessageId) {
    const msg = await channel.messages.fetch(guildData.listMessageId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed] });
      return;
    }
  }

  const newMsg = await channel.send({ embeds: [embed] });
  guildData.listMessageId = newMsg.id;
  saveMembers();
}

/* ================= DATABASE SYSTEM (Multi-Guild) ================= */

let guildsCache = {};
let levelsCache = {};

function loadDatabases() {
  // Load from local JSON first (fallback), then sync from Supabase
  try {
    if (fs.existsSync("./guilds_config.json")) {
      const data = fs.readFileSync("./guilds_config.json", "utf8");
      try { guildsCache = data ? JSON.parse(data) : {}; } catch (e) { guildsCache = {}; }
    }
    if (fs.existsSync("./levels.json")) {
      const data = fs.readFileSync("./levels.json", "utf8");
      try { levelsCache = data ? JSON.parse(data) : {}; } catch (e) { levelsCache = {}; }
    }
    loadWarns();
    loadMembers();
    console.log("📂 Local databases loaded into cache.");
    backupConfig();
  } catch (err) { console.error("❌ Error loading local databases:", err); }

  // Async load from Supabase (overrides local)
  loadFromSupabase();
}

async function loadFromSupabase() {
  try {
    console.log("☁️ Loading data from Supabase...");

    // Load guild configs
    const dbConfigs = await dbLoadGuildConfigs();
    if (Object.keys(dbConfigs).length > 0) {
      guildsCache = dbConfigs;
      saveGuildsLocal();
      console.log(`  ✅ Guild configs: ${Object.keys(dbConfigs).length} guilds`);
    } else if (Object.keys(guildsCache).length > 0) {
      // First time: migrate local data to Supabase
      console.log("  📤 Migrating local guild configs to Supabase...");
      for (const [guildId, config] of Object.entries(guildsCache)) {
        await dbSaveGuildConfig(guildId, config);
      }
      console.log(`  ✅ Migrated ${Object.keys(guildsCache).length} guild configs`);
    }

    // Load levels
    const dbLevels = await dbLoadLevels();
    if (Object.keys(dbLevels).length > 0) {
      levelsCache = dbLevels;
      console.log(`  ✅ Levels: ${Object.keys(dbLevels).length} users`);
    } else if (Object.keys(levelsCache).length > 0) {
      console.log("  📤 Migrating local levels to Supabase...");
      for (const [userId, data] of Object.entries(levelsCache)) {
        await dbSaveLevel(userId, data);
      }
      console.log(`  ✅ Migrated ${Object.keys(levelsCache).length} levels`);
    }

    // Load member settings
    const dbSettings = await dbLoadGuildMemberSettings();
    for (const [guildId, settings] of Object.entries(dbSettings)) {
      const guildData = getGuildMembers(guildId);
      Object.assign(guildData, settings);
    }

    // Load all members
    const dbMembers = await dbLoadAllMembers();
    for (const [guildId, members] of Object.entries(dbMembers)) {
      const guildData = getGuildMembers(guildId);
      guildData.members = members;
    }

    // Migrate local members if Supabase is empty
    if (Object.keys(dbMembers).length === 0 && Object.keys(membersCache).length > 0) {
      console.log("  📤 Migrating local members to Supabase...");
      for (const [guildId, guildData] of Object.entries(membersCache)) {
        if (guildData.members) {
          for (const [userId, data] of Object.entries(guildData.members)) {
            await dbSaveMember(guildId, userId, data);
          }
        }
        if (guildData.title || guildData.channelId) {
          await dbSaveGuildMemberSettings(guildId, guildData);
        }
      }
      console.log("  ✅ Members migrated");
    }

    console.log("☁️ Supabase sync complete!");
  } catch (err) {
    console.error("❌ Supabase load error (using local fallback):", err.message);
  }
}

function backupConfig() {
  try {
    if (!fs.existsSync("./backups")) fs.mkdirSync("./backups");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(`./backups/config_backup_${timestamp}.json`, JSON.stringify(guildsCache, null, 2));
    const files = fs.readdirSync("./backups").filter(f => f.endsWith(".json")).sort();
    while (files.length > 5) {
      const fileToDelete = files.shift();
      fs.unlinkSync(`./backups/${fileToDelete}`);
    }
  } catch (err) {
    console.error("❌ Backup Failed:", err);
  }
}

function saveGuilds() {
  saveGuildsLocal();
  // Async sync to Supabase (non-blocking)
  for (const [guildId, config] of Object.entries(guildsCache)) {
    dbSaveGuildConfig(guildId, config).catch(() => {});
  }
}

function saveGuildsLocal() {
  try {
    const data = JSON.stringify(guildsCache, null, 2);
    fs.writeFileSync("./guilds_config.json.tmp", data);
    fs.renameSync("./guilds_config.json.tmp", "./guilds_config.json");
  } catch (err) {
    console.error("❌ Error saving guilds_config:", err);
  }
}

function saveLevels() {
  try {
    fs.writeFileSync("./levels.json", JSON.stringify(levelsCache, null, 2));
  } catch (err) {
    console.error("❌ Error saving levels:", err);
  }
  // Async sync to Supabase
  for (const [userId, data] of Object.entries(levelsCache)) {
    dbSaveLevel(userId, data).catch(() => {});
  }
}

function getGuildConfig(guildId) {
  return guildsCache[guildId] || null;
}

function saveGuildConfig(guildId, config) {
  guildsCache[guildId] = { ...(guildsCache[guildId] || {}), ...config };
  saveGuilds();
  return true;
}

/* ================= SETUP WIZARD CONSTANTS ================= */

const SETUP_CATEGORIES = {
  statistics: {
    name: "📊 Server Statistics",
    description: "Voice channels untuk statistik member real-time",
    channels: [
      { key: "STATS_TOTAL_CH_ID", name: "⬩➤┃👥┃Total Member: 0", type: ChannelType.GuildVoice },
      { key: "STATS_MAN_CH_ID", name: "⬩➤┃👦┃Total Man: 0", type: ChannelType.GuildVoice },
      { key: "STATS_WOMAN_CH_ID", name: "⬩➤┃👧┃Total Woman: 0", type: ChannelType.GuildVoice },
      { key: "STATS_BOT_CH_ID", name: "⬩➤┃🤖┃Total Bot FiiCruzh: 0", type: ChannelType.GuildVoice },
      { key: "STATS_ONLINE_CH_ID", name: "⬩➤┃🟢┃Total Online: 0", type: ChannelType.GuildVoice }
    ],
    categoryKey: "STATS_CATEGORY_ID",
    categoryName: "📊 SERVER STATISTICS"
  },
  main: {
    name: "︱𝕄𝕒𝕚𝕟︱",
    description: "Channel utama (Welcome, Verify, Rules, Role, Chat, dll)",
    channels: [
      { key: "WELCOME_CHANNEL", name: "╭➤👋ㆍ𝙒𝙚𝙡𝙘𝙤𝙢𝙚-𝙂𝙤𝙤𝙙𝘽𝙮𝙚", type: ChannelType.GuildText },
      { key: "VERIFY_CHANNEL_ID", name: "┃✅ㆍ𝙑𝙚𝙧𝙞𝙛𝙞𝙘𝙖𝙩𝙞𝙤𝙣", type: ChannelType.GuildText },
      { key: "RULES_CHANNEL_ID", name: "┃🛡️ㆍ𝙍𝙪𝙡𝙚𝙨", type: ChannelType.GuildText },
      { key: "SOCIAL_CHANNEL_ID", name: "┃👑ㆍ𝙎𝙤𝙘𝙞𝙖𝙡𝙈𝙚𝙙𝙞𝙖-𝙁𝙞𝙞𝘾𝙧𝙪𝙯𝙝", type: ChannelType.GuildText },
      { key: "ROLE_CHANNEL_ID", name: "┃🎭ㆍ𝙍𝙤𝙡𝙚", type: ChannelType.GuildText },
      { key: "CHAT_CHANNEL_ID", name: "┃📝ㆍ𝙍𝙤𝙤𝙢-𝘾𝙝𝙖𝙩", type: ChannelType.GuildText },
      { key: "BOOST_CHANNEL_ID", name: "┃🚀ㆍ𝘽𝙤𝙨𝙩-𝙎𝙚𝙧𝙫𝙚𝙧", type: ChannelType.GuildText },
      { key: "LEVEL_UP_CHANNEL_ID", name: "╰➤🆙ㆍ𝙇𝙚𝙫𝙚𝙡-𝙐𝙋", type: ChannelType.GuildText },
      { key: "SUGGESTION_CHANNEL_ID", name: "┃💡ㆍ𝘾𝙤𝙣𝙩𝙚𝙣𝙩-𝙎𝙪𝙜𝙜𝙚𝙨𝙩𝙞𝙤𝙣", type: ChannelType.GuildText }
    ],
    categoryKey: "MAIN_CATEGORY_ID",
    categoryName: "︱𝕄𝕒𝕚𝕟︱"
  },
  ticket: {
    name: "𝕋𝕚𝕔𝕜et-𝕊𝕦𝕡𝕡𝕠𝕣𝕥",
    description: "Sistem tiket support untuk member",
    channels: [
      { key: "TICKET_CHANNEL_ID", name: "⬩➤┃🎟️ㆍ𝙏𝙞𝙘𝙠𝙚𝙩-𝙎𝙮𝙨𝙩𝙚𝙢", type: ChannelType.GuildText }
    ],
    categoryKey: "TICKET_CATEGORY_ID",
    categoryName: "𝕋𝕚𝕔𝕜et-𝕊𝕦𝕡𝕡𝕠𝕣𝕥"
  },
  admin: {
    name: "ℙ𝕒𝕟𝕖𝕝-𝔸𝕕𝕞𝕚𝕟",
    description: "Panel admin dan log system (hanya staff)",
    channels: [
      { key: "ADMIN_PANEL_CHANNEL_ID", name: "⬩➤┃🔰┃ㆍ𝙋𝙖𝙣𝙚𝙡-𝘼𝙙𝙢𝙞𝙣", type: ChannelType.GuildText },
      { key: "LOG_CHANNEL_ID", name: "⬩➤┃📋︱𝙇𝙤𝙜-𝙎𝙮𝙨𝙩𝙚𝙢", type: ChannelType.GuildText }
    ],
    categoryKey: "ADMIN_CATEGORY_ID",
    categoryName: "ℙ𝕒𝕟𝕖𝕝-𝔸𝕕𝕞𝕚𝕟"
  },
  clan: {
    name: "📋 Clan Member",
    description: "Panel member, list member, dan log member",
    channels: [
      { key: "MEMBER_PANEL_CHANNEL_ID", name: "⬩➤┃📁┃ㆍ𝙋𝙖𝙣𝙚𝙡-𝙈𝙚𝙢𝙗𝙚𝙧", type: ChannelType.GuildText },
      { key: "MEMBER_LIST_CHANNEL_ID", name: "⬩➤┃📜┃ㆍ𝙇𝙞𝙨𝙩-𝙈𝙚𝙢𝙗𝙚𝙧", type: ChannelType.GuildText },
      { key: "MEMBER_LOG_CHANNEL_ID", name: "⬩➤┃📋┃ㆍ𝙇𝙤𝙜-𝙈𝙚𝙢𝙗𝙚𝙧", type: ChannelType.GuildText }
    ],
    categoryKey: "MEMBER_CATEGORY_ID",
    categoryName: "ℂ𝕝𝕒𝕟-𝕄𝕖𝕞𝕓𝕖𝕣"
  }
};

const ROLE_STEPS = [
  { key: "verify", label: "✅ Verify Role", description: "Role yang diberikan setelah verifikasi" },
  { key: "member", label: "📋 Member Role", description: "Role untuk member yang sudah Input Data" },
  { key: "man", label: "💪 Man Role", description: "Role untuk Laki-laki" },
  { key: "woman", label: "🌸 Woman Role", description: "Role untuk Perempuan" },
  { key: "owner", label: "👑 Owner Role", description: "Role untuk Owner server" },
  { key: "staff", label: "🛡️ Staff Role", description: "Role untuk Staff/Moderator" },
  { key: "guard", label: "⚔️ Guard Role", description: "Role untuk Guard/Security" },
  { key: "admin", label: "🔧 Admin Role", description: "Role untuk Administrator" },
  { key: "dev", label: "🔰 Dev Role", description: "Role untuk Developer" }
];

/* ================= SETUP WIZARD FUNCTIONS ================= */

function detectExistingConfig(guildId) {
  const config = getGuildConfig(guildId);
  if (!config) return { exists: false };
  return {
    exists: true,
    channelCount: Object.keys(config).filter(k => k.includes("CHANNEL") || k.includes("_CH_")).length,
    roleCount: Object.keys(config).filter(k => k.includes("ROLE")).length,
    hasStats: !!config.STATS_CATEGORY_ID,
    hasTicket: !!config.TICKET_CATEGORY_ID,
    hasAdmin: !!config.ADMIN_PANEL_CHANNEL_ID
  };
}

async function deployPanels(guild, config, channels) {
  const results = { success: [], failed: [] };

  // --- VERIFICATION PANEL ---
  if (channels.VERIFY_CHANNEL_ID) {
    try {
      const verifyCh = guild.channels.cache.get(channels.VERIFY_CHANNEL_ID);
      if (verifyCh) {
        const vEmbed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle("🔒 Server Verification")
          .setDescription(
            "👋 **Welcome to our Server!**\n\n" +
            "To ensure the safety and quality of our community, we require all members to verify themselves.\n\n" +
            "**By clicking the button below, you agree to:**\n" +
            "• Follow all server rules and guidelines.\n" +
            "• Respect other members and staff.\n" +
            "• No spamming or NSFW content.\n\n" +
            "Click the ✅ **Verify** button to gain full access!"
          )
          .setThumbnail(guild.iconURL())
          .setFooter({ text: "Verification System by FiiCruzh", iconURL: guild.iconURL() })
          .setTimestamp();
        const vRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("verify_button").setLabel("✅ Verify Me").setStyle(ButtonStyle.Success)
        );
        await verifyCh.send({ embeds: [vEmbed], components: [vRow] });
        results.success.push("Verification Panel");
      }
    } catch (e) { results.failed.push("Verification Panel: " + e.message); }
  }

  // --- ROLE PANEL ---
  if (channels.ROLE_CHANNEL_ID) {
    try {
      const roleCh = guild.channels.cache.get(channels.ROLE_CHANNEL_ID);
      if (roleCh) {
        const rEmbed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("✨ Select Your Identity")
          .setDescription(
            "Welcome to the identity selection! Please choose your role below to personalize your experience in our community.\n\n" +
            "📋 **MEMBER** - Ambil role member (wajib Input Data dulu)\n" +
            "💪 **MAN** - Identify as male\n" +
            "🌸 **WOMAN** - Identify as female\n" +
            "👑 **ADMIN** - Request for administrative role (requires review)"
          )
          .setThumbnail(guild.iconURL())
          .setFooter({ text: "FiiCruzh Premium System", iconURL: guild.iconURL() })
          .setTimestamp();
        const rRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("member_role").setLabel("MEMBER 📋").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("man_role").setLabel("MAN 💪").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("woman_role").setLabel("WOMAN 🌸").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("admin_role").setLabel("ADMIN 👑").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("profile_button").setLabel("MY PROFILE 👤").setStyle(ButtonStyle.Success)
        );
        await roleCh.send({ embeds: [rEmbed], components: [rRow] });
        results.success.push("Role Panel");
      }
    } catch (e) { results.failed.push("Role Panel: " + e.message); }
  }

  // --- RULES PANEL ---
  if (channels.RULES_CHANNEL_ID) {
    try {
      const rulesCh = guild.channels.cache.get(channels.RULES_CHANNEL_ID);
      if (rulesCh) {
        const rulesEmbed = new EmbedBuilder()
          .setColor("#F1C40F")
          .setTitle("📜 Server Guidelines & Information")
          .setDescription(
            "Welcome to **FiiCruzh Official Server**! To maintain a safe and enjoyable community, please read our rules and role information by clicking the buttons below.\n\n" +
            "✅ **Step 1**             🔍 **Step 2**\n" +
            "Read the rules carefully.     Check role information."
          )
          .setThumbnail(guild.iconURL())
          .setFooter({ text: "Community Standards by FiiCruzh", iconURL: guild.iconURL() })
          .setTimestamp();
        const rulesRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("rules_display").setLabel("VIEW RULES 📋").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("role_info_display").setLabel("ROLE INFO 🛡️").setStyle(ButtonStyle.Secondary)
        );
        const rulesMsg = await rulesCh.send({ embeds: [rulesEmbed], components: [rulesRow] });
        config.MSG_RULES_ID = rulesMsg.id;
        results.success.push("Rules Panel");
      }
    } catch (e) { results.failed.push("Rules Panel: " + e.message); }
  }

  // --- SOCIAL PANEL ---
  if (channels.SOCIAL_CHANNEL_ID) {
    try {
      const socialCh = guild.channels.cache.get(channels.SOCIAL_CHANNEL_ID);
      if (socialCh) {
        const fullConfig = getGuildConfig(guild.id) || config;
        const buttons = getSocialButtons(fullConfig);
        const description = fullConfig.SOCIAL_DESCRIPTION || DEFAULT_SOCIAL_DESCRIPTION;

        const sEmbed = new EmbedBuilder()
          .setColor("#E1306C")
          .setTitle("🌐 Connect With Us")
          .setDescription(description)
          .setThumbnail(guild.iconURL())
          .setFooter({ text: "Official Social Hub", iconURL: guild.iconURL() })
          .setTimestamp();

        const components = [];
        if (buttons.length > 0) {
          const sRow = new ActionRowBuilder();
          for (const btn of buttons.slice(0, 5)) {
            sRow.addComponents(new ButtonBuilder().setLabel(btn.label).setStyle(ButtonStyle.Link).setURL(btn.url));
          }
          components.push(sRow);
        }

        const socialMsg = await socialCh.send({ embeds: [sEmbed], components });
        config.MSG_SOCIAL_ID = socialMsg.id;
        results.success.push("Social Panel");
      }
    } catch (e) { results.failed.push("Social Panel: " + e.message); }
  }

  // --- TICKET PANEL ---
  if (channels.TICKET_CHANNEL_ID) {
    try {
      const ticketCh = guild.channels.cache.get(channels.TICKET_CHANNEL_ID);
      if (ticketCh) {
        const tEmbed = new EmbedBuilder()
          .setColor("#3498DB")
          .setTitle("🎫 Support & Inquiry Center | Pusat Bantuan")
          .setDescription(
            "Butuh bantuan? Pilih kategori tiket di bawah untuk membuka tiket support.\n\n" +
            "🐛 **Bug Report** — Laporkan bug atau masalah teknis\n" +
            "💬 **General** — Pertanyaan umum atau bantuan\n" +
            "🤝 **Partnership** — Ajukan kerjasama/partnership\n" +
            "📝 **Other** — Lainnya\n\n" +
            "🕒 **Response Time:** Biasanya dalam 24 jam\n" +
            "🔒 **Privacy:** Hanya kamu dan staff yang bisa melihat tiket"
          )
          .setThumbnail(guild.iconURL())
          .setFooter({ text: "Official FiiCruzh Support", iconURL: guild.iconURL() })
          .setTimestamp();
        const tRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("ticket_category_select")
            .setPlaceholder("📋 Pilih kategori tiket...")
            .addOptions([
              { label: "🐛 Bug Report", value: "bug", description: "Laporkan bug atau masalah teknis" },
              { label: "💬 General Support", value: "general", description: "Pertanyaan umum atau bantuan" },
              { label: "🤝 Partnership", value: "partnership", description: "Ajukan kerjasama" },
              { label: "📝 Other", value: "other", description: "Kategori lainnya" }
            ])
        );
        await ticketCh.send({ embeds: [tEmbed], components: [tRow] });
        results.success.push("Ticket Panel");
      }
    } catch (e) { results.failed.push("Ticket Panel: " + e.message); }
  }

  // --- ADMIN PANEL ---
  if (channels.ADMIN_PANEL_CHANNEL_ID) {
    try {
      const adminPanelCh = guild.channels.cache.get(channels.ADMIN_PANEL_CHANNEL_ID);
      if (adminPanelCh) {
        const aEmbed = new EmbedBuilder()
          .setColor("#2C2F33")
          .setTitle("🛠️ Admin Control Panel")
          .setDescription(
            "Gunakan tombol di bawah untuk mengelola server secara dinamis.\n\n" +
            "🛡️ **Moderation**: Mute, Warn, Kick, Ban.\n" +
            "🎭 **Role Management**: Create Role, Add/Remove Member Role.\n" +
            "⚙️ **Configuration**: Edit Rules, Social Media Links."
          )
          .setThumbnail(guild.iconURL())
          .setTimestamp();
        const aRow1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ctrl_mute").setLabel("Mute").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("ctrl_unmute").setLabel("Unmute").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("ctrl_warn").setLabel("Warn").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("ctrl_kick").setLabel("Kick").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("ctrl_ban").setLabel("Ban").setStyle(ButtonStyle.Danger)
        );
        const aRow2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ctrl_create_role").setLabel("Create Role 🎭").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("ctrl_manage_role").setLabel("Manage Role 👤").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("ctrl_edit_config").setLabel("Edit Config ⚙️").setStyle(ButtonStyle.Success)
        );
        await adminPanelCh.send({ embeds: [aEmbed], components: [aRow1, aRow2] });
        results.success.push("Admin Panel");
      }
    } catch (e) { results.failed.push("Admin Panel: " + e.message); }
  }

  // --- MEMBER PANEL (Clan) ---
  if (channels.MEMBER_PANEL_CHANNEL_ID) {
    try {
      const memberPanelCh = guild.channels.cache.get(channels.MEMBER_PANEL_CHANNEL_ID);
      if (memberPanelCh) {
        const guildId = guild.id;
        const guildData = getGuildMembers(guildId);

        // Delete old panel if exists
        if (guildData.panelMessageId && guildData.panelChannelId) {
          const oldCh = guild.channels.cache.get(guildData.panelChannelId);
          if (oldCh) {
            const oldMsg = await oldCh.messages.fetch(guildData.panelMessageId).catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => {});
          }
        }

        const pmEmbed = new EmbedBuilder()
          .setColor("#2C2F33")
          .setTitle("📁 PANEL MEMBER FII")
          .setDescription("Gunakan tombol di bawah\n⏳ Limit 1 jam 1x")
          .setTimestamp();
        const pmRow1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("pm_input_data").setLabel("Input Data").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("pm_change_name").setLabel("Change Name").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("pm_input_manual").setLabel("Input Manual").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("pm_search").setLabel("Search").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("pm_edit").setLabel("Edit").setStyle(ButtonStyle.Secondary)
        );
        const pmRow2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("pm_delete").setLabel("🗑️ Delete").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("pm_title").setLabel("📝 Title").setStyle(ButtonStyle.Secondary)
        );
        const panelMsg = await memberPanelCh.send({ embeds: [pmEmbed], components: [pmRow1, pmRow2] });
        guildData.panelMessageId = panelMsg.id;
        guildData.panelChannelId = memberPanelCh.id;

        // Set list channel and initialize list embed
        if (channels.MEMBER_LIST_CHANNEL_ID) {
          guildData.channelId = channels.MEMBER_LIST_CHANNEL_ID;
        }
        saveMembers();

        // Initialize member list embed
        await updateMemberListEmbed(guild, guildId);

        results.success.push("Member Panel");
      }
    } catch (e) { results.failed.push("Member Panel: " + e.message); }
  }

  return results;
}

/* ================= BOT READY ================= */

client.once(Events.ClientReady, async () => {
  console.log(`🚀 Bot Online: ${client.user.tag}`);
  loadDatabases();

  try {
    if (process.env.BACKGROUND_URL) {
      cachedBackground = await Canvas.loadImage(process.env.BACKGROUND_URL);
      console.log("✅ Background image cached and ready.");
    }
  } catch (err) {
    console.log("❌ Failed to cache background image:", err);
  }

  const updatePresence = () => {
    const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    client.user.setActivity(`${totalMembers} Members | FiiCruzh`, { type: 3 });
  };
  updatePresence();
  setInterval(updatePresence, 60000);

  // Register Slash Commands
  const setupCommand = {
    name: 'fiicruzh',
    description: 'Setup sistem FiiCruzh Premium untuk server ini (Manual/Automatic)',
    options: []
  };

  const rankCommand = {
    name: 'rank',
    description: 'Lihat rank dan level kamu saat ini',
    options: [
      { name: 'user', description: 'Lihat rank user lain (opsional)', type: 6, required: false }
    ]
  };

  const leaderboardCommand = {
    name: 'leaderboard',
    description: 'Lihat top 10 member dengan level tertinggi',
    options: []
  };

  try {
    await client.application.commands.set([setupCommand, rankCommand, leaderboardCommand]);
    console.log("✅ Global Slash Commands registered.");
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }

  updateStats();
  setInterval(() => xpCooldown.clear(), 3600000);
  setInterval(saveLevels, 300000);

  // Cleanup stale setup sessions
  setInterval(() => {
    const now = Date.now();
    for (const [guildId, session] of setupSessions.entries()) {
      if (now - session.startedAt > 300000) setupSessions.delete(guildId);
    }
  }, 60000);

  setInterval(() => {
    const memory = process.memoryUsage().rss / 1024 / 1024;
    console.log(`💓 Heartbeat: Bot is healthy | Memory: ${memory.toFixed(2)} MB | Uptime: ${Math.floor(process.uptime() / 60)}m`);
  }, 600000);
});

/* ================= REAL-TIME STATS UPDATER ================= */
let statsTimeout = null;
const triggerStatsUpdate = () => {
  if (statsTimeout) return;
  statsTimeout = setTimeout(() => {
    updateStats();
    statsTimeout = null;
  }, 10000);
};

client.on(Events.GuildMemberAdd, () => triggerStatsUpdate());
client.on(Events.GuildMemberRemove, () => triggerStatsUpdate());
client.on(Events.PresenceUpdate, (oldP, newP) => {
  if (oldP?.status !== newP?.status) triggerStatsUpdate();
});

/* ================= SERVER STATS SYSTEM ================= */
const updateStats = async (specificGuild = null) => {
  const guilds = specificGuild ? [specificGuild] : Array.from(client.guilds.cache.values());
  for (const guild of guilds) {
    const config = getGuildConfig(guild.id);
    if (!config) continue;
    try {
      if (guild.memberCount > guild.members.cache.size) {
        await guild.members.fetch().catch(() => {});
      }
      const totalMembers = guild.memberCount;
      const members = guild.members.cache;
      const totalBots = members.filter(m => m.user.bot).size;
      const totalOnline = members.filter(m =>
        m.presence?.status === "online" || m.presence?.status === "dnd" || m.presence?.status === "idle"
      ).size;
      const totalMan = members.filter(m => config.MAN_ROLE_ID && m.roles.cache.has(config.MAN_ROLE_ID)).size;
      const totalWoman = members.filter(m => config.WOMAN_ROLE_ID && m.roles.cache.has(config.WOMAN_ROLE_ID)).size;

      const statsMap = {
        [config.STATS_TOTAL_CH_ID]: `⬩➤┃👥┃Total Member: ${totalMembers.toLocaleString()}`,
        [config.STATS_MAN_CH_ID]: `⬩➤┃👦┃Total Man: ${totalMan.toLocaleString()}`,
        [config.STATS_WOMAN_CH_ID]: `⬩➤┃👧┃Total Woman: ${totalWoman.toLocaleString()}`,
        [config.STATS_BOT_CH_ID]: `⬩➤┃🤖┃Total Bot FiiCruzh: ${totalBots.toLocaleString()}`,
        [config.STATS_ONLINE_CH_ID]: `⬩➤┃🟢┃Total Online: ${totalOnline.toLocaleString()}`
      };

      for (const [id, name] of Object.entries(statsMap)) {
        if (!id) continue;
        const channel = guild.channels.cache.get(id);
        if (channel && channel.name !== name) {
          if (!guild.members.me.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) continue;
          await channel.setName(name).catch(e => {
            if (e.code !== 50035 && e.code !== 50013 && e.code !== 429) logError(`Stats Update (${id})`, e, guild.id);
          });
        }
      }
    } catch (err) {
      logError("UpdateStats", err, guild.id);
    }
  }
};

function logError(context, err, guildId = "Global") {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] [${guildId}] [${context}] Error: ${err.message || err}`;
  console.error(msg);
  try { fs.appendFileSync("./error.log", msg + "\n"); } catch { }
}

/* ================= UTILS ================= */

function getConfig(guildId, key) {
  const config = getGuildConfig(guildId);
  if (config && config[key]) return config[key];
  return process.env[key];
}

function calculateTotalXP(level, currentXP) {
  let total = currentXP;
  for (let i = 1; i < level; i++) {
    total += 5 * (i ** 2) + 50 * i + 100;
  }
  return total;
}

function generateProgressBar(progress, length) {
  const filled = Math.round(progress * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function getTicketDuration(createdAt) {
  const diff = Date.now() - createdAt.getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/* ================= SOCIAL MEDIA HELPERS ================= */

const MAX_SOCIAL_BUTTONS = 5;
const DEFAULT_SOCIAL_DESCRIPTION =
  "Stay updated and support our journey by following our official social media channels!\n\n" +
  "📸 **Instagram**        🎬 **TikTok**        🎥 **YouTube**\n" +
  "Daily updates & stories    Short & fun content    Full length videos";

function isValidURL(str) {
  return /^https?:\/\/.+/.test(str);
}

function getSocialButtons(config) {
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

async function updateSocialPanel(guild, config) {
  const socialChId = config.SOCIAL_CHANNEL_ID;
  if (!socialChId) return;
  const channel = guild.channels.cache.get(socialChId);
  if (!channel) return;

  const buttons = getSocialButtons(config);
  const description = config.SOCIAL_DESCRIPTION || DEFAULT_SOCIAL_DESCRIPTION;

  const embed = new EmbedBuilder()
    .setColor("#E1306C")
    .setTitle("🌐 Connect With Us")
    .setDescription(description)
    .setThumbnail(guild.iconURL())
    .setFooter({ text: "Official Social Hub", iconURL: guild.iconURL() })
    .setTimestamp();

  const components = [];
  if (buttons.length > 0) {
    const row = new ActionRowBuilder();
    for (const btn of buttons.slice(0, 5)) {
      row.addComponents(new ButtonBuilder().setLabel(btn.label).setStyle(ButtonStyle.Link).setURL(btn.url));
    }
    components.push(row);
  }

  const socialMsgId = config.MSG_SOCIAL_ID;
  if (socialMsgId) {
    const msg = await channel.messages.fetch(socialMsgId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed], components });
      return;
    }
  }
  // Message not found, create new
  const newMsg = await channel.send({ embeds: [embed], components });
  config.MSG_SOCIAL_ID = newMsg.id;
  saveGuildConfig(guild.id, { MSG_SOCIAL_ID: newMsg.id });
}

async function sendLog(guild, embed) {
  const logChannelId = getConfig(guild.id, "LOG_CHANNEL_ID");
  const logChannel = guild.channels.cache.get(logChannelId);
  if (logChannel) logChannel.send({ embeds: [embed] }).catch(() => { });
}

async function getAIGreeting() {
  try {
    const res = await axios.get(process.env.AI_API || "https://api.example.com/greeting");
    return res.data.content;
  } catch { return "Welcome to our community!"; }
}

/* ================= ADVANCED LOGGING (EDIT/DELETE) ================= */

client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
  if (!oldMsg.author || oldMsg.author.bot || oldMsg.content === newMsg.content) return;
  sendLog(oldMsg.guild, new EmbedBuilder()
    .setColor("Yellow")
    .setTitle("📝 Message Edited")
    .setThumbnail(oldMsg.author.displayAvatarURL())
    .addFields(
      { name: "Author", value: `${oldMsg.author} (\`${oldMsg.author.id}\`)`, inline: true },
      { name: "Channel", value: `${oldMsg.channel}`, inline: true },
      { name: "Before", value: `\`\`\`${oldMsg.content || "None"}\`\`\`` },
      { name: "After", value: `\`\`\`${newMsg.content || "None"}\`\`\`` }
    )
    .setTimestamp()
  );
});

client.on(Events.MessageDelete, async message => {
  if (!message.author || message.author.bot) return;
  const hasMention = message.mentions.users.size > 0 || message.mentions.roles.size > 0;
  sendLog(message.guild, new EmbedBuilder()
    .setColor(hasMention ? "Red" : "DarkRed")
    .setTitle(hasMention ? "👻 Ghost Ping Detected!" : "🗑️ Message Deleted")
    .setThumbnail(message.author?.displayAvatarURL())
    .addFields(
      { name: "Author", value: `${message.author || "Unknown"}`, inline: true },
      { name: "Channel", value: `${message.channel}`, inline: true },
      { name: "Content", value: `\`\`\`${message.content || "None"}\`\`\`` }
    )
    .setFooter({ text: hasMention ? "A mention was deleted in this message." : "Audit Log" })
    .setTimestamp()
  );
});

/* ================= WELCOME IMAGE ================= */

async function createWelcome(member) {
  const canvas = Canvas.createCanvas(1024, 450);
  const ctx = canvas.getContext("2d");
  if (cachedBackground) { ctx.drawImage(cachedBackground, 0, 0, canvas.width, canvas.height); }
  else { ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(512, 160, 105, 0, Math.PI * 2, true);
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 10; ctx.stroke();
  ctx.closePath(); ctx.clip();
  const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: "png", size: 256 }));
  ctx.drawImage(avatar, 407, 55, 210, 210);
  ctx.restore();
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)"; ctx.shadowBlur = 10;
  ctx.font = "bold 60px Sans"; ctx.fillText("WELCOME", 512, 330);
  ctx.font = "45px Sans"; ctx.fillText(member.user.username.toUpperCase(), 512, 385);
  ctx.font = "30px Sans"; ctx.fillStyle = "#f1c40f";
  ctx.fillText(`YOU ARE OUR #${member.guild.memberCount} MEMBER`, 512, 430);
  return new AttachmentBuilder(canvas.toBuffer(), { name: "welcome.png" });
}

/* ================= GOODBYE IMAGE ================= */

async function createGoodbye(member) {
  const canvas = Canvas.createCanvas(1024, 450);
  const ctx = canvas.getContext("2d");
  if (cachedBackground) { ctx.drawImage(cachedBackground, 0, 0, canvas.width, canvas.height); }
  else { ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(512, 160, 105, 0, Math.PI * 2, true);
  ctx.strokeStyle = "#ff4757"; ctx.lineWidth = 10; ctx.stroke();
  ctx.closePath(); ctx.clip();
  const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: "png", size: 256 }));
  ctx.drawImage(avatar, 407, 55, 210, 210);
  ctx.restore();
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)"; ctx.shadowBlur = 10;
  ctx.font = "bold 60px Sans"; ctx.fillText("GOODBYE", 512, 330);
  ctx.font = "45px Sans"; ctx.fillText(member.user.username.toUpperCase(), 512, 385);
  ctx.font = "30px Sans"; ctx.fillStyle = "#ff4757";
  ctx.fillText("WE HOPE TO SEE YOU AGAIN!", 512, 430);
  return new AttachmentBuilder(canvas.toBuffer(), { name: "goodbye.png" });
}

/* ================= LEVEL UP CARD ================= */

async function createLevelUpCard(member, level) {
  const canvas = Canvas.createCanvas(1024, 450);
  const ctx = canvas.getContext("2d");
  if (cachedBackground) { ctx.drawImage(cachedBackground, 0, 0, canvas.width, canvas.height); }
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(512, 150, 100, 0, Math.PI * 2, true);
  ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 12;
  ctx.shadowColor = "#f1c40f"; ctx.shadowBlur = 20;
  ctx.stroke(); ctx.closePath(); ctx.clip();
  const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: "png", size: 256 }));
  ctx.drawImage(avatar, 412, 50, 200, 200);
  ctx.restore();
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
  ctx.font = "bold 60px Sans"; ctx.fillText("LEVEL UP!", 512, 310);
  ctx.font = "40px Sans"; ctx.fillStyle = "#f1c40f"; ctx.fillText(`LEVEL ${level}`, 512, 370);
  ctx.font = "25px Sans"; ctx.fillStyle = "#ffffff";
  ctx.fillText(member.user.username.toUpperCase(), 512, 410);
  return new AttachmentBuilder(canvas.toBuffer(), { name: "levelup.png" });
}

/* ================= PROFILE CARD ================= */

async function createProfileCard(member) {
  const canvas = Canvas.createCanvas(800, 400);
  const ctx = canvas.getContext("2d");
  const userData = levelsCache[member.id] || { xp: 0, level: 1 };
  const gradient = ctx.createLinearGradient(0, 0, 800, 400);
  gradient.addColorStop(0, "#1a1a1a"); gradient.addColorStop(1, "#2d3436");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 800, 400);
  if (cachedBackground) { ctx.globalAlpha = 0.2; ctx.drawImage(cachedBackground, 0, 0, 800, 400); ctx.globalAlpha = 1.0; }
  ctx.save();
  ctx.beginPath();
  ctx.arc(150, 200, 100, 0, Math.PI * 2, true);
  ctx.strokeStyle = "#5865F2"; ctx.lineWidth = 10; ctx.stroke();
  ctx.closePath(); ctx.clip();
  const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: "png", size: 256 }));
  ctx.drawImage(avatar, 50, 100, 200, 200);
  ctx.restore();
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)"; ctx.shadowBlur = 10;
  ctx.font = "bold 45px Sans"; ctx.fillText(member.user.username.toUpperCase(), 300, 80);
  ctx.font = "22px Sans"; ctx.fillStyle = "#b9bbbe";
  const joinedDate = member.joinedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(`Joined: ${joinedDate}`, 300, 115);
  ctx.fillStyle = "#f1c40f"; ctx.font = "bold 30px Sans";
  ctx.fillText(`LEVEL ${userData.level}`, 300, 160);
  ctx.fillStyle = "#ffffff"; ctx.font = "20px Sans";
  const nextXP = 5 * (userData.level ** 2) + 50 * userData.level + 100;
  ctx.fillText(`XP: ${userData.xp} / ${nextXP}`, 300, 190);
  ctx.fillStyle = "#484b4e"; ctx.beginPath(); ctx.roundRect(300, 205, 400, 20, 10); ctx.fill();
  const progress = Math.min(userData.xp / nextXP, 1);
  const progressGradient = ctx.createLinearGradient(300, 0, 700, 0);
  progressGradient.addColorStop(0, "#5865F2"); progressGradient.addColorStop(1, "#9b59b6");
  ctx.fillStyle = progressGradient; ctx.beginPath(); ctx.roundRect(300, 205, 400 * progress, 20, 10); ctx.fill();
  ctx.fillStyle = "#5865F2"; ctx.font = "bold 30px Sans";
  ctx.fillText(`Member #${member.guild.memberCount}`, 300, 260);
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 22px Sans"; ctx.fillText("ROLES:", 300, 300);
  ctx.font = "18px Sans"; ctx.fillStyle = "#ffffff";
  const roles = member.roles.cache.filter(r => r.name !== "@everyone").map(r => r.name).slice(0, 4);
  const rolesText = roles.join(", ") + (member.roles.cache.size > 5 ? " ..." : "");
  ctx.fillText(rolesText, 300, 330);
  ctx.font = "italic 16px Sans"; ctx.fillStyle = "#7289da";
  ctx.fillText(`Total Roles: ${member.roles.cache.size - 1}`, 300, 365);
  return new AttachmentBuilder(canvas.toBuffer(), { name: "profile.png" });
}

/* ================= MEMBER JOIN ================= */

client.on(Events.GuildMemberAdd, async member => {
  // === ANTI-RAID CHECK ===
  const raidDetected = checkRaid(member.guild.id);
  const raidData = raidTracker.get(member.guild.id);

  if (raidDetected) {
    // Raid detected - notify staff and kick new joins
    sendLog(member.guild, new EmbedBuilder()
      .setColor("Red").setTitle("🚨 RAID DETECTED!")
      .setDescription(
        `**${RAID_THRESHOLD}+ members joined dalam ${RAID_WINDOW / 1000} detik!**\n\n` +
        `🔒 Server dalam mode **LOCKDOWN** selama ${RAID_LOCKDOWN_DURATION / 1000} detik.\n` +
        `Member baru akan otomatis di-kick selama lockdown aktif.`
      )
      .setTimestamp());
  }

  if (raidData?.lockdown) {
    // During lockdown - kick new members and log
    try {
      await member.kick("Anti-Raid: Lockdown aktif");
      sendLog(member.guild, new EmbedBuilder()
        .setColor("Orange").setTitle("🛡️ Anti-Raid Kick")
        .setDescription(`${member.user.tag} (\`${member.id}\`) di-kick karena lockdown aktif.`)
        .setTimestamp());
    } catch { }
    return; // Don't process further
  }

  // Normal join flow
  const unverifiedRole = member.guild.roles.cache.get(getConfig(member.guild.id, "UNVERIFIED_ROLE_ID"));
  if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => { });

  sendLog(member.guild, new EmbedBuilder()
    .setColor("Blue").setTitle("📥 Member Joined")
    .setDescription(`${member} (\`${member.id}\`) joined the server.`)
    .setThumbnail(member.user.displayAvatarURL()).setTimestamp());

  const welcomeChannelId = getConfig(member.guild.id, "WELCOME_CHANNEL");
  const channel = member.guild.channels.cache.get(welcomeChannelId);
  if (channel) {
    const greeting = await getAIGreeting();
    const customWelcome = getConfig(member.guild.id, "WELCOME_MESSAGE");
    const image = await createWelcome(member);
    const embed = new EmbedBuilder()
      .setColor("#FF00FF").setTitle("🚀 New Arrival!")
      .setDescription(
        (customWelcome ? `${customWelcome}\n\n` : `Welcome to our server, ${member}!\n\n`) +
        `✨ **AI Inspiration:**\n*"${greeting}"*\n\n` +
        `📊 **Member Stats:**\nTotal Members: **${member.guild.memberCount}**\nRank: **#${member.guild.memberCount}**`
      )
      .setImage("attachment://welcome.png")
      .setFooter({ text: "Enjoy your stay!", iconURL: member.guild.iconURL() }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("📝 Verification").setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${member.guild.id}/${getConfig(member.guild.id, "VERIFY_CHANNEL_ID")}`),
      new ButtonBuilder().setLabel("📜 Server Rules").setStyle(ButtonStyle.Secondary).setCustomId("show_rules")
    );
    channel.send({ content: `Hey ${member}, welcome to **${member.guild.name}**!`, embeds: [embed], files: [image], components: [row] });
  }

  member.send({
    embeds: [new EmbedBuilder().setColor("#FF00FF").setTitle(`Welcome to ${member.guild.name}! ✨`)
      .setDescription(`Hi ${member.user.username}! We're so glad you're here.\n\n🔒 **Don't forget to verify** in the verification channel to get full access to the server!\n\nEnjoy your stay and have fun!`)
      .setThumbnail(member.guild.iconURL()).setFooter({ text: "Official Server Welcome" })]
  }).catch(() => {});
});

/* ================= GOODBYE ================= */

client.on(Events.GuildMemberRemove, async member => {
  const welcomeChannelId = getConfig(member.guild.id, "WELCOME_CHANNEL");
  const channel = member.guild.channels.cache.get(welcomeChannelId);
  if (!channel) return;
  const image = await createGoodbye(member);
  const embed = new EmbedBuilder().setColor("Red").setTitle("👋 Member Left")
    .setDescription(`${member.user.tag} keluar dari server`).setImage("attachment://goodbye.png").setTimestamp();
  channel.send({ embeds: [embed], files: [image] });
});

/* ================= XP SYSTEM & AUTO-MOD ================= */

const suggestVoters = new Map();
const badWords = ["kasar1", "kasar2", "anjing", "babi", "tolol", "goblok"];
const phishingRegex = /(discord\.gift|free-nitro|nitro-gift|steam-community|discord-nitro|dlscord)/i;
const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/.+/i;
const spamMap = new Map();

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild || !message.member) return;
  const guildId = message.guild.id;
  const config = getGuildConfig(guildId);

  // ANTI-INVITE
  if (inviteRegex.test(message.content) && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.delete().catch(() => { });
    const warnMsg = await message.channel.send(`⚠️ ${message.author}, dilarang mengirim link invite server lain!`);
    setTimeout(() => warnMsg.delete().catch(() => { }), 5000);
    return sendLog(message.guild, new EmbedBuilder().setColor("Red").setTitle("🛡️ Anti-Invite Triggered")
      .setDescription(`User: ${message.author}\nAction: Message Deleted\nContent: \`${message.content}\``).setTimestamp());
  }

  // ANTI-SPAM
  const now = Date.now();
  const userSpamData = spamMap.get(message.author.id) || { count: 0, lastMsg: now };
  if (now - userSpamData.lastMsg < 5000) { userSpamData.count++; } else { userSpamData.count = 1; }
  userSpamData.lastMsg = now;
  spamMap.set(message.author.id, userSpamData);
  if (userSpamData.count > 5 && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.delete().catch(() => { });
    const spamWarn = await message.channel.send(`⏳ ${message.author}, jangan spam! Tunggu sebentar.`);
    setTimeout(() => spamWarn.delete().catch(() => { }), 3000);
    return;
  }

  // SUGGESTION SYSTEM
  if (config && message.channel.id === config.SUGGESTION_CHANNEL_ID) {
    const suggestion = message.content;
    await message.delete().catch(() => { });
    const embed = new EmbedBuilder().setColor("#FFD700")
      .setAuthor({ name: `Saran dari ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
      .setDescription(suggestion)
      .addFields({ name: "👍 Setuju", value: "0", inline: true }, { name: "👎 Tolak", value: "0", inline: true })
      .setFooter({ text: "Gunakan tombol di bawah untuk voting!" }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("suggest_up").setLabel("👍 0").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("suggest_down").setLabel("👎 0").setStyle(ButtonStyle.Danger)
    );
    return message.channel.send({ embeds: [embed], components: [row] });
  }

  // AUTO-MOD
  const isPhishing = phishingRegex.test(message.content);
  const containsBadWord = badWords.some(word => message.content.toLowerCase().includes(word));
  if (isPhishing || containsBadWord) {
    await message.delete().catch(() => { });
    const warningEmbed = new EmbedBuilder().setColor("Red").setTitle("🛡️ Auto-Mod Protection")
      .setDescription(`${message.author}, pesan kamu dihapus karena melanggar peraturan.`).setTimestamp();
    const warnMsg = await message.channel.send({ embeds: [warningEmbed] });
    setTimeout(() => warnMsg.delete().catch(() => { }), 5000);
    sendLog(message.guild, new EmbedBuilder().setColor("Orange").setTitle("⚠️ Auto-Mod Action")
      .setDescription(`User: ${message.author}\nReason: ${isPhishing ? "Phishing/Scam Link" : "Bad Language"}\nContent: \`${message.content}\``).setTimestamp());
    return;
  }

  // XP SYSTEM
  const chatChannelId = getConfig(message.guild.id, "CHAT_CHANNEL_ID");
  if (message.channel.id !== chatChannelId) return;
  const cooldownKey = `${message.guild.id}-${message.author.id}`;
  if (xpCooldown.has(cooldownKey)) return;
  const userId = message.author.id;
  if (!levelsCache[userId]) levelsCache[userId] = { xp: 0, level: 1 };
  const xpGain = Math.floor(Math.random() * 15) + 10;
  levelsCache[userId].xp += xpGain;
  const nextXP = 5 * (levelsCache[userId].level ** 2) + 50 * levelsCache[userId].level + 100;
  if (levelsCache[userId].xp >= nextXP) {
    levelsCache[userId].level += 1;
    levelsCache[userId].xp = 0;
    const member = message.member;
    const lvl5Role = getConfig(message.guild.id, "LEVEL_5_ROLE_ID");
    const lvl10Role = getConfig(message.guild.id, "LEVEL_10_ROLE_ID");
    const lvl20Role = getConfig(message.guild.id, "LEVEL_20_ROLE_ID");
    if (levelsCache[userId].level === 5 && lvl5Role) await member.roles.add(lvl5Role).catch(() => { });
    if (levelsCache[userId].level === 10 && lvl10Role) await member.roles.add(lvl10Role).catch(() => { });
    if (levelsCache[userId].level === 20 && lvl20Role) await member.roles.add(lvl20Role).catch(() => { });
    const levelUpChannelId = getConfig(message.guild.id, "LEVEL_UP_CHANNEL_ID");
    const lvlChannel = message.guild.channels.cache.get(levelUpChannelId);
    if (lvlChannel) {
      const image = await createLevelUpCard(message.member, levelsCache[userId].level);
      const embed = new EmbedBuilder().setColor("#F1C40F").setTitle("🆙 Level Up! | Naik Level!")
        .setDescription(`Selamat ${message.author}! Kamu telah mencapai **Level ${levelsCache[userId].level}**.`)
        .setImage("attachment://levelup.png").setTimestamp();
      lvlChannel.send({ content: `${message.author}`, embeds: [embed], files: [image] }).catch(() => { });
      saveLevels();
    }
  }
  xpCooldown.set(cooldownKey, Date.now());
  setTimeout(() => xpCooldown.delete(cooldownKey), 60000);
});

/* ================= SLASH COMMAND HANDLER (SETUP WIZARD + RANK + LEADERBOARD) ================= */

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // === /rank COMMAND ===
  if (interaction.commandName === 'rank') {
    await interaction.deferReply();
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) return interaction.editReply("❌ User tidak ditemukan di server ini.");

      const userData = levelsCache[targetUser.id] || { xp: 0, level: 1 };
      const nextXP = 5 * (userData.level ** 2) + 50 * userData.level + 100;

      // Calculate rank position
      const allUsers = Object.entries(levelsCache)
        .map(([id, data]) => ({ id, totalXP: calculateTotalXP(data.level, data.xp) }))
        .sort((a, b) => b.totalXP - a.totalXP);
      const rankPosition = allUsers.findIndex(u => u.id === targetUser.id) + 1 || allUsers.length + 1;

      const progress = Math.min(userData.xp / nextXP, 1);
      const progressBar = generateProgressBar(progress, 20);

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setAuthor({ name: `${targetUser.username}'s Rank`, iconURL: targetUser.displayAvatarURL() })
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "🏆 Rank", value: `#${rankPosition}`, inline: true },
          { name: "⭐ Level", value: `${userData.level}`, inline: true },
          { name: "✨ XP", value: `${userData.xp.toLocaleString()} / ${nextXP.toLocaleString()}`, inline: true },
          { name: "📊 Progress", value: `${progressBar} ${Math.floor(progress * 100)}%` }
        )
        .setFooter({ text: `Total XP: ${calculateTotalXP(userData.level, userData.xp).toLocaleString()}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply(`❌ Error: ${err.message}`);
    }
  }

  // === /leaderboard COMMAND ===
  if (interaction.commandName === 'leaderboard') {
    await interaction.deferReply();
    try {
      const allUsers = Object.entries(levelsCache)
        .map(([id, data]) => ({ id, level: data.level, xp: data.xp, totalXP: calculateTotalXP(data.level, data.xp) }))
        .sort((a, b) => b.totalXP - a.totalXP)
        .slice(0, 10);

      if (allUsers.length === 0) {
        return interaction.editReply("📊 Belum ada data level. Mulai chatting untuk mendapatkan XP!");
      }

      const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
      let description = "";

      for (let i = 0; i < allUsers.length; i++) {
        const user = allUsers[i];
        const member = interaction.guild.members.cache.get(user.id);
        const username = member ? member.user.username : `Unknown (${user.id.slice(-4)})`;
        description += `${medals[i]} **${username}** — Level ${user.level} (${user.totalXP.toLocaleString()} XP)\n`;
      }

      // Find requester's position
      const myPosition = Object.entries(levelsCache)
        .map(([id, data]) => ({ id, totalXP: calculateTotalXP(data.level, data.xp) }))
        .sort((a, b) => b.totalXP - a.totalXP)
        .findIndex(u => u.id === interaction.user.id) + 1;

      const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("🏆 Leaderboard — Top 10")
        .setDescription(description)
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: `Posisi kamu: #${myPosition || "N/A"} | ${interaction.guild.name}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply(`❌ Error: ${err.message}`);
    }
  }

  // === /fiicruzh COMMAND ===
  if (interaction.commandName !== 'fiicruzh') return;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Kamu butuh izin `ADMINISTRATOR` untuk menjalankan perintah ini.", flags: 64 });
  }

  // Check bot permissions
  const botMember = interaction.guild.members.me;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({ content: "❌ Bot membutuhkan izin `Manage Channels` dan `Manage Roles` untuk menjalankan setup.", flags: 64 });
  }

  // Check if session already active
  if (setupSessions.has(interaction.guild.id)) {
    return interaction.reply({ content: "⚠️ Setup sedang berjalan di server ini. Tunggu selesai atau tunggu timeout (5 menit).", flags: 64 });
  }

  const guild = interaction.guild;
  const guildId = guild.id;

  // Create session
  const session = {
    guildId,
    userId: interaction.user.id,
    mode: null,
    selectedCategories: ["statistics", "main", "ticket", "admin", "clan"],
    roles: { verify: null, member: null, man: null, woman: null, owner: null, staff: null, guard: null, admin: null, dev: null },
    channelMappings: {},
    step: "init",
    startedAt: Date.now(),
    isUpdate: false
  };
  setupSessions.set(guildId, session);

  // Check existing config
  const existing = detectExistingConfig(guildId);

  if (existing.exists) {
    const existEmbed = new EmbedBuilder()
      .setColor("#FFA500")
      .setTitle("⚙️ FiiCruzh Setup Wizard")
      .setDescription(
        "**Konfigurasi sudah terdeteksi di server ini!**\n\n" +
        `📊 Channels: **${existing.channelCount}** | Roles: **${existing.roleCount}**\n` +
        `${existing.hasStats ? "✅" : "❌"} Statistics | ${existing.hasTicket ? "✅" : "❌"} Ticket | ${existing.hasAdmin ? "✅" : "❌"} Admin Panel\n\n` +
        "Pilih opsi di bawah:"
      )
      .setThumbnail(guild.iconURL())
      .setFooter({ text: "FiiCruzh Setup Wizard", iconURL: guild.iconURL() })
      .setTimestamp();

    const existRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("setup_update").setLabel("🔄 Update Setup").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("setup_fresh").setLabel("🆕 Fresh Setup").setStyle(ButtonStyle.Danger)
    );

    session.step = "config_detect";
    await interaction.reply({ embeds: [existEmbed], components: [existRow] });
  } else {
    // No existing config - go straight to role input
    session.step = "role_input";
    session.roleStep = 0;
    await interaction.reply(buildRoleInputMessage(session));
  }
});

/* ================= SETUP WIZARD HELPER BUILDERS ================= */

function buildRoleInputMessage(session) {
  const stepIndex = session.roleStep || 0;
  const currentRole = ROLE_STEPS[stepIndex];

  let description = "**Pilih role yang diperlukan untuk setup:**\n\n";
  for (let i = 0; i < ROLE_STEPS.length; i++) {
    const step = ROLE_STEPS[i];
    const roleKey = step.key;
    if (i < stepIndex) {
      description += `✅ ${step.label}: <@&${session.roles[roleKey]}>\n`;
    } else if (i === stepIndex) {
      description += `➡️ **${step.label}** — ${step.description}\n`;
    } else {
      description += `⬜ ${step.label}\n`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("⚙️ FiiCruzh Setup — Role Input")
    .setDescription(description)
    .setFooter({ text: `Step ${stepIndex + 1} dari ${ROLE_STEPS.length} | Timeout: 60 detik` })
    .setTimestamp();

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("setup_role_select")
    .setPlaceholder(`Pilih ${currentRole.label}`)
    .setMinValues(1)
    .setMaxValues(1);

  const row = new ActionRowBuilder().addComponents(roleSelect);
  return { embeds: [embed], components: [row] };
}

function buildModeSelectMessage() {
  const embed = new EmbedBuilder()
    .setColor("#00BFFF")
    .setTitle("⚙️ FiiCruzh Setup — Pilih Mode")
    .setDescription(
      "Pilih mode setup yang diinginkan:\n\n" +
      "🔧 **Manual Setup**\n" +
      "Pilih channel yang sudah ada di server untuk penempatan panel bot. Cocok jika kamu sudah memiliki struktur server.\n\n" +
      "🚀 **Automatic Setup**\n" +
      "Bot membuat channel & kategori secara otomatis. Cocok untuk server baru atau ingin setup cepat.\n\n" +
      "⏱️ *Timeout: 60 detik*"
    )
    .setFooter({ text: "FiiCruzh Setup Wizard" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_manual").setLabel("🔧 Manual Setup").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("setup_auto").setLabel("🚀 Automatic Setup").setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

function buildCategorySelectMessage() {
  const embed = new EmbedBuilder()
    .setColor("#9B59B6")
    .setTitle("⚙️ Automatic Setup — Pilih Kategori")
    .setDescription(
      "Pilih kategori yang ingin di-setup otomatis.\n" +
      "Semua kategori dipilih secara default. Kamu bisa men-deselect yang tidak diinginkan.\n\n" +
      "⏱️ *Timeout: 60 detik*"
    )
    .setFooter({ text: "FiiCruzh Setup Wizard" })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId("setup_category_select")
    .setPlaceholder("Pilih kategori yang ingin di-setup")
    .setMinValues(1)
    .setMaxValues(5)
    .addOptions([
      { label: "📊 Server Statistics", value: "statistics", default: true, description: "Voice channels statistik member" },
      { label: "︱𝕄𝕒𝕚𝕟︱", value: "main", default: true, description: "Channel utama (Welcome, Verify, Rules, dll)" },
      { label: "𝕋𝕚𝕔𝕜et-𝕊𝕦𝕡𝕡𝕠𝕣𝕥", value: "ticket", default: true, description: "Sistem tiket support" },
      { label: "ℙ𝕒𝕟𝕖𝕝-𝔸𝕕𝕞𝕚𝕟", value: "admin", default: true, description: "Panel admin dan log system" },
      { label: "📋 Clan Member", value: "clan", default: true, description: "Panel member, list member, dan log" }
    ]);

  const row = new ActionRowBuilder().addComponents(select);
  return { embeds: [embed], components: [row] };
}

function buildManualChannelSelectMessage(session) {
  const catKeys = session.selectedCategories;
  const currentCatIndex = session.manualCatIndex || 0;
  const currentChIndex = session.manualChIndex || 0;

  if (currentCatIndex >= catKeys.length) return null; // All done

  const catKey = catKeys[currentCatIndex];
  const catDef = SETUP_CATEGORIES[catKey];
  const channelDef = catDef.channels[currentChIndex];

  if (!channelDef) return null;

  const isVoice = channelDef.type === ChannelType.GuildVoice;

  let description = `**Kategori: ${catDef.name}**\n\n`;
  description += `Pilih channel untuk: **${channelDef.name}**\n`;
  description += `Tipe yang dibutuhkan: **${isVoice ? "🔊 Voice Channel" : "# Text Channel"}**\n\n`;
  description += `💡 *Scroll dropdown untuk melihat semua channel termasuk private.*\n`;
  description += `⏭️ *Klik "Skip" jika tidak ingin assign channel ini.*\n\n`;

  // Show progress
  let totalChannels = 0;
  let doneChannels = 0;
  for (const ck of catKeys) {
    totalChannels += SETUP_CATEGORIES[ck].channels.length;
  }
  for (let ci = 0; ci < currentCatIndex; ci++) {
    doneChannels += SETUP_CATEGORIES[catKeys[ci]].channels.length;
  }
  doneChannels += currentChIndex;

  description += `📊 Progress: ${doneChannels}/${totalChannels} channels assigned`;

  const embed = new EmbedBuilder()
    .setColor("#E67E22")
    .setTitle("⚙️ Manual Setup — Pilih Channel")
    .setDescription(description)
    .setFooter({ text: "FiiCruzh Setup Wizard | Timeout: 60 detik | Pastikan bot punya akses ke channel" })
    .setTimestamp();

  const channelTypes = isVoice ? [ChannelType.GuildVoice] : [ChannelType.GuildText];

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("setup_manual_channel")
    .setPlaceholder(`Pilih channel untuk ${channelDef.name.substring(0, 40)}`)
    .setChannelTypes(channelTypes);

  const row1 = new ActionRowBuilder().addComponents(channelSelect);
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("setup_manual_skip").setLabel("⏭️ Skip Channel Ini").setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row1, row2] };
}

/* ================= SETUP WIZARD INTERACTION HANDLER ================= */

client.on(Events.InteractionCreate, async interaction => {
  // Only handle setup wizard interactions
  if (!interaction.isButton() && !interaction.isAnySelectMenu()) return;
  if (!interaction.customId.startsWith("setup_")) return;

  const guildId = interaction.guild.id;
  const session = setupSessions.get(guildId);

  if (!session) {
    return interaction.reply({ content: "❌ Sesi setup tidak ditemukan atau sudah expired. Jalankan `/fiicruzh` lagi.", flags: 64 });
  }

  // Only the user who started setup can interact
  if (session.userId !== interaction.user.id) {
    return interaction.reply({ content: "❌ Hanya user yang memulai setup yang bisa berinteraksi.", flags: 64 });
  }

  // Reset timeout
  session.startedAt = Date.now();

  try {
    // === CONFIG DETECT: Update or Fresh ===
    if (interaction.customId === "setup_update") {
      session.isUpdate = true;
      session.step = "role_input";
      session.roleStep = 0;
      await interaction.update(buildRoleInputMessage(session));
      return;
    }

    if (interaction.customId === "setup_fresh") {
      const confirmEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("⚠️ Konfirmasi Fresh Setup")
        .setDescription(
          "**Apakah kamu yakin ingin melakukan Fresh Setup?**\n\n" +
          "Ini akan menimpa konfigurasi lama (backup otomatis akan dibuat).\n" +
          "Channel yang sudah ada TIDAK akan dihapus, hanya konfigurasi yang di-reset."
        )
        .setTimestamp();
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("setup_fresh_confirm").setLabel("✅ Ya, Lanjutkan").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("setup_fresh_cancel").setLabel("❌ Batal").setStyle(ButtonStyle.Secondary)
      );
      await interaction.update({ embeds: [confirmEmbed], components: [confirmRow] });
      return;
    }

    if (interaction.customId === "setup_fresh_confirm") {
      backupConfig();
      session.isUpdate = false;
      session.step = "role_input";
      session.roleStep = 0;
      await interaction.update(buildRoleInputMessage(session));
      return;
    }

    if (interaction.customId === "setup_fresh_cancel") {
      setupSessions.delete(guildId);
      await interaction.update({
        embeds: [new EmbedBuilder().setColor("Grey").setTitle("❌ Setup Dibatalkan").setDescription("Fresh setup dibatalkan.").setTimestamp()],
        components: []
      });
      return;
    }

    // === ROLE INPUT ===
    if (interaction.customId === "setup_role_select") {
      const selectedRoleId = interaction.values[0];
      const stepIndex = session.roleStep || 0;
      const roleKey = ROLE_STEPS[stepIndex].key;

      // Check duplicate
      const existingKeys = Object.entries(session.roles).filter(([k, v]) => v !== null && v === selectedRoleId);
      if (existingKeys.length > 0) {
        // Show warning but allow continue
        const dupKey = existingKeys[0][0];
        const dupLabel = ROLE_STEPS.find(r => r.key === dupKey)?.label || dupKey;
        session.roles[roleKey] = selectedRoleId;
        session.roleStep = stepIndex + 1;

        if (session.roleStep >= ROLE_STEPS.length) {
          // All roles collected - go to mode selection
          session.step = "mode_select";
          await interaction.update(buildModeSelectMessage());
        } else {
          await interaction.update(buildRoleInputMessage(session));
        }
        return;
      }

      session.roles[roleKey] = selectedRoleId;
      session.roleStep = stepIndex + 1;

      if (session.roleStep >= ROLE_STEPS.length) {
        session.step = "mode_select";
        await interaction.update(buildModeSelectMessage());
      } else {
        await interaction.update(buildRoleInputMessage(session));
      }
      return;
    }

    // === MODE SELECTION ===
    if (interaction.customId === "setup_manual") {
      session.mode = "manual";
      session.step = "category_select";
      // Manual mode also needs category selection
      const embed = new EmbedBuilder()
        .setColor("#E67E22")
        .setTitle("⚙️ Manual Setup — Pilih Kategori")
        .setDescription(
          "Pilih kategori yang ingin kamu konfigurasi secara manual.\n" +
          "Kamu akan memilih channel existing untuk setiap komponen.\n\n" +
          "⏱️ *Timeout: 60 detik*"
        )
        .setFooter({ text: "FiiCruzh Setup Wizard" })
        .setTimestamp();

      const select = new StringSelectMenuBuilder()
        .setCustomId("setup_category_select")
        .setPlaceholder("Pilih kategori yang ingin di-setup")
        .setMinValues(1)
        .setMaxValues(5)
        .addOptions([
          { label: "📊 Server Statistics", value: "statistics", default: true, description: "Voice channels statistik member" },
          { label: "︱𝕄𝕒𝕚𝕟︱", value: "main", default: true, description: "Channel utama (Welcome, Verify, Rules, dll)" },
          { label: "𝕋𝕚𝕔𝕜et-𝕊𝕦𝕡𝕡𝕠𝕣𝕥", value: "ticket", default: true, description: "Sistem tiket support" },
          { label: "ℙ𝕒𝕟𝕖𝕝-𝔸𝕕𝕞𝕚𝕟", value: "admin", default: true, description: "Panel admin dan log system" },
          { label: "📋 Clan Member", value: "clan", default: true, description: "Panel member, list member, dan log" }
        ]);

      const row = new ActionRowBuilder().addComponents(select);
      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    if (interaction.customId === "setup_auto") {
      session.mode = "automatic";
      session.step = "category_select";
      await interaction.update(buildCategorySelectMessage());
      return;
    }

    // === CATEGORY SELECTION ===
    if (interaction.customId === "setup_category_select") {
      session.selectedCategories = interaction.values;

      if (session.mode === "automatic") {
        // Show detailed confirmation with channels that will be created
        let description = "**Kategori & Channel yang akan dibuat:**\n\n";
        let totalChannels = 0;

        for (const catKey of session.selectedCategories) {
          const cat = SETUP_CATEGORIES[catKey];
          description += `📁 **${cat.name}**\n`;
          for (const ch of cat.channels) {
            const typeIcon = ch.type === ChannelType.GuildVoice ? "🔊" : "#";
            description += `　${typeIcon} ${ch.name}\n`;
            totalChannels++;
          }
          description += "\n";
        }

        description += `\n📊 **Total:** ${session.selectedCategories.length} kategori, ${totalChannels} channel\n`;
        description += `\n⚠️ Channel yang sudah ada tidak akan dibuat ulang (sync only).`;

        const embed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle("⚙️ Konfirmasi Automatic Setup")
          .setDescription(description)
          .setFooter({ text: "FiiCruzh Setup Wizard" })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("setup_auto_confirm").setLabel("✅ Mulai Setup").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("setup_auto_reselect").setLabel("↩️ Pilih Ulang").setStyle(ButtonStyle.Secondary)
        );
        await interaction.update({ embeds: [embed], components: [row] });
      } else {
        // Manual mode - start channel assignment
        session.step = "manual_assign";
        session.manualCatIndex = 0;
        session.manualChIndex = 0;
        const msg = buildManualChannelSelectMessage(session);
        if (msg) {
          await interaction.update(msg);
        }
      }
      return;
    }

    if (interaction.customId === "setup_auto_reselect") {
      await interaction.update(buildCategorySelectMessage());
      return;
    }

    // === MANUAL SKIP CHANNEL ===
    if (interaction.customId === "setup_manual_skip") {
      const catKeys = session.selectedCategories;
      const catIndex = session.manualCatIndex || 0;
      const chIndex = session.manualChIndex || 0;
      const catDef = SETUP_CATEGORIES[catKeys[catIndex]];

      // Move to next channel
      session.manualChIndex = chIndex + 1;
      if (session.manualChIndex >= catDef.channels.length) {
        session.manualCatIndex = catIndex + 1;
        session.manualChIndex = 0;
      }

      // Check if all done
      if (session.manualCatIndex >= catKeys.length) {
        session.step = "executing";
        await interaction.update({
          embeds: [new EmbedBuilder().setColor("#00BFFF").setTitle("⏳ Deploying...").setDescription("Menyimpan konfigurasi dan deploy panel...").setTimestamp()],
          components: []
        });
        await executeManualSetup(interaction, session);
      } else {
        const msg = buildManualChannelSelectMessage(session);
        if (msg) {
          await interaction.update(msg);
        }
      }
      return;
    }

    // === MANUAL CHANNEL ASSIGNMENT ===
    if (interaction.customId === "setup_manual_channel") {
      const selectedChannelId = interaction.values[0];
      const catKeys = session.selectedCategories;
      const catIndex = session.manualCatIndex || 0;
      const chIndex = session.manualChIndex || 0;
      const catKey = catKeys[catIndex];
      const catDef = SETUP_CATEGORIES[catKey];
      const channelDef = catDef.channels[chIndex];

      // Save the mapping
      session.channelMappings[channelDef.key] = selectedChannelId;

      // Move to next channel
      session.manualChIndex = chIndex + 1;
      if (session.manualChIndex >= catDef.channels.length) {
        session.manualCatIndex = catIndex + 1;
        session.manualChIndex = 0;
      }

      // Check if all done
      if (session.manualCatIndex >= catKeys.length) {
        // All channels assigned - execute manual setup
        session.step = "executing";
        await interaction.update({
          embeds: [new EmbedBuilder().setColor("#00BFFF").setTitle("⏳ Deploying...").setDescription("Menyimpan konfigurasi dan deploy panel...").setTimestamp()],
          components: []
        });
        await executeManualSetup(interaction, session);
      } else {
        const msg = buildManualChannelSelectMessage(session);
        if (msg) {
          await interaction.update(msg);
        }
      }
      return;
    }

    // === AUTOMATIC SETUP EXECUTION ===
    if (interaction.customId === "setup_auto_confirm") {
      session.step = "executing";
      await interaction.update({
        embeds: [new EmbedBuilder().setColor("#00BFFF").setTitle("🛠️ Memulai Setup FiiCruzh Ecosystem...").setDescription("⏳ Membuat channel dan kategori...").setTimestamp()],
        components: []
      });
      await executeAutomaticSetup(interaction, session);
      return;
    }

  } catch (err) {
    console.error("Setup Wizard Error:", err);
    setupSessions.delete(guildId);
    const errorMsg = { content: `❌ **Terjadi Kesalahan:** ${err.message}`, components: [] };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorMsg).catch(() => {});
    } else {
      await interaction.reply({ ...errorMsg, flags: 64 }).catch(() => {});
    }
  }
});

/* ================= AUTOMATIC SETUP EXECUTION ================= */

async function executeAutomaticSetup(interaction, session) {
  const guild = interaction.guild;
  const guildId = guild.id;
  const results = { success: [], failed: [] };
  let progressLines = ["🛠️ **Memulai Setup FiiCruzh Ecosystem...**\n"];

  const updateProgress = async (text) => {
    progressLines.push(text);
    // Keep only last 15 lines to avoid message length limit
    const display = progressLines.length > 15
      ? ["🛠️ **Setup FiiCruzh Ecosystem...**\n", "...", ...progressLines.slice(-13)]
      : progressLines;
    await interaction.editReply({ embeds: [
      new EmbedBuilder().setColor("#00BFFF").setTitle("⚙️ Setup Progress").setDescription(display.join("\n")).setTimestamp()
    ] }).catch(() => {});
  };

  try {
    const existingRoles = await guild.roles.fetch();
    const existingChannels = await guild.channels.fetch();
    const currentConfig = session.isUpdate ? (getGuildConfig(guildId) || {}) : {};
    const everyoneId = guild.roles.everyone.id;

    // Helper: Get or Create Role
    const getOrCreateRole = async (name, color, configKey = null) => {
      let role;
      if (configKey && currentConfig[configKey]) role = existingRoles.get(currentConfig[configKey]);
      if (!role) role = existingRoles.find(r => r.name === name);
      if (!role) {
        role = await guild.roles.create({ name, color, reason: "FiiCruzh Setup" });
        await updateProgress(`✅ Created Role: ${name}`);
      } else {
        await updateProgress(`🔄 Syncing Role: ${role.name}`);
      }
      return role;
    };

    // Helper: Get or Create Channel
    const getOrCreateChannel = async (name, type, parent = null, permissionOverwrites = [], configKey = null) => {
      let channel;
      if (configKey && currentConfig[configKey]) channel = existingChannels.get(currentConfig[configKey]);
      if (!channel) {
        if (name.includes(":")) {
          const prefix = name.split(":")[0];
          channel = existingChannels.find(c => c.name && c.name.startsWith(prefix) && c.type === type);
        } else {
          channel = existingChannels.find(c => c.name === name && c.type === type);
        }
      }
      if (!channel) {
        channel = await guild.channels.create({ name, type, parent, permissionOverwrites });
        await updateProgress(`✅ Created Channel: ${name}`);
      } else {
        await updateProgress(`🔄 Syncing Channel: ${channel.name}`);
        if (parent && channel.parentId !== parent) await channel.setParent(parent, { lockPermissions: false }).catch(() => {});
        if (permissionOverwrites.length > 0) await channel.permissionOverwrites.set(permissionOverwrites).catch(() => {});
      }
      return channel;
    };

    // Create system roles
    const unverifiedRole = await getOrCreateRole("🚫︱𝙐𝙣𝙫𝙚𝙧𝙞𝙛𝙞𝙚𝙙", "#95a5a6", "UNVERIFIED_ROLE_ID");
    const lvl5Role = await getOrCreateRole("🥉︱𝙇𝙚𝙫𝙚𝙡 𝙁𝙞𝙫𝙚", "#cd7f32", "LEVEL_5_ROLE_ID");
    const lvl10Role = await getOrCreateRole("🥈︱𝙇𝙚𝙫𝙚𝙡 𝙏𝙚𝙣", "#c0c0c0", "LEVEL_10_ROLE_ID");
    const lvl20Role = await getOrCreateRole("🥇︱𝙇𝙚𝙫𝙚𝙡 𝙏𝙬𝙚𝙣𝙩𝙮", "#ffd700", "LEVEL_20_ROLE_ID");

    const verifyRoleId = session.roles.verify;
    const memberRoleId = session.roles.member;
    const manRoleId = session.roles.man;
    const womanRoleId = session.roles.woman;
    const ownerRoleId = session.roles.owner;
    const staffRoleId = session.roles.staff;
    const guardRoleId = session.roles.guard;
    const adminRoleId = session.roles.admin;
    const devRoleId = session.roles.dev;

    // Build new config
    const newConfig = {
      VERIFY_ROLE_ID: verifyRoleId,
      MEMBER_ROLE_ID: memberRoleId,
      MAN_ROLE_ID: manRoleId,
      WOMAN_ROLE_ID: womanRoleId,
      OWNER_ROLE_ID: ownerRoleId,
      STAFF_ROLE_ID: staffRoleId,
      GUARD_ROLE_ID: guardRoleId,
      ADMIN_ROLE_ID: adminRoleId,
      DEV_ROLE_ID: devRoleId,
      UNVERIFIED_ROLE_ID: unverifiedRole.id,
      LEVEL_5_ROLE_ID: lvl5Role.id,
      LEVEL_10_ROLE_ID: lvl10Role.id,
      LEVEL_20_ROLE_ID: lvl20Role.id
    };

    // Create channels per selected category
    const selectedCats = session.selectedCategories;

    if (selectedCats.includes("statistics")) {
      try {
        const statsCat = await getOrCreateChannel("📊 SERVER STATISTICS", 4, null, [], "STATS_CATEGORY_ID");
        const totalCh = await getOrCreateChannel("⬩➤┃👥┃Total Member: 0", 2, statsCat.id, [{ id: everyoneId, deny: [PermissionFlagsBits.Connect] }], "STATS_TOTAL_CH_ID");
        const manCh = await getOrCreateChannel("⬩➤┃👦┃Total Man: 0", 2, statsCat.id, [{ id: everyoneId, deny: [PermissionFlagsBits.Connect] }], "STATS_MAN_CH_ID");
        const womanCh = await getOrCreateChannel("⬩➤┃👧┃Total Woman: 0", 2, statsCat.id, [{ id: everyoneId, deny: [PermissionFlagsBits.Connect] }], "STATS_WOMAN_CH_ID");
        const botCh = await getOrCreateChannel("⬩➤┃🤖┃Total Bot FiiCruzh: 0", 2, statsCat.id, [{ id: everyoneId, deny: [PermissionFlagsBits.Connect] }], "STATS_BOT_CH_ID");
        const onlineCh = await getOrCreateChannel("⬩➤┃🟢┃Total Online: 0", 2, statsCat.id, [{ id: everyoneId, deny: [PermissionFlagsBits.Connect] }], "STATS_ONLINE_CH_ID");
        newConfig.STATS_CATEGORY_ID = statsCat.id;
        newConfig.STATS_TOTAL_CH_ID = totalCh.id;
        newConfig.STATS_MAN_CH_ID = manCh.id;
        newConfig.STATS_WOMAN_CH_ID = womanCh.id;
        newConfig.STATS_BOT_CH_ID = botCh.id;
        newConfig.STATS_ONLINE_CH_ID = onlineCh.id;
        results.success.push("📊 Server Statistics");
      } catch (e) { results.failed.push("📊 Server Statistics: " + e.message); }
    }

    if (selectedCats.includes("main")) {
      try {
        const mainCat = await getOrCreateChannel("︱𝕄𝕒𝕚𝕟︱", 4, null, [], "MAIN_CATEGORY_ID");
        const welcomeCh = await getOrCreateChannel("╭➤👋ㆍ𝙒𝙚𝙡𝙘𝙤𝙢𝙚-𝙂𝙤𝙤𝙙𝘽𝙮𝙚", 0, mainCat.id, [], "WELCOME_CHANNEL");
        const verifyCh = await getOrCreateChannel("┃✅ㆍ𝙑𝙚𝙧𝙞𝙛𝙞𝙘𝙖𝙩𝙞𝙤𝙣", 0, mainCat.id, [], "VERIFY_CHANNEL_ID");
        const rulesCh = await getOrCreateChannel("┃🛡️ㆍ𝙍𝙪𝙡𝙚𝙨", 0, mainCat.id, [], "RULES_CHANNEL_ID");
        const socialCh = await getOrCreateChannel("┃👑ㆍ𝙎𝙤𝙘𝙞𝙖𝙡𝙈𝙚𝙙𝙞𝙖-𝙁𝙞𝙞𝘾𝙧𝙪𝙯𝙝", 0, mainCat.id, [], "SOCIAL_CHANNEL_ID");
        const roleCh = await getOrCreateChannel("┃🎭ㆍ𝙍𝙤𝙡𝙚", 0, mainCat.id, [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
          { id: verifyRoleId, allow: [PermissionFlagsBits.ViewChannel] }
        ], "ROLE_CHANNEL_ID");
        const chatCh = await getOrCreateChannel("┃📝ㆍ𝙍𝙤𝙤𝙢-𝘾𝙝𝙖𝙩", 0, mainCat.id, [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
          { id: manRoleId, allow: [PermissionFlagsBits.ViewChannel] },
          { id: womanRoleId, allow: [PermissionFlagsBits.ViewChannel] }
        ], "CHAT_CHANNEL_ID");
        const boostCh = await getOrCreateChannel("┃🚀ㆍ𝘽𝙤𝙨𝙩-𝙎𝙚𝙧𝙫𝙚𝙧", 0, mainCat.id, [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
          { id: manRoleId, allow: [PermissionFlagsBits.ViewChannel] },
          { id: womanRoleId, allow: [PermissionFlagsBits.ViewChannel] }
        ], "BOOST_CHANNEL_ID");
        const levelUpCh = await getOrCreateChannel("╰➤🆙ㆍ𝙇𝙚𝙫𝙚𝙡-𝙐𝙋", 0, mainCat.id, [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
          { id: manRoleId, allow: [PermissionFlagsBits.ViewChannel] },
          { id: womanRoleId, allow: [PermissionFlagsBits.ViewChannel] }
        ], "LEVEL_UP_CHANNEL_ID");
        const suggestCh = await getOrCreateChannel("┃💡ㆍ𝘾𝙤𝙣𝙩𝙚𝙣𝙩-𝙎𝙪𝙜𝙜𝙚𝙨𝙩𝙞𝙤𝙣", 0, mainCat.id, [], "SUGGESTION_CHANNEL_ID");

        newConfig.MAIN_CATEGORY_ID = mainCat.id;
        newConfig.WELCOME_CHANNEL = welcomeCh.id;
        newConfig.VERIFY_CHANNEL_ID = verifyCh.id;
        newConfig.RULES_CHANNEL_ID = rulesCh.id;
        newConfig.SOCIAL_CHANNEL_ID = socialCh.id;
        newConfig.ROLE_CHANNEL_ID = roleCh.id;
        newConfig.CHAT_CHANNEL_ID = chatCh.id;
        newConfig.BOOST_CHANNEL_ID = boostCh.id;
        newConfig.LEVEL_UP_CHANNEL_ID = levelUpCh.id;
        newConfig.SUGGESTION_CHANNEL_ID = suggestCh.id;
        results.success.push("︱𝕄𝕒𝕚𝕟︱");
      } catch (e) { results.failed.push("︱𝕄𝕒𝕚𝕟︱: " + e.message); }
    }

    if (selectedCats.includes("ticket")) {
      try {
        const ticketCat = await getOrCreateChannel("𝕋𝕚𝕔𝕜et-𝕊𝕦𝕡𝕡𝕠𝕣𝕥", 4, null, [], "TICKET_CATEGORY_ID");
        const ticketCh = await getOrCreateChannel("⬩➤┃🎟️ㆍ𝙏𝙞𝙘𝙠𝙚𝙩-𝙎𝙮𝙨𝙩𝙚𝙢", 0, ticketCat.id, [], "TICKET_CHANNEL_ID");
        newConfig.TICKET_CATEGORY_ID = ticketCat.id;
        newConfig.TICKET_CHANNEL_ID = ticketCh.id;
        results.success.push("𝕋𝕚𝕔𝕜et-𝕊𝕦𝕡𝕡𝕠𝕣𝕥");
      } catch (e) { results.failed.push("𝕋𝕚𝕔𝕜et-𝕊𝕦𝕡𝕡𝕠𝕣𝕥: " + e.message); }
    }

    if (selectedCats.includes("admin")) {
      try {
        const adminCat = await getOrCreateChannel("ℙ𝕒𝕟𝕖𝕝-𝔸𝕕𝕞𝕚𝕟", 4, null, [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
          { id: ownerRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: guardRoleId, allow: [PermissionFlagsBits.ViewChannel] },
          { id: adminRoleId, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
          { id: devRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ], "ADMIN_CATEGORY_ID");
        const adminPanelCh = await getOrCreateChannel("⬩➤┃🔰┃ㆍ𝙋𝙖𝙣𝙚𝙡-𝘼𝙙𝙢𝙞𝙣", 0, adminCat.id, [], "ADMIN_PANEL_CHANNEL_ID");
        const logCh = await getOrCreateChannel("⬩➤┃📋︱𝙇𝙤𝙜-𝙎𝙮𝙨𝙩𝙚𝙢", 0, adminCat.id, [], "LOG_CHANNEL_ID");
        newConfig.ADMIN_CATEGORY_ID = adminCat.id;
        newConfig.ADMIN_PANEL_CHANNEL_ID = adminPanelCh.id;
        newConfig.LOG_CHANNEL_ID = logCh.id;
        results.success.push("ℙ𝕒𝕟𝕖𝕝-𝔸𝕕𝕞𝕚𝕟");
      } catch (e) { results.failed.push("ℙ𝕒𝕟𝕖𝕝-𝔸𝕕𝕞𝕚𝕟: " + e.message); }
    }

    if (selectedCats.includes("clan")) {
      try {
        const clanCat = await getOrCreateChannel("ℂ𝕝𝕒𝕟-𝕄𝕖𝕞𝕓𝕖𝕣", 4, null, [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
          { id: verifyRoleId, allow: [PermissionFlagsBits.ViewChannel] }
        ], "MEMBER_CATEGORY_ID");
        const panelMemberCh = await getOrCreateChannel("⬩➤┃📁┃ㆍ𝙋𝙖𝙣𝙚𝙡-𝙈𝙚𝙢𝙗𝙚𝙧", 0, clanCat.id, [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: verifyRoleId, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
        ], "MEMBER_PANEL_CHANNEL_ID");
        const listMemberCh = await getOrCreateChannel("⬩➤┃📜┃ㆍ𝙇𝙞𝙨𝙩-𝙈𝙚𝙢𝙗𝙚𝙧", 0, clanCat.id, [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: verifyRoleId, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
        ], "MEMBER_LIST_CHANNEL_ID");
        const logMemberCh = await getOrCreateChannel("⬩➤┃📋┃ㆍ𝙇𝙤𝙜-𝙈𝙚𝙢𝙗𝙚𝙧", 0, clanCat.id, [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
          { id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel] },
          { id: adminRoleId, allow: [PermissionFlagsBits.ViewChannel] },
          { id: devRoleId, allow: [PermissionFlagsBits.ViewChannel] },
          { id: ownerRoleId, allow: [PermissionFlagsBits.ViewChannel] }
        ], "MEMBER_LOG_CHANNEL_ID");
        newConfig.MEMBER_CATEGORY_ID = clanCat.id;
        newConfig.MEMBER_PANEL_CHANNEL_ID = panelMemberCh.id;
        newConfig.MEMBER_LIST_CHANNEL_ID = listMemberCh.id;
        newConfig.MEMBER_LOG_CHANNEL_ID = logMemberCh.id;
        results.success.push("📋 Clan Member");
      } catch (e) { results.failed.push("📋 Clan Member: " + e.message); }
    }

    // Save config before deploying panels
    saveGuildConfig(guildId, newConfig);
    await updateProgress("Deploying Panels...");

    // Deploy panels
    const panelResults = await deployPanels(guild, newConfig, newConfig);
    results.success.push(...panelResults.success);
    results.failed.push(...panelResults.failed);

    // Save again (panel deploy may add MSG_RULES_ID, MSG_SOCIAL_ID)
    saveGuildConfig(guildId, newConfig);

    // Trigger stats update
    await updateStats();

    // Final summary
    const summaryEmbed = new EmbedBuilder()
      .setColor(results.failed.length === 0 ? "#2ECC71" : "#FFA500")
      .setTitle("✅ Setup Selesai!")
      .setDescription(
        "**Seluruh kategori, channel, dan panel telah dikonfigurasi.**\n\n" +
        `✅ **Berhasil (${results.success.length}):**\n${results.success.map(s => `• ${s}`).join("\n") || "—"}\n\n` +
        (results.failed.length > 0 ? `❌ **Gagal (${results.failed.length}):**\n${results.failed.map(f => `• ${f}`).join("\n")}` : "") +
        `\n\n**Mode:** 🚀 Automatic\n**Oleh:** ${interaction.user}`
      )
      .setFooter({ text: "FiiCruzh Setup Wizard" })
      .setTimestamp();

    await interaction.editReply({ embeds: [summaryEmbed], components: [] });

    // Log to log channel
    if (newConfig.LOG_CHANNEL_ID) {
      sendLog(guild, new EmbedBuilder()
        .setColor("#2ECC71").setTitle("⚙️ Setup Completed")
        .setDescription(`Mode: Automatic\nBy: ${interaction.user}\nCategories: ${selectedCats.join(", ")}`)
        .setTimestamp());
    }

  } catch (err) {
    console.error("Auto Setup Error:", err);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor("Red").setTitle("❌ Setup Error").setDescription(`Error: ${err.message}`).setTimestamp()],
      components: []
    }).catch(() => {});
  } finally {
    setupSessions.delete(guildId);
  }
}

/* ================= MANUAL SETUP EXECUTION ================= */

async function executeManualSetup(interaction, session) {
  const guild = interaction.guild;
  const guildId = guild.id;

  try {
    const existingRoles = await guild.roles.fetch();
    const currentConfig = session.isUpdate ? (getGuildConfig(guildId) || {}) : {};

    // Helper: Get or Create Role
    const getOrCreateRole = async (name, color, configKey = null) => {
      let role;
      if (configKey && currentConfig[configKey]) role = existingRoles.get(currentConfig[configKey]);
      if (!role) role = existingRoles.find(r => r.name === name);
      if (!role) role = await guild.roles.create({ name, color, reason: "FiiCruzh Setup" });
      return role;
    };

    // Create system roles
    const unverifiedRole = await getOrCreateRole("🚫︱𝙐𝙣𝙫𝙚𝙧𝙞𝙛𝙞𝙚𝙙", "#95a5a6", "UNVERIFIED_ROLE_ID");
    const lvl5Role = await getOrCreateRole("🥉︱𝙇𝙚𝙫𝙚𝙡 𝙁𝙞𝙫𝙚", "#cd7f32", "LEVEL_5_ROLE_ID");
    const lvl10Role = await getOrCreateRole("🥈︱𝙇𝙚𝙫𝙚𝙡 𝙏𝙚𝙣", "#c0c0c0", "LEVEL_10_ROLE_ID");
    const lvl20Role = await getOrCreateRole("🥇︱𝙇𝙚𝙫𝙚𝙡 𝙏𝙬𝙚𝙣𝙩𝙮", "#ffd700", "LEVEL_20_ROLE_ID");

    // Build config from manual channel mappings
    const newConfig = {
      VERIFY_ROLE_ID: session.roles.verify,
      MEMBER_ROLE_ID: session.roles.member,
      MAN_ROLE_ID: session.roles.man,
      WOMAN_ROLE_ID: session.roles.woman,
      OWNER_ROLE_ID: session.roles.owner,
      STAFF_ROLE_ID: session.roles.staff,
      GUARD_ROLE_ID: session.roles.guard,
      ADMIN_ROLE_ID: session.roles.admin,
      DEV_ROLE_ID: session.roles.dev,
      UNVERIFIED_ROLE_ID: unverifiedRole.id,
      LEVEL_5_ROLE_ID: lvl5Role.id,
      LEVEL_10_ROLE_ID: lvl10Role.id,
      LEVEL_20_ROLE_ID: lvl20Role.id,
      ...session.channelMappings
    };

    // Save config
    saveGuildConfig(guildId, newConfig);

    // Deploy panels to selected channels
    const panelResults = await deployPanels(guild, newConfig, newConfig);

    // Save again for MSG IDs
    saveGuildConfig(guildId, newConfig);

    // Trigger stats update
    await updateStats();

    // Final summary
    const assignedCount = Object.keys(session.channelMappings).length;
    const summaryEmbed = new EmbedBuilder()
      .setColor(panelResults.failed.length === 0 ? "#2ECC71" : "#FFA500")
      .setTitle("✅ Manual Setup Selesai!")
      .setDescription(
        "**Konfigurasi telah disimpan dan panel telah di-deploy.**\n\n" +
        `📊 **Channels Assigned:** ${assignedCount}\n` +
        `✅ **Panels Deployed:** ${panelResults.success.length}\n` +
        (panelResults.failed.length > 0 ? `❌ **Gagal:** ${panelResults.failed.join(", ")}` : "") +
        `\n\n**Mode:** 🔧 Manual\n**Oleh:** ${interaction.user}`
      )
      .setFooter({ text: "FiiCruzh Setup Wizard" })
      .setTimestamp();

    await interaction.editReply({ embeds: [summaryEmbed], components: [] });

    // Log
    if (newConfig.LOG_CHANNEL_ID) {
      sendLog(guild, new EmbedBuilder()
        .setColor("#2ECC71").setTitle("⚙️ Setup Completed")
        .setDescription(`Mode: Manual\nBy: ${interaction.user}\nChannels Assigned: ${assignedCount}`)
        .setTimestamp());
    }

  } catch (err) {
    console.error("Manual Setup Error:", err);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor("Red").setTitle("❌ Setup Error").setDescription(`Error: ${err.message}`).setTimestamp()],
      components: []
    }).catch(() => {});
  } finally {
    setupSessions.delete(guildId);
  }
}

/* ================= BUTTON SYSTEM ================= */

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton() && !interaction.isAnySelectMenu()) return;
  // Skip setup wizard interactions (handled above)
  if (interaction.customId.startsWith("setup_")) return;
  // Skip Panel Member interactions (handled by Panel Member system)
  if (interaction.customId.startsWith("pm_")) return;

  const member = interaction.member;
  const guildId = interaction.guild.id;

  // SELECT MENUS HANDLER
  if (interaction.isAnySelectMenu()) {
    if (interaction.customId === "manage_user_select") {
      const selectedUser = interaction.values[0];
      const userData = manageCache.get(interaction.user.id) || {};
      userData.targetId = selectedUser;
      manageCache.set(interaction.user.id, userData);
      return interaction.deferUpdate();
    }
    if (interaction.customId === "manage_role_select") {
      const selectedRole = interaction.values[0];
      const userData = manageCache.get(interaction.user.id) || {};
      userData.roleId = selectedRole;
      manageCache.set(interaction.user.id, userData);
      return interaction.deferUpdate();
    }

    // TICKET CATEGORY SELECT
    if (interaction.customId === "ticket_category_select") {
      const category = interaction.values[0];
      const ticketCatId = getConfig(guildId, "TICKET_CATEGORY_ID");
      const adminRoleId = getConfig(guildId, "ADMIN_ROLE_ID");
      const categoryLabels = { bug: "🐛 Bug Report", general: "💬 General", partnership: "🤝 Partnership", other: "📝 Other" };
      const categoryLabel = categoryLabels[category] || category;

      // Check existing ticket
      const existing = interaction.guild.channels.cache.find(c => c.name.startsWith(`ticket-`) && c.name.includes(interaction.user.username.toLowerCase().slice(0, 8)));
      if (existing) {
        return interaction.reply({ content: `❌ Kamu sudah memiliki tiket terbuka: ${existing}`, flags: 64 });
      }

      await interaction.deferReply({ flags: 64 });

      const channel = await interaction.guild.channels.create({
        name: `ticket-${category}-${interaction.user.username.slice(0, 10)}`,
        type: 0,
        parent: ticketCatId || null,
        topic: `Ticket by ${interaction.user.tag} | Category: ${categoryLabel} | Opened: ${new Date().toLocaleString('id-ID')}`,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
          { id: adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }
        ]
      });

      const ticketEmbed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setTitle(`🎫 Ticket — ${categoryLabel}`)
        .setDescription(
          `Halo ${interaction.user}! Tiket kamu telah dibuat.\n\n` +
          `**Kategori:** ${categoryLabel}\n` +
          `**Dibuat:** ${new Date().toLocaleString('id-ID')}\n\n` +
          `Silakan jelaskan masalah atau pertanyaan kamu di bawah.\nStaff akan merespons secepatnya.`
        )
        .setFooter({ text: `Ticket ID: ${channel.id}` })
        .setTimestamp();

      const ticketRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ticket_claim").setLabel("✋ Claim Ticket").setStyle(ButtonStyle.Primary)
      );

      await channel.send({ content: `${interaction.user} | <@&${adminRoleId}>`, embeds: [ticketEmbed], components: [ticketRow] });
      return interaction.editReply({ content: `✅ Tiket kamu telah dibuat: ${channel}\nKategori: **${categoryLabel}**` });
    }

    if (interaction.customId === "select_edit_config") {
      const choice = interaction.values[0];

      // === ADD SOCIAL MEDIA ===
      if (choice === "add_social") {
        const config = getGuildConfig(guildId) || {};
        const currentButtons = getSocialButtons(config);
        if (currentButtons.length >= MAX_SOCIAL_BUTTONS) {
          return interaction.reply({ content: `❌ Maksimum ${MAX_SOCIAL_BUTTONS} tombol social media tercapai. Hapus salah satu terlebih dahulu.`, flags: 64 });
        }
        const modal = new ModalBuilder().setCustomId("modal_add_social").setTitle("➕ Add Social Media Button");
        const labelInput = new TextInputBuilder().setCustomId("social_label").setLabel("Label (nama platform)").setStyle(TextInputStyle.Short).setPlaceholder("Website, Facebook, Twitter, dll").setRequired(true).setMaxLength(80);
        const urlInput = new TextInputBuilder().setCustomId("social_url").setLabel("URL (link lengkap)").setStyle(TextInputStyle.Short).setPlaceholder("https://example.com").setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(labelInput), new ActionRowBuilder().addComponents(urlInput));
        return interaction.showModal(modal);
      }

      // === REMOVE SOCIAL MEDIA ===
      if (choice === "remove_social") {
        const config = getGuildConfig(guildId) || {};
        const currentButtons = getSocialButtons(config);
        if (currentButtons.length === 0) {
          return interaction.reply({ content: "❌ Tidak ada tombol social media untuk dihapus.", flags: 64 });
        }
        const select = new StringSelectMenuBuilder().setCustomId("select_remove_social").setPlaceholder("Pilih tombol yang ingin dihapus")
          .addOptions(currentButtons.map((btn, i) => ({ label: `❌ ${btn.label}`, description: btn.url.substring(0, 50), value: String(i) })));
        return interaction.reply({ content: "🗑️ **Pilih tombol social media yang ingin dihapus:**", components: [new ActionRowBuilder().addComponents(select)], flags: 64 });
      }

      // === EDIT SOCIAL DESCRIPTION ===
      if (choice === "edit_social_desc") {
        const config = getGuildConfig(guildId) || {};
        const modal = new ModalBuilder().setCustomId("modal_edit_social_desc").setTitle("📝 Edit Social Description");
        const descInput = new TextInputBuilder().setCustomId("social_desc").setLabel("Deskripsi Embed Social Media").setStyle(TextInputStyle.Paragraph).setPlaceholder("Tulis deskripsi untuk panel social media...").setRequired(false).setValue(config.SOCIAL_DESCRIPTION || "");
        modal.addComponents(new ActionRowBuilder().addComponents(descInput));
        return interaction.showModal(modal);
      }

      // === EDIT RULES ===
      if (choice === "edit_rules") {
        const modal = new ModalBuilder().setCustomId("modal_edit_config").setTitle("Edit Server Rules");
        const input = new TextInputBuilder().setCustomId("rules_text").setLabel("Rules Content (kosongkan untuk default)").setStyle(TextInputStyle.Paragraph).setPlaceholder("Tulis rules server kamu di sini...\nKosongkan untuk menggunakan rules default.").setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      // === EDIT WELCOME ===
      if (choice === "edit_welcome") {
        const modal = new ModalBuilder().setCustomId("modal_edit_config").setTitle("Edit Welcome Message");
        const input = new TextInputBuilder().setCustomId("welcome_text").setLabel("Welcome Text").setStyle(TextInputStyle.Paragraph).setPlaceholder("Selamat datang di server kami!").setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      return;
    }

    // === REMOVE SOCIAL SELECT HANDLER ===
    if (interaction.customId === "select_remove_social") {
      const index = parseInt(interaction.values[0]);
      const config = getGuildConfig(guildId) || {};

      // Migrate to SOCIAL_BUTTONS if needed
      if (!config.SOCIAL_BUTTONS) {
        config.SOCIAL_BUTTONS = getSocialButtons(config);
      }

      const removed = config.SOCIAL_BUTTONS.splice(index, 1);
      saveGuildConfig(guildId, { SOCIAL_BUTTONS: config.SOCIAL_BUTTONS });

      await updateSocialPanel(interaction.guild, getGuildConfig(guildId));
      return interaction.reply({ content: `✅ Tombol **${removed[0]?.label || "Unknown"}** berhasil dihapus! Panel telah diperbarui.`, flags: 64 });
    }

    return;
  }

  // MODALS TRIGGER (ctrl_ buttons)
  if (interaction.customId.startsWith("ctrl_")) {
    const adminRoleId = getConfig(guildId, "ADMIN_ROLE_ID");
    const devRoleId = getConfig(guildId, "DEV_ROLE_ID");
    const ownerRoleId = getConfig(guildId, "OWNER_ROLE_ID");
    const staffRoleId = getConfig(guildId, "STAFF_ROLE_ID");
    const guardRoleId = getConfig(guildId, "GUARD_ROLE_ID");
    const hasAccess = member.roles.cache.has(adminRoleId) || member.roles.cache.has(devRoleId) || member.roles.cache.has(ownerRoleId) || member.roles.cache.has(staffRoleId) || member.roles.cache.has(guardRoleId);
    if (!hasAccess) {
      return interaction.reply({ content: "❌ Access Denied: Staff only.", flags: 64 });
    }
    const action = interaction.customId.split("_")[1];

    if (action === "create" && interaction.customId.includes("role")) {
      const modal = new ModalBuilder().setCustomId("modal_create_role").setTitle("Create New Role");
      const nameInput = new TextInputBuilder().setCustomId("role_name").setLabel("Role Name").setStyle(TextInputStyle.Short).setRequired(true);
      const colorInput = new TextInputBuilder().setCustomId("role_color").setLabel("Hex Color (e.g. #FF0000)").setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("#FFFFFF");
      const permInput = new TextInputBuilder().setCustomId("role_perms").setLabel("Permissions (admin/mod/none)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("admin, mod, atau none");
      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(permInput)
      );
      return interaction.showModal(modal);
    }

    if (action === "manage" && interaction.customId.includes("role")) {
      const userSelect = new UserSelectMenuBuilder().setCustomId("manage_user_select").setPlaceholder("Pilih Member yang akan dikelola").setMinValues(1).setMaxValues(1);
      const roleSelect = new RoleSelectMenuBuilder().setCustomId("manage_role_select").setPlaceholder("Pilih Role yang akan diberikan/dicabut").setMinValues(1).setMaxValues(1);
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("manage_action_add").setLabel("ADD ROLE ➕").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("manage_action_remove").setLabel("REMOVE ROLE ➖").setStyle(ButtonStyle.Danger)
      );
      return interaction.reply({
        content: "🎭 **Manage Member Role**\nSilakan pilih Member dan Role di bawah ini, lalu tentukan aksinya.",
        components: [new ActionRowBuilder().addComponents(userSelect), new ActionRowBuilder().addComponents(roleSelect), actionRow],
        flags: 64
      });
    }

    if (action === "edit" && interaction.customId.includes("config")) {
      const select = new StringSelectMenuBuilder().setCustomId("select_edit_config").setPlaceholder("Pilih bagian yang ingin diperbarui")
        .addOptions([
          { label: "➕ Add Social Media", description: "Tambah tombol social media baru", value: "add_social" },
          { label: "➖ Remove Social Media", description: "Hapus tombol social media", value: "remove_social" },
          { label: "📝 Edit Social Description", description: "Ubah deskripsi embed social", value: "edit_social_desc" },
          { label: "📜 Edit Rules", description: "Ubah/set peraturan server", value: "edit_rules" },
          { label: "👋 Welcome Message", description: "Ubah pesan sambutan", value: "edit_welcome" }
        ]);
      return interaction.reply({ content: "⚙️ **Server Configuration Editor**", components: [new ActionRowBuilder().addComponents(select)], flags: 64 });
    }

    // Moderation modals
    const modal = new ModalBuilder().setCustomId(`modal_${action}`).setTitle(`${action.toUpperCase()} User`);
    const targetInput = new TextInputBuilder().setCustomId("target_id").setLabel("User ID / Mention").setPlaceholder("123456789...").setStyle(TextInputStyle.Short).setRequired(true);
    const reasonInput = new TextInputBuilder().setCustomId("reason").setLabel("Reason | Alasan").setPlaceholder("Breaking rules...").setStyle(TextInputStyle.Paragraph).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(targetInput), new ActionRowBuilder().addComponents(reasonInput));
    return interaction.showModal(modal);
  }

  // Quick Cooldown Check
  if (interaction.customId.startsWith("pm_")) return; // Handled by Panel Member system
  if (cooldown.has(member.id)) {
    const timeLeft = Date.now() - cooldown.get(member.id);
    if (timeLeft < 3000) return interaction.reply({ content: "⚠️ **Slow down!** Tunggu beberapa detik.", flags: 64 }).catch(() => {});
  }
  cooldown.set(member.id, Date.now());

  try {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: 64 }).catch(() => {});

    /* VERIFY */
    if (interaction.customId === "verify_button") {
      const verifyRoleId = getConfig(guildId, "VERIFY_ROLE_ID");
      const unverifiedRoleId = getConfig(guildId, "UNVERIFIED_ROLE_ID");
      const role = interaction.guild.roles.cache.get(verifyRoleId);
      if (member.roles.cache.has(verifyRoleId)) return interaction.editReply({ content: "⚠️ Kamu sudah terverifikasi sebelumnya!" });
      if (unverifiedRoleId) await member.roles.remove(unverifiedRoleId).catch(() => {});
      await member.roles.add(role).catch(() => {});
      const roleChId = getConfig(guildId, "ROLE_CHANNEL_ID");
      return interaction.editReply({ content: `✅ **Verifikasi Berhasil!**\n\nSilakan ambil role gender kamu di channel <#${roleChId}>.` });
    }

    /* MEMBER ROLE */
    if (interaction.customId === "member_role") {
      const memberRoleId = getConfig(guildId, "MEMBER_ROLE_ID");
      if (!memberRoleId) return interaction.editReply({ content: "❌ Role Member belum dikonfigurasi." });
      if (member.roles.cache.has(memberRoleId)) return interaction.editReply({ content: "⚠️ Kamu sudah memiliki role **MEMBER 📋**!" });
      // Check if member has Input Data
      const memberData = getMemberData(guildId, member.id);
      if (!memberData) {
        const panelChId = getGuildMembers(guildId).panelChannelId || getConfig(guildId, "MEMBER_PANEL_CHANNEL_ID");
        const channelRef = panelChId ? ` Silakan daftar di <#${panelChId}>.` : "";
        return interaction.editReply({ content: `❌ Kamu harus **Input Data** terlebih dahulu sebelum mengambil role Member!${channelRef}` });
      }
      await member.roles.add(memberRoleId).catch(() => {});
      return interaction.editReply({ content: "✅ **Role MEMBER 📋 Berhasil Diberikan!**\n\nSekarang kamu bisa memilih gender (MAN/WOMAN)." });
    }

    /* GENDER ROLES */
    if (interaction.customId === "man_role") {
      // Check registration requirement
      const memberData = getMemberData(guildId, member.id);
      if (!memberData) {
        const panelChId = getGuildMembers(guildId).panelChannelId || getConfig(guildId, "MEMBER_PANEL_CHANNEL_ID");
        const channelRef = panelChId ? ` Silakan daftar di <#${panelChId}>.` : "";
        return interaction.editReply({ content: `❌ Kamu harus Input Data terlebih dahulu di Panel Member sebelum mengambil role!${channelRef}` });
      }
      // Check Member role requirement
      const memberRoleId = getConfig(guildId, "MEMBER_ROLE_ID");
      if (memberRoleId && !member.roles.cache.has(memberRoleId)) {
        return interaction.editReply({ content: "❌ Kamu harus mengambil role **MEMBER 📋** terlebih dahulu sebelum memilih gender!" });
      }
      const manRoleId = getConfig(guildId, "MAN_ROLE_ID");
      const womanRoleId = getConfig(guildId, "WOMAN_ROLE_ID");
      if (member.roles.cache.has(manRoleId)) return interaction.editReply({ content: "⚠️ Kamu sudah memiliki role **MAN 💪**!" });
      if (womanRoleId) await member.roles.remove(womanRoleId).catch(() => {});
      await member.roles.add(manRoleId).catch(() => {});
      const chatChId = getConfig(guildId, "CHAT_CHANNEL_ID");
      return interaction.editReply({ content: `✅ **Role MAN 💪 Berhasil Diberikan!**\n\nSekarang kamu bisa chatting di <#${chatChId}>.` });
    }
    if (interaction.customId === "woman_role") {
      // Check registration requirement
      const memberData = getMemberData(guildId, member.id);
      if (!memberData) {
        const panelChId = getGuildMembers(guildId).panelChannelId || getConfig(guildId, "MEMBER_PANEL_CHANNEL_ID");
        const channelRef = panelChId ? ` Silakan daftar di <#${panelChId}>.` : "";
        return interaction.editReply({ content: `❌ Kamu harus Input Data terlebih dahulu di Panel Member sebelum mengambil role!${channelRef}` });
      }
      // Check Member role requirement
      const memberRoleId = getConfig(guildId, "MEMBER_ROLE_ID");
      if (memberRoleId && !member.roles.cache.has(memberRoleId)) {
        return interaction.editReply({ content: "❌ Kamu harus mengambil role **MEMBER 📋** terlebih dahulu sebelum memilih gender!" });
      }
      const manRoleId = getConfig(guildId, "MAN_ROLE_ID");
      const womanRoleId = getConfig(guildId, "WOMAN_ROLE_ID");
      if (member.roles.cache.has(womanRoleId)) return interaction.editReply({ content: "⚠️ Kamu sudah memiliki role **WOMAN 🌸**!" });
      if (manRoleId) await member.roles.remove(manRoleId).catch(() => {});
      await member.roles.add(womanRoleId).catch(() => {});
      const chatChId = getConfig(guildId, "CHAT_CHANNEL_ID");
      return interaction.editReply({ content: `✅ **Role WOMAN 🌸 Berhasil Diberikan!**\n\nSekarang kamu bisa chatting di <#${chatChId}>.` });
    }

    /* ADMIN REQUEST */
    if (interaction.customId === "admin_role") {
      const adminRoleId = getConfig(guildId, "ADMIN_ROLE_ID");
      const devRoleId = getConfig(guildId, "DEV_ROLE_ID");
      const adminPanelChId = getConfig(guildId, "ADMIN_PANEL_CHANNEL_ID");
      if (member.roles.cache.has(adminRoleId)) return interaction.editReply({ content: "⚠️ Kamu sudah menjadi **ADMIN**!" });
      const adminPanelCh = interaction.guild.channels.cache.get(adminPanelChId);
      if (!adminPanelCh) return interaction.editReply({ content: "❌ Sistem Admin Panel belum siap." });
      await interaction.editReply({ content: "✅ Permintaan Anda telah dikirim ke Staff. Mohon tunggu peninjauan." });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`approve_admin_${member.id}`).setLabel("Approve").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`deny_admin_${member.id}`).setLabel("Tolak").setStyle(ButtonStyle.Danger)
      );
      const embed = new EmbedBuilder().setColor("Yellow").setTitle("🛡️ New Admin Request")
        .setDescription(`User: ${member} (${member.id})\nMeminta akses sebagai Admin.`).setTimestamp();
      sendLog(interaction.guild, new EmbedBuilder().setColor("Blue").setTitle("📝 Admin Request Log")
        .setDescription(`Member ${member} telah mengajukan permintaan menjadi Admin.`).setTimestamp());
      return adminPanelCh.send({ content: `<@&${devRoleId}>`, embeds: [embed], components: [row] });
    }

    /* MANAGE ACTION BUTTONS */
    if (interaction.customId.startsWith("manage_action_")) {
      const action = interaction.customId.split("_")[2];
      const userData = manageCache.get(interaction.user.id);
      if (!userData || !userData.targetId || !userData.roleId) return interaction.editReply("❌ Silakan pilih Member DAN Role terlebih dahulu!");
      const targetMember = await interaction.guild.members.fetch(userData.targetId).catch(() => null);
      if (!targetMember) return interaction.editReply("❌ Member tidak ditemukan.");
      const devRoleId = getConfig(guildId, "DEV_ROLE_ID");
      const isOwner = targetMember.id === interaction.guild.ownerId;
      const isDev = targetMember.roles.cache.has(devRoleId);
      if ((isOwner || isDev) && interaction.user.id !== interaction.guild.ownerId) return interaction.editReply("❌ Kamu tidak bisa memodifikasi Role milik Owner atau Developer!");
      const botMember = interaction.guild.members.me;
      const targetRole = interaction.guild.roles.cache.get(userData.roleId);
      if (!targetRole) return interaction.editReply("❌ Role tidak ditemukan.");
      if (targetRole.position >= botMember.roles.highest.position) return interaction.editReply("❌ Role lebih tinggi dari Bot!");
      if (action === "add") {
        await targetMember.roles.add(userData.roleId).catch(e => interaction.editReply(`❌ Gagal: ${e.message}`));
        interaction.editReply(`✅ Berhasil menambahkan Role ke **${targetMember.user.tag}**`);
      } else {
        await targetMember.roles.remove(userData.roleId).catch(e => interaction.editReply(`❌ Gagal: ${e.message}`));
        interaction.editReply(`✅ Berhasil mencabut Role dari **${targetMember.user.tag}**`);
      }
      manageCache.delete(interaction.user.id);
      return;
    }

    /* ADMIN APPROVALS */
    if (interaction.customId.startsWith("approve_admin_") || interaction.customId.startsWith("deny_admin_")) {
      const devRoleId = getConfig(guildId, "DEV_ROLE_ID");
      if (!member.roles.cache.has(devRoleId)) return interaction.editReply({ content: "❌ Hanya Owner/Developer yang bisa melakukan approval." });
      const parts = interaction.customId.split("_");
      const action = parts[0];
      const targetUserId = parts[2];
      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (!targetMember) return interaction.editReply({ content: "❌ Member tidak ditemukan." });

      if (action === "approve") {
        const adminRoleId = getConfig(guildId, "ADMIN_ROLE_ID");
        await targetMember.roles.add(adminRoleId).catch(() => {});
        targetMember.send(`🎉 Permintaan admin Anda di **${interaction.guild.name}** telah **DISETUJUI**.`).catch(() => {});
        sendLog(interaction.guild, new EmbedBuilder().setColor("Green").setTitle("✅ Admin Role Granted")
          .setDescription(`Target: ${targetMember}\nBy: ${interaction.user}`).setTimestamp());
        await interaction.message.edit({ components: [] });
        const reply = await interaction.editReply({ embeds: [new EmbedBuilder().setColor("Green").setTitle("✅ Admin Approved").setDescription(`Target: ${targetMember}\nApproved By: ${interaction.user}`).setTimestamp()] });
        setTimeout(() => { interaction.message.delete().catch(() => {}); reply.delete().catch(() => {}); }, 5000);
      } else {
        targetMember.send(`❌ Permintaan admin Anda di **${interaction.guild.name}** telah **DITOLAK**.`).catch(() => {});
        sendLog(interaction.guild, new EmbedBuilder().setColor("Red").setTitle("❌ Admin Request Rejected")
          .setDescription(`Target: ${targetMember}\nBy: ${interaction.user}`).setTimestamp());
        await interaction.message.edit({ components: [] });
        const reply = await interaction.editReply({ embeds: [new EmbedBuilder().setColor("Red").setTitle("❌ Admin Denied").setDescription(`Target: ${targetMember}\nRejected By: ${interaction.user}`).setTimestamp()] });
        setTimeout(() => { interaction.message.delete().catch(() => {}); reply.delete().catch(() => {}); }, 5000);
      }
      return;
    }

    /* RULES & ROLE INFO */
    if (interaction.customId === "show_rules" || interaction.customId === "rules_display") {
      const config = getGuildConfig(guildId);
      const customRules = config?.CUSTOM_RULES || "";
      const defaultRules =
        "🛡️ **1. Respect Everyone | Hormati Semua Orang**\nPerlakukan semua anggota dengan hormat.\n\n" +
        "🚫 **2. No Spamming | Dilarang Spam**\nJangan mengirim pesan berlebihan.\n\n" +
        "🔞 **3. No NSFW Content | Tidak Ada Konten Dewasa**\nKonten dewasa tidak diizinkan.\n\n" +
        "👮 **4. Follow Staff | Ikuti Instruksi Staff**\nKeputusan staff adalah mutlak.";

      // Jika ada custom rules, tampilkan HANYA custom rules. Jika tidak ada, tampilkan default.
      const rulesText = customRules ? customRules : defaultRules;

      const embed = new EmbedBuilder().setColor("#FF4757").setTitle("⚖️ Server Rules & Regulations")
        .setThumbnail(interaction.guild.iconURL())
        .setDescription(rulesText)
        .setFooter({ text: "FiiCruzh Rules System" }).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.customId === "role_info_display") {
      const embed = new EmbedBuilder().setColor("#2F3136").setTitle("🛡️ Role Information")
        .setDescription("**Dev**: Mengelola server\n**Admin**: Menjaga ketertiban\n**Member**: Anggota resmi");
      return interaction.editReply({ embeds: [embed] });
    }

    /* PROFILE */
    if (interaction.customId === "profile_button") {
      const profileImage = await createProfileCard(member);
      const embed = new EmbedBuilder().setColor("#5865F2").setTitle(`👤 ${interaction.user.username}'s Profile`).setImage("attachment://profile.png");
      return interaction.editReply({ embeds: [embed], files: [profileImage] });
    }

    /* TICKET */
    if (interaction.customId === "open_ticket") {
      // Legacy fallback for old ticket panels
      const ticketCatId = getConfig(guildId, "TICKET_CATEGORY_ID");
      const adminRoleId = getConfig(guildId, "ADMIN_ROLE_ID");
      const existing = interaction.guild.channels.cache.find(c => c.name.startsWith(`ticket-`) && c.name.includes(interaction.user.username.toLowerCase().slice(0, 8)));
      if (existing) return interaction.editReply({ content: `❌ Kamu sudah memiliki tiket terbuka: ${existing}` });
      const channel = await interaction.guild.channels.create({
        name: `ticket-general-${interaction.user.username.slice(0, 10)}`, type: 0, parent: ticketCatId || null,
        topic: `Ticket by ${interaction.user.tag} | Category: General | Opened: ${new Date().toLocaleString('id-ID')}`,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });
      const embed = new EmbedBuilder().setColor("#00BFFF").setTitle("🎫 Ticket — 💬 General")
        .setDescription(`Halo ${interaction.user}! Tiket kamu telah dibuat.\nSilakan jelaskan masalah kamu.`)
        .setFooter({ text: `Ticket ID: ${channel.id}` }).setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ticket_claim").setLabel("✋ Claim Ticket").setStyle(ButtonStyle.Primary)
      );
      await channel.send({ content: `${member} | <@&${adminRoleId}>`, embeds: [embed], components: [row] });
      return interaction.editReply({ content: `✅ Tiket kamu telah dibuat: ${channel}` });
    }

    if (interaction.customId === "ticket_claim") {
      const adminRoleId = getConfig(guildId, "ADMIN_ROLE_ID");
      const devRoleId = getConfig(guildId, "DEV_ROLE_ID");
      if (!member.roles.cache.has(adminRoleId) && !member.roles.cache.has(devRoleId)) {
        return interaction.editReply({ content: "❌ Hanya staff yang bisa claim tiket." });
      }
      const claimEmbed = new EmbedBuilder()
        .setColor("#2ECC71")
        .setTitle("✋ Ticket Claimed")
        .setDescription(`Tiket ini sedang ditangani oleh ${interaction.user}.`)
        .setTimestamp();
      await interaction.message.edit({ components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("ticket_claim").setLabel(`✋ ${interaction.user.username}`).setStyle(ButtonStyle.Primary).setDisabled(true)
        )
      ] });
      await interaction.channel.send({ embeds: [claimEmbed] });
      return interaction.editReply({ content: `✅ Kamu telah claim tiket ini.` });
    }

    if (interaction.customId === "ticket_close" || interaction.customId === "close_ticket") {
      // Show confirmation with transcript option
      const confirmEmbed = new EmbedBuilder()
        .setColor("#FF6B6B")
        .setTitle("🔒 Konfirmasi Tutup Tiket")
        .setDescription("Apakah kamu yakin ingin menutup tiket ini?\nTranscript akan otomatis disimpan ke log channel.")
        .setTimestamp();
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_close_confirm").setLabel("✅ Ya, Tutup").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ticket_close_cancel").setLabel("❌ Batal").setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });
    }

    if (interaction.customId === "ticket_close_cancel") {
      return interaction.editReply({ content: "✅ Penutupan tiket dibatalkan.", embeds: [], components: [] });
    }

    if (interaction.customId === "ticket_close_confirm") {
      await interaction.editReply({ content: "⏳ Menyimpan transcript dan menutup tiket...", embeds: [], components: [] });

      // Generate transcript
      try {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        let transcript = `📋 TICKET TRANSCRIPT\n`;
        transcript += `Channel: ${interaction.channel.name}\n`;
        transcript += `Closed by: ${interaction.user.tag}\n`;
        transcript += `Date: ${new Date().toLocaleString('id-ID')}\n`;
        transcript += `${"═".repeat(50)}\n\n`;

        sorted.forEach(msg => {
          const time = msg.createdAt.toLocaleString('id-ID');
          transcript += `[${time}] ${msg.author.tag}: ${msg.content || "[Embed/Attachment]"}\n`;
        });

        // Send transcript to log channel
        const logChannelId = getConfig(guildId, "LOG_CHANNEL_ID");
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const transcriptBuffer = Buffer.from(transcript, 'utf-8');
          const transcriptFile = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${interaction.channel.name}.txt` });

          const logEmbed = new EmbedBuilder()
            .setColor("Grey")
            .setTitle("🔒 Ticket Closed")
            .setDescription(
              `**Channel:** ${interaction.channel.name}\n` +
              `**Closed by:** ${interaction.user}\n` +
              `**Messages:** ${sorted.size}\n` +
              `**Duration:** ${getTicketDuration(interaction.channel.createdAt)}`
            )
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed], files: [transcriptFile] });
        }
      } catch (e) {
        console.error("Transcript Error:", e);
      }

      // Send rating request to ticket opener via DM
      try {
        const ticketTopic = interaction.channel.topic || "";
        const openerMatch = ticketTopic.match(/Ticket by (.+?) \|/);
        if (openerMatch) {
          const openerTag = openerMatch[1];
          const opener = interaction.guild.members.cache.find(m => m.user.tag === openerTag);
          if (opener && opener.id !== interaction.user.id) {
            await opener.send({
              embeds: [new EmbedBuilder()
                .setColor("#FFD700")
                .setTitle("⭐ Rate Your Support Experience")
                .setDescription(`Tiket kamu di **${interaction.guild.name}** telah ditutup.\nBagaimana pengalaman support kamu?`)
                .setTimestamp()
              ]
            }).catch(() => {});
          }
        }
      } catch { }

      // Delete channel after 5 seconds
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    /* SUGGESTION VOTING */
    if (interaction.customId === "suggest_up" || interaction.customId === "suggest_down") {
      const msgId = interaction.message.id;
      const voters = suggestVoters.get(msgId) || new Set();
      if (voters.has(interaction.user.id)) return interaction.editReply("⚠️ Kamu sudah memberikan suara!");
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      let up = parseInt(embed.data.fields[0].value);
      let down = parseInt(embed.data.fields[1].value);
      if (interaction.customId === "suggest_up") up++; else down++;
      embed.data.fields[0].value = up.toString();
      embed.data.fields[1].value = down.toString();
      const row = ActionRowBuilder.from(interaction.message.components[0]);
      row.components[0].setLabel(`👍 ${up}`);
      row.components[1].setLabel(`👎 ${down}`);
      voters.add(interaction.user.id);
      suggestVoters.set(msgId, voters);
      await interaction.message.edit({ embeds: [embed], components: [row] });
      return interaction.editReply("✅ Suara kamu berhasil direkam!");
    }

  } catch (err) {
    if (err.code !== 40060) logError("Interaction", err, guildId);
  }
});

/* ================= MODAL HANDLER ================= */

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isModalSubmit()) return;
  try {
    const guildId = interaction.guild.id;

    if (interaction.customId === "modal_create_role") {
      await interaction.deferReply({ flags: 64 });
      const name = interaction.fields.getTextInputValue("role_name");
      const color = interaction.fields.getTextInputValue("role_color") || "#FFFFFF";
      const permsType = interaction.fields.getTextInputValue("role_perms").toLowerCase();
      let permissions = [];
      if (permsType === "admin") permissions = [PermissionFlagsBits.Administrator];
      else if (permsType === "mod") permissions = [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers];
      const role = await interaction.guild.roles.create({ name, color, permissions, reason: `Created by: ${interaction.user.tag}` }).catch(e => null);
      if (role) return interaction.editReply(`✅ Role **${role.name}** berhasil dibuat.`);
      return interaction.editReply("❌ Gagal membuat role.");
    }

    // === ADD SOCIAL MEDIA MODAL ===
    if (interaction.customId === "modal_add_social") {
      await interaction.deferReply({ flags: 64 });
      const label = interaction.fields.getTextInputValue("social_label").trim();
      const url = interaction.fields.getTextInputValue("social_url").trim();

      if (!isValidURL(url)) {
        return interaction.editReply("❌ URL tidak valid! Harus dimulai dengan `http://` atau `https://`.");
      }

      const config = getGuildConfig(guildId) || {};
      // Migrate to SOCIAL_BUTTONS if needed
      if (!config.SOCIAL_BUTTONS) {
        config.SOCIAL_BUTTONS = getSocialButtons(config);
      }
      config.SOCIAL_BUTTONS.push({ label, url });
      saveGuildConfig(guildId, { SOCIAL_BUTTONS: config.SOCIAL_BUTTONS });

      await updateSocialPanel(interaction.guild, getGuildConfig(guildId));
      return interaction.editReply(`✅ Tombol **${label}** berhasil ditambahkan! Panel telah diperbarui.`);
    }

    // === EDIT SOCIAL DESCRIPTION MODAL ===
    if (interaction.customId === "modal_edit_social_desc") {
      await interaction.deferReply({ flags: 64 });
      const desc = interaction.fields.getTextInputValue("social_desc")?.trim() || "";
      const config = getGuildConfig(guildId) || {};
      if (desc) {
        config.SOCIAL_DESCRIPTION = desc;
      } else {
        delete config.SOCIAL_DESCRIPTION; // Use default
      }
      saveGuildConfig(guildId, desc ? { SOCIAL_DESCRIPTION: desc } : { SOCIAL_DESCRIPTION: null });

      await updateSocialPanel(interaction.guild, getGuildConfig(guildId));
      return interaction.editReply("✅ **Deskripsi Social Panel berhasil diperbarui!**");
    }

    if (interaction.customId === "modal_edit_config") {
      await interaction.deferReply({ flags: 64 });
      const rules = interaction.fields.fields.get("rules_text")?.value;
      const welcome = interaction.fields.fields.get("welcome_text")?.value;
      const currentConfig = getGuildConfig(guildId) || {};

      if (rules !== undefined) currentConfig.CUSTOM_RULES = rules || ""; // Empty = use default
      if (welcome) currentConfig.WELCOME_MESSAGE = welcome;
      saveGuildConfig(guildId, currentConfig);

      return interaction.editReply("✅ **Konfigurasi Berhasil Diperbarui!**");
    }

    // Moderation modals
    if (interaction.customId.startsWith("modal_pm_")) return; // Handled by Panel Member system
    const action = interaction.customId.split("_")[1];
    const targetInput = interaction.fields.getTextInputValue("target_id").replace(/[<@!>]/g, "");
    const reason = interaction.fields.getTextInputValue("reason");
    await interaction.deferReply({ flags: 64 });
    const target = await interaction.guild.members.fetch(targetInput).catch(() => null);
    if (!target) return interaction.editReply({ content: "❌ User tidak ditemukan." });

    const botMember = interaction.guild.members.me;
    if (target.roles.highest.position >= botMember.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.editReply({ content: "❌ Member ini memiliki posisi role lebih tinggi dari Bot!" });
    }

    if (action === "mute") {
      await target.timeout(24 * 60 * 60 * 1000, reason);
      interaction.editReply({ content: `✅ **${target.user.tag}** telah di-Mute selama 24 jam.` });
    } else if (action === "unmute") {
      await target.timeout(null);
      interaction.editReply({ content: `✅ **${target.user.tag}** telah di-Unmute.` });
    } else if (action === "warn") {
      const warnCount = addWarn(guildId, target.id, reason, interaction.user.tag);
      await target.send({ content: `⚠️ **Warning from ${interaction.guild.name}**\nReason: ${reason}\n\n⚠️ Total Warnings: **${warnCount}**/3${warnCount >= 3 ? "\n\n🔇 Kamu telah di-mute otomatis karena 3 warnings!" : ""}` }).catch(() => {});

      // Auto-mute after 3 warnings
      if (warnCount >= 3) {
        await target.timeout(24 * 60 * 60 * 1000, "Auto-mute: 3 warnings reached").catch(() => {});
        interaction.editReply({ content: `✅ **${target.user.tag}** telah diberikan peringatan ke-**${warnCount}**.\n🔇 **Auto-Mute 24 jam** karena sudah 3 warnings!` });
      } else {
        interaction.editReply({ content: `✅ **${target.user.tag}** telah diberikan peringatan ke-**${warnCount}**/3.` });
      }
    } else if (action === "kick") {
      if (!target.kickable) return interaction.editReply({ content: "❌ Tidak bisa Kick user ini." });
      await target.kick(reason);
      interaction.editReply({ content: `✅ **${target.user.tag}** telah di-Kick.` });
    } else if (action === "ban") {
      if (!target.bannable) return interaction.editReply({ content: "❌ Tidak bisa Ban user ini." });
      await target.ban({ reason });
      interaction.editReply({ content: `✅ **${target.user.tag}** telah di-Ban.` });
    }

    sendLog(interaction.guild, new EmbedBuilder().setColor("DarkRed").setTitle(`🔨 Moderation: ${action.toUpperCase()}`)
      .addFields(
        { name: "Target", value: `${target.user.tag} (\`${target.id}\`)`, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason }
      ).setTimestamp());

  } catch (err) {
    console.log("Modal Error:", err);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: "❌ Terjadi kesalahan.", flags: 64 }).catch(() => {});
    } else {
      interaction.editReply({ content: "❌ Terjadi kesalahan." }).catch(() => {});
    }
  }
});

/* ================= GUILD JOIN SYSTEM ================= */

client.on(Events.GuildCreate, async guild => {
  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("🚀 Thanks for Inviting FiiCruzh Public Bot!")
    .setDescription(
      "Halo Owner! Terima kasih telah mempercayakan **FiiCruzh Ecosystem** untuk mengelola server Anda.\n\n" +
      "### 🛠️ Cara Memulai (Setup):\n" +
      "Cukup ketik perintah:\n## `/fiicruzh`\n\n" +
      "Bot akan menampilkan wizard interaktif untuk memilih:\n" +
      "• **🔧 Manual Setup** — Pilih channel existing\n" +
      "• **🚀 Automatic Setup** — Bot buat channel otomatis\n\n" +
      "### 💡 Fitur Utama:\n" +
      "✅ Auto-Provisioning & Manual Channel Assignment\n" +
      "✅ Tiered Access (Verify ➔ Role ➔ Chat)\n" +
      "✅ Real-time Stats di Voice Channel\n" +
      "✅ Admin Panel & Moderation System\n" +
      "✅ Ticket Support System\n\n" +
      "*Butuh bantuan? Hubungi Developer FiiCruzh!*"
    )
    .setThumbnail(guild.iconURL())
    .setFooter({ text: "FiiCruzh Public Bot - Premium Community System" })
    .setTimestamp();

  const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
  if (channel) channel.send({ embeds: [embed] }).catch(() => {});

  try {
    const owner = await guild.fetchOwner();
    if (owner) await owner.send({ content: `👋 Halo **${owner.user.username}**! Terima kasih telah mengundang **FiiCruzh Bot** ke server **${guild.name}**.`, embeds: [embed] });
  } catch (err) { console.log("Gagal kirim DM ke Owner:", err.message); }
});

/* ================= GLOBAL ERROR HANDLER ================= */

client.on("error", (err) => logError("Discord Client", err));
process.on("unhandledRejection", (error) => logError("Unhandled Rejection", error));
process.on("uncaughtException", (error) => logError("Uncaught Exception", error));

/* ================= PANEL MEMBER SYSTEM ================= */

const MEMBER_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function getMemberLogChannel(guild, guildId) {
  const memberLogId = getConfig(guildId, "MEMBER_LOG_CHANNEL_ID");
  if (memberLogId) {
    const ch = guild.channels.cache.get(memberLogId);
    if (ch) return ch;
  }
  const logId = getConfig(guildId, "LOG_CHANNEL_ID");
  if (logId) return guild.channels.cache.get(logId) || null;
  return null;
}

function checkMemberCooldown(guildId, userId, actionType) {
  const key = `${guildId}-${userId}-${actionType}`;
  const lastUsed = memberCooldown.get(key);
  if (!lastUsed) return { onCooldown: false };
  const elapsed = Date.now() - lastUsed;
  if (elapsed >= MEMBER_COOLDOWN_MS) return { onCooldown: false };
  const remaining = MEMBER_COOLDOWN_MS - elapsed;
  const minutes = Math.max(1, Math.ceil(remaining / 60000));
  return { onCooldown: true, minutes };
}

function setMemberCooldown(guildId, userId, actionType) {
  const key = `${guildId}-${userId}-${actionType}`;
  memberCooldown.set(key, Date.now());
}

// Cache for staff select menu target (pm_select flows)
const pmSelectCache = new Map();

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton() && !interaction.isAnySelectMenu() && !interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith("pm_") && !interaction.customId.startsWith("modal_pm_")) return;

  const member = interaction.member;
  const guildId = interaction.guild.id;

  try {
    // === BUTTON HANDLERS ===
    if (interaction.isButton()) {

      // --- INPUT DATA ---
      if (interaction.customId === "pm_input_data") {
        const cd = checkMemberCooldown(guildId, member.id, "input_data");
        if (cd.onCooldown) return interaction.reply({ content: `⏳ Tunggu ${cd.minutes} menit`, flags: 64 });
        const modal = new ModalBuilder().setCustomId("modal_pm_input_data").setTitle("📁 Input Data Member");
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("roblox_name").setLabel("Nama Roblox (wajib akhiri CHAOS)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20).setPlaceholder("contoh: FiiCruzhCHAOS")),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nickname").setLabel("Nama Panggilan").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32).setPlaceholder("contoh: Fii")),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("address").setLabel("Alamat").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder("contoh: Jakarta"))
        );
        return interaction.showModal(modal);
      }

      // --- CHANGE NAME ---
      if (interaction.customId === "pm_change_name") {
        const existing = getMemberData(guildId, member.id);
        if (!existing) return interaction.reply({ content: "❌ Kamu belum terdaftar! Gunakan **Input Data** terlebih dahulu.", flags: 64 });
        const cd = checkMemberCooldown(guildId, member.id, "change_name");
        if (cd.onCooldown) return interaction.reply({ content: `⏳ Tunggu ${cd.minutes} menit`, flags: 64 });
        const modal = new ModalBuilder().setCustomId("modal_pm_change_name").setTitle("✏️ Change Roblox Name");
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("roblox_name").setLabel("Nama Roblox Baru (wajib akhiri CHAOS)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20).setPlaceholder("contoh: NewNameCHAOS"))
        );
        return interaction.showModal(modal);
      }

      // --- INPUT MANUAL (Staff Only) ---
      if (interaction.customId === "pm_input_manual") {
        if (!hasStaffAccess(member, guildId)) return interaction.reply({ content: "❌ Hanya admin!", flags: 64 });
        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder().setCustomId("pm_select_manual").setPlaceholder("Pilih member target").setMinValues(1).setMaxValues(1)
        );
        return interaction.reply({ content: "👤 **Pilih member yang ingin didaftarkan:**", components: [row], flags: 64 });
      }

      // --- SEARCH (Staff Only) ---
      if (interaction.customId === "pm_search") {
        if (!hasStaffAccess(member, guildId)) return interaction.reply({ content: "❌ Hanya admin!", flags: 64 });
        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder().setCustomId("pm_select_search").setPlaceholder("Pilih member untuk dicari").setMinValues(1).setMaxValues(1)
        );
        return interaction.reply({ content: "🔍 **Pilih member yang ingin dicari datanya:**", components: [row], flags: 64 });
      }

      // --- EDIT (Staff Only) ---
      if (interaction.customId === "pm_edit") {
        if (!hasStaffAccess(member, guildId)) return interaction.reply({ content: "❌ Hanya admin!", flags: 64 });
        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder().setCustomId("pm_select_edit").setPlaceholder("Pilih member untuk diedit").setMinValues(1).setMaxValues(1)
        );
        return interaction.reply({ content: "✏️ **Pilih member yang ingin diedit namanya:**", components: [row], flags: 64 });
      }

      // --- TITLE CHANGE (via admin panel button) ---
      if (interaction.customId === "pm_title") {
        if (!hasStaffAccess(member, guildId)) return interaction.reply({ content: "❌ Hanya admin!", flags: 64 });
        const modal = new ModalBuilder().setCustomId("modal_pm_title").setTitle("📝 Ubah Judul List Member");
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("title").setLabel("Judul Baru (maks 50 karakter)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50).setPlaceholder("contoh: MARA SALVATRUCHA"))
        );
        return interaction.showModal(modal);
      }

      // --- DELETE MEMBER (Staff Only) ---
      if (interaction.customId === "pm_delete") {
        if (!hasStaffAccess(member, guildId)) return interaction.reply({ content: "❌ Hanya admin!", flags: 64 });
        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder().setCustomId("pm_select_delete").setPlaceholder("Pilih member untuk dihapus dari list").setMinValues(1).setMaxValues(1)
        );
        return interaction.reply({ content: "🗑️ **Pilih member yang ingin dihapus dari list:**", components: [row], flags: 64 });
      }
    }

    // === SELECT MENU HANDLERS ===
    if (interaction.isAnySelectMenu()) {

      // --- MANUAL SELECT ---
      if (interaction.customId === "pm_select_manual") {
        const targetId = interaction.values[0];
        const modal = new ModalBuilder().setCustomId(`modal_pm_input_manual_${targetId}`).setTitle("📁 Input Manual Member");
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("roblox_name").setLabel("Nama Roblox (wajib akhiri CHAOS)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32).setPlaceholder("contoh: FiiCruzhCHAOS")),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nickname").setLabel("Nama Panggilan").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32).setPlaceholder("contoh: Fii"))
        );
        return interaction.showModal(modal);
      }

      // --- SEARCH SELECT ---
      if (interaction.customId === "pm_select_search") {
        const targetId = interaction.values[0];
        const data = getMemberData(guildId, targetId);
        if (!data) return interaction.update({ content: "❌ Member ini belum terdaftar.", components: [] });
        const regDate = data.registeredAt ? new Date(data.registeredAt).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A";
        const embed = new EmbedBuilder()
          .setColor("#00BFFF")
          .setTitle("🔍 Data Member")
          .setDescription(`<@${targetId}>`)
          .addFields(
            { name: "Nama Roblox", value: data.robloxName || "N/A", inline: true },
            { name: "Nama Panggilan", value: data.nickname || "N/A", inline: true },
            { name: "Alamat", value: data.address || "N/A", inline: false },
            { name: "Tanggal Daftar", value: regDate, inline: true }
          )
          .setTimestamp();
        return interaction.update({ content: "", embeds: [embed], components: [] });
      }

      // --- EDIT SELECT ---
      if (interaction.customId === "pm_select_edit") {
        const targetId = interaction.values[0];
        const data = getMemberData(guildId, targetId);
        if (!data) return interaction.update({ content: "❌ Member ini belum terdaftar.", components: [] });
        const modal = new ModalBuilder().setCustomId(`modal_pm_edit_${targetId}`).setTitle("✏️ Edit Nama Roblox");
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("roblox_name").setLabel("Nama Roblox Baru (wajib akhiri CHAOS)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32).setPlaceholder(data.robloxName || "NamaCHAOS"))
        );
        return interaction.showModal(modal);
      }

      // --- DELETE SELECT ---
      if (interaction.customId === "pm_select_delete") {
        const targetId = interaction.values[0];
        const data = getMemberData(guildId, targetId);
        if (!data) return interaction.update({ content: "❌ Member ini belum terdaftar.", components: [] });

        // Remove from members cache
        const guildData = getGuildMembers(guildId);
        delete guildData.members[targetId];
        saveMembers();
        // Sync delete to Supabase
        dbDeleteMember(guildId, targetId).catch(() => {});

        // Update list embed
        await updateMemberListEmbed(interaction.guild, guildId);

        return interaction.update({ content: `✅ **Berhasil!** Data <@${targetId}> (${data.robloxName}) telah dihapus dari list member.`, components: [] });
      }
    }

    // === MODAL HANDLERS ===
    if (interaction.isModalSubmit()) {

      // --- INPUT DATA MODAL ---
      if (interaction.customId === "modal_pm_input_data") {
        await interaction.deferReply({ flags: 64 });
        const robloxName = interaction.fields.getTextInputValue("roblox_name").trim();
        const nickname = interaction.fields.getTextInputValue("nickname").trim();
        const address = interaction.fields.getTextInputValue("address").trim();

        const validation = validateRobloxName(robloxName);
        if (!validation.valid) return interaction.editReply({ content: validation.error });

        // Save data
        saveMemberData(guildId, member.id, { robloxName, nickname, address });

        // Set nickname
        let nickFailed = false;
        try { await member.setNickname(robloxName); } catch { nickFailed = true; }

        // Update list
        await updateMemberListEmbed(interaction.guild, guildId);

        // Send log
        const logChannel = getMemberLogChannel(interaction.guild, guildId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("#00FF00")
            .setTitle("📋 Log Member")
            .setDescription(`Registered by: ${member}`)
            .addFields(
              { name: "Nama Roblox", value: robloxName, inline: true },
              { name: "Nama Panggilan", value: nickname, inline: true },
              { name: "Alamat", value: address, inline: false }
            )
            .setTimestamp();
          const logContent = `Nama Roblox: ${robloxName}\nNama Panggilan: ${nickname}\nAlamat: ${address}`;
          const logFile = new AttachmentBuilder(Buffer.from(logContent, "utf-8"), { name: "log_member.txt" });
          await logChannel.send({ embeds: [logEmbed], files: [logFile] }).catch(() => console.warn("[PanelMember] Failed to send log"));
        }

        // Set cooldown
        setMemberCooldown(guildId, member.id, "input_data");

        let reply = "✅ **Berhasil!** Data kamu telah disimpan.";
        if (nickFailed) reply += "\n⚠️ Nickname tidak bisa diubah (bot tidak punya izin).";
        return interaction.editReply({ content: reply });
      }

      // --- CHANGE NAME MODAL ---
      if (interaction.customId === "modal_pm_change_name") {
        await interaction.deferReply({ flags: 64 });
        const robloxName = interaction.fields.getTextInputValue("roblox_name").trim();

        const validation = validateRobloxName(robloxName);
        if (!validation.valid) return interaction.editReply({ content: validation.error });

        // Update data
        saveMemberData(guildId, member.id, { robloxName });

        // Set nickname
        let nickFailed = false;
        try { await member.setNickname(robloxName); } catch { nickFailed = true; }

        // Update list
        await updateMemberListEmbed(interaction.guild, guildId);

        // Set cooldown
        setMemberCooldown(guildId, member.id, "change_name");

        let reply = "✅ **Berhasil!** Nama Roblox kamu telah diubah.";
        if (nickFailed) reply += "\n⚠️ Nickname tidak bisa diubah (bot tidak punya izin).";
        return interaction.editReply({ content: reply });
      }

      // --- INPUT MANUAL MODAL ---
      if (interaction.customId.startsWith("modal_pm_input_manual_")) {
        await interaction.deferReply({ flags: 64 });
        const targetId = interaction.customId.replace("modal_pm_input_manual_", "");
        const robloxName = interaction.fields.getTextInputValue("roblox_name").trim();
        const nickname = interaction.fields.getTextInputValue("nickname").trim();

        const validation = validateRobloxName(robloxName);
        if (!validation.valid) return interaction.editReply({ content: validation.error });

        // Save data for target
        saveMemberData(guildId, targetId, { robloxName, nickname });

        // Set target nickname
        let nickFailed = false;
        try {
          const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (targetMember) await targetMember.setNickname(robloxName);
          else nickFailed = true;
        } catch { nickFailed = true; }

        // Update list
        await updateMemberListEmbed(interaction.guild, guildId);

        // Send log
        const logChannel = getMemberLogChannel(interaction.guild, guildId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("#FFA500")
            .setTitle("📋 Log Member")
            .setDescription(`Target: <@${targetId}>\nRegistered by: ${member}`)
            .addFields(
              { name: "Nama Roblox", value: robloxName, inline: true },
              { name: "Nama Panggilan", value: nickname, inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] }).catch(() => console.warn("[PanelMember] Failed to send log"));
        }

        let reply = `✅ **Berhasil!** Data <@${targetId}> telah disimpan.`;
        if (nickFailed) reply += "\n⚠️ Nickname tidak bisa diubah (bot tidak punya izin).";
        return interaction.editReply({ content: reply });
      }

      // --- EDIT MODAL ---
      if (interaction.customId.startsWith("modal_pm_edit_")) {
        await interaction.deferReply({ flags: 64 });
        const targetId = interaction.customId.replace("modal_pm_edit_", "");
        const robloxName = interaction.fields.getTextInputValue("roblox_name").trim();

        const validation = validateRobloxName(robloxName);
        if (!validation.valid) return interaction.editReply({ content: validation.error });

        // Update data
        saveMemberData(guildId, targetId, { robloxName });

        // Set target nickname
        let nickFailed = false;
        try {
          const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (targetMember) await targetMember.setNickname(robloxName);
          else nickFailed = true;
        } catch { nickFailed = true; }

        // Update list
        await updateMemberListEmbed(interaction.guild, guildId);

        let reply = `✅ **Berhasil!** Nama Roblox <@${targetId}> telah diubah menjadi **${robloxName}**.`;
        if (nickFailed) reply += "\n⚠️ Nickname tidak bisa diubah (bot tidak punya izin).";
        return interaction.editReply({ content: reply });
      }

      // --- TITLE CHANGE MODAL ---
      if (interaction.customId === "modal_pm_title") {
        await interaction.deferReply({ flags: 64 });
        const title = interaction.fields.getTextInputValue("title").trim();

        if (!title || title.length < 1 || title.length > 50) {
          return interaction.editReply({ content: "❌ Judul harus antara 1-50 karakter!" });
        }

        const guildData = getGuildMembers(guildId);
        guildData.title = title.toUpperCase();
        saveMembers();
        // Sync to Supabase
        dbSaveGuildMemberSettings(guildId, guildData).catch(() => {});

        // Refresh list embed
        await updateMemberListEmbed(interaction.guild, guildId).catch(() => {});

        return interaction.editReply({ content: `✅ Judul list member berhasil diubah menjadi: **${title.toUpperCase()}**` });
      }
    }

  } catch (err) {
    console.error("[PanelMember] Error:", err);
    const reply = interaction.replied || interaction.deferred
      ? interaction.editReply.bind(interaction)
      : interaction.reply.bind(interaction);
    await reply({ content: "❌ Terjadi kesalahan.", flags: 64 }).catch(() => {});
  }
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN).catch(err => {
  console.error("❌ CRITICAL: Failed to login to Discord.");
  console.error(err);
  process.exit(1);
});
