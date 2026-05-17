// bosses.js
// Defines the lists of OSRS bosses and raids used to power the autocomplete dropdowns
// in the /setweek command. Also provides the function that converts a boss display name
// into the exact metric key that the Wise Old Man API expects.
//
// How autocomplete works: Discord shows the "name" to the user in the dropdown.
// When they pick one, the "value" is what gets sent to the bot and stored in pending.json.
// Here, name and value are the same (the human-readable display name like "Kalphite Queen")
// so pending.json stays easy to read. The getMetricKey() function then converts it
// to the WOM format (like "kalphite_queen") at competition-creation time.

// All standard bosses. Used for the solo/group midgame and endgame boss autocomplete fields.
// Sorted alphabetically so the dropdown is easy to scan.
const ALL_BOSSES = [
  { name: 'Abyssal Sire',               value: 'Abyssal Sire' },
  { name: 'Alchemical Hydra',           value: 'Alchemical Hydra' },
  { name: 'Amoxliatl',                  value: 'Amoxliatl' },
  { name: 'Araxxor',                    value: 'Araxxor' },
  { name: 'Artio',                      value: 'Artio' },
  { name: 'Barrows Chests',             value: 'Barrows Chests' },
  { name: 'Bryophyta',                  value: 'Bryophyta' },
  { name: "Cal'varion",                 value: "Cal'varion" },
  { name: 'Callisto',                   value: 'Callisto' },
  { name: 'Cerberus',                   value: 'Cerberus' },
  { name: 'Chaos Elemental',            value: 'Chaos Elemental' },
  { name: 'Chaos Fanatic',              value: 'Chaos Fanatic' },
  { name: 'Commander Zilyana',          value: 'Commander Zilyana' },
  { name: 'Corporeal Beast',            value: 'Corporeal Beast' },
  { name: 'Crazy Archaeologist',        value: 'Crazy Archaeologist' },
  { name: 'Dagannoth Prime',            value: 'Dagannoth Prime' },
  { name: 'Dagannoth Rex',              value: 'Dagannoth Rex' },
  { name: 'Dagannoth Supreme',          value: 'Dagannoth Supreme' },
  { name: 'Deranged Archaeologist',     value: 'Deranged Archaeologist' },
  { name: 'Duke Sucellus',              value: 'Duke Sucellus' },
  { name: 'General Graardor',           value: 'General Graardor' },
  { name: 'Giant Mole',                 value: 'Giant Mole' },
  { name: 'Grotesque Guardians',        value: 'Grotesque Guardians' },
  { name: 'Hespori',                    value: 'Hespori' },
  { name: 'Hueycoatl',                  value: 'Hueycoatl' },
  { name: 'Kalphite Queen',             value: 'Kalphite Queen' },
  { name: 'King Black Dragon',          value: 'King Black Dragon' },
  { name: "Kree'Arra",                  value: "Kree'Arra" },
  { name: "K'ril Tsutsaroth",           value: "K'ril Tsutsaroth" },
  { name: 'Kraken',                     value: 'Kraken' },
  { name: 'The Leviathan',              value: 'The Leviathan' },
  { name: 'Mimic',                      value: 'Mimic' },
  { name: 'Nex',                        value: 'Nex' },
  { name: 'The Nightmare',              value: 'The Nightmare' },
  { name: 'Obor',                       value: 'Obor' },
  { name: 'Phantom Muspah',             value: 'Phantom Muspah' },
  { name: "Phosani's Nightmare",        value: "Phosani's Nightmare" },
  { name: 'Sarachnis',                  value: 'Sarachnis' },
  { name: 'Scorpia',                    value: 'Scorpia' },
  { name: 'Scurrius',                   value: 'Scurrius' },
  { name: 'Skotizo',                    value: 'Skotizo' },
  { name: 'Sol Heredit',                value: 'Sol Heredit' },
  { name: 'Spindel',                    value: 'Spindel' },
  { name: 'Tempoross',                  value: 'Tempoross' },
  { name: 'Thermonuclear Smoke Devil',  value: 'Thermonuclear Smoke Devil' },
  { name: 'TzKal-Zuk',                  value: 'TzKal-Zuk' },
  { name: 'TzTok-Jad',                  value: 'TzTok-Jad' },
  { name: 'Vardorvis',                  value: 'Vardorvis' },
  { name: 'Venenatis',                  value: 'Venenatis' },
  { name: "Vet'ion",                    value: "Vet'ion" },
  { name: 'Vorkath',                    value: 'Vorkath' },
  { name: 'The Whisperer',              value: 'The Whisperer' },
  { name: 'Wintertodt',                 value: 'Wintertodt' },
  { name: 'Zalcano',                    value: 'Zalcano' },
  { name: 'Zulrah',                     value: 'Zulrah' },
];

// Bosses that are commonly assigned by Slayer masters. Used for the slayer_boss autocomplete field.
// This is a shorter, focused list so staff doesn't have to scroll past irrelevant options.
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

// Raids only. Used for the raid autocomplete field so staff doesn't see regular bosses there.
const RAIDS = [
  { name: 'Chambers of Xeric',                  value: 'Chambers of Xeric' },
  { name: 'Chambers of Xeric: Challenge Mode',  value: 'Chambers of Xeric: Challenge Mode' },
  { name: 'Theatre of Blood',                   value: 'Theatre of Blood' },
  { name: 'Theatre of Blood: Hard Mode',        value: 'Theatre of Blood: Hard Mode' },
  { name: 'Tombs of Amascut',                   value: 'Tombs of Amascut' },
  { name: 'Tombs of Amascut: Expert Mode',      value: 'Tombs of Amascut: Expert Mode' },
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
  ALL_BOSSES,
  SLAYER_BOSSES,
  RAIDS,
  getMetricKey,
};
