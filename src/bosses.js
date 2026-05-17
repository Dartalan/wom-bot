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
//
// How autocomplete works: Discord shows the "name" to the user in the dropdown.
// When they pick one, the "value" is what gets sent to the bot and stored in pending.json.
// Here, name and value are the same (the human-readable display name like "Kalphite Queen")
// so pending.json stays easy to read. The getMetricKey() function then converts it
// to the WOM format (like "kalphite_queen") at competition-creation time.

// Easy / Medium / Hard tier bosses — shown for solo_midgame_boss.
// Group-filtered version is used for group_midgame_boss.
const MIDGAME_BOSSES = [
  { name: 'Abyssal Sire',              value: 'Abyssal Sire',              groupEligible: false }, // Hard     — solo-only (wiki confirmed)
  { name: 'Alchemical Hydra',          value: 'Alchemical Hydra',          groupEligible: false }, // Hard     — solo instance
  { name: 'Amoxliatl',                 value: 'Amoxliatl',                 groupEligible: false }, // Medium   — solo instance
  { name: 'Araxxor',                   value: 'Araxxor',                   groupEligible: false }, // Hard     — solo-only (wiki confirmed)
  { name: 'Artio',                     value: 'Artio',                     groupEligible: true  }, // Hard     — wilderness multi-combat
  { name: 'Barrows Chests',            value: 'Barrows Chests',            groupEligible: true  }, // Easy     — multi-combat, group runs common
  { name: 'Bryophyta',                 value: 'Bryophyta',                 groupEligible: false }, // Easy     — mossy key solo instance
  { name: "Cal'varion",                value: "Cal'varion",                groupEligible: true  }, // Hard     — wilderness multi-combat
  { name: 'Callisto',                  value: 'Callisto',                  groupEligible: true  }, // Hard     — wilderness multi-combat
  { name: 'Cerberus',                  value: 'Cerberus',                  groupEligible: false }, // Hard     — each player has own Cerberus
  { name: 'Chaos Elemental',           value: 'Chaos Elemental',           groupEligible: true  }, // Hard     — wilderness multi-combat
  { name: 'Chaos Fanatic',             value: 'Chaos Fanatic',             groupEligible: true  }, // Medium   — wilderness multi-combat
  { name: 'Commander Zilyana',         value: 'Commander Zilyana',         groupEligible: true  }, // Hard     — GWD group boss
  { name: 'Corporeal Beast',           value: 'Corporeal Beast',           groupEligible: true  }, // Medium   — classic team boss
  { name: 'Crazy Archaeologist',       value: 'Crazy Archaeologist',       groupEligible: true  }, // Medium   — wilderness multi-combat
  { name: 'Dagannoth Prime',           value: 'Dagannoth Prime',           groupEligible: true  }, // Hard     — classic trio boss
  { name: 'Dagannoth Rex',             value: 'Dagannoth Rex',             groupEligible: true  }, // Hard     — classic trio boss
  { name: 'Dagannoth Supreme',         value: 'Dagannoth Supreme',         groupEligible: true  }, // Hard     — classic trio boss
  { name: 'Deranged Archaeologist',    value: 'Deranged Archaeologist',    groupEligible: true  }, // Easy     — open world multi-combat
  { name: 'The Gauntlet',              value: 'The Gauntlet',              groupEligible: false }, // Hard     — solo only
  { name: 'Giant Mole',                value: 'Giant Mole',                groupEligible: true  }, // Easy     — multi-combat
  { name: 'Grotesque Guardians',       value: 'Grotesque Guardians',       groupEligible: false }, // Hard     — solo instance (wiki: "Participants: 1")
  { name: 'Hespori',                   value: 'Hespori',                   groupEligible: false }, // Medium   — solo instance (wiki confirmed)
  { name: 'Hueycoatl',                 value: 'Hueycoatl',                 groupEligible: true  }, // Medium   — up to 20 players (wiki confirmed)
  { name: 'Kalphite Queen',            value: 'Kalphite Queen',            groupEligible: true  }, // Hard     — multi-combat area
  { name: 'King Black Dragon',         value: 'King Black Dragon',         groupEligible: true  }, // Medium   — multi-combat
  { name: 'Kraken',                    value: 'Kraken',                    groupEligible: false }, // Medium   — each player wakes own Kraken
  { name: "K'ril Tsutsaroth",          value: "K'ril Tsutsaroth",          groupEligible: true  }, // Hard     — GWD group boss
  { name: 'Mimic',                     value: 'Mimic',                     groupEligible: false }, // Medium   — personal casket, solo only
  { name: 'Obor',                      value: 'Obor',                      groupEligible: false }, // Easy     — giant key solo instance
  { name: 'Sarachnis',                 value: 'Sarachnis',                 groupEligible: true  }, // Medium   — multi-player dungeon
  { name: 'Scorpia',                   value: 'Scorpia',                   groupEligible: true  }, // Hard     — wilderness multi-combat
  { name: 'Scurrius',                  value: 'Scurrius',                  groupEligible: true  }, // Easy     — public room confirmed (wiki)
  { name: 'Skotizo',                   value: 'Skotizo',                   groupEligible: false }, // Hard     — dark totem solo instance
  { name: 'Spindel',                   value: 'Spindel',                   groupEligible: true  }, // Hard     — wilderness multi-combat
  { name: 'Tempoross',                 value: 'Tempoross',                 groupEligible: true  }, // Easy     — group skilling boss
  { name: 'Thermonuclear Smoke Devil', value: 'Thermonuclear Smoke Devil', groupEligible: false }, // Medium   — each player spawns own
  { name: 'TzTok-Jad',                 value: 'TzTok-Jad',                 groupEligible: false }, // Hard     — Fight Cave, solo only
  { name: 'Venenatis',                 value: 'Venenatis',                 groupEligible: true  }, // Hard     — wilderness multi-combat
  { name: "Vet'ion",                   value: "Vet'ion",                   groupEligible: true  }, // Hard     — wilderness multi-combat
  { name: 'Wintertodt',                value: 'Wintertodt',                groupEligible: true  }, // Easy     — group skilling boss
  { name: 'Zalcano',                   value: 'Zalcano',                   groupEligible: true  }, // Medium   — group boss
];

