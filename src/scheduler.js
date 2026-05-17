// scheduler.js
// Handles all cron-based scheduling. Three jobs run each week:
//   1. Day-before-start at noon — remind staff to run /setweek if they haven't yet
//   2. Start day at configured time — create new competitions and post the announcement
//   3. Start day + 1 at configured time - 1 minute — end-of-week report
// The exact timing is configurable via /setschedule and stored in data/schedule.json.

const cron = require('node-cron');
const config = require('../config');
const storage = require('./storage');
const wom = require('./wom');

// Builds a weight map for every eligible skill based on how recently it was used.
// Recently used skills get low weight (less likely to be picked) and skills not in the
// history at all get the highest weight. Nothing is ever fully blocked — this adds
// randomness while still strongly favouring skills that haven't been used recently.
//
// Weight scale:
//   Used last week:           weight 1  (least likely)
//   Used 2 weeks ago:         weight 2
//   ...
//   Used 9 weeks ago:         weight 9
//   Not used in 9+ weeks:     weight 10 (most likely)
//
// additionalExclusions are hard-excluded entirely (weight 0, not added to the map).
// Used when one skill competition already exists on WOM and we must avoid duplicating it.
function buildSkillWeightMap(skillHistory, additionalExclusions) {
  const lookbackWeeks = config.skillRepeatLookbackWeeks;
  const freshWeight = lookbackWeeks + 1;

  // Find the most recent position (from the end of the array) each skill appears at.
  // skillHistory is oldest-first, so position 1 from the end = used last week.
  const mostRecentPosition = {};
  for (let i = 0; i < skillHistory.length; i++) {
    const skill = skillHistory[i];
    const positionFromEnd = skillHistory.length - i;
    if (mostRecentPosition[skill] == null || positionFromEnd < mostRecentPosition[skill]) {
      mostRecentPosition[skill] = positionFromEnd;
    }
  }

  const weights = {};
  for (const skill of config.noncombatSkills) {
    if (additionalExclusions.includes(skill)) continue; // hard exclude

    if (mostRecentPosition[skill] == null) {
      weights[skill] = freshWeight; // not used recently — highest weight
    } else {
      // positions 1-2 = week 1, 3-4 = week 2, etc.
      const weekNumber = Math.ceil(mostRecentPosition[skill] / 2);
      weights[skill] = weekNumber;
    }
  }

  return weights;
}

// Picks one skill at random from a weight map using weighted probability.
// A skill with weight 10 is 10x more likely to be chosen than one with weight 1.
function weightedRandomPick(weightMap) {
  const skills = Object.keys(weightMap);
  const totalWeight = skills.reduce((sum, skill) => sum + weightMap[skill], 0);

  let random = Math.random() * totalWeight;
  for (const skill of skills) {
    random -= weightMap[skill];
    if (random <= 0) return skill;
  }

  return skills[skills.length - 1]; // floating-point safety fallback
}

// Picks two skills using weighted random selection. Recently used skills are less likely
// but never impossible, adding natural variety without ever fully locking out a skill.
// Logs the weight of each chosen skill so staff can see how the randomness played out.
// Always returns an array of 2 skills (the caller takes [0] or [1] as needed).
function pickSkillsOfTheWeek(additionalExclusions = []) {
  const skillHistory = storage.readSkillHistory();
  const weights = buildSkillWeightMap(skillHistory, additionalExclusions);

  if (Object.keys(weights).length < 2) {
    // Safety net — should never happen with 15 skills
    console.warn('[scheduler] Fewer than 2 weighted skills available — falling back to equal weights');
    for (const skill of config.noncombatSkills) {
      if (!additionalExclusions.includes(skill)) weights[skill] = 1;
    }
  }

  const skill1 = weightedRandomPick(weights);
  console.log(`[scheduler] Picked skill 1: ${skill1} (weight ${weights[skill1]})`);

  // Remove skill1 from the pool so we can't pick the same skill twice
  const weightsForSkill2 = { ...weights };
  delete weightsForSkill2[skill1];

  const skill2 = weightedRandomPick(weightsForSkill2);
  console.log(`[scheduler] Picked skill 2: ${skill2} (weight ${weightsForSkill2[skill2]})`);

  return [skill1, skill2];
}

// Fetches this week's competitions from WOM — any group competition that started
// within the last 7 days. Used to detect which slots are already filled before
// deciding what to create.
async function fetchThisWeeksCompetitions() {
  const allGroupCompetitions = await wom.getGroupCompetitions();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return allGroupCompetitions.filter((c) => new Date(c.startsAt) >= sevenDaysAgo);
}

