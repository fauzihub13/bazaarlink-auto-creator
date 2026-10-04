// Random identity helpers: names, strong passwords, API key labels.
const FIRST = [
  "Aaron", "Adrian", "Alan", "Albert", "Alex", "Amelia", "Andrew", "Angela", "Arthur", "Aurora",
  "Benjamin", "Blake", "Caleb", "Cameron", "Carl", "Carmen", "Catherine", "Chloe", "Claire", "Colin",
  "Daniel", "Daphne", "David", "Derek", "Diana", "Dominic", "Dylan", "Edgar", "Elena", "Elliot",
  "Emma", "Ethan", "Evelyn", "Felix", "Fiona", "Frank", "Gabriel", "Grace", "Hannah", "Harper",
  "Henry", "Hugo", "Iris", "Isaac", "Ivy", "Jack", "Jasmine", "Jasper", "Jenna", "Julian",
  "Karen", "Kevin", "Lara", "Leo", "Liam", "Lily", "Lucas", "Mason", "Maya", "Miles",
  "Nadia", "Nathan", "Nora", "Oliver", "Oscar", "Owen", "Paula", "Peter", "Quinn", "Rachel",
  "Ralph", "Rebecca", "Riley", "Robin", "Ryan", "Sabrina", "Samuel", "Sarah", "Simon", "Sophia",
  "Stella", "Theo", "Thomas", "Tristan", "Valerie", "Victor", "Violet", "Walter", "Wendy", "Zoe",
];
const LAST = [
  "Adams", "Alvarez", "Baker", "Bennett", "Brooks", "Bryant", "Burns", "Carter", "Chen", "Clark",
  "Coleman", "Cooper", "Cruz", "Davis", "Diaz", "Duncan", "Ellis", "Evans", "Fischer", "Fleming",
  "Foster", "Fowler", "Garcia", "Gibson", "Grant", "Gray", "Green", "Griffin", "Hall", "Harper",
  "Hayes", "Henderson", "Hughes", "Hunt", "Jackson", "James", "Jenkins", "Johnson", "Keller", "Kelly",
  "Kennedy", "Knight", "Lane", "Lawson", "Lewis", "Long", "Marshall", "Martin", "Mason", "Matthews",
  "Mercer", "Miller", "Mitchell", "Morgan", "Morris", "Murphy", "Nelson", "Newman", "Norris", "Owen",
  "Palmer", "Parker", "Patterson", "Pearson", "Perry", "Peters", "Porter", "Powell", "Price", "Quinn",
  "Reed", "Reid", "Reynolds", "Rhodes", "Rice", "Roberts", "Rogers", "Rowe", "Russell", "Sanders",
  "Scott", "Shaw", "Simpson", "Spencer", "Stanley", "Stevens", "Stone", "Sullivan", "Sutton", "Taylor",
  "Thomas", "Thompson", "Turner", "Walker", "Wallace", "Ward", "Warren", "Watson", "Webb", "Wells",
  "West", "Wheeler", "Whitaker", "Willis", "Wilson", "Wood", "Wright", "Young",
];
const WORDS = [
  "Amber", "Arctic", "Aurora", "Azure", "Blizzard", "Boulder", "Breeze", "Canyon", "Cedar", "Cinder",
  "Citrus", "Cobalt", "Comet", "Copper", "Cosmic", "Crimson", "Crystal", "Cypress", "Dawn", "Delta",
  "Dusk", "Ember", "Falcon", "Frost", "Galaxy", "Glacier", "Granite", "Harbor", "Hazel", "Indigo",
  "Ivory", "Jade", "Jasper", "Jungle", "Lagoon", "Lantern", "Lunar", "Maple", "Marble", "Meadow",
  "Meteor", "Midnight", "Mist", "Nebula", "Nimbus", "Nova", "Onyx", "Orchid", "Osprey", "Panther",
  "Peak", "Pebble", "Phoenix", "Pine", "Pioneer", "Quartz", "Raven", "River", "Saffron", "Sage",
  "Sapphire", "Scarlet", "Shadow", "Sierra", "Silver", "Solstice", "Sparrow", "Summit", "Thunder", "Tiger",
  "Timber", "Topaz", "Tundra", "Velvet", "Vertex", "Violet", "Willow", "Winter", "Wisp", "Zephyr",
];
const KEY_LABELS = [
  "Production", "Development", "Staging", "Default", "Primary", "Main", "Testing", "Sandbox",
  "Backend", "Frontend", "Mobile", "Server", "Automation", "Integration", "Agent", "Worker",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (n) => Math.floor(Math.random() * n);

export function randomName() {
  return `${pick(FIRST)} ${pick(LAST)}`;
}

// Build a unique inbox local-part: "<prefix><digits>". The prefix is sanitized to
// the characters the mail provider accepts (it lowercases and strips anything
// else), so only [a-z0-9] survive. When no prefix is given a random word is used,
// and a random digit run keeps each address unique.
export function randomEmailLocalPart(prefix = "", digits = 3) {
  const clean = String(prefix || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = clean || pick(WORDS).toLowerCase();
  let n = "";
  for (let i = 0; i < digits; i++) n += rand(10);
  return `${base}${n}`;
}

// Strong password: e.g. "Panther-Cobalt-4821" (>= 8 chars, mixed case + digits).
export function randomPassword() {
  return `${pick(WORDS)}-${pick(WORDS)}-${1000 + rand(9000)}`;
}

export function randomKeyName() {
  return `${pick(KEY_LABELS)} Key`;
}
