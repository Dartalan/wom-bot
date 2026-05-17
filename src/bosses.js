// bosses.js
// Defines the lists of OSRS bosses and raids used to power the autocomplete dropdowns
// in the /setweek command. Also provides the function that converts a boss display name
// into the exact metric key that the Wise Old Man API expects.
//
// Bosses are split into MIDGAME and ENDGAME based on the OSRS Bossing Ladder guide:
//   https://oldschool.runescape.wiki/w/Guide:Bossing_Ladder
// Midgame = Easy / Medium / Hard tier. Endgame = Elite tier and above.
//
// groupEligible: true  — multiple players can fight the same boss together
// groupEligible: false — solo only (instanced per player, or mechanically solo)
// wilderness:    true  — boss is located in the Wilderness (PvP risk applies)
// wilderness:    false — boss is in a safe, non-wilderness area
//
// How autocomplete works: Discord shows the "name" to the user in the dropdown.
// When they pick one, the "value" is what gets sent to the bot and stored in pending.json.
// Here, name and value are the same (the human-readable display name like "Kalphite Queen")
// so pending.json stays easy to read. The getMetricKey() function then converts it
// to the WOM format (like "kalphite_queen") at competition-creation time.

// Easy / Medium / Hard tier bosses — shown for solo_midgame_boss.
// Group-filtered version is used for group_midgame_boss.
const MIDGAME_BOSSES = [
  { name: 'Abyssal Sire',              value: 'Abyssal Sire',              groupEligible: false, wilderness: false }, // Hard
  { name: 'Alchemical Hydra',          value: 'Alchemical Hydra',          groupEligible: false, wilderness: false }, // Hard
  { name: 'Amoxliatl',                 value: 'Amoxliatl',                 groupEligible: false, wilderness: false }, // Medium
  { name: 'Araxxor',                   value: 'Araxxor',                   groupEligible: false, wilderness: false }, // Hard
  { name: 'Artio',                     value: 'Artio',                     groupEligible: true,  wilderness: true  }, // Hard
  { name: 'Barrows Chests',            value: 'Barrows Chests',            groupEligible: true,  wilderness: false }, // Easy
  { name: 'Bryophyta',                 value: 'Bryophyta',                 groupEligible: false, wilderness: false }, // Easy
  { name: "Cal'varion",                value: "Cal'varion",                groupEligible: true,  wilderness: true  }, // Hard
  { name: 'Callisto',                  value: 'Callisto',                  groupEligible: true,  wilderness: true  }, // Hard
  { name: 'Cerberus',                  value: 'Cerberus',                  groupEligible: false, wilderness: false }, // Hard
  { name: 'Chaos Elemental',           value: 'Chaos Elemental',           groupEligible: true,  wilderness: true  }, // Hard
  { name: 'Chaos Fanatic',             value: 'Chaos Fanatic',             groupEligible: true,  wilderness: true  }, // Medium
  { name: 'Commander Zilyana',         value: 'Commander Zilyana',         groupEligible: true,  wilderness: false }, // Hard
  { name: 'Corporeal Beast',           value: 'Corporeal Beast',           groupEligible: true,  wilderness: false }, // Medium
  { name: 'Crazy Archaeologist',       value: 'Crazy Archaeologist',       groupEligible: true,  wilderness: true  }, // Medium
  { name: 'Dagannoth Prime',           value: 'Dagannoth Prime',           groupEligible: true,  wilderness: false }, // Hard
  { name: 'Dagannoth Rex',             value: 'Dagannoth Rex',             groupEligible: true,  wilderness: false }, // Hard
  { name: 'Dagannoth Supreme',         value: 'Dagannoth Supreme',         groupEligible: true,  wilderness: false }, // Hard
  { name: 'Deranged Archaeologist',    value: 'Deranged Archaeologist',    groupEligible: true,  wilderness: false }, // Easy
  { name: 'The Gauntlet',              value: 'The Gauntlet',              groupEligible: false, wilderness: false }, // Hard
  { name: 'Giant Mole',                value: 'Giant Mole',                groupEligible: true,  wilderness: false }, // Easy
  { name: 'Grotesque Guardians',       value: 'Grotesque Guardians',       groupEligible: false, wilderness: false }, // Hard
  { name: 'Hespori',                   value: 'Hespori',                   groupEligible: false, wilderness: false }, // Medium
  { name: 'Hueycoatl',                 value: 'Hueycoatl',                 groupEligible: true,  wilderness: false }, // Medium
  { name: 'Kalphite Queen',            value: 'Kalphite Queen',            groupEligible: true,  wilderness: false }, // Hard
  { name: 'King Black Dragon',         value: 'King Black Dragon',         groupEligible: true,  wilderness: true  }, // Medium
  { name: 'Kraken',                    value: 'Kraken',                    groupEligible: false, wilderness: false }, // Medium
  { name: "K'ril Tsutsaroth",          value: "K'ril Tsutsaroth",          groupEligible: true,  wilderness: false }, // Hard
  { name: 'Mimic',                     value: 'Mimic',                     groupEligible: false, wilderness: false }, // Medium
  { name: 'Obor',                      value: 'Obor',                      groupEligible: false, wilderness: false }, // Easy
  { name: 'Sarachnis',                 value: 'Sarachnis',                 groupEligible: true,  wilderness: false }, // Medium
  { name: 'Scorpia',                   value: 'Scorpia',                   groupEligible: true,  wilderness: true  }, // Hard
  { name: 'Scurrius',                  value: 'Scurrius',                  groupEligible: true,  wilderness: false }, // Easy
  { name: 'Skotizo',                   value: 'Skotizo',                   groupEligible: false, wilderness: false }, // Hard
  { name: 'Spindel',                   value: 'Spindel',                   groupEligible: true,  wilderness: true  }, // Hard
  { name: 'Tempoross',                 value: 'Tempoross',                 groupEligible: true,  wilderness: false }, // Easy
  { name: 'Thermonuclear Smoke Devil', value: 'Thermonuclear Smoke Devil', groupEligible: false, wilderness: false }, // Medium
  { name: 'TzTok-Jad',                 value: 'TzTok-Jad',                 groupEligible: false, wilderness: false }, // Hard
  { name: 'Venenatis',                 value: 'Venenatis',                 groupEligible: true,  wilderness: true  }, // Hard
  { name: "Vet'ion",                   value: "Vet'ion",                   groupEligible: true,  wilderness: true  }, // Hard
  { name: 'Wintertodt',                value: 'Wintertodt',                groupEligible: true,  wilderness: false }, // Easy
  { name: 'Zalcano',                   value: 'Zalcano',                   groupEligible: true,  wilderness: false }, // Medium
];