// Takes a list of this week's WOM competitions and maps each one to its slot key
// by matching the title prefix we use when creating competitions.
// Returns an object where each key holds the WOM competition object if found, or null if missing.
function mapCompetitionsToSlots(competitions) {
  const slots = {
    skillOfWeek1Id: null,
    skillOfWeek2Id: null,
    soloMidgameBossId: null,
    soloEndgameBossId: null,
    raidId: null,
    slayerBossId: null,
  };

  for (const competition of competitions) {
    if (competition.title.startsWith('Skill of the Week 1:'))      slots.skillOfWeek1Id    = competition;
    else if (competition.title.startsWith('Skill of the Week 2:')) slots.skillOfWeek2Id    = competition;
    else if (competition.title.startsWith('Solo Midgame Boss:'))   slots.soloMidgameBossId = competition;
    else if (competition.title.startsWith('Solo Endgame Boss:'))   slots.soloEndgameBossId = competition;
    else if (competition.title.startsWith('Raid:'))                slots.raidId            = competition;
    else if (competition.title.startsWith('Slayer Boss:'))         slots.slayerBossId      = competition;
  }

  return slots;
}

// Extracts the skill name from a Skill of the Week competition title.
// e.g. "Skill of the Week 1: Mining" → "Mining"
function parseSkillFromTitle(title) {
  const match = title.match(/^Skill of the Week \d+: (.+)$/);
  return match ? match[1].trim() : null;
}

// Builds the start and end Date objects for the current competition week.
// Start: the Monday this function runs at 3:00am Central.
// End: the following Monday at 2:59am Central (one minute before the next cycle starts).
// We rely on node-cron running in America/Chicago, so "now" is already the correct local time.
function buildWeekDateRange() {
  const now = new Date();

  // Start 3 minutes from now rather than exactly now. Without this buffer, the first
  // couple of competitions create fine, but by the time the later API calls fire a few
  // seconds have elapsed and WOM rejects the start date as being in the past.
  const startsAt = new Date(now.getTime() + 3 * 60 * 1000);

  // End is exactly 7 days after start, minus 1 minute, so the next Monday's cycle
  // can begin right at the 7-day mark without overlap.
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + 7);
  endsAt.setMinutes(endsAt.getMinutes() - 1);

  return { startsAt, endsAt };
}

