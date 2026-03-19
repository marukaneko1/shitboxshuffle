import { Injectable, OnModuleInit } from "@nestjs/common";

const SCRABBLE_LETTER_SCORES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5,
  L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4,
  W: 4, X: 8, Y: 4, Z: 10,
};

const SCRABBLE_TILE_DISTRIBUTION: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1,
  L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2,
  W: 2, X: 1, Y: 2, Z: 1, _: 2,
};

const BOGGLE_DICE: string[][] = [
  ["R", "I", "F", "O", "B", "X"], ["I", "F", "E", "H", "E", "Y"],
  ["D", "E", "N", "O", "W", "S"], ["U", "T", "O", "K", "N", "D"],
  ["H", "M", "S", "R", "A", "O"], ["L", "U", "P", "E", "T", "S"],
  ["A", "C", "I", "T", "O", "A"], ["Y", "L", "G", "K", "U", "E"],
  ["QU", "B", "M", "J", "O", "A"], ["E", "H", "I", "S", "P", "N"],
  ["V", "E", "T", "I", "G", "N"], ["B", "A", "L", "I", "Y", "T"],
  ["E", "Z", "A", "V", "N", "D"], ["R", "A", "L", "E", "S", "C"],
  ["U", "W", "I", "L", "R", "G"], ["P", "A", "C", "E", "M", "D"],
];

const SCATTERGORIES_CATEGORIES = [
  "Animal", "Boy's Name", "Girl's Name", "City", "Country", "Food",
  "Drink", "Movie", "TV Show", "Song", "Band/Musician", "Book",
  "Author", "Sport", "Occupation", "School Subject", "Clothing",
  "Color", "Furniture", "Vehicle", "Fruit", "Vegetable", "Tool",
  "Kitchen Item", "Toy", "Holiday", "Flower", "Tree", "Body Part",
  "Restaurant", "Store/Shop", "Candy/Dessert", "Insect", "Fish",
  "Bird", "Mammal", "Something Cold", "Something Hot", "Something Round",
  "Something Soft", "Famous Person", "Historical Figure", "Cartoon Character",
  "Superhero", "Villain", "Video Game", "Board Game", "Musical Instrument",
  "Dance", "Language", "College/University", "Magazine", "Weapon",
  "Something in a Bathroom", "Something in a Classroom", "Something at a Beach",
  "Something at a Party", "Something at a Zoo", "Something Scary",
  "Something You Shout", "A Reason to be Late", "An Excuse", "A Bad Habit",
  "Something You Throw Away", "Something in the Sky", "Something Underground",
  "A Type of Cheese", "A Spice/Herb", "Something in a Hospital",
  "Something You Sit On", "Something Electric", "A Nickname", "A Word with Double Letters",
  "A Four-Letter Word", "Something Made of Metal", "Something Made of Wood",
  "An Award/Prize", "A Crime", "Something You Read", "A Sound",
  "Something Sticky", "A Type of Dance", "Something in a Wallet",
  "Something in a Park", "An Olympic Event", "A Breakfast Food",
  "Something in a Gym", "A Household Chore", "Something Fragile",
  "Something You Wear on Your Head", "A Gift", "Something at a Wedding",
  "A Type of Candy", "A Pizza Topping", "Something at a Fair/Carnival",
  "A Song Title", "A Movie Title", "A Type of Shoe", "Something in Space",
  "A Emotion/Feeling", "Something in a Refrigerator",
];

@Injectable()
export class DictionaryService implements OnModuleInit {
  private wordSet: Set<string> = new Set();
  private wordsByLength: Map<number, string[]> = new Map();
  private fiveLetterAnswers: string[] = [];
  private prefixSet: Set<string> = new Set();

  async onModuleInit() {
    await this.loadWords();
  }

