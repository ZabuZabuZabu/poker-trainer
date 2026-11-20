// ===== 保存データ（localStorage） =====
// 読み書きに失敗してもアプリが止まらないよう、すべて try/catch で包む
const Store = (() => {
    const KEYS = {
        answers: "yk2_answers",     // 回答ログ
        mistakes: "yk2_mistakes",   // 苦手スポット
        settings: "yk2_settings",   // ドリル設定
        meta: "yk2_meta",           // 最高連続正解など
        legacy: "poker_practice_history" // 旧バージョンの間違い履歴
    };
    const MAX_ANSWERS = 10000;

    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    }
    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 容量不足など */ }
    }
    function remove(key) { try { localStorage.removeItem(key); } catch (e) { } }

    const spotKey = (hand, my, opp) => `${hand}|${my}|${opp || "-"}`;

    // 旧バージョンの履歴を新形式に取り込む（1回だけ）
    function migrate() {
        const old = read(KEYS.legacy, null);
        if (!Array.isArray(old) || !old.length) return;
        const mistakes = read(KEYS.mistakes, {});
        old.forEach(q => {
            const opp = (q.oppPos && q.oppPos !== "なし" && q.oppPos !== "-") ? q.oppPos : "";
            if (!HAND_RANK[q.hand] || !Engine.isValidSpot(q.myPos, opp || null)) return;
            const key = spotKey(q.hand, q.myPos, opp);
            const t = Date.parse(q.date) || Date.now();
            const prev = mistakes[key];
            mistakes[key] = {
                key, hand: q.hand, my: q.myPos, opp,
                count: (prev ? prev.count : 0) + 1,
                last: Math.max(prev ? prev.last : 0, t)
            };
        });
        write(KEYS.mistakes, mistakes);
        remove(KEYS.legacy);
    }

    return {
        spotKey,
        migrate,

        getAnswers: () => read(KEYS.answers, []),
        addAnswer(entry) {
            const list = read(KEYS.answers, []);
            list.push(entry);
            if (list.length > MAX_ANSWERS) list.splice(0, list.length - MAX_ANSWERS);
            write(KEYS.answers, list);
        },
        clearAnswers() { remove(KEYS.answers); remove(KEYS.meta); },

        getMistakes() {
            return Object.values(read(KEYS.mistakes, {})).sort((a, b) => b.last - a.last);
        },
        recordMistake(hand, my, opp) {
            const mistakes = read(KEYS.mistakes, {});
            const key = spotKey(hand, my, opp);
            const prev = mistakes[key];
            mistakes[key] = { key, hand, my, opp: opp || "", count: (prev ? prev.count : 0) + 1, last: Date.now() };
            write(KEYS.mistakes, mistakes);
        },
        removeMistake(key) {
            const mistakes = read(KEYS.mistakes, {});
            delete mistakes[key];
            write(KEYS.mistakes, mistakes);
        },
        clearMistakes() { remove(KEYS.mistakes); },

        getSettings: (defaults) => ({ ...defaults, ...read(KEYS.settings, {}) }),
        saveSettings: (s) => write(KEYS.settings, s),

        getMeta: () => ({ bestStreak: 0, ...read(KEYS.meta, {}) }),
        saveMeta: (m) => write(KEYS.meta, m)
    };
})();
