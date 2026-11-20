// ===== ヨコサワ流レンジのデータ定義 =====
// ランク: 1(最強) 〜 9(フォールド)。range_table.jpg と一致することを確認済み。
const HAND_RANK = {
    "AA": 1, "AKs": 1, "AQs": 2, "AJs": 2, "ATs": 2, "A9s": 4, "A8s": 4, "A7s": 4, "A6s": 4, "A5s": 4, "A4s": 4, "A3s": 4, "A2s": 4,
    "AKo": 1, "KK": 1, "KQs": 2, "KJs": 3, "KTs": 4, "K9s": 4, "K8s": 6, "K7s": 6, "K6s": 6, "K5s": 6, "K4s": 6, "K3s": 6, "K2s": 6,
    "AQo": 2, "KQo": 3, "QQ": 1, "QJs": 3, "QTs": 4, "Q9s": 5, "Q8s": 6, "Q7s": 6, "Q6s": 6, "Q5s": 7, "Q4s": 7, "Q3s": 7, "Q2s": 7,
    "AJo": 3, "KJo": 4, "QJo": 5, "JJ": 2, "JTs": 3, "J9s": 5, "J8s": 6, "J7s": 6, "J6s": 7, "J5s": 8, "J4s": 8, "J3s": 8, "J2s": 8,
    "ATo": 4, "KTo": 5, "QTo": 6, "JTo": 5, "TT": 2, "T9s": 4, "T8s": 5, "T7s": 7, "T6s": 8, "T5s": 8, "T4s": 8, "T3s": 8, "T2s": 9,
    "A9o": 5, "K9o": 6, "Q9o": 6, "J9o": 6, "T9o": 6, "99": 2, "98s": 5, "97s": 6, "96s": 7, "95s": 8, "94s": 9, "93s": 9, "92s": 9,
    "A8o": 6, "K8o": 8, "Q8o": 8, "J8o": 8, "T8o": 8, "98o": 7, "88": 3, "87s": 6, "86s": 7, "85s": 8, "84s": 9, "83s": 9, "82s": 9,
    "A7o": 6, "K7o": 8, "Q7o": 8, "J7o": 9, "T7o": 9, "97o": 8, "87o": 8, "77": 3, "76s": 6, "75s": 7, "74s": 8, "73s": 9, "72s": 9,
    "A6o": 7, "K6o": 8, "Q6o": 9, "J6o": 9, "T6o": 9, "96o": 9, "86o": 9, "76o": 9, "66": 4, "65s": 6, "64s": 7, "63s": 8, "62s": 9,
    "A5o": 8, "K5o": 8, "Q5o": 9, "J5o": 9, "T5o": 9, "95o": 9, "85o": 9, "75o": 9, "65o": 9, "55": 4, "54s": 7, "53s": 8, "52s": 9,
    "A4o": 8, "K4o": 9, "Q4o": 9, "J4o": 9, "T4o": 9, "94o": 9, "84o": 9, "74o": 9, "64o": 9, "54o": 9, "44": 5, "43s": 8, "42s": 9,
    "A3o": 8, "K3o": 9, "Q3o": 9, "J3o": 9, "T3o": 9, "93o": 9, "83o": 9, "73o": 9, "63o": 9, "53o": 9, "43o": 9, "33": 5, "32s": 9,
    "A2o": 8, "K2o": 9, "Q2o": 9, "J2o": 9, "T2o": 9, "92o": 9, "82o": 9, "72o": 9, "62o": 9, "52o": 9, "42o": 9, "32o": 9, "22": 5
};

// 13×13グリッドの並び（左上がAA。右上がスーテッド、左下がオフスート）
const CARD_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
function handAt(i, j) {
    if (i === j) return CARD_RANKS[i] + CARD_RANKS[j];
    if (i < j) return CARD_RANKS[i] + CARD_RANKS[j] + 's';
    return CARD_RANKS[j] + CARD_RANKS[i] + 'o';
}
const ALL_HANDS = [];
for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) ALL_HANDS.push(handAt(i, j));

// ポジション（アクション順）。behind = 自分より後ろにいる人数
const POSITIONS = [
    { name: "UTG", behind: 8 }, { name: "UTG+1", behind: 7 }, { name: "MP", behind: 6 },
    { name: "MP+1", behind: 5 }, { name: "HJ", behind: 4 }, { name: "CO", behind: 3 },
    { name: "BTN", behind: 2 }, { name: "SB", behind: 1 }, { name: "BB", behind: 0 }
];
const POS_NAMES = POSITIONS.map(p => p.name);
const POS = Object.fromEntries(POSITIONS.map((p, i) => [p.name, { ...p, index: i }]));

// ランクごとに「後ろが何人以下ならオープンできるか」
const OPEN_THRESHOLD = { 1: 8, 2: 8, 3: 8, 4: 7, 5: 5, 6: 3, 7: 2, 8: 0 };

// ランクの説明（凡例用。色は range_table.jpg に合わせる）
const RANK_INFO = {
    1: { label: "8人（強）", desc: "常にリレイズ" },
    2: { label: "8人（中）", desc: "どこからでもオープン" },
    3: { label: "8人（弱）", desc: "どこからでもオープン" },
    4: { label: "6〜7人", desc: "後ろ7人以下でオープン" },
    5: { label: "4〜5人", desc: "後ろ5人以下でオープン" },
    6: { label: "3人", desc: "後ろ3人以下でオープン" },
    7: { label: "2人", desc: "後ろ2人以下でオープン" },
    8: { label: "BBのみ", desc: "BBでBTNのレイズにコール" },
    9: { label: "フォールド", desc: "参加しない" }
};

// アクションの定義
const ACTIONS = {
    raise: { label: "レイズ", key: "R" },
    "3bet": { label: "リレイズ", key: "R" },
    call: { label: "コール", key: "C" },
    fold: { label: "フォールド", key: "F" }
};
const ACTION_BY_LABEL = { "レイズ": "raise", "リレイズ": "3bet", "コール": "call", "フォールド": "fold" };
