# Implementation Plan: Panel Member System
# Implementation Plan: Panel Member System

## Overview

Implement the Panel Member System as a set of button, modal, and select menu interaction handlers in `index.js`. The system provides self-service Roblox identity registration for members and staff management tools, with logging, cooldown enforcement, and a live member list embed. All handlers use the `pm_` prefix convention and integrate with the existing `membersCache` / `members.json` persistence layer.

## Tasks

- [ ] 1. Enhance core helper functions
  - [ ] 1.1 Refactor `validateRobloxName()` to return `{ valid, error }` object
    - Change return type from boolean to `{ valid: boolean, error?: string }`
    - Add minimum 6 characters check (at least 1 char before "CHAOS")
    - Add maximum 20 characters check
    - Add empty/whitespace-only check
    - Keep case-sensitive "CHAOS" suffix check
    - Update all existing callers of `validateRobloxName()` to use the new return shape
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

  - [ ]* 1.2 Write property test for `validateRobloxName()`
    - **Property 1: Roblox Name Validation**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**

  - [ ] 1.3 Enhance `updateMemberListEmbed()` with sorting and truncation
    - Sort member entries by `registeredAt` timestamp (earliest first)
    - Implement 4096-character embed description truncation
    - Append a line indicating how many members are not shown when truncated
    - Ensure no partial entries appear in truncated output
    - Display "*Belum ada member terdaftar.*" when no members exist
    - _Requirements: 8.1, 8.3, 8.4, 8.6, 8.7_

  - [ ]* 1.4 Write property test for member list formatting
    - **Property 3: Member List Formatting**
    - **Validates: Requirements 8.1, 8.2, 8.5**

  - [ ]* 1.5 Write property test for member list truncation
    - **Property 4: Member List Truncation**
    - **Validates: Requirements 8.7**

  - [ ] 1.6 Add `registeredAt` field to `saveMemberData()`
    - Set `registeredAt` to `Date.now()` only on first save (do not overwrite on updates)
    - Ensure `updatedAt` continues to be set on every save
    - _Requirements: 2.2, 8.1_

  - [ ]* 1.7 Write property test for data persistence round-trip
    - **Property 2: Member Data Persistence Round-Trip**
    - **Validates: Requirements 2.2, 3.2, 4.3, 6.3**

- [ ] 2. Implement cooldown system for panel member buttons
  - [ ] 2.1 Implement cooldown check and set functions for panel member actions
    - Use key format `{guildId}-{userId}-{actionType}` where actionType is `input_data` or `change_name`
    - Check if elapsed time < 1 hour (3600000ms)
    - Calculate remaining minutes with `Math.ceil(remaining / 60000)` (minimum 1)
    - Only set cooldown after successful data save (not on validation failure)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 2.2 Write property test for cooldown enforcement
    - **Property 5: Cooldown Enforcement**
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [ ]* 2.3 Write property test for failed validation not triggering cooldown
    - **Property 6: Failed Validation Does Not Trigger Cooldown**
    - **Validates: Requirements 9.4**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement panel deployment and button handler routing
  - [ ] 4.1 Create panel deployment command handler
    - Build embed with title "📁 PANEL MEMBER FII" and description "Gunakan tombol di bawah\n⏳ Limit 1 jam 1x"
    - Create ActionRow with 5 buttons: Input Data (Primary, `pm_input_data`), Change Name (Secondary, `pm_change_name`), Input Manual (Danger, `pm_input_manual`), Search (Success, `pm_search`), Edit (Secondary, `pm_edit`)
    - Store `panelMessageId` and `panelChannelId` in Guild_Data
    - Delete old panel message if one exists in Guild_Data
    - Check staff access before allowing deployment
    - Handle missing send permissions with ephemeral error
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 4.2 Create button interaction router for `pm_` prefix
    - Route `pm_input_data` and `pm_change_name` through cooldown check then show modal
    - Route `pm_input_manual`, `pm_search`, `pm_edit` through `hasStaffAccess()` check
    - Reply with ephemeral "❌ Hanya admin!" for unauthorized staff button clicks
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 4.3 Write property test for role-based access control
    - **Property 7: Role-Based Access Control**
    - **Validates: Requirements 11.1, 11.2, 11.4**

