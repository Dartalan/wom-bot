// wom.js
// All communication with the Wise Old Man API lives here.
// No other file should make HTTP requests to WOM — route everything through this file.

const axios = require('axios');
const config = require('../config');
const bosses = require('./bosses');

// Pull the group ID and verification code from environment variables.
// These are secret and must never be hardcoded.
const womGroupId = process.env.WOM_GROUP_ID;
const womVerificationCode = process.env.WOM_VERIFICATION_CODE;

// A pre-configured axios instance that always sends requests to the WOM base URL.
// Includes a User-Agent header so WOM can identify our bot if needed.
const womClient = axios.create({
  baseURL: config.womApiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'wom-bot/1.0 (The Duke Clan Discord Bot)',
  },
  timeout: 15000, // 15 seconds — if WOM doesn't respond by then, treat it as a failure
});

// Creates a single competition in Wise Old Man for the given metric (skill or boss).
// Returns the new competition object from the WOM API, which includes the competition ID.
//
// Parameters:
//   title        — The competition title shown in WOM (e.g. "Duke Clan - Skill of the Week: Mining")
//   metric       — The WOM metric key (e.g. "mining" or "corporeal_beast"). Must match WOM's metric names exactly.
//   startsAt     — JavaScript Date object for when the competition starts
//   endsAt       — JavaScript Date object for when the competition ends
//   scoreThreshold — Minimum XP/KC a player needs to count as a completer (used in our report, not enforced by WOM)
async function createCompetition(title, metric, startsAt, endsAt) {
  const requestBody = {
    title: title,
    metric: metric,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    groupId: Number(womGroupId),
    groupVerificationCode: womVerificationCode,
  };

  try {
    console.log(`[wom] Creating competition: "${title}" (metric: ${metric})`);
    const response = await womClient.post('/competitions', requestBody);
    console.log(`[wom] Competition created. ID: ${response.data.competition.id}`);
    return response.data.competition;
  } catch (error) {
    const errorMessage = error.response
      ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
      : error.message;
    console.error(`[wom] Failed to create competition "${title}": ${errorMessage}`);
    throw new Error(`WOM API error when creating "${title}": ${errorMessage}`);
  }
}

// Fetches all competitions currently associated with the clan group from WOM.
// Returns an array of competition objects, each with at minimum: id, title, metric, startsAt, endsAt.
// This is used to check whether competitions already exist before creating new ones,
// so we're asking WOM directly rather than trusting our local weeks.json file.
async function getGroupCompetitions() {
  try {
    console.log(`[wom] Fetching competitions for group ${womGroupId}...`);
    const response = await womClient.get(`/groups/${womGroupId}/competitions`);
    return response.data || [];
  } catch (error) {
    const errorMessage = error.response
      ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
      : error.message;
    console.error(`[wom] Failed to fetch group competitions: ${errorMessage}`);
    throw new Error(`WOM API error when fetching group competitions: ${errorMessage}`);
  }
}

// Fetches the results of a single competition by its WOM competition ID.
// Returns an array of participant objects, each with a player name and gained XP/KC.
async function getCompetitionResults(competitionId) {
  try {
    console.log(`[wom] Fetching results for competition ID: ${competitionId}`);
    const response = await womClient.get(`/competitions/${competitionId}/top5`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response
      ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
      : error.message;
    console.error(`[wom] Failed to fetch results for competition ${competitionId}: ${errorMessage}`);
    throw new Error(`WOM API error when fetching results for competition ${competitionId}: ${errorMessage}`);
  }
}

// Fetches the full participant list for a competition, not just the top 5.
// We use this when we need to find everyone who crossed a threshold (e.g. 150k XP).
async function getCompetitionParticipants(competitionId) {
  try {
    console.log(`[wom] Fetching all participants for competition ID: ${competitionId}`);
    const response = await womClient.get(`/competitions/${competitionId}`);
    // The full competition object has a "participations" array with every player's progress
    return response.data.participations || [];
  } catch (error) {
    const errorMessage = error.response
      ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
      : error.message;
    console.error(`[wom] Failed to fetch participants for competition ${competitionId}: ${errorMessage}`);
    throw new Error(`WOM API error when fetching participants for competition ${competitionId}: ${errorMessage}`);
  }
}

// Given a list of participations (from getCompetitionParticipants), returns only the players
// whose gained value (XP or KC) is at or above the given threshold.
// Used to find who "completed" the Skill of the Week and boss challenges.
function filterParticipantsByThreshold(participations, threshold) {
  return participations.filter((participation) => {
    const gained = participation.progress && participation.progress.gained != null
      ? participation.progress.gained
      : 0;
    return gained >= threshold;
  });
}

// Converts a WOM metric key (like "corporeal_beast") into a readable display name (like "Corporeal Beast").
// WOM uses snake_case metric names; this turns them into Title Case for Discord messages.
function formatMetricName(metricKey) {
  return metricKey
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Converts a skill name as stored in config (e.g. "Agility") into the lowercase WOM metric key (e.g. "agility").
// WOM expects all metric names in lowercase with underscores.
function skillNameToMetricKey(skillName) {
  return skillName.toLowerCase().replace(/ /g, '_');
}

// Converts a boss or raid display name (e.g. "Kree'Arra") into the WOM metric key (e.g. "kreearra").
// Delegates to bosses.getMetricKey() which handles apostrophes, hyphens, colons, and other
// special characters that the simple lowercase+replace approach would get wrong.
function bossNameToMetricKey(bossName) {
  return bosses.getMetricKey(bossName);
}

// Tells WOM to refresh the stats for every member of the clan group.
// Returns true if updates were queued (caller should wait ~60 seconds before fetching results),
// or false if WOM said no members were outdated (data is already fresh — no wait needed).
async function updateAllGroupMembers() {
  try {
    console.log(`[wom] Triggering update-all for group ${womGroupId}...`);
    const response = await womClient.post(`/groups/${womGroupId}/update-all`, {
      verificationCode: womVerificationCode,
    });
    console.log('[wom] Update-all triggered successfully:', response.data.message || 'queued');
    return true; // updates were queued — caller should wait before fetching
  } catch (error) {
    // WOM returns an error when all members were already updated within the last 24 hours.
    // In that case the data is already fresh so we can skip the wait entirely.
    const responseBody = error.response && error.response.data;
    if (responseBody && typeof responseBody.message === 'string' &&
        responseBody.message.toLowerCase().includes('no outdated members')) {
      console.log('[wom] All members already up to date — no update queued, skipping wait.');
      return false; // no updates queued — caller can proceed immediately
    }

    const errorMessage = error.response
      ? `HTTP ${error.response.status}: ${JSON.stringify(responseBody)}`
      : error.message;
    // Any other error: log it but don't crash the report. Treat as "no update queued"
    // so we don't wait 60 seconds for nothing.
    console.error(`[wom] Failed to trigger update-all: ${errorMessage}`);
    return false;
  }
}

module.exports = {
  createCompetition,
  getGroupCompetitions,
  getCompetitionResults,
  getCompetitionParticipants,
  filterParticipantsByThreshold,
  formatMetricName,
  skillNameToMetricKey,
  bossNameToMetricKey,
  updateAllGroupMembers,
};