// Creates any missing competitions for the current week and posts the announcement embed.
// On each run it first asks WOM what already exists, then only creates the gaps.
// This means running it twice is safe — the second run fills in any failures from the first.
// If dryRun is true, skips all API calls and Discord posts and just logs what would happen.
async function runWeekStart(discordClient, dryRun = false) {
  console.log(`[scheduler] runWeekStart called. dryRun=${dryRun}`);

  const pendingConfig = storage.readPending();

  // Make sure staff ran /setweek before Monday — if not, log the error and stop.
  if (
    !pendingConfig ||
    !pendingConfig.soloMidgameBoss ||
    !pendingConfig.soloEndgameBoss ||
    !pendingConfig.raid ||
    !pendingConfig.slayerBoss
  ) {
    console.error('[scheduler] Cannot start week — pending.json is missing required fields. Did staff run /setweek?');
    return;
  }

  // Step 1: Ask WOM what competitions already exist for this week so we know what to skip.
  let existingBySlot = {
    skillOfWeek1Id: null, skillOfWeek2Id: null,
    soloMidgameBossId: null, soloEndgameBossId: null,
    raidId: null, slayerBossId: null,
  };

  if (!dryRun) {
    const thisWeeksCompetitions = await fetchThisWeeksCompetitions();
    existingBySlot = mapCompetitionsToSlots(thisWeeksCompetitions);
    const existingCount = Object.values(existingBySlot).filter(Boolean).length;
    if (existingCount > 0) {
      console.log(`[scheduler] Found ${existingCount}/6 existing competition(s) on WOM — will skip those and create the rest.`);
    }
  }

  // Step 2: Determine which skills to use.
  // Priority order for each skill slot:
  //   1. Already exists on WOM (partial re-run) — use it, don't touch history
  //   2. Staff specified it via /setweek — use it
  //   3. Neither — randomize it (with repeat avoidance)
  // Track which skills are being created this run so we only add those to history.
  // Skills found on WOM were already recorded in a previous run.
  let skill1 = null;
  let skill2 = null;

  if (existingBySlot.skillOfWeek1Id) {
    skill1 = parseSkillFromTitle(existingBySlot.skillOfWeek1Id.title);
  } else if (pendingConfig.skill1) {
    skill1 = pendingConfig.skill1;
  }

  if (existingBySlot.skillOfWeek2Id) {
    skill2 = parseSkillFromTitle(existingBySlot.skillOfWeek2Id.title);
  } else if (pendingConfig.skill2) {
    skill2 = pendingConfig.skill2;
  }

  // Randomize any slots still null, passing the already-determined skill as an exclusion
  // so we never end up with the same skill in both slots.
  const alreadyDetermined = [skill1, skill2].filter(Boolean);
  if (!skill1 && !skill2) {
    [skill1, skill2] = pickSkillsOfTheWeek([]);
  } else if (!skill1) {
    [skill1] = pickSkillsOfTheWeek(alreadyDetermined);
  } else if (!skill2) {
    [skill2] = pickSkillsOfTheWeek(alreadyDetermined);
  }

  const skill1Source = existingBySlot.skillOfWeek1Id ? 'existing on WOM' : pendingConfig.skill1 ? 'set by staff' : 'randomized';
  const skill2Source = existingBySlot.skillOfWeek2Id ? 'existing on WOM' : pendingConfig.skill2 ? 'set by staff' : 'randomized';
  console.log(`[scheduler] Skill 1: ${skill1} (${skill1Source})`);
  console.log(`[scheduler] Skill 2: ${skill2} (${skill2Source})`);

  // Only add skills to history if they're being created this run (not already on WOM).
  // This prevents double-counting on partial re-runs.
  const newlyPickedSkills = [];
  if (!existingBySlot.skillOfWeek1Id) newlyPickedSkills.push(skill1);
  if (!existingBySlot.skillOfWeek2Id) newlyPickedSkills.push(skill2);

  // Step 3: Determine the week's date range.
  // Start time is always "now + buffer" so WOM accepts the competitions as being in
  // the future — even on a partial re-run where existing competitions have a start
  // time that's already in the past.
  // End time is borrowed from an existing competition if one exists, so all competitions
  // in the week close at the same moment. If nothing exists yet, build the full range fresh.
  const anyExistingCompetition = Object.values(existingBySlot).find(Boolean);
  const { startsAt } = buildWeekDateRange();
  const endsAt = anyExistingCompetition
    ? new Date(anyExistingCompetition.endsAt)
    : (() => { const e = new Date(startsAt); e.setDate(e.getDate() + 7); e.setMinutes(e.getMinutes() - 1); return e; })();

  if (anyExistingCompetition) {
    console.log(`[scheduler] Partial re-run — fresh start: ${startsAt.toISOString()}, keeping original end: ${endsAt.toISOString()}`);
  } else {
    console.log(`[scheduler] Week: ${startsAt.toISOString()} → ${endsAt.toISOString()}`);
  }

  // Step 4: Define all six competition slots.
  // WOM enforces a 50-character limit on titles, so we keep them short:
  // no "Duke Clan" prefix (the group is already attached to the competition in WOM)
  // and no date suffix (WOM stores start/end dates separately).
  // "Raid of the Week" is shortened to "Raid" to fit long raid names like
  // "Chambers of Xeric: Challenge Mode" (33 chars on its own).
  const competitionDefinitions = [
    { key: 'skillOfWeek1Id',    title: `Skill of the Week 1: ${skill1}`,                     metric: wom.skillNameToMetricKey(skill1) },
    { key: 'skillOfWeek2Id',    title: `Skill of the Week 2: ${skill2}`,                     metric: wom.skillNameToMetricKey(skill2) },
    { key: 'soloMidgameBossId', title: `Solo Midgame Boss: ${pendingConfig.soloMidgameBoss}`, metric: wom.bossNameToMetricKey(pendingConfig.soloMidgameBoss) },
    { key: 'soloEndgameBossId', title: `Solo Endgame Boss: ${pendingConfig.soloEndgameBoss}`, metric: wom.bossNameToMetricKey(pendingConfig.soloEndgameBoss) },
    { key: 'raidId',            title: `Raid: ${pendingConfig.raid}`,                         metric: wom.bossNameToMetricKey(pendingConfig.raid) },
    { key: 'slayerBossId',      title: `Slayer Boss: ${pendingConfig.slayerBoss}`,             metric: wom.bossNameToMetricKey(pendingConfig.slayerBoss) },
  ];

  // Step 5: For each slot, skip if already on WOM, create if missing.
  const allCompetitionIds = {};

  if (dryRun) {
    console.log('[scheduler] DRY RUN — would create the following competitions:');
    for (const def of competitionDefinitions) {
      console.log(`  - "${def.title}" (metric: ${def.metric})`);
      allCompetitionIds[def.key] = 'DRY_RUN_ID';
    }
  } else {
    for (const def of competitionDefinitions) {
      if (existingBySlot[def.key]) {
        // Already exists on WOM — record the existing ID and move on
        allCompetitionIds[def.key] = existingBySlot[def.key].id;
        console.log(`[scheduler] Skipping "${def.title}" — already exists (ID ${existingBySlot[def.key].id})`);
      } else {
        // Missing — create it
        try {
          const createdCompetition = await wom.createCompetition(def.title, def.metric, startsAt, endsAt);
          allCompetitionIds[def.key] = createdCompetition.id;
        } catch (error) {
          console.error(`[scheduler] Failed to create competition "${def.title}":`, error.message);
          // Continue with the rest even if one fails
        }
      }
    }
  }

  // Step 6: Save the full week state (existing + newly created IDs) to weeks.json.
  // Only append newly picked skills to history — skills found on WOM were already
  // recorded during the previous (partial) run that created them.
  const weekData = {
    weekStartDate: startsAt.toISOString(),
    weekEndDate: endsAt.toISOString(),
    skillOfWeek1: skill1,
    skillOfWeek2: skill2,
    competitions: allCompetitionIds,
    config: pendingConfig,
  };

  if (!dryRun) {
    storage.writeCurrentWeek(weekData);
    if (newlyPickedSkills.length > 0) {
      storage.appendSkillHistory(newlyPickedSkills);
    }
  }

  // Post the weekly announcement to Discord
  const announcementEmbed = buildAnnouncementEmbed(weekData, pendingConfig, startsAt, endsAt);
  if (dryRun) {
    console.log('[scheduler] DRY RUN — would post announcement embed:');
    console.log(JSON.stringify(announcementEmbed, null, 2));
  } else {
    await postToDiscord(discordClient, announcementEmbed, storage.resolveChannelId('announcement'));
  }

  console.log('[scheduler] runWeekStart complete.');
}

