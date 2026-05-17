// index.js
// The entry point for the bot. Run this file with: node src/index.js
// This file's only job is to load environment variables, start the Discord bot,
// and then hand the Discord client off to the scheduler so it can post messages.

require('dotenv').config();

const { createAndStartBot } = require('./bot');
const { startScheduler } = require('./scheduler');

// Check that the required environment variables are present before trying to start.
// If any are missing, print a clear error and exit — better to fail early than to
// crash mysteriously later when a cron job actually tries to use them.
// These must always be present — the bot cannot function without them
const requiredEnvVars = [
  'DISCORD_TOKEN',
  'WOM_GROUP_ID',
  'WOM_VERIFICATION_CODE',
];

// These can be set either here in .env OR via /setchannel in Discord.
// We warn at startup if neither source has them, but don't exit — the bot
// can still start and staff can run /setchannel to configure them.
const optionalChannelVars = [
  'DISCORD_ANNOUNCEMENT_CHANNEL_ID',
  'DISCORD_STAFF_CHANNEL_ID',
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`[index] Missing required environment variable: ${varName}`);
    console.error('[index] Copy .env.example to .env and fill in all the values.');
    process.exit(1);
  }
}

// Warn about channel vars only if they aren't set in .env AND haven't been saved via /setchannel
const { resolveChannelId } = require('./storage');
for (const varName of optionalChannelVars) {
  const type = varName.includes('ANNOUNCEMENT') ? 'announcement' : 'staff';
  if (!resolveChannelId(type)) {
    console.warn(`[index] Warning: no channel configured for "${type}". Use /setchannel in Discord to set it.`);
  }
}

// Start everything up
async function main() {
  console.log('[index] Starting wom-bot...');

  try {
    // Start the Discord bot and wait until it's fully logged in
    const discordClient = await createAndStartBot();

    // Now that the bot is running, register the cron jobs and give them access to the Discord client
    startScheduler(discordClient);

    console.log('[index] wom-bot is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('[index] Fatal error during startup:', error);
    process.exit(1);
  }
}

main();
