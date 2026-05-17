// bot.js
// Sets up the Discord bot, registers all slash commands, and handles incoming interactions.
// This file is the "front door" for everything Discord-related.
// It does NOT contain scheduling logic — that lives in scheduler.js.

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const config = require('../config');
const storage = require('./storage');
const scheduler = require('./scheduler');
const bosses = require('./bosses');

// The full list of slash commands the bot supports.
// discord.js requires these to be registered with Discord before they appear in the UI.
const slashCommandDefinitions = [
  // /setweek — staff enters all the week's boss/raid/threshold info before Monday
  new SlashCommandBuilder()
    .setName('setweek')
    .setDescription('Set the bosses, raids, and KC thresholds for the upcoming week')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // Only visible to admins by default; further restricted in handler
    .addStringOption((option) =>
      option.setName('solo_midgame_boss').setDescription('Solo Midgame Boss — type to search').setRequired(true).setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option.setName('solo_midgame_kc').setDescription('KC threshold for Solo Midgame Boss').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('group_midgame_boss').setDescription('Group Midgame Boss — type to search (manually tracked, no WOM competition)').setRequired(true).setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option.setName('group_midgame_kc').setDescription('KC goal for Group Midgame Boss').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('solo_endgame_boss').setDescription('Solo Endgame Boss — type to search').setRequired(true).setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option.setName('solo_endgame_kc').setDescription('KC threshold for Solo Endgame Boss').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('group_endgame_boss').setDescription('Group Endgame Boss — type to search (manually tracked, no WOM competition)').setRequired(true).setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option.setName('group_endgame_kc').setDescription('KC goal for Group Endgame Boss').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('raid').setDescription('Raid of the Week — type to search').setRequired(true).setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option.setName('raid_completions').setDescription('Completions threshold for Raid of the Week').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('slayer_boss').setDescription('Slayer Boss — type to search').setRequired(true).setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option.setName('slayer_kc').setDescription('KC threshold for Slayer Boss').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('skill_1').setDescription('Skill of the Week 1 — leave blank to randomize').setRequired(false).setAutocomplete(true)
    )
    .addStringOption((option) =>
      option.setName('skill_2').setDescription('Skill of the Week 2 — leave blank to randomize').setRequired(false).setAutocomplete(true)
    ),

  // /preview — shows what pending.json currently has, as a formatted embed
  new SlashCommandBuilder()
    .setName('preview')
    .setDescription('Preview the upcoming week settings saved by /setweek')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // /report — manually trigger the end-of-week results report
  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Manually trigger the end-of-week results report now')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option.setName('dry_run').setDescription('If true, logs what would happen without posting or calling WOM').setRequired(false)
    ),

  // /setchannel — configure which Discord channels the bot posts to
  new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set which Discord channel the bot posts announcements or staff alerts to')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option.setName('type').setDescription('Which channel to configure').setRequired(true)
        .addChoices(
          { name: 'Announcements & Reports', value: 'announcement' },
          { name: 'Staff Alerts',            value: 'staff' },
        )
    )
    .addChannelOption((option) =>
      option.setName('channel').setDescription('The channel to post to').setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  // /setschedule — change the day and time competitions start each week
  new SlashCommandBuilder()
    .setName('setschedule')
    .setDescription('Change the day and time competitions start each week')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((option) =>
      option.setName('day').setDescription('Day of week competitions start').setRequired(true)
        .addChoices(
          { name: 'Sunday',    value: 0 },
          { name: 'Monday',    value: 1 },
          { name: 'Tuesday',   value: 2 },
          { name: 'Wednesday', value: 3 },
          { name: 'Thursday',  value: 4 },
          { name: 'Friday',    value: 5 },
          { name: 'Saturday',  value: 6 },
        )
    )
    .addIntegerOption((option) =>
      option.setName('hour').setDescription('Hour competitions start (0–23, Central time)').setRequired(true).setMinValue(0).setMaxValue(23)
    )
    .addIntegerOption((option) =>
      option.setName('minute').setDescription('Minute competitions start (0–59), default 0').setRequired(false).setMinValue(0).setMaxValue(59)
    ),

  // /createcompetitions — manually trigger competition creation for the current week
  new SlashCommandBuilder()
    .setName('createcompetitions')
    .setDescription('Manually trigger competition creation now (normally runs automatically on Monday)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option.setName('dry_run').setDescription('If true, logs what would happen without creating competitions or posting').setRequired(false)
    ),
];