  private async loadWords() {
    try {
      let allWords: string[];
      try {
        const wordsModule = require("an-array-of-english-words");
        allWords = Array.isArray(wordsModule) ? wordsModule : (wordsModule.default || []);
      } catch {
        allWords = [];
      }
      if (allWords.length === 0) { this.loadFallbackWords(); this.buildPrefixSet(); return; }
      for (const w of allWords) {
        const upper = w.toUpperCase();
        if (/^[A-Z]+$/.test(upper) && upper.length >= 3 && upper.length <= 15) {
          this.wordSet.add(upper);
          const len = upper.length;
          if (!this.wordsByLength.has(len)) this.wordsByLength.set(len, []);
          this.wordsByLength.get(len)!.push(upper);
        }
      }
      const fiveLetters = this.wordsByLength.get(5) || [];
      const commonFive = fiveLetters.filter(
        (w) =>
          !w.includes("Q") ||
          w.includes("QU"),
      );
      this.fiveLetterAnswers =
        commonFive.length > 500
          ? commonFive.sort(() => Math.random() - 0.5).slice(0, 2500)
          : commonFive;
      this.buildPrefixSet();
    } catch {
      this.loadFallbackWords();
      this.buildPrefixSet();
    }
  }

  private buildPrefixSet() {
    for (const word of this.wordSet) {
      for (let i = 1; i <= word.length; i++) {
        this.prefixSet.add(word.substring(0, i));
      }
    }
  }

