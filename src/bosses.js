// bosses.js
// Defines the lists of OSRS bosses and raids used to power the autocomplete dropdowns
// in the /setweek command. Also provides the function that converts a boss display name
// into the exact metric key that the Wise Old Man API expects.
//
// Bosses are split into MIDGAME and ENDGAME based on the OSRS Bossing Ladder guide:
//   https://oldschool.runescape.wiki/w/Guide:Bossing_Ladder
// Midgame = Easy / Medium / Hard tier. Endgame = Elite tier and above.
//
// How autocomplete works: Discord shows the "name" to the user in the dropdown.
// When they pick one, the "value" is what gets sent to the bot and stored in pending.json.
// Here, name and value are the same (the human-readable display name like "Kalphite Queen")
// so pending.json stays easy to read. The getMetricKey() function then converts it
// to the WOM format (like "kalphite_queen") at competition-creation time.

// Easy / Medium / Hard tier bosses — shown for solo_midgame_boss and group_midgame_boss.
const MIDGAME_BOSSES = [
  { name: 'Abyssal Sire',              value: 'Abyssal Sire' },            // Hard
  { name: 'Alchemical Hydra',          value: 'Alchemical Hydra' },        // Hard
  { name: 'Amoxliatl',                 value: 'Amoxliatl' },               // Medium
  { name: 'Araxxor',                   value: 'Araxxor' },                 // Hard
  { name: 'Artio',                     value: 'Artio' },                   // Hard
  { name: 'Barrows Chests',            value: 'Barrows Chests' },          // Easy
  { name: 'Bryophyta',                 value: 'Bryophyta' },               // Easy
  { name: "Cal'varion",                value: "Cal'varion" },              // Hard
  { name: 'Callisto',                  value: 'Callisto' },                // Hard
  { name: 'Cerberus',                  value: 'Cerberus' },                // Hard
  { name: 'Chaos Elemental',           value: 'Chaos Elemental' },         // Hard
  { name: 'Chaos Fanatic',             value: 'Chaos Fanatic' },           // Medium
  { name: 'Commander Zilyana',         value: 'Commander Zilyana' },       // Hard (Solo)
  { name: 'Corporeal Beast',           value: 'Corporeal Beast' },         // GWD team boss, Medium-adjacent
  { name: 'Crazy Archaeologist',       value: 'Crazy Archaeologist' },     // Medium
  { name: 'Dagannoth Prime',           value: 'Dagannoth Prime' },         // Hard
  { name: 'Dagannoth Rex',             value: 'Dagannoth Rex' },           // Hard
  { name: 'Dagannoth Supreme',         value: 'Dagannoth Supreme' },       // Hard
  { name: 'Deranged Archaeologist',    value: 'Deranged Archaeologist' },  // Easy
  { name: 'The Gauntlet',              value: 'The Gauntlet' },            // Hard
  { name: 'Giant Mole',                value: 'Giant Mole' },              // Easy
  { name: 'Grotesque Guardians',       value: 'Grotesque Guardians' },     // Hard
  { name: 'Hespori',                   value: 'Hespori' },                 // Medium
  { name: 'Hueycoatl',                 value: 'Hueycoatl' },               // Medium
  { name: 'Kalphite Queen',            value: 'Kalphite Queen' },          // Hard
  { name: 'King Black Dragon',         value: 'King Black Dragon' },       // Medium
  { name: 'Kraken',                    value: 'Kraken' },                  // Medium
  { name: "K'ril Tsutsaroth",          value: "K'ril Tsutsaroth" },        // Hard (Solo)
  { name: 'Mimic',                     value: 'Mimic' },                   // Medium
  { name: 'Obor',                      value: 'Obor' },                    // Easy
  { name: 'Sarachnis',                 value: 'Sarachnis' },               // Medium
  { name: 'Scorpia',                   value: 'Scorpia' },                 // Hard
  { name: 'Scurrius',                  value: 'Scurrius' },                // Easy
  { name: 'Skotizo',                   value: 'Skotizo' },                 // Hard
  { name: 'Spindel',                   value: 'Spindel' },                 // Hard
  { name: 'Tempoross',                 value: 'Tempoross' },               // Easy
  { name: 'Thermonuclear Smoke Devil', value: 'Thermonuclear Smoke Devil' }, // Medium
  { name: 'TzTok-Jad',                 value: 'TzTok-Jad' },              // Hard
  { name: 'Venenatis',                 value: 'Venenatis' },               // Hard
  { name: "Vet'ion",                   value: "Vet'ion" },                 // Hard
  { name: 'Wintertodt',                value: 'Wintertodt' },              // Easy
  { name: 'Zalcano',                   value: 'Zalcano' },                 // Medium
];