// Pauses execution for a given number of milliseconds.
// Used to wait for WOM to finish processing an update-all request before pulling results.
function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Fetches results for all competitions from the week that just ended and posts
// a summary report to Discord. If dryRun is true, logs what would happen instead.
async function runWeekEnd(discordClient, dryRun = false) {
  console.log(`[scheduler] runWeekEnd called. dryRun=${dryRun}`);

  const weekData = storage.readCurrentWeek();

  if (!weekData || !weekData.competitions) {
    console.error('[scheduler] Cannot run end-of-week report — weeks.json is missing or empty.');
    return;
  }

  // Trigger a WOM update-all before fetching results so we're working with the
  // Trigger a WOM update-all before fetching results so we're working with the freshest
  // possible stats. updateAllGroupMembers() returns true if updates were queued (meaning
  // we need to wait for WOM to process them), or false if all members were already
  // up to date (data is fresh — no wait needed, we can fetch immediately).
  if (dryRun) {
    console.log('[scheduler] DRY RUN — would trigger WOM update-all.');
  } else {
    const updatesWereQueued = await wom.updateAllGroupMembers();
    if (updatesWereQueued) {
      console.log('[scheduler] Waiting 60 seconds for WOM to finish updating member stats...');
      await sleep(60 * 1000);
      console.log('[scheduler] Wait complete. Fetching competition results...');
    }
  }

  const competitionIds = weekData.competitions;
  const pendingConfig = weekData.config;

  // Fetch participant lists for every competition that has a real ID
  const results = {};

  if (dryRun) {
    console.log('[scheduler] DRY RUN — would fetch results for competition IDs:');
    console.log(JSON.stringify(competitionIds, null, 2));
  } else {
    // Fetch all participants for each competition so we can apply our own threshold
    for (const [competitionKey, competitionId] of Object.entries(competitionIds)) {
      if (!competitionId || competitionId === 'DRY_RUN_ID') continue;
      try {
        const participations = await wom.getCompetitionParticipants(competitionId);
        results[competitionKey] = participations;
      } catch (error) {
        console.error(`[scheduler] Failed to fetch results for ${competitionKey} (ID ${competitionId}):`, error.message);
        results[competitionKey] = [];
      }
    }
  }

  // Scan all fetched participation lists for players whose WOM data is more than 2 hours old.
  // If any are found, we'll include a warning in the report so staff know those results
  // may not reflect what the player actually achieved by the end of the week.
  const allParticipations = Object.values(results).flat();
  const outdatedPlayers = findOutdatedPlayers(allParticipations);

  if (outdatedPlayers.length > 0) {
    console.warn(`[scheduler] ${outdatedPlayers.length} player(s) have data older than 2 hours:`, outdatedPlayers.map((p) => p.name).join(', '));
  }

  // Find players who completed BOTH Skill of the Week competitions (crossed the XP threshold in both)
  const skill1Completers = wom.filterParticipantsByThreshold(
    results['skillOfWeek1Id'] || [],
    config.skillXpThreshold
  ).map((p) => p.player.displayName);

  const skill2Completers = wom.filterParticipantsByThreshold(
    results['skillOfWeek2Id'] || [],
    config.skillXpThreshold
  ).map((p) => p.player.displayName);

  // Players who appear in both lists completed both skills
  const bothSkillsCompleters = skill1Completers.filter((playerName) =>
    skill2Completers.includes(playerName)
  );

  // Build and post the report. postReport() handles the single-vs-split decision internally.
  await postReport(discordClient, weekData, pendingConfig, results, skill1Completers, skill2Completers, bothSkillsCompleters, outdatedPlayers, dryRun);

  console.log('[scheduler] runWeekEnd complete.');
}

// Sends an embed object to a specific Discord channel.
// The channelId is passed by the caller so announcements and staff alerts can go to different channels.
async function postToDiscord(discordClient, embed, channelId) {
  try {
    const channel = await discordClient.channels.fetch(channelId);
    await channel.send({ embeds: [embed] });
    console.log(`[scheduler] Posted embed to channel ${channelId}`);
  } catch (error) {
    console.error(`[scheduler] Failed to post to Discord channel ${channelId}:`, error.message);
    throw error;
  }
}

