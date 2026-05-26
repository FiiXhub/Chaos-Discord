# Requirements Document

## Introduction

The Panel Member System is a comprehensive member registration and management feature for the FII Discord bot. It provides a panel with interactive buttons that allow members to register their Roblox identity, and staff to manage member data. The system includes logging, a live member list embed, cooldown enforcement, and role-based access control. All Roblox names must conform to the "CHAOS" suffix convention.

## Glossary

- **Bot**: The FII Discord bot application running on discord.js v14
- **Panel_Member**: The embed message containing interactive buttons for member management
- **Member_List**: The embed message displaying all registered members in a numbered list
- **Log_Channel**: The designated text channel where member registration logs are sent
- **Modal**: A Discord popup form with text input fields presented to the user
- **UserSelectMenu**: A Discord dropdown component that allows selecting a server member
- **Staff**: A user holding any of the following roles: Developer, Owner, Guard, Staff, or Admin
- **Cooldown**: A time-based restriction preventing repeated use of a button (1 hour)
- **Roblox_Name**: A text identifier that must end with the uppercase string "CHAOS"
- **Nickname**: The user's display name within the Discord server (set by the bot)
- **Guild_Data**: The per-guild data structure stored in members.json

## Requirements

### Requirement 1: Panel Member Deployment

**User Story:** As a staff member, I want to deploy the Panel Member embed with interactive buttons, so that members can access registration and management functions.

#### Acceptance Criteria

1. WHEN a Staff member triggers panel deployment in a text channel, THE Bot SHALL send an embed with title "📁 PANEL MEMBER FII" and description "Gunakan tombol di bawah\n⏳ Limit 1 jam 1x" to the channel where the command was issued
2. WHEN the panel embed is sent, THE Bot SHALL attach exactly 5 buttons in a single action row: "Input Data" (Primary style), "Change Name" (Secondary style), "Input Manual" (Danger style), "Search" (Success style), "Edit" (Secondary style)
3. WHEN the panel embed is successfully sent, THE Bot SHALL store the panel message ID and the channel ID in Guild_Data for future reference
4. IF a Panel_Member already exists in Guild_Data for the guild, THEN THE Bot SHALL replace the previous panel by deleting the old panel message (if still accessible) and sending a new one
5. IF the Bot lacks permission to send messages in the target channel, THEN THE Bot SHALL respond with an ephemeral error message indicating insufficient permissions
6. WHEN a non-Staff member triggers panel deployment, THE Bot SHALL reject the command and display an ephemeral message indicating only Staff can deploy the panel

### Requirement 2: Input Data Registration

**User Story:** As a server member, I want to register my Roblox identity through the Input Data button, so that I am added to the member list.

#### Acceptance Criteria

1. WHEN a member clicks the "Input Data" button, THE Bot SHALL present a Modal with three required fields: Nama Roblox, Nama Panggilan, and Alamat
2. WHEN the member submits the Modal with a valid Roblox_Name, THE Bot SHALL save the robloxName, nickname, and address to Guild_Data under the member's user ID
3. WHEN the member submits the Modal with a valid Roblox_Name, THE Bot SHALL set the member's server Nickname to the submitted Roblox_Name
4. WHEN the member submits the Modal with a valid Roblox_Name, THE Bot SHALL update the Member_List embed to include the new entry
5. WHEN the member submits the Modal with a valid Roblox_Name, THE Bot SHALL send a log entry to the Log_Channel
6. WHEN the member submits a Roblox_Name that does not end with "CHAOS", THE Bot SHALL reject the submission and display an ephemeral error message indicating the name must end with "CHAOS"
7. IF the Bot lacks permission to change the member's Nickname, THEN THE Bot SHALL save the data, update the Member_List, send the log, and notify the member that the nickname could not be changed

### Requirement 3: Change Name

**User Story:** As a registered member, I want to change my Roblox name through the Change Name button, so that my identity stays up to date.

#### Acceptance Criteria

1. WHEN a member clicks the "Change Name" button, THE Bot SHALL present a Modal with one required field: Nama Roblox
2. WHEN the member submits the Modal with a valid Roblox_Name, THE Bot SHALL update the robloxName field in Guild_Data for that member
3. WHEN the member submits the Modal with a valid Roblox_Name, THE Bot SHALL set the member's server Nickname to the new Roblox_Name
4. WHEN the member submits the Modal with a valid Roblox_Name, THE Bot SHALL update the Member_List embed to reflect the name change
5. WHEN the member submits a Roblox_Name that does not end with "CHAOS", THE Bot SHALL reject the submission and display an ephemeral error message indicating the name must end with "CHAOS"
6. IF the member has no existing registration in Guild_Data, THEN THE Bot SHALL reject the interaction and display an ephemeral error message indicating the member must register first via "Input Data"
7. IF the Bot lacks permission to change the member's Nickname, THEN THE Bot SHALL update the robloxName in Guild_Data, update the Member_List embed, and notify the member via ephemeral message that the nickname could not be changed