  private loadFallbackWords() {
    const basics = [
      "THE","AND","FOR","ARE","BUT","NOT","YOU","ALL","CAN","HER","WAS","ONE",
      "OUR","OUT","DAY","HAD","HAS","HIS","HOW","MAN","NEW","NOW","OLD","SEE",
      "WAY","WHO","DID","GET","LET","SAY","SHE","TOO","USE","BOY","ITS","HIM",
      "ABLE","ALSO","BACK","BEEN","CALL","CAME","COME","EACH","EVEN","FIND",
      "FIRE","FROM","GIVE","GOOD","HAND","HAVE","HELP","HERE","HIGH","HOME",
      "JUST","KEEP","KIND","KNOW","LAST","LEFT","LIFE","LIKE","LINE","LIVE",
      "LONG","LOOK","MADE","MAKE","MANY","MIND","MORE","MOST","MUCH","MUST",
      "NAME","NEAR","NEED","NEXT","ONLY","OPEN","OVER","PAGE","PART","PLAN",
      "PLAY","READ","REAL","SAID","SAME","SHOW","SIDE","SOME","SUCH","SURE",
      "TAKE","TELL","THAN","THAT","THEM","THEN","THEY","THIS","TIME","TURN",
      "UPON","VERY","WANT","WELL","WENT","WERE","WHAT","WHEN","WILL","WITH",
      "WORD","WORK","YEAR","YOUR","ABOUT","ABOVE","AFTER","AGAIN","BEING",
      "BELOW","BRING","BUILD","CARRY","CAUSE","CHAIN","CHAIR","CHILD","CLEAN",
      "CLEAR","CLIMB","CLOSE","COULD","COVER","CRANE","CREAM","DANCE","DEATH",
      "DOING","DOUBT","DRAFT","DRAIN","DREAM","DRESS","DRINK","DRIVE","EARTH",
      "EIGHT","EMPTY","ENJOY","ENTER","ERROR","EVENT","EVERY","EXTRA","FAITH",
      "FALSE","FANCY","FEAST","FIELD","FIGHT","FINAL","FIRST","FLAME","FLASH",
      "FLOAT","FLOOD","FLOOR","FOCUS","FORCE","FOUND","FRAME","FRESH","FRONT",
      "FRUIT","GLASS","GLOBE","GRACE","GRAIN","GRAND","GRANT","GRAPE","GRASP",
      "GRASS","GRAVE","GREAT","GREEN","GRIND","GROUP","GROWN","GUARD","GUESS",
      "GUIDE","HAPPY","HEARD","HEART","HEAVY","HENCE","HORSE","HOTEL","HOUSE",
      "HUMAN","HURRY","IDEAL","IMAGE","INDEX","INNER","INPUT","IRONY","IVORY",
      "JAPAN","JEWEL","JOINT","JUDGE","JUICE","KNOCK","KNOWN","LABEL","LARGE",
      "LASER","LATER","LAUGH","LAYER","LEARN","LEMON","LEVEL","LIGHT","LIMIT",
      "LINEN","LIVER","LOGIC","LOOSE","LOVER","LOWER","LUCKY","LUNAR","LUNCH",
      "LYRIC","MAGIC","MAJOR","MAKER","MAPLE","MARCH","MATCH","MAYBE","MAYOR",
      "MEANT","MEDIA","MERCY","METAL","MIGHT","MINOR","MINUS","MODEL","MONEY",
      "MONTH","MORAL","MOTOR","MOUNT","MOUSE","MOUTH","MOVED","MOVIE","MUSIC",
      "NAKED","NERVE","NEVER","NIGHT","NOBLE","NOISE","NORTH","NOTED","NOVEL",
      "NURSE","OCCUR","OCEAN","OFFER","ORDER","OTHER","OUGHT","OUTER","OWNED",
      "OWNER","PAINT","PANEL","PANIC","PAPER","PARTY","PATCH","PAUSE","PEACE",
      "PEARL","PENNY","PHASE","PHONE","PHOTO","PIANO","PIECE","PILOT","PITCH",
      "PIXEL","PLACE","PLAIN","PLANE","PLANT","PLATE","PLAZA","PLEAD","PLUMB",
      "PLUME","PLUMP","PLUNGE","POINT","POLAR","POUCH","POUND","POWER","PRESS",
      "PRICE","PRIDE","PRIME","PRINCE","PRINT","PRIOR","PRIZE","PROOF","PROUD",
      "PROVE","PSALM","PULSE","PUNCH","PUPIL","QUEEN","QUERY","QUEST","QUEUE",
      "QUICK","QUIET","QUOTE","RADAR","RADIO","RAISE","RANGE","RAPID","RATIO",
      "REACH","READY","REALM","REIGN","RELAX","REPLY","RIGHT","RIVAL","RIVER",
      "ROBIN","ROBOT","ROCKY","ROGER","ROMAN","ROUGE","ROUGH","ROUND","ROUTE",
      "ROYAL","RUGBY","RULER","RURAL","SAINT","SALAD","SAUCE","SCALE","SCENE",
      "SCOPE","SCORE","SENSE","SERVE","SEVEN","SHALL","SHAPE","SHARE","SHARP",
      "SHELL","SHIFT","SHINE","SHIRT","SHOCK","SHOOT","SHORT","SHOUT","SIGHT",
      "SINCE","SIXTH","SIXTY","SKILL","SKULL","SLASH","SLAVE","SLEEP","SLIDE",
      "SLOPE","SMALL","SMART","SMELL","SMILE","SMOKE","SOLAR","SOLID","SOLVE",
      "SORRY","SOUND","SOUTH","SPACE","SPARE","SPEAK","SPEED","SPEND","SPICE",
      "SPLIT","SPORT","SPRAY","SQUAD","STACK","STAFF","STAGE","STAIN","STAIR",
      "STAKE","STALE","STAMP","STAND","STARE","START","STATE","STAVE","STEAL",
      "STEAM","STEEL","STEEP","STEER","STERN","STICK","STIFF","STILL","STOCK",
      "STONE","STOOD","STORE","STORM","STORY","STOVE","STRAP","STRAW","STRIP",
      "STUCK","STUDY","STUFF","STYLE","SUGAR","SUITE","SUPER","SURGE","SWAMP",
      "SWEAR","SWEAT","SWEEP","SWEET","SWEPT","SWIFT","SWING","SWORD","SWORE",
      "SWUNG","TABLE","TASTE","TEACH","TEETH","THANK","THEIR","THEME","THERE",
      "THICK","THING","THINK","THIRD","THOSE","THREE","THREW","THROW","THUMB",
      "TIGER","TIGHT","TIMER","TIRED","TITLE","TODAY","TOKEN","TOTAL","TOUCH",
      "TOUGH","TOWER","TOXIC","TRACE","TRACK","TRADE","TRAIL","TRAIN","TRAIT",
      "TRASH","TREAT","TREND","TRIAL","TRIBE","TRICK","TRIED","TROOP","TRUCK",
      "TRULY","TRUMP","TRUNK","TRUST","TRUTH","TWICE","TWIST","ULTRA","UNCLE",
      "UNDER","UNION","UNITE","UNITY","UNTIL","UPPER","UPSET","URBAN","USAGE",
      "USUAL","UTTER","VALID","VALUE","VIDEO","VIGOR","VINYL","VIRAL","VIRUS",
      "VISIT","VITAL","VIVID","VOCAL","VODKA","VOICE","VOTER","WAIST","WATCH",
      "WATER","WEARY","WEAVE","WEDGE","WEIRD","WHEAT","WHEEL","WHERE","WHICH",
      "WHILE","WHITE","WHOLE","WHOSE","WIDOW","WIDTH","WOMAN","WORLD","WORRY",
      "WORSE","WORST","WORTH","WOULD","WOUND","WRATH","WRITE","WRONG","WROTE",
      "YACHT","YIELD","YOUNG","YOUTH","APPLE","BADGE","CAMEL","DELTA","EAGLE",
      "FABLE","GAMMA","HAVEN","IGLOO","JOKER","KAYAK","LANCE","MANGO","NAVAL",
      "OASIS","PANDA","QUAIL","RAVEN","SABLE","TALON","ULCER","VALET","WAGON",
      "XEROX","YEARN","ZEBRA","AGILE","BLEND","CLAMP","DWARF","EMBER","FLASK",
      "GLAZE","HASTE","IVORY","JUMBO","KNEEL","LATCH","MARSH","NIFTY","ONION",
      "PLANK","QUIRK","RIDGE","SNARE","TRUCE","USHER","VENUE","WRIST","BOXER",
      "CEDAR","DECOY","ELBOW","FORGE","GHOST","HITCH","INBOX","JOUST","KEBAB",
      "LLAMA","MOOSE","NOTCH","OLIVE","PIXEL","QUEST","ROAST","STING","TREND",
    ];
    for (const w of basics) {
      if (/^[A-Z]+$/.test(w) && w.length >= 3 && w.length <= 15) {
        this.wordSet.add(w);
        const len = w.length;
        if (!this.wordsByLength.has(len)) this.wordsByLength.set(len, []);
        this.wordsByLength.get(len)!.push(w);
      }
    }
    this.fiveLetterAnswers = (this.wordsByLength.get(5) || []).slice();
  }