// Builds a Discord embed object for the weekly announcement.
// Shows all six competitions with links to WOM, plus the group boss announcements,
// and a note about when this week's results report will be posted.
function buildAnnouncementEmbed(weekData, pendingConfig, startsAt, endsAt) {
  const weekLabel = formatWeekLabel(startsAt, endsAt);
  const schedule = storage.readSchedule() || config.defaultSchedule;
  const reportTimeLabel = describeReportTime(schedule);

  // Build each field of the embed
  const fields = [
    {
      name: '🎯 Skill of the Week 1',
      value: `**${weekData.skillOfWeek1}** — Gain ${config.skillXpThreshold.toLocaleString()} XP to complete\n${womCompetitionLink(weekData.competitions.skillOfWeek1Id)}`,
      inline: false,
    },
    {
      name: '🎯 Skill of the Week 2',
      value: `**${weekData.skillOfWeek2}** — Gain ${config.skillXpThreshold.toLocaleString()} XP to complete\n${womCompetitionLink(weekData.competitions.skillOfWeek2Id)}`,
      inline: false,
    },
    {
      name: '⚔️ Solo Midgame Boss',
      value: `**${pendingConfig.soloMidgameBoss}** — Reach ${pendingConfig.soloMidgameKc} KC\n${womCompetitionLink(weekData.competitions.soloMidgameBossId)}`,
      inline: false,
    },
    {
      name: '🐉 Solo Endgame Boss',
      value: `**${pendingConfig.soloEndgameBoss}** — Reach ${pendingConfig.soloEndgameKc} KC\n${womCompetitionLink(weekData.competitions.soloEndgameBossId)}`,
      inline: false,
    },
    {
      name: '🏛️ Raid of the Week',
      value: `**${pendingConfig.raid}** — Complete ${pendingConfig.raidCompletions} ${pendingConfig.raidCompletions === 1 ? 'time' : 'times'}\n${womCompetitionLink(weekData.competitions.raidId)}`,
      inline: false,
    },
    {
      name: '🗡️ Slayer Boss',
      value: `**${pendingConfig.slayerBoss}** — Reach ${pendingConfig.slayerKc} KC\n${womCompetitionLink(weekData.competitions.slayerBossId)}`,
      inline: false,
    },
    {
      name: '👥 Group Midgame Boss (manually enforced)',
      value: `**${pendingConfig.groupMidgameBoss}** — ${pendingConfig.groupMidgameKc} KC as a group`,
      inline: false,
    },
    {
      name: '👥 Group Endgame Boss (manually enforced)',
      value: `**${pendingConfig.groupEndgameBoss}** — ${pendingConfig.groupEndgameKc} KC as a group`,
      inline: false,
    },
  ];

  return {
    title: `Duke Clan Weekly Competitions — ${weekLabel}`,
    description: `Good luck everyone! Results from last week will be posted **${reportTimeLabel}**.`,
    color: 0x2ecc71, // Green
    fields: fields,
    footer: { text: 'Competitions tracked via Wise Old Man' },
    timestamp: new Date().toISOString(),
  };
}

// Scans a flat list of participation objects and returns any players whose WOM data
// is more than 2 hours old. Each entry in the returned array is { name, updatedAt }.
// We use 2 hours as the threshold because we trigger an update-all ~60 seconds before
// the report runs — if a player's data is still hours old, WOM didn't update them in time.
function findOutdatedPlayers(participations) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const seenNames = new Set();
  const outdated = [];

  for (const participation of participations) {
    const playerName = participation.player && participation.player.displayName;
    const updatedAt = participation.player && participation.player.updatedAt
      ? new Date(participation.player.updatedAt)
      : null;

    // Skip if we've already checked this player (they appear in multiple competitions)
    if (!playerName || seenNames.has(playerName)) continue;
    seenNames.add(playerName);

    if (!updatedAt || updatedAt < twoHoursAgo) {
      outdated.push({ name: playerName, updatedAt: updatedAt ? updatedAt.toISOString() : 'never' });
    }
  }

  return outdated;
}

// Formats a list of player names into a single string that fits within Discord's
// 1024-character field value limit. If the full list would be too long, it shows
// as many names as fit and appends "...and X more" so nothing is silently dropped.
// The limit is set to 950 to leave headroom for the surrounding label text in the field.
function formatPlayerList(playerNames) {
  const FIELD_LIMIT = 950;
  let result = '';

  for (let i = 0; i < playerNames.length; i++) {
    const separator = i === 0 ? '' : ', ';
    const remaining = playerNames.length - i;
    const suffix = remaining > 0 ? `, ...and ${remaining} more` : '';

    // Check if adding this name would push the string over the limit
    const candidate = result + separator + playerNames[i];
    if (candidate.length + suffix.length > FIELD_LIMIT && result.length > 0) {
      result += `, ...and ${remaining} more`;
      break;
    }

    result = candidate;
  }

  return result || 'Nobody';
}

// Counts the total characters in a Discord embed object.
// Discord rejects embeds that exceed 6000 characters across all text fields combined.
function countEmbedChars(embed) {
  let total = 0;
  if (embed.title) total += embed.title.length;
  if (embed.description) total += embed.description.length;
  if (embed.footer && embed.footer.text) total += embed.footer.text.length;
  for (const field of (embed.fields || [])) {
    total += (field.name || '').length + (field.value || '').length;
  }
  return total;
}