// Elite tier and above — shown for solo_endgame_boss and group_endgame_boss.
const ENDGAME_BOSSES = [
  { name: 'The Corrupted Gauntlet',    value: 'The Corrupted Gauntlet' },  // Elite
  { name: 'Duke Sucellus',             value: 'Duke Sucellus' },           // Elite
  { name: 'General Graardor',          value: 'General Graardor' },        // Elite (Solo)
  { name: "Kree'Arra",                 value: "Kree'Arra" },               // Elite (Solo)
  { name: 'The Leviathan',             value: 'The Leviathan' },           // Elite
  { name: 'Nex',                       value: 'Nex' },                     // Elite
  { name: 'The Nightmare',             value: 'The Nightmare' },           // Master
  { name: 'Phantom Muspah',            value: 'Phantom Muspah' },          // Elite
  { name: "Phosani's Nightmare",       value: "Phosani's Nightmare" },     // Master
  { name: 'Sol Heredit',               value: 'Sol Heredit' },             // Master
  { name: 'TzKal-Zuk',                 value: 'TzKal-Zuk' },              // Master
  { name: 'Vardorvis',                 value: 'Vardorvis' },               // Elite
  { name: 'Vorkath',                   value: 'Vorkath' },                 // Elite
  { name: 'The Whisperer',             value: 'The Whisperer' },           // Elite
  { name: 'Zulrah',                    value: 'Zulrah' },                  // Elite
];

// All bosses combined — used for /setbossrate autocomplete so staff can search any boss.
const ALL_BOSSES = [...MIDGAME_BOSSES, ...ENDGAME_BOSSES];

// Bosses commonly assigned by Slayer masters — used for the slayer_boss autocomplete field.
const SLAYER_BOSSES = [
  { name: 'Abyssal Sire',              value: 'Abyssal Sire' },
  { name: 'Alchemical Hydra',          value: 'Alchemical Hydra' },
  { name: 'Cerberus',                  value: 'Cerberus' },
  { name: 'Dagannoth Prime',           value: 'Dagannoth Prime' },
  { name: 'Dagannoth Rex',             value: 'Dagannoth Rex' },
  { name: 'Dagannoth Supreme',         value: 'Dagannoth Supreme' },
  { name: 'Grotesque Guardians',       value: 'Grotesque Guardians' },
  { name: 'Kalphite Queen',            value: 'Kalphite Queen' },
  { name: 'Kraken',                    value: 'Kraken' },
  { name: 'Sarachnis',                 value: 'Sarachnis' },
  { name: 'Scurrius',                  value: 'Scurrius' },
  { name: 'Skotizo',                   value: 'Skotizo' },
  { name: 'Thermonuclear Smoke Devil', value: 'Thermonuclear Smoke Devil' },
  { name: 'Vorkath',                   value: 'Vorkath' },
  { name: 'Zulrah',                    value: 'Zulrah' },
];

// Raids only — used for the raid autocomplete field.
// All raids are endgame (Elite tier or above).
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
  ALL_BOSSES,
  SLAYER_BOSSES,
  RAIDS,
  getMetricKey,
};