  isValidWord(word: string, minLength = 3): boolean {
    const upper = word.toUpperCase();
    return upper.length >= minLength && this.wordSet.has(upper);
  }

  isValidPrefix(prefix: string): boolean {
    return this.prefixSet.has(prefix.toUpperCase());
  }

  getRandomFiveLetterWord(): string {
    const idx = Math.floor(Math.random() * this.fiveLetterAnswers.length);
    return this.fiveLetterAnswers[idx];
  }

  getRandomWord(length: number): string | null {
    const words = this.wordsByLength.get(length);
    if (!words || words.length === 0) return null;
    return words[Math.floor(Math.random() * words.length)];
  }

  getWordsUsingLetters(letters: string[], centerLetter?: string, minLength = 4): string[] {
    const letterSet = new Set(letters.map((l) => l.toUpperCase()));
    const center = centerLetter?.toUpperCase();
    const results: string[] = [];
    for (const word of this.wordSet) {
      if (word.length < minLength) continue;
      if (center && !word.includes(center)) continue;
      if ([...word].every((ch) => letterSet.has(ch))) {
        results.push(word);
      }
    }
    return results;
  }

  getWordsFromLetterPool(letters: string[], minLength = 3): string[] {
    const pool = new Set(letters.map((l) => l.toUpperCase()));
    const results: string[] = [];
    for (const word of this.wordSet) {
      if (word.length < minLength) continue;
      if ([...word].every((ch) => pool.has(ch))) {
        results.push(word);
      }
    }
    return results;
  }

  hasNoRepeatedLetters(word: string): boolean {
    const upper = word.toUpperCase();
    return new Set(upper).size === upper.length;
  }

  countMatchingLetters(word1: string, word2: string): number {
    const set1 = new Set(word1.toUpperCase());
    let count = 0;
    for (const ch of new Set(word2.toUpperCase())) {
      if (set1.has(ch)) count++;
    }
    return count;
  }

  getScrabbleLetterScore(letter: string): number {
    return SCRABBLE_LETTER_SCORES[letter.toUpperCase()] || 0;
  }