// Builds the report content as an array of named sections, each containing one or more
// Discord embed fields. Keeping sections separate lets postReport() decide whether to
// combine them into one embed or send them as individual messages.
// The skills section always groups all three skill fields together (per the spec).
function buildReportSections(weekData, pendingConfig, results, skill1Completers, skill2Completers, bothSkillsCompleters, outdatedPlayers) {
  const sections = [];

  // Skills section — only shows players who completed both skills, not individual skill lists
  const sotwFields = [
    {
      name: `⭐ Skills of the Week: ${weekData.skillOfWeek1} & ${weekData.skillOfWeek2}`,
      value: bothSkillsCompleters.length > 0
        ? `**Completed both (${config.skillXpThreshold.toLocaleString()}+ XP each):**\n${formatPlayerList(bothSkillsCompleters)}`
        : 'Nobody completed both skills this week.',
      inline: false,
    },
  ];
  sections.push({ label: 'Skills of the Week', fields: sotwFields });

  // Solo Midgame Boss
  const soloMidgameCompleters = wom.filterParticipantsByThreshold(
    results['soloMidgameBossId'] || [], pendingConfig.soloMidgameKc
  ).map((p) => p.player.displayName);
  sections.push({
    label: `Solo Midgame Boss: ${pendingConfig.soloMidgameBoss}`,
    fields: [{
      name: `⚔️ Solo Midgame Boss: ${pendingConfig.soloMidgameBoss}`,
      value: soloMidgameCompleters.length > 0
        ? `**Reached ${pendingConfig.soloMidgameKc} KC:**\n${formatPlayerList(soloMidgameCompleters)}`
        : `Nobody reached ${pendingConfig.soloMidgameKc} KC.`,
      inline: false,
    }],
  });

  // Solo Endgame Boss
  const soloEndgameCompleters = wom.filterParticipantsByThreshold(
    results['soloEndgameBossId'] || [], pendingConfig.soloEndgameKc
  ).map((p) => p.player.displayName);
  sections.push({
    label: `Solo Endgame Boss: ${pendingConfig.soloEndgameBoss}`,
    fields: [{
      name: `🐉 Solo Endgame Boss: ${pendingConfig.soloEndgameBoss}`,
      value: soloEndgameCompleters.length > 0
        ? `**Reached ${pendingConfig.soloEndgameKc} KC:**\n${formatPlayerList(soloEndgameCompleters)}`
        : `Nobody reached ${pendingConfig.soloEndgameKc} KC.`,
      inline: false,
    }],
  });

  // Raid
  const raidCompleters = wom.filterParticipantsByThreshold(
    results['raidId'] || [], pendingConfig.raidCompletions
  ).map((p) => p.player.displayName);
  sections.push({
    label: `Raid: ${pendingConfig.raid}`,
    fields: [{
      name: `🏛️ Raid of the Week: ${pendingConfig.raid}`,
      value: raidCompleters.length > 0
        ? `**Reached ${pendingConfig.raidCompletions} ${pendingConfig.raidCompletions === 1 ? 'completion' : 'completions'}:**\n${formatPlayerList(raidCompleters)}`
        : `Nobody reached ${pendingConfig.raidCompletions} ${pendingConfig.raidCompletions === 1 ? 'completion' : 'completions'}.`,
      inline: false,
    }],
  });

  // Slayer Boss
  const slayerCompleters = wom.filterParticipantsByThreshold(
    results['slayerBossId'] || [], pendingConfig.slayerKc
  ).map((p) => p.player.displayName);
  sections.push({
    label: `Slayer Boss: ${pendingConfig.slayerBoss}`,
    fields: [{
      name: `🗡️ Slayer Boss: ${pendingConfig.slayerBoss}`,
      value: slayerCompleters.length > 0
        ? `**Reached ${pendingConfig.slayerKc} KC:**\n${formatPlayerList(slayerCompleters)}`
        : `Nobody reached ${pendingConfig.slayerKc} KC.`,
      inline: false,
    }],
  });

  // Group bosses (always short — fixed text, no player lists)
  sections.push({
    label: 'Group Bosses',
    fields: [{
      name: '👥 Group Bosses (manually tracked)',
      value: `Group Midgame: **${pendingConfig.groupMidgameBoss}** (${pendingConfig.groupMidgameKc} KC goal)\nGroup Endgame: **${pendingConfig.groupEndgameBoss}** (${pendingConfig.groupEndgameKc} KC goal)`,
      inline: false,
    }],
  });

  // Outdated data warning (only added if relevant)
  if (outdatedPlayers.length > 0) {
    sections.push({
      label: 'Outdated Data Warning',
      fields: [{
        name: '⚠️ Potentially outdated data',
        value: `The following players were not updated by WOM in time for this report. Their results may be incomplete:\n${formatPlayerList(outdatedPlayers.map((p) => p.name))}`,
        inline: false,
      }],
    });
  }

  return sections;
}