### Requirement 4: Input Manual (Staff Registration)

**User Story:** As a staff member, I want to manually register data for any server member, so that I can onboard members who cannot self-register.

#### Acceptance Criteria

1. WHEN a Staff member clicks the "Input Manual" button, THE Bot SHALL present a UserSelectMenu to select the target member with a 60-second interaction timeout
2. WHEN the Staff member selects a target member from the UserSelectMenu, THE Bot SHALL present a Modal with two required fields: Nama Roblox (maximum 32 characters) and Nama Panggilan (maximum 32 characters)
3. WHEN the Staff member submits the Modal with a valid Roblox_Name, THE Bot SHALL save the robloxName and nickname to Guild_Data under the target member's user ID, overwriting any existing registration data for that member
4. WHEN the Staff member submits the Modal with a valid Roblox_Name, THE Bot SHALL set the target member's server Nickname to the submitted Roblox_Name
5. WHEN the Staff member submits the Modal with a valid Roblox_Name, THE Bot SHALL update the Member_List embed and send a log entry to the Log_Channel
6. WHEN the Staff member submits a Roblox_Name that does not end with "CHAOS", THE Bot SHALL reject the submission and display an ephemeral error message indicating the name must end with "CHAOS"
7. IF the Bot lacks permission to change the target member's Nickname, THEN THE Bot SHALL save the data, update the Member_List, send the log, and notify the Staff member with an ephemeral message that the nickname could not be changed
8. WHEN a non-Staff member clicks the "Input Manual" button, THE Bot SHALL display an ephemeral message "❌ Hanya admin!" and take no further action

### Requirement 5: Search Member Data

**User Story:** As a staff member, I want to search and view a member's registered data, so that I can verify their information.

#### Acceptance Criteria

1. WHEN a Staff member clicks the "Search" button, THE Bot SHALL present an ephemeral UserSelectMenu listing server members
2. WHEN the Staff member selects a member from the UserSelectMenu, THE Bot SHALL display an ephemeral embed showing: Nama Roblox, Nama Panggilan, Alamat, and registration date formatted as "DD/MM/YYYY HH:mm"
3. WHEN the Staff member selects a member who has no registered data, THE Bot SHALL display an ephemeral message indicating the member is not registered
4. WHEN a non-Staff member clicks the "Search" button, THE Bot SHALL display an ephemeral message "❌ Hanya admin!" and take no further action
5. IF the Staff member does not select a member from the UserSelectMenu within 60 seconds, THEN THE Bot SHALL dismiss the menu and take no further action

### Requirement 6: Edit Member Data

**User Story:** As a staff member, I want to edit a member's Roblox name, so that I can correct or update their identity.

#### Acceptance Criteria

1. WHEN a Staff member clicks the "Edit" button, THE Bot SHALL present a UserSelectMenu to select the target member with a maximum response window of 60 seconds
2. WHEN the Staff member selects a target member who has existing data in Guild_Data, THE Bot SHALL present a Modal with one required field: Nama Roblox (maximum 32 characters)
3. WHEN the Staff member submits the Modal with a valid Roblox_Name, THE Bot SHALL update the robloxName field in Guild_Data for the target member
4. WHEN the Staff member submits the Modal with a valid Roblox_Name, THE Bot SHALL set the target member's server Nickname to the new Roblox_Name
5. WHEN the Staff member submits the Modal with a valid Roblox_Name, THE Bot SHALL update the Member_List embed to reflect the changed name
6. IF the Staff member submits a Roblox_Name that does not end with "CHAOS", THEN THE Bot SHALL reject the submission and display an ephemeral error message indicating the name must end with "CHAOS"
7. IF the Staff member selects a target member who has no existing data in Guild_Data, THEN THE Bot SHALL display an ephemeral message indicating the member is not registered and take no further action
8. IF the Bot lacks permission to change the target member's Nickname, THEN THE Bot SHALL update the Guild_Data and Member_List, and notify the Staff member that the nickname could not be changed
9. WHEN a non-Staff member clicks the "Edit" button, THE Bot SHALL display an ephemeral message "❌ Hanya admin!" and take no further action

### Requirement 7: Member Log System

**User Story:** As a staff member, I want registration events to be logged, so that I have an audit trail of member data changes.

#### Acceptance Criteria