- [ ] 5. Implement Input Data flow (self-registration)
  - [ ] 5.1 Implement `pm_input_data` button handler and `modal_pm_input_data` modal submission
    - Show modal with fields: Nama Roblox, Nama Panggilan, Alamat
    - On submit: validate Roblox name, save data with `saveMemberData()`, set nickname, update member list, send log, set cooldown
    - Handle nickname permission failure gracefully (continue save, notify user)
    - Show ephemeral error if validation fails (do not set cooldown)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 5.2 Implement log entry for Input Data registration
    - Create log embed with title "Log Member", description with user mention, fields for Nama Roblox, Nama Panggilan, Alamat
    - Attach `log_member.txt` with labeled lines for each value
    - Handle missing/inaccessible log channel with console.warn (don't fail)
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 5.3 Write property test for log entry completeness
    - **Property 8: Log Entry Completeness**
    - **Validates: Requirements 7.1, 7.2, 7.4**

- [ ] 6. Implement Change Name flow
  - [ ] 6.1 Implement `pm_change_name` button handler and `modal_pm_change_name` modal submission
    - Show modal with single field: Nama Roblox
    - On submit: check member has existing registration (reject if not), validate name, update `robloxName` in Guild_Data, set nickname, update member list, set cooldown
    - Handle nickname permission failure gracefully
    - Show ephemeral error if member not registered ("harus register dulu via Input Data")
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 7. Implement Input Manual flow (staff registration)
  - [ ] 7.1 Implement `pm_input_manual` button → `pm_select_manual` UserSelectMenu → `modal_pm_input_manual_{targetUserId}` modal flow
    - On button click: show ephemeral UserSelectMenu with 60-second timeout
    - On user select: show modal with fields Nama Roblox (max 32 chars), Nama Panggilan (max 32 chars)
    - On modal submit: validate name, save data for target user (overwrite existing), set target nickname, update member list, send log
    - Handle nickname permission failure gracefully
    - Handle select menu timeout gracefully (no action)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 7.2 Implement log entry for Input Manual registration
    - Create log embed with title "Log Member", description with target user mention and staff mention, fields for Nama Roblox and Nama Panggilan
    - Set embed color to orange (#FFA500)
    - _Requirements: 7.4_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Search flow
  - [ ] 9.1 Implement `pm_search` button → `pm_select_search` UserSelectMenu → display result
    - On button click: show ephemeral UserSelectMenu with 60-second timeout
    - On user select: fetch member data, display ephemeral embed with Nama Roblox, Nama Panggilan, Alamat, and registration date formatted as "DD/MM/YYYY HH:mm"
    - Show ephemeral message if selected member is not registered
    - Handle select menu timeout gracefully
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [ ]* 9.2 Write property test for search display completeness
    - **Property 10: Search Display Completeness**
    - **Validates: Requirements 5.2**

- [ ] 10. Implement Edit flow
  - [ ] 10.1 Implement `pm_edit` button → `pm_select_edit` UserSelectMenu → `modal_pm_edit_{targetUserId}` modal flow
    - On button click: show ephemeral UserSelectMenu with 60-second timeout
    - On user select: check target has existing data (reject if not), show modal with field Nama Roblox (max 32 chars)
    - On modal submit: validate name, update `robloxName` in Guild_Data, set target nickname, update member list
    - Handle nickname permission failure gracefully
    - Handle select menu timeout and unregistered target gracefully
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

- [ ] 11. Implement Admin Title Configuration
  - [ ] 11.1 Implement title change command with `modal_pm_title` modal
    - Validate title is 1-50 characters after trimming
    - Update `title` field in Guild_Data
    - Refresh Member_List embed with new title format "[ ‼️ LIST MEMBER {NEW_TITLE} ‼️ ]"
    - Reply with ephemeral confirmation showing new title
    - Handle unavailable list embed (persist title, notify staff)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 11.2 Write property test for title validation and persistence
    - **Property 9: Title Validation and Persistence**
    - **Validates: Requirements 12.1, 12.2, 12.5**

- [ ] 12. Implement Role Selection Registration Check
  - [ ] 12.1 Add registration check to MAN/WOMAN role button handlers
    - Before assigning gender role, check if member has data in Guild_Data via `getMemberData()`
    - If not registered: reject with ephemeral "❌ Kamu harus Input Data terlebih dahulu di Panel Member sebelum mengambil role!" including channel mention if `panelChannelId` is configured
    - If registered: proceed with normal role assignment (assign gender role, remove opposite role)
    - Only apply to MAN 💪 / WOMAN 🌸 buttons; Verify and Admin request buttons are unaffected
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 13. Integrate Clan Member category into Setup Wizard
  - [ ] 13.1 Add "clan" entry to `SETUP_CATEGORIES` constant
    - Name: "📋 Clan Member", categoryName: "ℂ𝕝𝕒𝕟-𝕄𝕖𝕞𝕓𝕖𝕣"
    - Channels: MEMBER_PANEL_CHANNEL_ID (Panel-Member), MEMBER_LIST_CHANNEL_ID (List-Member), MEMBER_LOG_CHANNEL_ID (Log-Member)
    - categoryKey: "MEMBER_CATEGORY_ID"
    - _Requirements: 14.1, 14.2_

  - [ ] 13.2 Update Setup Wizard category selection UI
    - Add 5th option "📋 Clan Member" to StringSelectMenuBuilder in both Automatic and Manual modes
    - Update `setMaxValues` from 4 to 5
    - Add to `buildCategorySelectMessage()` and manual mode category select
    - _Requirements: 14.1_

  - [ ] 13.3 Implement Automatic Setup for "clan" category
    - Create category "ℂ𝕝𝕒𝕟-𝕄𝕖𝕞𝕓𝕖𝕣" with permissions (verified-only view, read-only for non-staff)
    - Create 3 text channels with appropriate permissions
    - Store channel IDs in guilds_config.json (MEMBER_CATEGORY_ID, MEMBER_PANEL_CHANNEL_ID, MEMBER_LIST_CHANNEL_ID, MEMBER_LOG_CHANNEL_ID)
    - _Requirements: 14.2, 14.3, 14.7_

  - [ ] 13.4 Implement Manual Setup channel assignment for "clan" category
    - Prompt user to select existing channels for Panel Member, List Member, and Log Member via ChannelSelectMenu
    - Store selected channel IDs in guilds_config.json
    - _Requirements: 14.4, 14.3_

  - [ ] 13.5 Auto-deploy Panel Member and List Member after setup
    - Deploy Panel Member embed (5 buttons) to MEMBER_PANEL_CHANNEL_ID
    - Initialize Member List embed in MEMBER_LIST_CHANNEL_ID
    - Set `channelId` in membersCache[guildId] to MEMBER_LIST_CHANNEL_ID
    - Store panelMessageId in membersCache[guildId]
    - _Requirements: 14.5, 14.6_

  - [ ] 13.6 Update log channel resolution to prioritize MEMBER_LOG_CHANNEL_ID
    - When sending member registration logs, check MEMBER_LOG_CHANNEL_ID first
    - Fall back to LOG_CHANNEL_ID if MEMBER_LOG_CHANNEL_ID is not configured
    - Console warning if neither is available
    - _Requirements: 14.6, 7.3_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code is implemented in the single `index.js` file following existing patterns
- The project uses JavaScript (Node.js) with discord.js v14
- Property tests use `fast-check` library as specified in the design

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.6"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.7", "2.1"] },
    { "id": 2, "tasks": ["1.4", "1.5", "2.2", "2.3"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "9.1"] },
    { "id": 8, "tasks": ["9.2", "10.1"] },
    { "id": 9, "tasks": ["11.1"] },
    { "id": 10, "tasks": ["11.2", "12.1"] },
    { "id": 11, "tasks": ["13.1", "13.2"] },
    { "id": 12, "tasks": ["13.3", "13.4"] },
    { "id": 13, "tasks": ["13.5", "13.6"] }
  ]
}
```