// Elite tier and above — shown for solo_endgame_boss.
// Group-filtered version is used for group_endgame_boss.
// None of the endgame bosses are in the Wilderness.
const ENDGAME_BOSSES = [
  { name: 'The Corrupted Gauntlet',    value: 'The Corrupted Gauntlet',    groupEligible: false, wilderness: false }, // Elite
  { name: 'Duke Sucellus',             value: 'Duke Sucellus',             groupEligible: false, wilderness: false }, // Elite
  { name: 'General Graardor',          value: 'General Graardor',          groupEligible: true,  wilderness: false }, // Elite
  { name: "Kree'Arra",                 value: "Kree'Arra",                 groupEligible: true,  wilderness: false }, // Elite
  { name: 'The Leviathan',             value: 'The Leviathan',             groupEligible: false, wilderness: false }, // Elite
  { name: 'Nex',                       value: 'Nex',                       groupEligible: true,  wilderness: false }, // Elite
  { name: 'The Nightmare',             value: 'The Nightmare',             groupEligible: true,  wilderness: false }, // Master
  { name: 'Phantom Muspah',            value: 'Phantom Muspah',            groupEligible: false, wilderness: false }, // Elite
  { name: "Phosani's Nightmare",       value: "Phosani's Nightmare",       groupEligible: false, wilderness: false }, // Master
  { name: 'Sol Heredit',               value: 'Sol Heredit',               groupEligible: false, wilderness: false }, // Master
  { name: 'TzKal-Zuk',                 value: 'TzKal-Zuk',                 groupEligible: false, wilderness: false }, // Master
  { name: 'Vardorvis',                 value: 'Vardorvis',                 groupEligible: false, wilderness: false }, // Elite
  { name: 'Vorkath',                   value: 'Vorkath',                   groupEligible: false, wilderness: false }, // Elite
  { name: 'The Whisperer',             value: 'The Whisperer',             groupEligible: false, wilderness: false }, // Elite
  { name: 'Zulrah',                    value: 'Zulrah',                    groupEligible: false, wilderness: false }, // Elite
];