  getScrabbleWordScore(word: string): number {
    return [...word.toUpperCase()].reduce(
      (sum, ch) => sum + this.getScrabbleLetterScore(ch),
      0,
    );
  }

  getScrabbleTileDistribution(): Record<string, number> {
    return { ...SCRABBLE_TILE_DISTRIBUTION };
  }

  getScrabbleLetterScores(): Record<string, number> {
    return { ...SCRABBLE_LETTER_SCORES };
  }

  getBoggleDice(): string[][] {
    return BOGGLE_DICE.map((die) => [...die]);
  }

  getRandomCategories(count = 12): string[] {
    const shuffled = [...SCATTERGORIES_CATEGORIES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  getRandomLetter(): string {
    const letters = "ABCDEFGHIJKLMNOPRSTW";
    return letters[Math.floor(Math.random() * letters.length)];
  }

  generateSpellingBeeLetters(): { letters: string[]; centerLetter: string; validWords: string[] } {
    const vowels = ["A", "E", "I", "O", "U"];
    const consonants = ["B","C","D","F","G","H","J","K","L","M","N","P","R","S","T","V","W"];
    let best: { letters: string[]; centerLetter: string; validWords: string[] } | null = null;

    for (let attempt = 0; attempt < 100; attempt++) {
      const shuffledVowels = [...vowels].sort(() => Math.random() - 0.5);
      const shuffledCons = [...consonants].sort(() => Math.random() - 0.5);
      const picked = [...shuffledVowels.slice(0, 2), ...shuffledCons.slice(0, 5)];
      const center = picked[Math.floor(Math.random() * picked.length)];
      const words = this.getWordsUsingLetters(picked, center, 4);
      if (!best || words.length > best.validWords.length) {
        best = { letters: picked, centerLetter: center, validWords: words };
      }
      if (words.length >= 20) break;
    }
    return best!;
  }

  generateLetterBoxedSides(): string[][] {
    const alphabet = "ABCDEFGHIJKLMNOPRSTUVW".split("");
    const shuffled = alphabet.sort(() => Math.random() - 0.5).slice(0, 12);
    return [shuffled.slice(0, 3), shuffled.slice(3, 6), shuffled.slice(6, 9), shuffled.slice(9, 12)];
  }

  isAdjacentInGrid(row1: number, col1: number, row2: number, col2: number): boolean {
    return Math.abs(row1 - row2) <= 1 && Math.abs(col1 - col2) <= 1 && !(row1 === row2 && col1 === col2);
  }

  isValidBogglePath(grid: string[][], word: string): boolean {
    const upper = word.toUpperCase();
    const rows = grid.length;
    const cols = grid[0].length;

    const dfs = (r: number, c: number, idx: number, visited: Set<string>): boolean => {
      if (idx === upper.length) return true;
      if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
      const key = `${r},${c}`;
      if (visited.has(key)) return false;
      const cell = grid[r][c].toUpperCase();
      if (cell === "QU") {
        if (upper.substring(idx, idx + 2) !== "QU") return false;
        visited.add(key);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (dfs(r + dr, c + dc, idx + 2, visited)) return true;
          }
        }
        visited.delete(key);
        return false;
      }
      if (upper[idx] !== cell) return false;
      visited.add(key);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (dfs(r + dr, c + dc, idx + 1, visited)) return true;
        }
      }
      visited.delete(key);
      return false;
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (dfs(r, c, 0, new Set())) return true;
      }
    }
    return false;
  }

  generateBoggleGrid(): string[][] {
    const dice = this.getBoggleDice();
    const shuffled = [...dice].sort(() => Math.random() - 0.5);
    const grid: string[][] = [];
    for (let r = 0; r < 4; r++) {
      const row: string[] = [];
      for (let c = 0; c < 4; c++) {
        const die = shuffled[r * 4 + c];
        row.push(die[Math.floor(Math.random() * die.length)]);
      }
      grid.push(row);
    }
    return grid;
  }

  getAllWords(): Set<string> {
    return this.wordSet;
  }

  getWordCount(): number {
    return this.wordSet.size;
  }
}