// Elite tier and above — shown for solo_endgame_boss.
// Group-filtered version is used for group_endgame_boss.
const ENDGAME_BOSSES = [
  { name: 'The Corrupted Gauntlet',    value: 'The Corrupted Gauntlet',    groupEligible: false }, // Elite    — solo only
  { name: 'Duke Sucellus',             value: 'Duke Sucellus',             groupEligible: false }, // Elite    — DT2 solo instance
  { name: 'General Graardor',          value: 'General Graardor',          groupEligible: true  }, // Elite    — GWD group boss
  { name: "Kree'Arra",                 value: "Kree'Arra",                 groupEligible: true  }, // Elite    — GWD group boss
  { name: 'The Leviathan',             value: 'The Leviathan',             groupEligible: false }, // Elite    — DT2 solo instance
  { name: 'Nex',                       value: 'Nex',                       groupEligible: true  }, // Elite    — group boss
  { name: 'The Nightmare',             value: 'The Nightmare',             groupEligible: true  }, // Master   — 5-80 players (wiki confirmed)
  { name: 'Phantom Muspah',            value: 'Phantom Muspah',            groupEligible: false }, // Elite    — solo boss (wiki confirmed)
  { name: "Phosani's Nightmare",       value: "Phosani's Nightmare",       groupEligible: false }, // Master   — solo variant of Nightmare
  { name: 'Sol Heredit',               value: 'Sol Heredit',               groupEligible: false }, // Master   — Fortis Colosseum, solo only
  { name: 'TzKal-Zuk',                 value: 'TzKal-Zuk',                 groupEligible: false }, // Master   — Inferno, solo only
  { name: 'Vardorvis',                 value: 'Vardorvis',                 groupEligible: false }, // Elite    — DT2 solo instance
  { name: 'Vorkath',                   value: 'Vorkath',                   groupEligible: false }, // Elite    — solo instance
  { name: 'The Whisperer',             value: 'The Whisperer',             groupEligible: false }, // Elite    — DT2 solo instance
  { name: 'Zulrah',                    value: 'Zulrah',                    groupEligible: false }, // Elite    — solo instance
];

