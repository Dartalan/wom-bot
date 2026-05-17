# Changelog

All notable changes to wom-bot are recorded here. Most recent changes are at the top.

---

## 2026-05-17

### Wilderness constraint on auto-selection
- Removed the `allow_wilderness` setweek option (dropdowns are already constrained by tier and group eligibility)
- Auto-selector now ensures at most one wilderness boss is picked per week — if a wilderness boss is already set (by staff or an earlier auto-pick), it is excluded from all subsequent auto-picks for that week

### Boss wilderness flag + auto-selection with weighting
- Added `wilderness: true/false` flag to every boss entry in `src/bosses.js`
- Wilderness midgame bosses: Artio, Cal'varion, Callisto, Chaos Elemental, Chaos Fanatic, Crazy Archaeologist, King Black Dragon, Scorpia, Spindel, Venenatis, Vet'ion — no endgame bosses are wilderness
- Auto-boss selection: if any boss field is left blank in `/setweek` (or `/setweek` is not run at all), the bot now picks bosses automatically using weighted history (same system as skills — recently used bosses are less likely but not impossible)
- Boss history tracked per category in `data/boss-history.json` with a 4-week lookback
- Auto-generated KC threshold = `KPH × 2` (roughly 2 hours of effort)
- Added `data/boss-history.json` and `config.bossHistoryLookbackWeeks`

### Boss reference table in README
- Added full boss reference table showing tier, group eligibility, wilderness flag, default KPH, and source for every boss and raid

### Boss dropdowns split by group eligibility
- `group_midgame_boss` now only shows bosses where `groupEligible: true`
- `group_endgame_boss` now only shows bosses where `groupEligible: true`
- Solo fields still show all bosses in their tier

### Boss dropdowns split by tier (midgame vs endgame)
- `solo_midgame_boss` and `group_midgame_boss` now show only Easy/Medium/Hard tier bosses
- `solo_endgame_boss` and `group_endgame_boss` now show only Elite tier and above
- Based on the OSRS Bossing Ladder: oldschool.runescape.wiki/w/Guide:Bossing_Ladder
- Notable tier splits: K'ril/Zilyana = Hard (midgame); Graardor/Kree'Arra = Elite (endgame)

### Staff message in weekly announcement
- `/setweek` now has an optional `message` field
- If provided, the message is included in the weekly announcement embed (prefixed with 📢)
- Shown in `/preview` as "Staff Message"

### Weighted skill selection over 9-week history
- Skill selection changed from hard exclusion (4 weeks) to weighted randomness (9 weeks)
- Recently used skills get lower weight but are never fully blocked
- Weight scale: used last week = 1, used 9 weeks ago = 9, not in history = 10
- Prevents a rigid rotation while still strongly favouring skills not used recently

### `/setbossrate` with reset option, wiki-sourced KPH defaults
- `/setbossrate` now accepts `reset: True` to remove a custom override and revert to the built-in default
- `kills_per_hour` is now optional when `reset: True` is used
- Default KPH values updated from OSRS wiki money making guides at 75% for 27 bosses
- Bosses without wiki pages retain community estimates at 75%

### `/setchannel` command + configurable report time in announcement
- Split `DISCORD_CHANNEL_ID` into `DISCORD_ANNOUNCEMENT_CHANNEL_ID` and `DISCORD_STAFF_CHANNEL_ID`
- Added `/setchannel` slash command — staff can set channels directly in Discord without editing `.env`
- Channel config saved to `data/channels.json`; env vars remain as fallback
- Weekly announcement now shows when the results report will be posted (derived from the schedule)

---

## Initial build — 2026-05-17

### Core bot
- Discord bot with slash commands restricted to the Staff role
- Connects to Wise Old Man API v2 for competition creation and results
- Stores state in JSON files under `data/`

### Automated scheduling
- Monday 3:00am Central: creates 6 WOM competitions and posts weekly announcement
- Tuesday 2:59am Central: triggers WOM update-all, then posts end-of-week results report
- Sunday noon: pings Staff role if `/setweek` hasn't been run yet
- Schedule configurable via `/setschedule` — takes effect immediately without restart

### Competitions created each week
- Skill of the Week ×2 (random non-combat skills, repeat-avoidance with weighting)
- Solo Midgame Boss, Solo Endgame Boss, Raid of the Week, Slayer Boss (WOM-tracked)
- Group Midgame Boss, Group Endgame Boss (announced only, manually enforced)

### Skill selection
- 15 non-combat skills in the pool; staff can override via `/setweek skill_1` / `skill_2`
- Weighted random selection over 9-week history to avoid repetition without rigid rotation

### Slash commands
- `/setweek` — set bosses, raids, thresholds, skills, and optional announcement message
- `/preview` — review pending week settings before they go live; shows recommended KPH next to each boss KC
- `/setschedule` — change competition start day and time
- `/setchannel` — set announcement and staff alert channels
- `/setbossrate` — override or reset default kills/hour for any boss
- `/createcompetitions` — manual trigger with dry-run support; detects and skips existing competitions
- `/report` — manual trigger with dry-run support

### Competition safety
- Checks WOM directly for existing competitions before creating (prevents duplicates)
- Partial failure recovery: re-running `/createcompetitions` fills only the missing slots
- Competition start includes a 3-minute buffer so all 6 API calls complete before start time

### Results report
- WOM update-all triggered 24 hours after competition end (when members are guaranteed outdated)
- Skips 60-second wait if WOM says all members are already up to date
- Reports only players who completed BOTH Skill of the Week challenges
- Flags players whose data was not refreshed in time
- Automatically splits into multiple messages if the report exceeds Discord's 6000-character embed limit

### Boss autocomplete
- Boss fields in `/setweek` use searchable dropdowns filtered by category and group eligibility
- Wilderness bosses are identified and capped at one per week in auto-selection
- KPH defaults sourced from OSRS wiki at 75%; overridable per-boss with `/setbossrate`
