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
const requiredEnvVars = [
  'DISCORD_TOKEN',
  'DISCORD_CHANNEL_ID',
  'WOM_GROUP_ID',
  'WOM_VERIFICATION_CODE',
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`[index] Missing required environment variable: ${varName}`);
    console.error('[index] Copy .env.example to .env and fill in all the values.');
    process.exit(1);
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