// Builds and posts the end-of-week report. Tries to send everything as a single embed.
// If the total character count would exceed Discord's 6000-character embed limit,
// it falls back to posting a header message followed by one embed per section instead.
async function postReport(discordClient, weekData, pendingConfig, results, skill1Completers, skill2Completers, bothSkillsCompleters, outdatedPlayers, dryRun) {
  const weekLabel = formatWeekLabel(
    new Date(weekData.weekStartDate),
    new Date(weekData.weekEndDate)
  );

  const title = dryRun
    ? `[DRY RUN] Duke Clan Weekly Results — ${weekLabel}`
    : `Duke Clan Weekly Results — ${weekLabel}`;

  const description = 'Here are the results for this week\'s competitions. Great work everyone!';
  const color = 0xe67e22; // Orange
  const footer = { text: 'Results pulled from Wise Old Man' };
  const timestamp = new Date().toISOString();

  const sections = buildReportSections(weekData, pendingConfig, results, skill1Completers, skill2Completers, bothSkillsCompleters, outdatedPlayers);
  const allFields = sections.flatMap((section) => section.fields);

  // Try fitting everything into one embed first
  const singleEmbed = { title, description, color, fields: allFields, footer, timestamp };

  if (countEmbedChars(singleEmbed) <= 6000) {
    // All sections fit — post as one message
    if (dryRun) {
      console.log('[scheduler] DRY RUN — report fits in a single embed, would post:');
      console.log(JSON.stringify(singleEmbed, null, 2));
    } else {
      console.log('[scheduler] Posting report as a single embed.');
      await postToDiscord(discordClient, singleEmbed, storage.resolveChannelId('announcement'));
    }
    return;
  }

  // Too large for one embed — post a header message, then one embed per section
  console.log(`[scheduler] Report exceeds 6000 chars — splitting into ${sections.length + 1} messages.`);

  const headerEmbed = { title, description, color, timestamp };

  if (dryRun) {
    console.log('[scheduler] DRY RUN — report too large, would post as split messages:');
    console.log('  Header:', JSON.stringify(headerEmbed));
    for (const section of sections) {
      console.log(`  Section "${section.label}":`, JSON.stringify(section.fields));
    }
    return;
  }

  const announcementChannelId = storage.resolveChannelId('announcement');
  await postToDiscord(discordClient, headerEmbed, announcementChannelId);

  for (const section of sections) {
    const sectionEmbed = { color, fields: section.fields, footer, timestamp };
    await postToDiscord(discordClient, sectionEmbed, announcementChannelId);
  }
}

