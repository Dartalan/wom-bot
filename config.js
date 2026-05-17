// config.js
// This file holds all the settings that control how the bot behaves.
// Safe for non-developers to edit — just change the values, not the structure.

const config = {
  // The base URL for all Wise Old Man API requests
  womApiBaseUrl: 'https://api.wiseoldman.net/v2',

  // How many XP a player must gain in a Skill of the Week competition to be counted as a completer
  skillXpThreshold: 150000,

  // How many weeks of skill history to track. With 15 non-combat skills and 2 picked per week,
  // 9 weeks covers enough of the pool that weighted randomness (rather than hard exclusion)
  // keeps the selection feeling varied without ever completely locking out a skill.
  skillRepeatLookbackWeeks: 9,

  // All non-combat skills that are eligible to be randomly chosen as Skill of the Week
  noncombatSkills: [
    'Agility',
    'Construction',
    'Cooking',
    'Crafting',
    'Farming',
    'Firemaking',
    'Fishing',
    'Fletching',
    'Herblore',
    'Hunter',
    'Mining',
    'Runecrafting',
    'Smithing',
    'Thieving',
    'Woodcutting',
  ],

  // The timezone used for all cron scheduling and time display
  timezone: 'America/Chicago',

  // The Discord role name that is allowed to use staff-only slash commands
  staffRoleName: 'Staff',

  // The default competition schedule. Can be changed at any time via /setschedule in Discord.
  // startDay: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  // startHour: 0–23 (uses 24-hour time in the America/Chicago timezone)
  // startMinute: 0–59
  defaultSchedule: {
    startDay: 1,
    startHour: 3,
    startMinute: 0,
  },

  // File paths where the bot stores its data between restarts
  dataFiles: {
    // Stores the configuration set by /setweek before it goes live on Monday
    pending: 'data/pending.json',
    // Stores the active week's competition IDs and details
    weeks: 'data/weeks.json',
    // Stores a flat list of the last 8 skills used (to avoid repeats)
    skillHistory: 'data/skill-history.json',
    // Stores the competition schedule set by /setschedule
    schedule: 'data/schedule.json',
    // Stores the channel IDs set by /setchannel
    channels: 'data/channels.json',
    // Stores per-boss kills/completions per hour overrides set by /setbossrate
    bossThresholds: 'data/boss-thresholds.json',
  },

  // Default kills (or completions) per hour for each boss/raid, at approximately 75% of
  // what a well-geared experienced player can achieve. Used to show staff a recommended
  // weekly KC when setting up /setweek. Override any value with /setbossrate in Discord.
  // Keys must match the display names in src/bosses.js exactly.
  // Sources: wiki.runescape.com/w/Money_making_guide/<boss> where available, taken at 75%.
  // Entries marked "est." had no wiki page and use community estimates at 75%.
  defaultKillsPerHour: {
    'Abyssal Sire':                       29, // wiki: 39/hr
    'Alchemical Hydra':                   19, // wiki: 25/hr
    'Amoxliatl':                          11, // est.
    'Araxxor':                            26, // wiki: 35/hr
    'Artio':                              34, // est.
    'Barrows Chests':                     11, // est.
    "Bryophyta":                          11, // est.
    "Cal'varion":                         26, // est.
    'Callisto':                           14, // est.
    'Cerberus':                           38, // wiki: 50/hr
    'Chambers of Xeric':                   2, // wiki: 3/hr
    'Chambers of Xeric: Challenge Mode':   2, // est.
    'Chaos Elemental':                    23, // est.
    'Chaos Fanatic':                      45, // est.
    'Commander Zilyana':                  20, // wiki: 27/hr
    'Corporeal Beast':                     8, // wiki: 10/hr
    'Crazy Archaeologist':                45, // est.
    'Dagannoth Prime':                    19, // wiki: 25/hr
    'Dagannoth Rex':                      19, // wiki: 25/hr
    'Dagannoth Supreme':                  19, // wiki: 25/hr
    'Deranged Archaeologist':             45, // est.
    'Duke Sucellus':                      26, // wiki: 34/hr
    'General Graardor':                   20, // wiki: 27/hr
    'Giant Mole':                         34, // est.
    'Grotesque Guardians':                18, // wiki: 24/hr
    'The Gauntlet':                        5, // wiki: 7/hr
    'The Corrupted Gauntlet':              5, // wiki: 6/hr
    'Hueycoatl':                          11, // est.
    'Kalphite Queen':                     17, // wiki: 22/hr
    'King Black Dragon':                  30, // est.
    'Kraken':                             45, // wiki: 60/hr
    "Kree'Arra":                          20, // wiki: 27/hr
    "K'ril Tsutsaroth":                   20, // wiki: 26/hr
    'The Leviathan':                      18, // wiki: 24/hr
    'Nex':                                 5, // wiki: 6/hr (duo); solo estimate
    'The Nightmare':                      10, // est.
    'Obor':                               30, // est.
    'Phantom Muspah':                     19, // wiki: 25/hr
    "Phosani's Nightmare":                 8, // est.
    'Sarachnis':                          23, // wiki: 30/hr
    'Scorpia':                            45, // est.
    'Scurrius':                           21, // est.
    'Sol Heredit':                         3, // est.
    'Spindel':                            21, // est.
    'Tempoross':                           8, // est.
    'Theatre of Blood':                    2, // wiki: 3/hr
    'Theatre of Blood: Hard Mode':         1, // user specified
    'Thermonuclear Smoke Devil':          60, // wiki: 80/hr
    'Tombs of Amascut':                    2, // est.
    'Tombs of Amascut: Expert Mode':       2, // est.
    'TzKal-Zuk':                           1, // est.
    'TzTok-Jad':                           2, // est.
    'Vardorvis':                          24, // wiki: 32/hr
    'Venenatis':                          19, // est.
    "Vet'ion":                            14, // est.
    'Vorkath':                            23, // wiki: 30/hr
    'The Whisperer':                      15, // wiki: 20/hr
    'Wintertodt':                          8, // est.
    'Zalcano':                            11, // est.
    'Zulrah':                             15, // wiki: 20/hr
  },
};

module.exports = config;
