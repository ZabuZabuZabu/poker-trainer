// ===== 判定ロジック（全モードで共通） =====
const Engine = (() => {
    // 後ろの人数から「その位置のオープンレンジは何ランクまでか」を求める
    function openRangeRank(behind) {
        for (let r = 7; r >= 1; r--) if (OPEN_THRESHOLD[r] >= behind) return r;
        return 1;
    }

    // ありえる状況か（BBで全員フォールド、自分より後ろの人がオープン、は不成立）
    function isValidSpot(my, opp) {
        if (!POS[my]) return false;
        if (!opp) return my !== "BB";
        return POS[opp] && POS[opp].index < POS[my].index;
    }

    function legalActions(opp) {
        return opp ? ["fold", "call", "3bet"] : ["fold", "raise"];
    }

    // 正解アクションと理由を返す
    function judge(hand, my, opp) {
        const rank = HAND_RANK[hand];
        const me = POS[my];
        if (!opp) {
            const thr = OPEN_THRESHOLD[rank];
            const canOpen = rank <= 7 && me.behind <= thr;
            let reason;
            if (canOpen) reason = `ランク${rank}は後ろ${thr}人以下ならオープンできます。${my}は後ろ${me.behind}人なのでレイズ。`;
            else if (rank === 9) reason = `ランク9は常にフォールドです。`;
            else if (rank === 8) reason = `ランク8はオープンしません（BBでBTNのレイズにコールする時だけ参加）。`;
            else reason = `ランク${rank}のオープンは後ろ${thr}人まで。${my}は後ろ${me.behind}人いるのでフォールド。`;
            return { action: canOpen ? "raise" : "fold", rank, oppRank: null, reason };
        }
        const o = POS[opp];
        const oppRank = openRangeRank(o.behind);
        const diff = oppRank - rank;
        const head = `${opp}（後ろ${o.behind}人）のオープンはランク${oppRank}まで。`;
        if (rank <= 1 || diff >= 2) {
            return {
                action: "3bet", rank, oppRank,
                reason: rank <= 1 ? `ランク1は常にリレイズ。` : `${head}あなたはランク${rank}で${diff}ランク強いのでリレイズ（2ランク以上強ければリレイズ）。`
            };
        }
        if (diff === 1) {
            return { action: "call", rank, oppRank, reason: `${head}あなたはランク${rank}で1ランク強いのでコール。` };
        }
        if (my === "BB" && opp === "BTN" && rank <= 8) {
            return { action: "call", rank, oppRank, reason: `BBはBTNのオープンに対してランク8までコールで守ります（特別ルール）。` };
        }
        const gap = diff === 0 ? "同じランク" : `${-diff}ランク弱い`;
        return { action: "fold", rank, oppRank, reason: `${head}あなたはランク${rank}で${gap}ため、有利さが足りずフォールド（コールには1ランク以上の強さが必要）。` };
    }

    function combos(hand) {
        if (hand.length === 2) return 6;
        return hand.endsWith('s') ? 4 : 12;
    }

    // スポット全体のアクション別コンボ割合
    function rangeSummary(my, opp) {
        const out = { raise: 0, "3bet": 0, call: 0, fold: 0 };
        ALL_HANDS.forEach(h => { out[judge(h, my, opp).action] += combos(h); });
        Object.keys(out).forEach(k => out[k] = out[k] / 1326);
        return out;
    }

    // ハンドから具体的な2枚のカードを配る
    const SUITS = ['s', 'h', 'd', 'c'];
    function dealCards(hand) {
        const r1 = hand[0], r2 = hand[1];
        const shuffled = [...SUITS].sort(() => Math.random() - 0.5);
        if (hand.length === 3 && hand[2] === 's') return [{ r: r1, s: shuffled[0] }, { r: r2, s: shuffled[0] }];
        return [{ r: r1, s: shuffled[0] }, { r: r2, s: shuffled[1] }];
    }

    // このスポットで判断が分かれる境目のランク
    function boundaryRanks(my, opp) {
        if (!opp) {
            let b = 0;
            for (let r = 7; r >= 1; r--) if (OPEN_THRESHOLD[r] >= POS[my].behind) { b = r; break; }
            return [b, b + 1].filter(r => r >= 1 && r <= 9);
        }
        const k = openRangeRank(POS[opp].behind);
        const set = [k - 2, k - 1, k].filter(r => r >= 1 && r <= 9);
        if (my === "BB" && opp === "BTN") set.push(8, 9);
        return set;
    }

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    function pickHand(mode, my, opp) {
        if (mode === "real") {
            let x = Math.random() * 1326;
            for (const h of ALL_HANDS) { x -= combos(h); if (x <= 0) return h; }
            return ALL_HANDS[ALL_HANDS.length - 1];
        }
        if (mode === "boundary") {
            const ranks = boundaryRanks(my, opp);
            const near = ALL_HANDS.filter(h => ranks.includes(HAND_RANK[h]));
            if (near.length && Math.random() < 0.8) return pick(near);
            return pick(ALL_HANDS);
        }
        // balance: 参加可能(1〜8)を70%、フォールド専用(9)を30%（フォールド連打対策）
        const playable = ALL_HANDS.filter(h => HAND_RANK[h] <= 8);
        const foldOnly = ALL_HANDS.filter(h => HAND_RANK[h] === 9);
        return Math.random() < 0.7 ? pick(playable) : pick(foldOnly);
    }

    // 設定に合う状況（自分の位置・オープンした人）をランダムに選ぶ
    function pickSpot(cfg) {
        const allowed = (cfg.positions && cfg.positions.length) ? cfg.positions : POS_NAMES;
        const openable = allowed.filter(p => cfg.situation !== "raised" && isValidSpot(p, null) && !cfg.fixedOpp);
        const facing = allowed.filter(p => cfg.situation !== "open" && POS[p].index > 0 &&
            (!cfg.fixedOpp || isValidSpot(p, cfg.fixedOpp)));
        const types = [];
        if (openable.length) types.push("open");
        if (facing.length) types.push("raised");
        if (!types.length) return null;
        const type = pick(types);
        if (type === "open") return { my: pick(openable), opp: null };
        const my = pick(facing);
        const opp = cfg.fixedOpp || pick(POS_NAMES.slice(0, POS[my].index));
        return { my, opp };
    }

    function spotMatches(cfg, my, opp) {
        const allowed = (cfg.positions && cfg.positions.length) ? cfg.positions : POS_NAMES;
        if (!allowed.includes(my)) return false;
        if (cfg.situation === "open" && opp) return false;
        if (cfg.situation === "raised" && !opp) return false;
        if (cfg.fixedOpp && opp !== cfg.fixedOpp) return false;
        return isValidSpot(my, opp);
    }

    function spotLabel(my, opp) {
        return opp ? `${my} vs ${opp}オープン` : `${my} 未レイズ`;
    }

    return { openRangeRank, isValidSpot, legalActions, judge, combos, rangeSummary, dealCards, pickHand, pickSpot, spotMatches, spotLabel, boundaryRanks };
})();
