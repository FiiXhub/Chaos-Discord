# Requirements Document

## Introduction

This feature simplifies the member registration and role assignment flow for the FiiCruzh Discord bot. Currently, users must go through a 4-step process (Verify → Input Data → Click MEMBER → Click MAN/WOMAN). This feature reduces it to 3 steps by auto-assigning the Member role after data registration, adding a `/claim` command for WhatsApp-migrated members, and removing the now-redundant MEMBER button from the Role Panel.

## Glossary

- **Bot**: The FiiCruzh Discord bot application built with discord.js v14
- **Member_Role**: The Discord role assigned to registered members (configured via MEMBER_ROLE_ID)
- **Role_Panel**: The Discord embed message with buttons for selecting identity roles (MAN, WOMAN, ADMIN, MY PROFILE)
- **Panel_Member**: The Discord embed message with buttons for member data management (Input Data, Change Name, etc.)
- **Input_Data_Modal**: The modal form where users submit their Roblox name, nickname, and address
- **Claim_Command**: The `/claim` slash command that allows WhatsApp-migrated members to link their Discord account
- **WhatsApp_Member**: A member record in Supabase whose user_id starts with "wa_" (added from WhatsApp bot)
- **Supabase**: The PostgreSQL database service storing member records in the `members` table
- **Setup_Wizard**: The interactive setup flow that configures roles and channels for a guild
- **Guild_Config**: The per-guild configuration stored in guilds_config.json and Supabase

## Requirements

### Requirement 1: Claim Command Registration

**User Story:** As a Discord user who was previously registered via WhatsApp, I want to claim my existing member record using my Roblox name, so that I can link my Discord account and receive my roles without re-registering.

#### Acceptance Criteria

1. THE Bot SHALL register a slash command `/claim` with one required string option named `roblox_name`
2. WHEN a user executes `/claim` with a roblox_name value, THE Bot SHALL search the Supabase `members` table for a record matching that roblox_name in the current guild
3. WHEN a matching record is found AND the record's user_id starts with "wa_", THE Bot SHALL update the record's user_id to the Discord user's real ID
4. WHEN a matching record is found AND the record's user_id starts with "wa_", THE Bot SHALL assign the Member_Role to the user
5. WHEN a matching record is found AND the record's user_id starts with "wa_", THE Bot SHALL set the user's server nickname to the roblox_name
6. WHEN a matching record is found AND the record's user_id starts with "wa_", THE Bot SHALL reply with a success message indicating the account has been claimed
7. WHEN a matching record is found AND the record's user_id does NOT start with "wa_", THE Bot SHALL reply with an error message indicating the name has already been claimed by another user
8. WHEN no matching record is found for the given roblox_name in the current guild, THE Bot SHALL reply with an error message indicating the name is not in the database
9. IF the Bot fails to set the user's nickname due to insufficient permissions, THEN THE Bot SHALL still complete the claim successfully and include a warning about the nickname failure

### Requirement 2: Auto-assign Member Role After Input Data

**User Story:** As a new Discord member, I want to automatically receive the Member role after submitting my data, so that I do not need to click a separate button.

#### Acceptance Criteria

1. WHEN a user successfully submits the Input_Data_Modal, THE Bot SHALL automatically assign the Member_Role to the user
2. WHEN the Member_Role is not configured for the guild (MEMBER_ROLE_ID is empty or missing), THE Bot SHALL skip the auto-assignment without showing an error
3. WHEN the user already has the Member_Role, THE Bot SHALL skip the auto-assignment without showing an error
4. IF the Bot fails to assign the Member_Role due to insufficient permissions, THEN THE Bot SHALL include a warning in the success reply indicating the role could not be assigned

### Requirement 3: Remove MEMBER Button from Role Panel

**User Story:** As a server administrator, I want the MEMBER button removed from the Role Panel, so that the panel is simpler and members are not confused by a now-unnecessary step.

#### Acceptance Criteria

1. THE Role_Panel SHALL display only the following buttons: MAN 💪, WOMAN 🌸, ADMIN 👑, MY PROFILE 👤
2. THE Role_Panel embed description SHALL NOT reference the MEMBER button or the requirement to click it
3. WHEN the `member_role` button customId is received from an old panel message, THE Bot SHALL reply with a message indicating this button is no longer needed and that the Member role is now assigned automatically

### Requirement 4: Simplify Gender Role Validation

**User Story:** As a registered member, I want to select my gender role (MAN/WOMAN) immediately after registration, so that I do not need to take an extra step of clicking the MEMBER button first.

#### Acceptance Criteria

1. WHEN a user clicks the MAN 💪 button, THE Bot SHALL check only that the user has registered data (via Input Data or /claim) before assigning the role
2. WHEN a user clicks the WOMAN 🌸 button, THE Bot SHALL check only that the user has registered data (via Input Data or /claim) before assigning the role
3. THE Bot SHALL NOT check for the presence of the Member_Role when processing MAN or WOMAN button clicks
4. WHEN a user clicks MAN 💪 or WOMAN 🌸 without having registered data, THE Bot SHALL reply with an error directing them to Input Data or use /claim

### Requirement 5: Remove Member Role from Setup Wizard

**User Story:** As a server administrator setting up the bot, I want the Member Role step to be optional in the setup wizard, so that the setup process is faster while still allowing configuration if needed.

#### Acceptance Criteria

1. THE Setup_Wizard SHALL NOT include "📋 Member Role" as a required step in ROLE_STEPS
2. THE Bot SHALL still recognize and use MEMBER_ROLE_ID from Guild_Config if it has been previously configured
3. WHEN MEMBER_ROLE_ID is not configured, THE Bot SHALL skip all Member_Role auto-assignment operations without errors

### Requirement 6: Claim Command Input Validation

**User Story:** As a system administrator, I want the /claim command to validate input properly, so that invalid data does not corrupt the database.

#### Acceptance Criteria

1. WHEN a user executes `/claim` with a roblox_name, THE Bot SHALL validate the name using the same rules as the Input_Data_Modal (validateRobloxName function)
2. IF the roblox_name fails validation, THEN THE Bot SHALL reply with the validation error message and not perform any database operations
3. THE Claim_Command SHALL be usable only in guild channels (not in DMs)

### Requirement 7: Claim Command Updates Cache and List

**User Story:** As a server administrator, I want the member list to update when someone claims their account, so that the member list stays accurate.

#### Acceptance Criteria

1. WHEN a claim is successful, THE Bot SHALL update the local member cache with the new user_id
2. WHEN a claim is successful, THE Bot SHALL trigger an update of the member list embed
3. WHEN a claim is successful, THE Bot SHALL send a log entry to the member log channel (if configured)