// All bosses combined — used for /setbossrate autocomplete so staff can search any boss.
const ALL_BOSSES = [...MIDGAME_BOSSES, ...ENDGAME_BOSSES];

// Midgame bosses that can be done as a group — used for group_midgame_boss autocomplete.
const GROUP_MIDGAME_BOSSES = MIDGAME_BOSSES.filter((b) => b.groupEligible);

// Endgame bosses that can be done as a group — used for group_endgame_boss autocomplete.
const GROUP_ENDGAME_BOSSES = ENDGAME_BOSSES.filter((b) => b.groupEligible);

// Bosses commonly assigned by Slayer masters — used for the slayer_boss autocomplete field.
const SLAYER_BOSSES = [
  { name: 'Abyssal Sire',              value: 'Abyssal Sire',              groupEligible: false, wilderness: false },
  { name: 'Alchemical Hydra',          value: 'Alchemical Hydra',          groupEligible: false, wilderness: false },
  { name: 'Cerberus',                  value: 'Cerberus',                  groupEligible: false, wilderness: false },
  { name: 'Dagannoth Prime',           value: 'Dagannoth Prime',           groupEligible: true,  wilderness: false },
  { name: 'Dagannoth Rex',             value: 'Dagannoth Rex',             groupEligible: true,  wilderness: false },
  { name: 'Dagannoth Supreme',         value: 'Dagannoth Supreme',         groupEligible: true,  wilderness: false },
  { name: 'Grotesque Guardians',       value: 'Grotesque Guardians',       groupEligible: false, wilderness: false },
  { name: 'Kalphite Queen',            value: 'Kalphite Queen',            groupEligible: true,  wilderness: false },
  { name: 'Kraken',                    value: 'Kraken',                    groupEligible: false, wilderness: false },
  { name: 'Sarachnis',                 value: 'Sarachnis',                 groupEligible: true,  wilderness: false },
  { name: 'Scurrius',                  value: 'Scurrius',                  groupEligible: true,  wilderness: false },
  { name: 'Skotizo',                   value: 'Skotizo',                   groupEligible: false, wilderness: false },
  { name: 'Thermonuclear Smoke Devil', value: 'Thermonuclear Smoke Devil', groupEligible: false, wilderness: false },
  { name: 'Vorkath',                   value: 'Vorkath',                   groupEligible: false, wilderness: false },
  { name: 'Zulrah',                    value: 'Zulrah',                    groupEligible: false, wilderness: false },
];

// Raids only — used for the raid autocomplete field.
// All raids are endgame (Elite tier or above), all group eligible, none in the Wilderness.
const RAIDS = [
  { name: 'Chambers of Xeric',                 value: 'Chambers of Xeric',                 groupEligible: true, wilderness: false }, // Master
  { name: 'Chambers of Xeric: Challenge Mode', value: 'Chambers of Xeric: Challenge Mode', groupEligible: true, wilderness: false }, // Grandmaster
  { name: 'Theatre of Blood',                  value: 'Theatre of Blood',                  groupEligible: true, wilderness: false }, // Master
  { name: 'Theatre of Blood: Hard Mode',       value: 'Theatre of Blood: Hard Mode',       groupEligible: true, wilderness: false }, // Grandmaster
  { name: 'Tombs of Amascut',                  value: 'Tombs of Amascut',                  groupEligible: true, wilderness: false }, // Elite
  { name: 'Tombs of Amascut: Expert Mode',     value: 'Tombs of Amascut: Expert Mode',     groupEligible: true, wilderness: false }, // Grandmaster
];

// Converts a boss display name (like "Kree'Arra") into the WOM API metric key (like "kreearra").
// WOM expects all-lowercase with underscores and no special characters.
function getMetricKey(displayName) {
  return displayName
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/-/g, ' ')
    .replace(/:/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/ +/g, '_');
}

module.exports = {
  MIDGAME_BOSSES,
  ENDGAME_BOSSES,
  GROUP_MIDGAME_BOSSES,
  GROUP_ENDGAME_BOSSES,
  ALL_BOSSES,
  SLAYER_BOSSES,
  RAIDS,
  getMetricKey,
};
