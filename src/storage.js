// storage.js
// Handles reading and writing data files to disk.
// All bot state that needs to survive a restart lives in the data/ folder.
// This file is the only place that touches those files directly.

const fs = require('fs');
const path = require('path');
const config = require('../config');

// Resolves a data file path relative to the project root, not relative to this file.
// This means the file paths in config.js work no matter where Node is launched from.
function resolveDataPath(relativePath) {
  return path.join(__dirname, '..', relativePath);
}

// Reads a JSON file from disk and returns its contents as a JavaScript object.
// If the file doesn't exist or can't be parsed, logs the error and returns null.
function readJsonFile(filePath) {
  const fullPath = resolveDataPath(filePath);
  try {
    const rawContent = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(rawContent);
  } catch (error) {
    console.error(`[storage] Failed to read file ${fullPath}:`, error.message);
    return null;
  }
}

// Writes a JavaScript object to a JSON file on disk, pretty-printed so humans can read it.
// Overwrites the file if it already exists.
function writeJsonFile(filePath, data) {
  const fullPath = resolveDataPath(filePath);
  try {
    const prettyJson = JSON.stringify(data, null, 2);
    fs.writeFileSync(fullPath, prettyJson, 'utf8');
    console.log(`[storage] Wrote file: ${fullPath}`);
  } catch (error) {
    console.error(`[storage] Failed to write file ${fullPath}:`, error.message);
    throw error;
  }
}

// Reads the pending.json file, which holds the /setweek configuration
// that will be applied on the next Monday when competitions are created.
function readPending() {
  return readJsonFile(config.dataFiles.pending);
}

// Writes a new pending configuration to pending.json.
// Called by /setweek to save what staff entered.
function writePending(pendingData) {
  writeJsonFile(config.dataFiles.pending, pendingData);
}

// Reads the weeks.json file, which holds the active week's competition IDs and settings.
function readCurrentWeek() {
  return readJsonFile(config.dataFiles.weeks);
}

// Writes the active week data to weeks.json.
// Called every Monday after competitions are created in WOM.
function writeCurrentWeek(weekData) {
  writeJsonFile(config.dataFiles.weeks, weekData);
}

// Reads skill-history.json, which is a flat array of skill names used in recent weeks.
// Returns an empty array if the file is missing or empty.
function readSkillHistory() {
  const history = readJsonFile(config.dataFiles.skillHistory);
  if (!Array.isArray(history)) {
    return [];
  }
  return history;
}

// Appends one or more newly chosen skills to the skill history and trims it so it never
// grows beyond the lookback window (4 weeks × 2 skills = 8 entries).
// Takes an array so callers can add 1 or 2 skills depending on what was actually newly picked
// (e.g. during a partial re-run, only the missing skill needs to be added).
function appendSkillHistory(newSkills) {
  const existingHistory = readSkillHistory();
  const updatedHistory = [...existingHistory, ...newSkills];

  // How many total entries to keep: 4 weeks × 2 skills per week
  const maxEntries = config.skillRepeatLookbackWeeks * 2;

  // If we've grown past the limit, drop the oldest entries from the front
  const trimmedHistory = updatedHistory.slice(-maxEntries);

  writeJsonFile(config.dataFiles.skillHistory, trimmedHistory);
  return trimmedHistory;
}

// Reads the channel configuration from channels.json.
// Returns an object with announcementChannelId and staffChannelId, either of which may be null.
function readChannels() {
  return readJsonFile(config.dataFiles.channels) || {};
}

// Writes a new channel configuration to channels.json.
// Called by /setchannel after staff picks a channel in Discord.
function writeChannels(channelData) {
  writeJsonFile(config.dataFiles.channels, channelData);
}

// Returns the active channel ID for a given type ('announcement' or 'staff').
// Checks channels.json first (set via /setchannel), then falls back to the
// corresponding environment variable so existing .env setups keep working.
function resolveChannelId(type) {
  const channels = readChannels();
  if (type === 'announcement') {
    return channels.announcementChannelId || process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID || null;
  }
  if (type === 'staff') {
    return channels.staffChannelId || process.env.DISCORD_STAFF_CHANNEL_ID || null;
  }
  return null;
}

// Reads the competition schedule from schedule.json.
// Returns the stored schedule, or null if the file is missing (caller should use the default).
function readSchedule() {
  return readJsonFile(config.dataFiles.schedule);
}

// Writes a new competition schedule to schedule.json.
// Called by /setschedule after staff changes the timing.
function writeSchedule(scheduleData) {
  writeJsonFile(config.dataFiles.schedule, scheduleData);
}

module.exports = {
  readChannels,
  writeChannels,
  resolveChannelId,
  readSchedule,
  writeSchedule,
  readPending,
  writePending,
  readCurrentWeek,
  writeCurrentWeek,
  readSkillHistory,
  appendSkillHistory,
};