1. WHEN a member successfully registers via "Input Data", THE Bot SHALL send an embed to the Log_Channel with title "Log Member" containing the registering user's Discord mention, and embed fields: Nama Roblox, Nama Panggilan, and Alamat, with a timestamp indicating when the registration occurred
2. WHEN a member successfully registers via "Input Data", THE Bot SHALL attach a text file named "log_member.txt" to the log message containing the registered Nama Roblox, Nama Panggilan, and Alamat values each on a separate labeled line
3. IF the Log_Channel is not configured or inaccessible, THEN THE Bot SHALL log a warning to the console and continue the registration process without failing
4. WHEN a Staff member successfully registers a member via "Input Manual", THE Bot SHALL send a log embed to the Log_Channel with title "Log Member" containing the target member's Discord mention, the staff member who performed the action, and embed fields: Nama Roblox and Nama Panggilan, with a timestamp

### Requirement 8: Member List Display

**User Story:** As a server member, I want to see a live list of all registered members, so that I know who is part of the group.

#### Acceptance Criteria

1. THE Bot SHALL display registered members in a numbered list format: "**{index}.** {RobloxName} [{Nickname}]", ordered by registration time (earliest first), with each entry separated by a blank line
2. THE Bot SHALL format the Member_List embed title as "[ ‼️ LIST MEMBER {TITLE} ‼️ ]" where TITLE is the configured guild title
3. WHEN a member is added or their name is changed, THE Bot SHALL update the existing Member_List embed message in place within 5 seconds
4. WHEN no members are registered, THE Bot SHALL display the text "*Belum ada member terdaftar.*" in the embed description
5. THE Bot SHALL include a footer showing "Total: {count} members" in the Member_List embed, where count is the current number of registered members
6. IF the Member_List embed message has been deleted or is unreachable, THEN THE Bot SHALL create a new Member_List embed message in the configured channel and store the new message ID in Guild_Data
7. IF the embed description would exceed 4096 characters due to the number of registered members, THEN THE Bot SHALL truncate the list to fit within the limit and append a line indicating the number of members not shown

### Requirement 9: Cooldown Enforcement

**User Story:** As a server administrator, I want a cooldown on registration buttons, so that members cannot spam the system.

#### Acceptance Criteria

1. WHEN a member clicks "Input Data" or "Change Name" within 1 hour of their last successful submission for that same action type, THE Bot SHALL reject the interaction and display an ephemeral message showing remaining cooldown time in the format "⏳ Tunggu {X} menit" where X is the remaining minutes rounded up to the nearest whole number, with a minimum display value of 1
2. WHEN a member clicks "Input Data" or "Change Name" after the 1-hour cooldown has expired, THE Bot SHALL allow the interaction to proceed normally by presenting the corresponding Modal
3. THE Bot SHALL track cooldowns per user per guild independently, using a composite key of guild ID and user ID
4. THE Bot SHALL start the cooldown timer only after a submission is accepted and data is saved successfully; a submission rejected due to validation failure (e.g., Roblox_Name not ending with "CHAOS") SHALL NOT trigger or reset the cooldown
5. THE Bot SHALL store cooldown timestamps in memory; cooldown timers MAY reset when the Bot restarts

### Requirement 10: Roblox Name Validation

**User Story:** As a server administrator, I want all Roblox names to follow the naming convention, so that member identity is consistent.

#### Acceptance Criteria

1. THE Bot SHALL validate that every submitted Roblox_Name ends with the exact case-sensitive uppercase string "CHAOS" and contains at least 6 characters (minimum 1 character before "CHAOS")
2. IF a submitted Roblox_Name does not end with "CHAOS" (case-sensitive match), THEN THE Bot SHALL reject the submission and display an ephemeral error message indicating the name must end with "CHAOS"
3. IF a submitted Roblox_Name is empty or contains only whitespace, THEN THE Bot SHALL reject the submission and display an ephemeral error message indicating the name is required
4. THE Bot SHALL apply Roblox_Name validation to all submission paths: Input Data, Change Name, Input Manual, and Edit
5. THE Bot SHALL accept Roblox_Name values with a maximum length of 20 characters

### Requirement 11: Role-Based Access Control

**User Story:** As a server administrator, I want restricted buttons to be staff-only, so that sensitive operations are protected.

#### Acceptance Criteria

1. THE Bot SHALL allow all server members to use the "Input Data" and "Change Name" buttons regardless of their roles
2. THE Bot SHALL restrict the "Input Manual", "Search", and "Edit" buttons to Staff members only, permitting Staff members to proceed with the button's normal workflow
3. WHEN a non-Staff member clicks a restricted button, THE Bot SHALL respond with an ephemeral message "❌ Hanya admin!" within 3 seconds and take no further action
4. IF no Staff role IDs are configured for the guild, THEN THE Bot SHALL treat all restricted button clicks as unauthorized and respond with the ephemeral denial message