// All bosses combined — used for /setbossrate autocomplete so staff can search any boss.
const ALL_BOSSES = [...MIDGAME_BOSSES, ...ENDGAME_BOSSES];

// Midgame bosses that can be done as a group — used for group_midgame_boss autocomplete.
const GROUP_MIDGAME_BOSSES = MIDGAME_BOSSES.filter((b) => b.groupEligible);

// Endgame bosses that can be done as a group — used for group_endgame_boss autocomplete.
const GROUP_ENDGAME_BOSSES = ENDGAME_BOSSES.filter((b) => b.groupEligible);

// Bosses commonly assigned by Slayer masters — used for the slayer_boss autocomplete field.
const SLAYER_BOSSES = [
  { name: 'Abyssal Sire',              value: 'Abyssal Sire',              groupEligible: false },
  { name: 'Alchemical Hydra',          value: 'Alchemical Hydra',          groupEligible: false },
  { name: 'Cerberus',                  value: 'Cerberus',                  groupEligible: false },
  { name: 'Dagannoth Prime',           value: 'Dagannoth Prime',           groupEligible: true  },
  { name: 'Dagannoth Rex',             value: 'Dagannoth Rex',             groupEligible: true  },
  { name: 'Dagannoth Supreme',         value: 'Dagannoth Supreme',         groupEligible: true  },
  { name: 'Grotesque Guardians',       value: 'Grotesque Guardians',       groupEligible: false },
  { name: 'Kalphite Queen',            value: 'Kalphite Queen',            groupEligible: true  },
  { name: 'Kraken',                    value: 'Kraken',                    groupEligible: false },
  { name: 'Sarachnis',                 value: 'Sarachnis',                 groupEligible: true  },
  { name: 'Scurrius',                  value: 'Scurrius',                  groupEligible: true  },
  { name: 'Skotizo',                   value: 'Skotizo',                   groupEligible: false },
  { name: 'Thermonuclear Smoke Devil', value: 'Thermonuclear Smoke Devil', groupEligible: false },
  { name: 'Vorkath',                   value: 'Vorkath',                   groupEligible: false },
  { name: 'Zulrah',                    value: 'Zulrah',                    groupEligible: false },
];

// Raids only — used for the raid autocomplete field.
// All raids are endgame (Elite tier or above) and all are group eligible.
const RAIDS = [
  { name: 'Chambers of Xeric',                 value: 'Chambers of Xeric' },           // Master
  { name: 'Chambers of Xeric: Challenge Mode', value: 'Chambers of Xeric: Challenge Mode' }, // Grandmaster
  { name: 'Theatre of Blood',                  value: 'Theatre of Blood' },             // Master
  { name: 'Theatre of Blood: Hard Mode',       value: 'Theatre of Blood: Hard Mode' },  // Grandmaster
  { name: 'Tombs of Amascut',                  value: 'Tombs of Amascut' },             // Elite
  { name: 'Tombs of Amascut: Expert Mode',     value: 'Tombs of Amascut: Expert Mode' }, // Grandmaster
];

// Converts a boss display name (like "Kree'Arra") into the WOM API metric key (like "kreearra").
// WOM expects all-lowercase with underscores and no special characters.
//
// The conversion rules, applied in order:
//   1. Lowercase everything
//   2. Strip apostrophes (Kree'Arra → kreearra, Vet'ion → vetion)
//   3. Turn hyphens into spaces (TzKal-Zuk → tzkal zuk → tzkal_zuk)
//   4. Turn colons into spaces (Challenge Mode: → challenge mode  → challenge_mode)
//   5. Strip any remaining non-letter, non-digit, non-space characters
//   6. Collapse multiple spaces and replace with underscores
function getMetricKey(displayName) {
  return displayName
    .toLowerCase()
    .replace(/'/g, '')           // strip apostrophes
    .replace(/-/g, ' ')          // hyphens become spaces
    .replace(/:/g, ' ')          // colons become spaces
    .replace(/[^a-z0-9 ]/g, '') // strip anything else unusual
    .trim()
    .replace(/ +/g, '_');        // one or more spaces become a single underscore
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