// Formats a week range like "May 19 – May 26, 2025" for use in embed titles and fields.
function formatWeekLabel(startsAt, endsAt) {
  const options = { month: 'short', day: 'numeric' };
  const startLabel = startsAt.toLocaleDateString('en-US', options);
  const endLabel = endsAt.toLocaleDateString('en-US', { ...options, year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

// Returns a clickable WOM competition link, or "(not created)" if the ID is missing.
function womCompetitionLink(competitionId) {
  if (!competitionId || competitionId === 'DRY_RUN_ID') {
    return '_(not created)_';
  }
  return `https://wiseoldman.net/competitions/${competitionId}`;
}

// Checks whether /setweek has been run during the current competition week.
// We do this by looking at the "setAt" timestamp in pending.json.
// The current competition week started on the most recent Monday, so if setAt
// is within the past 7 days we consider it fresh. Anything older means staff
// hasn't set up the upcoming week yet.
function pendingWasSetThisWeek(pendingData) {
  if (!pendingData || !pendingData.setAt) {
    return false;
  }
  const setAt = new Date(pendingData.setAt);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return setAt > sevenDaysAgo;
}

// Checks whether /setweek has been run this week. If not, posts a reminder to
// the Discord channel that pings everyone with the Staff role.
// Called automatically on Sunday at noon Central.
async function runSetweekReminder(discordClient) {
  console.log('[scheduler] runSetweekReminder: checking if /setweek has been run this week...');

  const pendingData = storage.readPending();

  if (pendingWasSetThisWeek(pendingData)) {
    console.log('[scheduler] /setweek already set this week — no reminder needed.');
    return;
  }

  console.log('[scheduler] /setweek has NOT been set this week — posting reminder.');

  const channelId = storage.resolveChannelId('staff');

  try {
    const channel = await discordClient.channels.fetch(channelId);

    // Fetch the guild's roles so the cache is populated, then find the Staff role by name
    await channel.guild.roles.fetch();
    const staffRole = channel.guild.roles.cache.find(
      (role) => role.name === config.staffRoleName
    );

    // If we found the role, mention it with <@&ID> so Discord sends a real ping.
    // If something went wrong finding it, fall back to bolded text so the message still makes sense.
    const mention = staffRole ? `<@&${staffRole.id}>` : `**@${config.staffRoleName}**`;

    const schedule = storage.readSchedule() || config.defaultSchedule;
    const startLabel = describeSchedule(schedule);
    await channel.send(
      `${mention} ⚠️ Reminder: **/setweek has not been run** for the upcoming week yet!\n` +
      `Competitions go live **${startLabel}**. Please run \`/setweek\` before then.`
    );

    console.log('[scheduler] Reminder posted to Discord.');
  } catch (error) {
    console.error('[scheduler] Failed to post /setweek reminder:', error.message);
  }
}

// Derives the three cron expressions from a schedule config object.
// All timing logic lives here so changing the schedule only requires updating one place.
//
// Report timing derivation:
//   Competition ends at (startHour:startMinute - 1 minute) one week later.
//   Report fires 24 hours after that = same time of day, 1 calendar day after start day.
//   If startMinute is 0, the end time rolls back to 23:59 the previous day, and so does the report.
function buildCronExpressions(schedule) {
  const { startDay, startHour, startMinute } = schedule;

  const startCron = `${startMinute} ${startHour} * * ${startDay}`;

  // Compute end-of-competition time in minutes from midnight, then add 24 hours for the report
  const endMinutesFromMidnight = startHour * 60 + startMinute - 1;
  let reportMinutesFromMidnight = endMinutesFromMidnight;
  let reportDayOffset = 1;

  if (reportMinutesFromMidnight < 0) {
    // startMinute was 0, so end time rolls back to 23:59 the previous day
    reportMinutesFromMidnight += 24 * 60;
    reportDayOffset = 0; // end was 1 day earlier, so +24h lands us back on start day
  }

  const reportDay = (startDay + reportDayOffset) % 7;
  const reportHour = Math.floor(reportMinutesFromMidnight / 60);
  const reportMinute = reportMinutesFromMidnight % 60;
  const reportCron = `${reportMinute} ${reportHour} * * ${reportDay}`;

  // Reminder fires at noon the day before competitions start
  const reminderDay = (startDay - 1 + 7) % 7;
  const reminderCron = `0 12 * * ${reminderDay}`;

  return { startCron, reportCron, reminderCron };
}

// Returns a human-readable description of a schedule, e.g. "Mondays at 3:00am Central".
// Used in log messages and the reminder ping so staff always see the correct time.
function describeSchedule(schedule) {
  const dayNames = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  const day = dayNames[schedule.startDay] || 'Unknown';
  const hour12 = schedule.startHour % 12 || 12;
  const amPm = schedule.startHour < 12 ? 'am' : 'pm';
  const minute = String(schedule.startMinute).padStart(2, '0');
  return `${day} at ${hour12}:${minute}${amPm} Central`;
}

// Returns a human-readable description of when the end-of-week report will fire,
// e.g. "Tuesday at 2:59am Central". Derived from the schedule the same way buildCronExpressions does.
function describeReportTime(schedule) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const { startDay, startHour, startMinute } = schedule;

  const endMinutesFromMidnight = startHour * 60 + startMinute - 1;
  let reportMinutesFromMidnight = endMinutesFromMidnight;
  let reportDayOffset = 1;

  if (reportMinutesFromMidnight < 0) {
    reportMinutesFromMidnight += 24 * 60;
    reportDayOffset = 0;
  }

  const reportDay = (startDay + reportDayOffset) % 7;
  const reportHour = Math.floor(reportMinutesFromMidnight / 60);
  const reportMinute = reportMinutesFromMidnight % 60;

  const hour12 = reportHour % 12 || 12;
  const amPm = reportHour < 12 ? 'am' : 'pm';
  const minuteStr = String(reportMinute).padStart(2, '0');

  return `${dayNames[reportDay]} at ${hour12}:${minuteStr}${amPm} Central`;
}

// Holds references to the currently active cron tasks so they can be stopped when
// the schedule changes. node-cron tasks expose a .stop() method for this purpose.
let activeCronTasks = [];

// Stops all currently running cron tasks.
// Called before starting new ones whenever the schedule is changed via /setschedule.
function stopAllCronTasks() {
  for (const task of activeCronTasks) {
    task.stop();
  }
  activeCronTasks = [];
}

// Reads the saved schedule (or falls back to the default from config.js), builds the
// cron expressions, and registers all three jobs. If jobs were already running from a
// previous call, they are stopped first — so calling this again after /setschedule
// cleanly replaces the old schedule without restarting the bot.
function startScheduler(discordClient) {
  stopAllCronTasks();

  const schedule = storage.readSchedule() || config.defaultSchedule;
  const { startCron, reportCron, reminderCron } = buildCronExpressions(schedule);
  const scheduleLabel = describeSchedule(schedule);

  console.log(`[scheduler] Starting cron jobs. Competitions: ${scheduleLabel}`);
  console.log(`[scheduler]   Start cron:    ${startCron}`);
  console.log(`[scheduler]   Report cron:   ${reportCron}`);
  console.log(`[scheduler]   Reminder cron: ${reminderCron}`);

  const reminderTask = cron.schedule(reminderCron, async () => {
    console.log('[scheduler] Cron triggered: /setweek reminder check');
    try {
      await runSetweekReminder(discordClient);
    } catch (error) {
      console.error('[scheduler] Unhandled error in runSetweekReminder:', error);
    }
  }, { timezone: config.timezone });

  const reportTask = cron.schedule(reportCron, async () => {
    console.log('[scheduler] Cron triggered: end-of-week report');
    try {
      await runWeekEnd(discordClient, false);
    } catch (error) {
      console.error('[scheduler] Unhandled error in runWeekEnd:', error);
    }
  }, { timezone: config.timezone });

  const startTask = cron.schedule(startCron, async () => {
    console.log('[scheduler] Cron triggered: week start');
    try {
      await runWeekStart(discordClient, false);
    } catch (error) {
      console.error('[scheduler] Unhandled error in runWeekStart:', error);
    }
  }, { timezone: config.timezone });

  activeCronTasks = [reminderTask, reportTask, startTask];
  console.log('[scheduler] Cron jobs registered. Waiting for next scheduled event...');
}

module.exports = {
  startScheduler,
  buildCronExpressions,
  describeSchedule,
  runWeekStart,
  runWeekEnd,
};