// Handles autocomplete interactions for the boss and raid fields in /setweek.
// When a user is typing into one of those fields, Discord sends an autocomplete event
// and expects us to respond within 3 seconds with a list of up to 25 matching choices.
//
// Each field gets a different list:
//   - raid → only shows raids (not regular bosses)
//   - slayer_boss → shows the slayer-focused boss list
//   - everything else → shows the full boss list
//
// The filter is case-insensitive and matches anywhere in the name, so typing "corp"
// will find "Corporeal Beast".
async function handleAutocomplete(interaction) {
  // getFocused(true) returns the option the user is currently typing in,
  // as an object with a "name" (the option name) and "value" (what they've typed so far)
  const focusedOption = interaction.options.getFocused(true);
  const typedSoFar = focusedOption.value.toLowerCase();
  const optionName = focusedOption.name;

  // Pick the right list based on which field the user is filling in
  let choiceList;
  if (optionName === 'skill_1' || optionName === 'skill_2') {
    // Skills come from config, not the bosses file
    choiceList = config.noncombatSkills.map((skill) => ({ name: skill, value: skill }));
  } else if (optionName === 'raid') {
    choiceList = bosses.RAIDS;
  } else if (optionName === 'slayer_boss') {
    choiceList = bosses.SLAYER_BOSSES;
  } else {
    choiceList = bosses.ALL_BOSSES;
  }

  // Filter to entries that contain what the user typed, anywhere in the name
  const matchingChoices = choiceList
    .filter((entry) => entry.name.toLowerCase().includes(typedSoFar))
    .slice(0, 25); // Discord allows a maximum of 25 autocomplete results

  // Send the filtered list back to Discord so it can show the dropdown
  await interaction.respond(matchingChoices);
}

// Checks whether the user who ran a command has the Staff role.
// Returns true if they do, false if not.
// We check by role name (from config) rather than by role ID so it's easy to configure.
function userHasStaffRole(interaction) {
  const staffRole = interaction.member.roles.cache.find(
    (role) => role.name === config.staffRoleName
  );
  return staffRole !== undefined;
}

