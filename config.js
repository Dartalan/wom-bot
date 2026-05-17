// config.js
// This file holds all the settings that control how the bot behaves.
// Safe for non-developers to edit — just change the values, not the structure.

const config = {
  // The base URL for all Wise Old Man API requests
  womApiBaseUrl: 'https://api.wiseoldman.net/v2',

  // How many XP a player must gain in a Skill of the Week competition to be counted as a completer
  skillXpThreshold: 150000,

  // How many weeks back to check when avoiding skill repeats (4 weeks × 2 skills = 8 entries)
  skillRepeatLookbackWeeks: 4,

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
  },
};

module.exports = config;
