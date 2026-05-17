# wom-bot

A Discord bot for **The Duke Clan** that automatically runs weekly OSRS competitions through [Wise Old Man](https://wiseoldman.net). By default, competitions start every **Monday at 3:00am Central**, run for 7 days, and results are posted 24 hours after the competition ends. The schedule is fully configurable via `/setschedule` without touching the code.

---

## What it does

### The day before competitions start — noon Central
- Checks whether `/setweek` has been run since the current competition week started
- If it **hasn't** been run yet, posts a message to the competition channel that **pings the Staff role** as a reminder
- If `/setweek` was already run, nothing happens

### Competition start day (default: Monday at 3:00am Central)
- Randomly picks **two non-combat skills** for Skill of the Week, or uses the skills staff specified in `/setweek` (avoids repeating randomly chosen skills from the last 4 weeks)
- Creates **six Wise Old Man competitions** for the week:
  - Skill of the Week ×2
  - Solo Midgame Boss
  - Solo Endgame Boss
  - Raid of the Week
  - Slayer Boss
- Posts a **weekly announcement embed** to the configured Discord channel with links to each competition and the KC/completion thresholds
- Also announces the two **Group Bosses** (no WOM competition — these are manually enforced by staff)

### 24 hours after competition ends (default: Tuesday at 2:59am Central)
- Triggers a **WOM update-all** to refresh every clan member's stats (WOM only re-fetches stats after 24+ hours, so waiting until exactly 24 hours after the competition ends guarantees a fresh update)
- If all members are already up to date, skips the 60-second wait and fetches immediately
- Fetches results from all six WOM competitions
- Posts a **results report** showing:
  - Who completed **both** Skills of the Week (150,000+ XP in each — players who only finished one are not listed)
  - Who hit the KC threshold for the Solo Midgame Boss, Solo Endgame Boss, Raid, and Slayer Boss
  - A reminder about the Group Boss goals
  - A warning if any players' data couldn't be refreshed in time
- If the report is too long for a single Discord message, it automatically splits into one message per competition

---

## Slash commands

All commands are restricted to the **Staff** role.

| Command | What it does |
|---|---|
| `/setbossrate` | Set or reset the estimated kills/completions per hour for a boss. Shown in `/preview` as a reference when choosing a KC threshold. |
| `/setchannel` | Set which Discord channel the bot posts announcements/reports or staff alerts to. |
| `/setweek` | Set the bosses, raids, thresholds, and optionally the skills for the upcoming week. |
| `/preview` | Shows what's currently saved for the upcoming week as a formatted embed — use this to double-check before competitions start. |
| `/setschedule` | Change the day and time competitions start each week. Takes effect immediately — no bot restart needed. |
| `/createcompetitions` | Manually triggers competition creation right now. **This runs automatically on schedule — you only need this for manual corrections or recovery if the scheduled run failed.** Detects and skips any competitions already created this week — safe to run more than once. Add `dry_run: True` to test without creating anything. |
| `/report` | Manually triggers the end-of-week results report right now. Add `dry_run: True` to test without posting. |

### Using `/setweek`

The boss and raid fields have a live-search dropdown — just start typing and pick from the list. Skill fields are optional — leave them blank to randomize.

| Option | Description |
|---|---|
| `solo_midgame_boss` | Boss name (searchable dropdown) |
| `solo_midgame_kc` | KC players need to reach |
| `group_midgame_boss` | Group boss name (manually enforced, no WOM tracking) |
| `group_midgame_kc` | KC goal for the group |
| `solo_endgame_boss` | Boss name (searchable dropdown) |
| `solo_endgame_kc` | KC players need to reach |
| `group_endgame_boss` | Group boss name (manually enforced, no WOM tracking) |
| `group_endgame_kc` | KC goal for the group |
| `raid` | Raid name (searchable dropdown — shows raids only) |
| `raid_completions` | Number of completions players need |
| `slayer_boss` | Slayer boss name (searchable dropdown) |
| `slayer_kc` | KC players need to reach |
| `skill_1` | Skill of the Week 1 (searchable dropdown) — leave blank to randomize |
| `skill_2` | Skill of the Week 2 (searchable dropdown) — leave blank to randomize |
| `allow_wilderness` | Whether to include wilderness bosses in dropdowns and auto-selection (default: True) |
| `message` | Optional message included in the weekly announcement (e.g. event notes, reminders) |

### Using `/setbossrate`

Sets the estimated kills or completions per hour for a boss, which is shown in `/preview` next to the KC threshold staff entered so they can judge whether it's too easy or too hard. Built-in defaults are sourced from the OSRS wiki at 75% of the benchmark rate for a well-geared player.

| Option | Description |
|---|---|
| `boss` | Boss or raid name (searchable dropdown) |
| `kills_per_hour` | Your estimate — leave blank if using `reset` |
| `reset` | Set to `True` to remove your override and revert to the built-in default |

Example: `/setbossrate boss:Kraken kills_per_hour:50` or `/setbossrate boss:Kraken reset:True`

### Using `/setchannel`

| Option | Description |
|---|---|
| `type` | `Announcements & Reports` — weekly post and results; or `Staff Alerts` — /setweek reminder ping |
| `channel` | Pick a channel from the dropdown |

Channel settings are saved to `data/channels.json` and survive restarts. The env vars `DISCORD_ANNOUNCEMENT_CHANNEL_ID` and `DISCORD_STAFF_CHANNEL_ID` act as fallbacks if `/setchannel` hasn't been run yet.

### Using `/setschedule`

| Option | Description |
|---|---|
| `day` | Day of week — dropdown (Sunday through Saturday) |
| `hour` | Hour in 24-hour Central time (0 = midnight, 15 = 3pm) |
| `minute` | Minute (optional, defaults to 0) |

The end-of-week report (24h after competition ends) and the day-before reminder are derived automatically from whatever start time you set — you never configure those separately.

---

## Weekly workflow for staff

1. **Any time before noon the day before competitions start** — run `/setweek` and fill in the bosses, thresholds, and optionally the skills
2. Run `/preview` to confirm everything looks right
3. **If you forget**, the bot will ping the Staff role at noon the day before as a reminder
4. That's it — the bot handles competition creation, the announcement, and the results report automatically

If you need to test or re-run something manually, use `/createcompetitions dry_run:True` or `/report dry_run:True` to see what would happen without actually posting anything.

---

## Setup

### Requirements
- [Node.js](https://nodejs.org) v18 or higher
- A Discord bot token ([create one here](https://discord.com/developers/applications))
- A Wise Old Man group with a verification code

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in your values
cp .env.example .env

# 3. Start the bot
node src/index.js
```

### Environment variables (`.env`)

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Your Discord bot token |
| `DISCORD_ANNOUNCEMENT_CHANNEL_ID` | (Optional) Channel for weekly announcements and results reports — can be set via `/setchannel` instead |
| `DISCORD_STAFF_CHANNEL_ID` | (Optional) Channel for staff-only alerts — can be set via `/setchannel` instead |
| `WOM_GROUP_ID` | Your Wise Old Man group ID |
| `WOM_VERIFICATION_CODE` | Your Wise Old Man group verification code |

---

## File structure

```
wom-bot/
├── src/
│   ├── index.js        Entry point — starts the bot and scheduler
│   ├── bot.js          Discord client, slash commands, interaction handling
│   ├── scheduler.js    Cron jobs, competition creation, Discord embeds
│   ├── wom.js          All Wise Old Man API calls
│   ├── storage.js      Reading and writing data files
│   └── bosses.js       Boss/raid lists for autocomplete dropdowns
├── data/
│   ├── pending.json        Saved by /setweek, applied at competition start
│   ├── weeks.json          Active week's competition IDs and config
│   ├── skill-history.json  Last 8 randomly chosen skills (prevents repeats)
│   ├── schedule.json       Competition schedule saved by /setschedule
│   ├── channels.json       Channel IDs saved by /setchannel
│   └── boss-thresholds.json  Per-boss KPH overrides saved by /setbossrate
├── config.js           Tunable settings (skill list, XP threshold, timezone, default schedule)
└── .env                Secrets — never commit this file
```

---

## Competitions created each week

| Competition | Tracked in WOM | Threshold |
|---|---|---|
| Skill of the Week ×2 | Yes | 150,000 XP each |
| Solo Midgame Boss | Yes | Set by staff each week |
| Solo Endgame Boss | Yes | Set by staff each week |
| Raid of the Week | Yes | Set by staff each week |
| Slayer Boss | Yes | Set by staff each week |
| Group Midgame Boss | No (manually enforced) | Set by staff each week |
| Group Endgame Boss | No (manually enforced) | Set by staff each week |

Only players who hit 150k XP in **both** Skill of the Week competitions are listed in the report. Completing just one does not count.

---

## Boss reference

Default kills/completions per hour shown in `/preview` when choosing a KC threshold. Values are sourced from the OSRS wiki money making guides at 75%, or estimated at 75% where no wiki page exists. Override any value with `/setbossrate`.

**Group eligible** indicates whether multiple players can fight the same boss together. Solo-only bosses will not appear in the group boss dropdown.

### Midgame bosses (Easy / Medium / Hard tier)

| Boss | Group | Wilderness | Default KPH | Source |
|---|---|---|---|---|
| Abyssal Sire | No | No | 29 | Wiki |
| Alchemical Hydra | No | No | 19 | Wiki |
| Amoxliatl | No | No | 11 | Est. |
| Araxxor | No | No | 26 | Wiki |
| Artio | Yes | **Yes** | 34 | Est. |
| Barrows Chests | Yes | No | 11 | Est. |
| Bryophyta | No | No | 11 | Est. |
| Cal'varion | Yes | **Yes** | 26 | Est. |
| Callisto | Yes | **Yes** | 14 | Est. |
| Cerberus | No | No | 38 | Wiki |
| Chaos Elemental | Yes | **Yes** | 23 | Est. |
| Chaos Fanatic | Yes | **Yes** | 45 | Est. |
| Commander Zilyana | Yes | No | 20 | Wiki |
| Corporeal Beast | Yes | No | 8 | Wiki |
| Crazy Archaeologist | Yes | **Yes** | 45 | Est. |
| Dagannoth Prime | Yes | No | 19 | Wiki |
| Dagannoth Rex | Yes | No | 19 | Wiki |
| Dagannoth Supreme | Yes | No | 19 | Wiki |
| Deranged Archaeologist | Yes | No | 45 | Est. |
| The Gauntlet | No | No | 5 | Wiki |
| Giant Mole | Yes | No | 34 | Est. |
| Grotesque Guardians | No | No | 18 | Wiki |
| Hespori | No | No | — | Key-gated |
| Hueycoatl | Yes | No | 11 | Est. |
| Kalphite Queen | Yes | No | 17 | Wiki |
| King Black Dragon | Yes | **Yes** | 30 | Est. |
| Kraken | No | No | 45 | Wiki |
| K'ril Tsutsaroth | Yes | No | 20 | Wiki |
| Mimic | No | No | — | Casket-gated |
| Obor | No | No | 30 | Est. |
| Sarachnis | Yes | No | 23 | Wiki |
| Scorpia | Yes | **Yes** | 45 | Est. |
| Scurrius | Yes | No | 21 | Est. |
| Skotizo | No | No | — | Totem-gated |
| Spindel | Yes | **Yes** | 21 | Est. |
| Tempoross | Yes | No | 8 | Est. |
| Thermonuclear Smoke Devil | No | No | 60 | Wiki |
| TzTok-Jad | No | No | 2 | Est. |
| Venenatis | Yes | **Yes** | 19 | Est. |
| Vet'ion | Yes | **Yes** | 14 | Est. |
| Wintertodt | Yes | No | 8 | Est. |
| Zalcano | Yes | No | 11 | Est. |

### Endgame bosses (Elite tier and above)

None of the endgame bosses are in the Wilderness.

| Boss | Group | Default KPH | Source |
|---|---|---|---|
| The Corrupted Gauntlet | No | 5 | Wiki |
| Duke Sucellus | No | 26 | Wiki |
| General Graardor | Yes | 20 | Wiki |
| Kree'Arra | Yes | 20 | Wiki |
| The Leviathan | No | 18 | Wiki |
| Nex | Yes | 5 | Wiki |
| The Nightmare | Yes | 10 | Est. |
| Phantom Muspah | No | 19 | Wiki |
| Phosani's Nightmare | No | 8 | Est. |
| Sol Heredit | No | 3 | Est. |
| TzKal-Zuk | No | 1 | Est. |
| Vardorvis | No | 24 | Wiki |
| Vorkath | No | 23 | Wiki |
| The Whisperer | No | 15 | Wiki |
| Zulrah | No | 15 | Wiki |

### Raids (all group eligible, all endgame, none in Wilderness)

| Raid | Default Completions/hr | Source |
|---|---|---|
| Chambers of Xeric | 2 | Wiki |
| Chambers of Xeric: Challenge Mode | 2 | Est. |
| Theatre of Blood | 2 | Wiki |
| Theatre of Blood: Hard Mode | 1 | — |
| Tombs of Amascut | 2 | Est. |
| Tombs of Amascut: Expert Mode | 2 | Est. |

The repeat-avoidance history only applies to **randomly chosen** skills. If staff manually picks a skill via `/setweek`, it will be used regardless of recent history — but it will still be recorded so the random picker avoids it in future weeks.

---

## Todo

- **Submissions for points** — automatically create a "Submissions for points" competition or post alongside the weekly announcement
- **Configurable boss dropdowns** — ✅ done; midgame fields show Easy/Medium/Hard bosses, endgame fields show Elite+ bosses, raid field shows raids only, slayer field shows slayer bosses
- **Timezone configurability** — remove the hardcoded dependency on Central time so the bot can be used by clans in other timezones
- **Recommended thresholds** — ✅ done via `/setbossrate` and `/preview`; skill XP thresholds could also show a recommended weekly goal