// Handles /setweek — reads all the options from the command and saves them to pending.json.
async function handleSetWeek(interaction) {
  if (!userHasStaffRole(interaction)) {
    await interaction.reply({ content: 'You need the Staff role to use this command.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Read every option from the interaction — discord.js returns null for missing optional options
  const pendingData = {
    soloMidgameBoss: interaction.options.getString('solo_midgame_boss'),
    soloMidgameKc: interaction.options.getInteger('solo_midgame_kc'),
    groupMidgameBoss: interaction.options.getString('group_midgame_boss'),
    groupMidgameKc: interaction.options.getInteger('group_midgame_kc'),
    soloEndgameBoss: interaction.options.getString('solo_endgame_boss'),
    soloEndgameKc: interaction.options.getInteger('solo_endgame_kc'),
    groupEndgameBoss: interaction.options.getString('group_endgame_boss'),
    groupEndgameKc: interaction.options.getInteger('group_endgame_kc'),
    raid: interaction.options.getString('raid'),
    raidCompletions: interaction.options.getInteger('raid_completions'),
    slayerBoss: interaction.options.getString('slayer_boss'),
    slayerKc: interaction.options.getInteger('slayer_kc'),
    skill1: interaction.options.getString('skill_1') || null,
    skill2: interaction.options.getString('skill_2') || null,
    setAt: new Date().toISOString(),
    setBy: interaction.user.tag,
  };

  try {
    storage.writePending(pendingData);
    await interaction.reply({
      content: `Week settings saved! Use /preview to double-check them before Monday.\n\nSaved by: ${interaction.user.tag}`,
      flags: MessageFlags.Ephemeral,
    });
    console.log(`[bot] /setweek used by ${interaction.user.tag}`);
  } catch (error) {
    console.error('[bot] Failed to write pending.json in /setweek:', error.message);
    await interaction.reply({ content: 'Something went wrong saving the settings. Check the bot logs.', flags: MessageFlags.Ephemeral });
  }
}

// Handles /preview — reads pending.json and formats it into a Discord embed so staff can review it.
async function handlePreview(interaction) {
  if (!userHasStaffRole(interaction)) {
    await interaction.reply({ content: 'You need the Staff role to use this command.', flags: MessageFlags.Ephemeral });
    return;
  }

  const pendingData = storage.readPending();

  if (!pendingData || !pendingData.soloMidgameBoss) {
    await interaction.reply({
      content: 'No week settings found. Run /setweek first.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Upcoming Week Preview')
    .setDescription(`Set by **${pendingData.setBy || 'unknown'}** at ${pendingData.setAt || 'unknown time'}`)
    .setColor(0x3498db) // Blue
    .addFields(
      { name: 'Solo Midgame Boss', value: `${pendingData.soloMidgameBoss} — ${pendingData.soloMidgameKc} KC`, inline: true },
      { name: 'Group Midgame Boss', value: `${pendingData.groupMidgameBoss} — ${pendingData.groupMidgameKc} KC`, inline: true },
      { name: '​', value: '​', inline: false }, // empty line spacer
      { name: 'Solo Endgame Boss', value: `${pendingData.soloEndgameBoss} — ${pendingData.soloEndgameKc} KC`, inline: true },
      { name: 'Group Endgame Boss', value: `${pendingData.groupEndgameBoss} — ${pendingData.groupEndgameKc} KC`, inline: true },
      { name: '​', value: '​', inline: false },
      { name: 'Raid of the Week', value: `${pendingData.raid} — ${pendingData.raidCompletions} completions`, inline: true },
      { name: 'Slayer Boss', value: `${pendingData.slayerBoss} — ${pendingData.slayerKc} KC`, inline: true },
      { name: 'Skill of the Week 1', value: pendingData.skill1 || 'Random (chosen on Monday)', inline: true },
      { name: 'Skill of the Week 2', value: pendingData.skill2 || 'Random (chosen on Monday)', inline: true }
    )
    .setFooter({ text: 'These settings will go live Monday at 3:00am Central' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// Handles /setchannel — saves a channel ID to channels.json so the bot knows where to post.
// Reads the existing config first so it only overwrites the one type being changed.
async function handleSetChannel(interaction) {
  if (!userHasStaffRole(interaction)) {
    await interaction.reply({ content: 'You need the Staff role to use this command.', flags: MessageFlags.Ephemeral });
    return;
  }

  const type    = interaction.options.getString('type');
  const channel = interaction.options.getChannel('channel');

  const existing = storage.readChannels() || {};

  const updated = {
    ...existing,
    announcementChannelId: type === 'announcement' ? channel.id : (existing.announcementChannelId || null),
    staffChannelId:        type === 'staff'        ? channel.id : (existing.staffChannelId        || null),
  };

  try {
    storage.writeChannels(updated);

    const typeLabel = type === 'announcement' ? 'Announcements & Reports' : 'Staff Alerts';
    await interaction.reply({
      content: `Done! **${typeLabel}** will now be posted to <#${channel.id}>.`,
      flags: MessageFlags.Ephemeral,
    });
    console.log(`[bot] /setchannel used by ${interaction.user.tag} — ${typeLabel} → #${channel.name} (${channel.id})`);
  } catch (error) {
    console.error('[bot] Error in /setchannel:', error.message);
    await interaction.reply({ content: `Something went wrong: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
}

// Handles /setschedule — saves a new competition start time and immediately restarts the
// cron jobs so the change takes effect without needing to restart the bot.
async function handleSetSchedule(interaction, discordClient) {
  if (!userHasStaffRole(interaction)) {
    await interaction.reply({ content: 'You need the Staff role to use this command.', flags: MessageFlags.Ephemeral });
    return;
  }

  const startDay    = interaction.options.getInteger('day');
  const startHour   = interaction.options.getInteger('hour');
  const startMinute = interaction.options.getInteger('minute') ?? 0;

  const newSchedule = { startDay, startHour, startMinute };

  // Derive what the report and reminder times will be so we can confirm them to staff
  const { reportCron, reminderCron } = scheduler.buildCronExpressions(newSchedule);
  const startLabel = scheduler.describeSchedule(newSchedule);

  try {
    storage.writeSchedule(newSchedule);
    // Restart the cron jobs immediately with the new schedule — no bot restart needed
    scheduler.startScheduler(discordClient);

    await interaction.reply({
      content:
        `Schedule updated! Competitions will now start **${startLabel}**.\n` +
        `The end-of-week report will run automatically 24 hours after each competition ends.\n` +
        `The /setweek reminder will ping at noon the day before competitions start.\n\n` +
        `*(Start cron: \`${scheduler.buildCronExpressions(newSchedule).startCron}\` — Report cron: \`${reportCron}\`)*`,
      flags: MessageFlags.Ephemeral,
    });

    console.log(`[bot] /setschedule used by ${interaction.user.tag} — new schedule: ${startLabel}`);
  } catch (error) {
    console.error('[bot] Error in /setschedule:', error.message);
    await interaction.reply({ content: `Something went wrong: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
}

// Handles /report — manually triggers the end-of-week results report, with optional dry-run mode.
async function handleReport(interaction, discordClient) {
  if (!userHasStaffRole(interaction)) {
    await interaction.reply({ content: 'You need the Staff role to use this command.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Defer the reply because fetching WOM data can take a few seconds
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const dryRun = interaction.options.getBoolean('dry_run') ?? false;

  try {
    await scheduler.runWeekEnd(discordClient, dryRun);
    const message = dryRun
      ? 'Dry run complete. Check the bot console logs to see what would have been posted.'
      : 'End-of-week report posted to the competition channel.';
    await interaction.editReply({ content: message });
  } catch (error) {
    console.error('[bot] Error in /report:', error.message);
    await interaction.editReply({ content: `Something went wrong: ${error.message}` });
  }
}

// Handles /createcompetitions — manually creates competitions, with optional dry-run mode.
async function handleCreateCompetitions(interaction, discordClient) {
  if (!userHasStaffRole(interaction)) {
    await interaction.reply({ content: 'You need the Staff role to use this command.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Defer because creating multiple WOM competitions will take several seconds
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const dryRun = interaction.options.getBoolean('dry_run') ?? false;

  try {
    await scheduler.runWeekStart(discordClient, dryRun);
    const message = dryRun
      ? 'Dry run complete. Check the bot console logs to see what would have been created.'
      : 'Competitions created and announcement posted!';
    await interaction.editReply({ content: message });
  } catch (error) {
    console.error('[bot] Error in /createcompetitions:', error.message);
    await interaction.editReply({ content: `Something went wrong: ${error.message}` });
  }
}

// Registers all slash commands with Discord's API so they appear in the UI.
// This needs to run once when the bot starts. Discord caches commands, so changes may
// take up to an hour to appear — but re-registering on every startup is safe and keeps things in sync.
async function registerSlashCommands(botToken, clientId) {
  const rest = new REST({ version: '10' }).setToken(botToken);
  const commandJsonArray = slashCommandDefinitions.map((command) => command.toJSON());

  try {
    console.log('[bot] Registering slash commands with Discord...');
    await rest.put(Routes.applicationCommands(clientId), { body: commandJsonArray });
    console.log('[bot] Slash commands registered successfully.');
  } catch (error) {
    console.error('[bot] Failed to register slash commands:', error.message);
    throw error;
  }
}

// Creates and configures the Discord client, attaches event listeners, and logs in.
// Returns the logged-in client so other modules (like the scheduler) can use it to post messages.
async function createAndStartBot() {
  const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  // Fired once when the bot successfully connects to Discord
  discordClient.once('clientReady', async () => {
    console.log(`[bot] Logged in as ${discordClient.user.tag}`);

    // Register slash commands now that we know our client ID
    await registerSlashCommands(process.env.DISCORD_TOKEN, discordClient.user.id);
  });

  // Fired every time any interaction comes in — slash commands, autocomplete, buttons, etc.
  discordClient.on('interactionCreate', async (interaction) => {
    // Autocomplete interactions must be handled separately and before the slash command check.
    // They have a 3-second deadline so we handle them immediately and return early.
    if (interaction.isAutocomplete()) {
      try {
        await handleAutocomplete(interaction);
      } catch (error) {
        console.error('[bot] Error handling autocomplete:', error.message);
      }
      return;
    }

    // Ignore anything that isn't a slash command (e.g. button clicks)
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    console.log(`[bot] Received command: /${commandName} from ${interaction.user.tag}`);

    try {
      if (commandName === 'setweek') {
        await handleSetWeek(interaction);
      } else if (commandName === 'preview') {
        await handlePreview(interaction);
      } else if (commandName === 'setchannel') {
        await handleSetChannel(interaction);
      } else if (commandName === 'setschedule') {
        await handleSetSchedule(interaction, discordClient);
      } else if (commandName === 'report') {
        await handleReport(interaction, discordClient);
      } else if (commandName === 'createcompetitions') {
        await handleCreateCompetitions(interaction, discordClient);
      } else {
        await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      // Catch errors so one bad interaction doesn't crash the bot
      console.error(`[bot] Unhandled error in /${commandName}:`, error);
      const errorMessage = 'Something went wrong. Check the bot logs.';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage }).catch(() => {});
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });

  // Log in to Discord using the token from .env
  await discordClient.login(process.env.DISCORD_TOKEN);

  return discordClient;
}

module.exports = {
  createAndStartBot,
};