### Requirement 12: Admin Title Configuration

**User Story:** As a staff member, I want to change the member list title, so that it reflects the group identity.

#### Acceptance Criteria

1. WHEN a Staff member issues a title change command with a new title value, THE Bot SHALL validate that the title is between 1 and 50 characters (after trimming whitespace) and update the title field in Guild_Data
2. IF the submitted title is empty or exceeds 50 characters after trimming, THEN THE Bot SHALL reject the change and display an ephemeral error message indicating the allowed length range
3. WHEN the title is updated, THE Bot SHALL refresh the Member_List embed within 3 seconds to display the new title in the format "[ ‼️ LIST MEMBER {NEW_TITLE} ‼️ ]" and reply with an ephemeral confirmation message showing the new title
4. IF the Member_List embed message or its channel is unavailable when refreshing, THEN THE Bot SHALL still persist the new title in Guild_Data and notify the Staff member that the list could not be refreshed
5. THE Bot SHALL persist the title value across bot restarts by storing it in members.json

### Requirement 13: Role Selection Requires Registration

**User Story:** As a server administrator, I want members to register their Roblox identity before taking a gender role, so that all active members are properly documented.

#### Acceptance Criteria

1. WHEN a member clicks the "MAN 💪" or "WOMAN 🌸" role button, THE Bot SHALL check whether the member has existing registration data in Guild_Data (members.json)
2. IF the member has no registration data, THEN THE Bot SHALL reject the role assignment and display an ephemeral error message: "❌ Kamu harus Input Data terlebih dahulu di Panel Member sebelum mengambil role!" with a reference to the Panel Member channel
3. IF the member has existing registration data, THEN THE Bot SHALL proceed with the normal role assignment flow (assign gender role, remove opposite role if held)
4. THE Bot SHALL apply this validation only to gender role buttons (MAN/WOMAN); the Verify button and Admin request button SHALL NOT require prior registration
5. IF the Panel Member channel ID is configured in Guild_Data, THEN the error message SHALL include a channel mention linking to the Panel Member channel for easy navigation

### Requirement 14: Clan Member Category in Setup Wizard

**User Story:** As a server administrator, I want a "Clan Member" category option in the Setup Wizard, so that the bot automatically creates dedicated channels for the Panel Member system (input form, list member, and log member).

#### Acceptance Criteria

1. THE Bot SHALL add a new category option "📋 Clan Member" to the Setup Wizard category selection (both Automatic and Manual modes), alongside the existing categories (Server Statistics, Main, Ticket-Support, Panel-Admin)
2. WHEN the "Clan Member" category is selected in Automatic Setup, THE Bot SHALL create a Discord category named "ℂ𝕝𝕒𝕟-𝕄𝕖𝕞𝕓𝕖𝕣" containing three text channels:
   - `⬩➤┃📁┃ㆍ𝙋𝙖𝙣𝙚𝙡-𝙈𝙚𝙢𝙗𝙚𝙧` — Where the Panel Member embed with buttons is deployed
   - `⬩➤┃📜┃ㆍ𝙇𝙞𝙨𝙩-𝙈𝙚𝙢𝙗𝙚𝙧` — Where the live Member List embed is displayed
   - `⬩➤┃📋┃ㆍ𝙇𝙤𝙜-𝙈𝙚𝙢𝙗𝙚𝙧` — Where registration log entries are sent
3. WHEN the channels are created, THE Bot SHALL store the channel IDs in guilds_config.json under keys: `MEMBER_PANEL_CHANNEL_ID`, `MEMBER_LIST_CHANNEL_ID`, `MEMBER_LOG_CHANNEL_ID`, and the category ID under `MEMBER_CATEGORY_ID`
4. WHEN the "Clan Member" category is selected in Manual Setup, THE Bot SHALL prompt the user to select existing channels for Panel Member, List Member, and Log Member via ChannelSelectMenu
5. AFTER channel creation/assignment, THE Bot SHALL automatically deploy the Panel Member embed (with 5 buttons) to the Panel Member channel, and initialize the Member List embed in the List Member channel
6. THE Bot SHALL set the `channelId` in Guild_Data (members.json) to the List Member channel ID, and use the Log Member channel ID for sending registration logs instead of the general LOG_CHANNEL_ID
7. THE Bot SHALL set permissions on the Clan Member category so that only verified members (with Verify role) can view the channels, and the Panel Member channel SHALL be read-only for non-staff (only bot can send messages)
8. IF the "Clan Member" category is not selected during setup, THEN the Panel Member system SHALL still function if manually deployed by staff to any channel
