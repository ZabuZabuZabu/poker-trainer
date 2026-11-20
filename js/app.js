// ===== アプリ本体（画面遷移・ドリル・レンジ表・成績・復習） =====
(() => {
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const { esc, pct, pill, rankBadge, actLabel, actClass } = UI;
    const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const fmtDate = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
    const fmtSec = ms => `${(ms / 1000).toFixed(1)}s`;

    const DEFAULTS = {
        count: 20,
        situation: "any",          // any | open | raised
        positions: [...POS_NAMES],
        handMode: "boundary",      // balance | boundary | real
        adaptive: true,
        autoNext: true,
        fourColor: true
    };
    let settings = Store.getSettings(DEFAULTS);
    let currentView = "home";

    // =========================================================
    // 画面遷移
    // =========================================================
    const NAV_OF = { home: "home", setup: "setup", drill: "setup", summary: "setup", ranges: "ranges", stats: "stats", review: "review" };
    const renderers = {};

    function go(view) {
        if (currentView === "drill" && view !== "drill") stopDrillTimers();
        currentView = view;
        $$(".view").forEach(v => v.hidden = v.id !== `view-${view}`);
        $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.nav === NAV_OF[view]));
        UI.closeModal();
        if (renderers[view]) renderers[view]();
        updateBadge();
        window.scrollTo(0, 0);
    }

    function updateBadge() {
        const n = Store.getMistakes().length;
        const b = $("#nav-mistake-badge");
        b.hidden = n === 0;
        b.textContent = n > 99 ? "99+" : n;
    }

    // =========================================================
    // 集計
    // =========================================================
    function agg(list, keyFn) {
        const out = {};
        list.forEach(a => {
            const k = keyFn(a);
            if (k == null) return;
            (out[k] = out[k] || { ok: 0, n: 0, ms: 0 });
            out[k].n++; out[k].ms += a.ms || 0;
            if (a.a === a.c) out[k].ok++;
        });
        return out;
    }
    const isOk = a => a.a === a.c;

    function weakSpots(answers, minN = 5, limit = 5) {
        const g = agg(answers, a => `${a.m}|${a.o || ""}`);
        return Object.entries(g)
            .filter(([, v]) => v.n >= minN && v.ok < v.n)
            .map(([k, v]) => { const [my, opp] = k.split("|"); return { my, opp: opp || null, ...v, acc: v.ok / v.n }; })
            .sort((a, b) => a.acc - b.acc || b.n - a.n)
            .slice(0, limit);
    }

    function weakSpotList(spots) {
        if (!spots.length) return `<div class="empty-state">まだデータが足りません。同じスポットを5問以上解くと、苦手なスポットがここに表示されます。</div>`;
        return `<div class="list">` + spots.map(s => `
            <div class="list-item">
                <div class="grow"><b>${Engine.spotLabel(s.my, s.opp)}</b><div class="meta">正解率 ${pct(s.acc)}（${s.ok}/${s.n}問）</div></div>
                <button class="btn btn-sm" data-action="practice-spot" data-my="${s.my}" data-opp="${s.opp || ""}">練習する</button>
            </div>`).join("") + `</div>`;
    }

    // =========================================================
    // ホーム
    // =========================================================
    renderers.home = () => {
        const answers = Store.getAnswers();
        const today = dayKey(Date.now());
        const todays = answers.filter(a => dayKey(a.t) === today);
        const okAll = answers.filter(isOk).length;
        const okToday = todays.filter(isOk).length;
        const meta = Store.getMeta();
        const mistakes = Store.getMistakes();
        $("#home-tiles").innerHTML =
            UI.tile("今日の回答数", todays.length, "問") +
            UI.tile("今日の正解率", todays.length ? pct(okToday / todays.length) : "-", todays.length ? `${okToday} / ${todays.length}問` : "まだ回答なし") +
            UI.tile("通算正解率", answers.length ? pct(okAll / answers.length) : "-", `${answers.length}問`) +
            UI.tile("最高連続正解", meta.bestStreak, "問") +
            UI.tile("苦手スポット", mistakes.length, "件");

        const quick = [
            { id: "quick10", t: "クイック10問", d: "今の設定で10問だけ" },
            { id: "open", t: "オープン判断", d: "全員フォールドで回ってきた時のレイズ／フォールド" },
            { id: "raised", t: "vs オープン", d: "前にレイズがある時のリレイズ／コール／フォールド" },
            { id: "bb", t: "BB防衛", d: "BBでのオープンへの対応（BTNへの特別ルールを含む）" },
            { id: "endless", t: "エンドレス", d: "やめるまで出題し続けます" },
            { id: "mistakes", t: `苦手克服（${mistakes.length}件）`, d: "間違えたスポットだけを出題。正解すると一覧から消えます" }
        ];
        $("#home-quick").innerHTML = quick.map(q => `<button class="quick" data-action="quick" data-id="${q.id}"><b>${q.t}</b><span>${q.d}</span></button>`).join("");
        $("#home-weak").innerHTML = weakSpotList(weakSpots(answers, 5, 3));
    };

    function quickStart(id) {
        const base = { ...settings, fixedOpp: null };
        if (id === "quick10") return startDrill({ ...base, count: 10 });
        if (id === "open") return startDrill({ ...base, situation: "open", positions: [...POS_NAMES], count: 20 });
        if (id === "raised") return startDrill({ ...base, situation: "raised", positions: [...POS_NAMES], count: 20 });
        if (id === "bb") return startDrill({ ...base, situation: "raised", positions: ["BB"], count: 20 });
        if (id === "endless") return startDrill({ ...base, count: 0 });
        if (id === "mistakes") return startMistakeDrill(Store.getMistakes());
    }

    // =========================================================
    // ドリル設定
    // =========================================================
    renderers.setup = () => {
        const s = settings;
        const chip = (group, value, label, on) => `<button class="chip${on ? " on" : ""}" data-action="set" data-group="${group}" data-value="${value}">${label}</button>`;
        const sw = (key, label, help) => `<label class="switch"><div><div class="field-label" style="margin:0">${label}</div><div class="field-help" style="margin:0">${help}</div></div><input type="checkbox" data-action="toggle" data-key="${key}" ${s[key] ? "checked" : ""}><span class="track"></span></label>`;
        const handHelp = {
            balance: "参加できるハンド70%・フォールド専用ハンド30%で出題します（従来の出題方法）。",
            boundary: "そのスポットで判断が分かれる境目のランクを80%の確率で出題します。効率よく弱点を潰せます。",
            real: "実際に配られる確率どおりに出題します（オフスートが多く、ペアは少なめ）。"
        };
        const allOn = s.positions.length === POS_NAMES.length;
        $("#setup-form").innerHTML = `
            <div>
                <div class="field-label">問題数</div>
                <div class="chips">${[10, 20, 50, 100].map(n => chip("count", n, `${n}問`, s.count === n)).join("")}${chip("count", 0, "エンドレス", s.count === 0)}</div>
            </div>
            <div>
                <div class="field-label">状況</div>
                <div class="chips">${chip("situation", "any", "ランダム", s.situation === "any")}${chip("situation", "open", "未レイズ（オープン判断）", s.situation === "open")}${chip("situation", "raised", "前にレイズあり", s.situation === "raised")}</div>
            </div>
            <div>
                <div class="field-label">自分のポジション</div>
                <div class="chips">${chip("pos-all", "all", "すべて", allOn)}${POS_NAMES.map(p => chip("pos", p, p, s.positions.includes(p))).join("")}</div>
            </div>
            <div>
                <div class="field-label">出題するハンド</div>
                <div class="chips">${chip("handMode", "boundary", "境目を重視（おすすめ）", s.handMode === "boundary")}${chip("handMode", "balance", "バランス", s.handMode === "balance")}${chip("handMode", "real", "実際の配牌確率", s.handMode === "real")}</div>
                <div class="field-help">${handHelp[s.handMode]}</div>
            </div>
            ${sw("adaptive", "苦手スポットを多めに出題", "間違えたことのあるスポットを約30%の確率で出題します。正解すると苦手一覧から消えます。")}
            ${sw("autoNext", "正解したら自動で次へ", "不正解のときは解説を読めるよう止まります。")}
            ${sw("fourColor", "4色デッキ", "♦を青、♣を緑で表示してスートを見分けやすくします。")}
        `;
        validateSetup();
    };

    function validateSetup() {
        const err = $("#setup-error");
        const ok = !!Engine.pickSpot(settings);
        err.hidden = ok;
        if (!ok) err.textContent = settings.positions.length ? "この組み合わせでは問題を作れません（UTGには前にレイズする人がいない／BBは未レイズで回ってこない）。" : "ポジションを1つ以上選んでください。";
        $('[data-action="start-drill"]').disabled = !ok;
    }

    function setSetting(group, value) {
        if (group === "count") settings.count = Number(value);
        else if (group === "situation") settings.situation = value;
        else if (group === "handMode") settings.handMode = value;
        else if (group === "pos-all") settings.positions = settings.positions.length === POS_NAMES.length ? [] : [...POS_NAMES];
        else if (group === "pos") {
            const set = new Set(settings.positions);
            set.has(value) ? set.delete(value) : set.add(value);
            settings.positions = POS_NAMES.filter(p => set.has(p));
        }
        Store.saveSettings(settings);
        renderers.setup();
    }

    // =========================================================
    // ドリル
    // =========================================================
    let S = null; // 実行中のセッション

    function startDrill(cfg, pool = null) {
        if (!pool && !Engine.pickSpot(cfg)) { go("setup"); return; }
        S = {
            cfg, pool,
            total: pool ? pool.length : cfg.count,
            n: 0, ok: 0, streak: 0, best: 0, totalMs: 0,
            wrong: [], q: null, answered: false, t0: 0, timer: null, autoTimer: null, lastKey: null
        };
        document.body.classList.toggle("two-color", !cfg.fourColor);
        go("drill");
        nextQuestion();
    }

    function startMistakeDrill(list) {
        if (!list.length) { UI.modal("苦手克服", `<p class="muted">苦手スポットはありません。ドリルで間違えた問題がここに溜まります。</p>`); return; }
        const pool = shuffle(list).map(m => ({ hand: m.hand, my: m.my, opp: m.opp || null }));
        startDrill({ ...settings, fixedOpp: null, adaptive: false }, pool);
    }

    function stopDrillTimers() {
        if (!S) return;
        clearInterval(S.timer); clearTimeout(S.autoTimer);
    }

    function makeQuestion() {
        const cfg = S.cfg;
        if (S.pool) return { ...S.pool[S.n], fromMistake: true };
        if (cfg.adaptive && Math.random() < 0.3) {
            const cands = Store.getMistakes().filter(m => Engine.spotMatches(cfg, m.my, m.opp || null) && m.key !== S.lastKey);
            if (cands.length) {
                const m = cands[Math.floor(Math.random() * cands.length)];
                return { hand: m.hand, my: m.my, opp: m.opp || null, fromMistake: true };
            }
        }
        for (let i = 0; i < 6; i++) {
            const spot = Engine.pickSpot(cfg);
            const hand = Engine.pickHand(cfg.handMode, spot.my, spot.opp);
            const q = { hand, ...spot, fromMistake: false };
            if (Store.spotKey(hand, spot.my, spot.opp) !== S.lastKey) return q;
        }
        const spot = Engine.pickSpot(cfg);
        return { hand: Engine.pickHand(cfg.handMode, spot.my, spot.opp), ...spot, fromMistake: false };
    }

    function nextQuestion() {
        stopDrillTimers();
        if (S.total && S.n >= S.total) return finishDrill();
        const q = makeQuestion();
        q.result = Engine.judge(q.hand, q.my, q.opp);
        q.cards = Engine.dealCards(q.hand);
        q.key = Store.spotKey(q.hand, q.my, q.opp);
        S.q = q; S.answered = false; S.lastKey = q.key;

        UI.table($(".table-wrap"), { my: q.my, opp: q.opp, cardList: q.cards });
        $("#drill-spot").innerHTML = q.opp
            ? `<b>${q.opp}</b> が 2.5BB にオープン → あなたは <b>${q.my}</b>`
            : `全員フォールドで <b>${q.my}</b> のあなたに回ってきました`;
        $("#drill-spot").innerHTML += `<span class="hand-name">${q.hand}</span>`;

        const legal = Engine.legalActions(q.opp);
        $("#drill-actions").innerHTML = legal.map((a, i) =>
            `<button class="act-btn ${actClass(a)}" data-action="answer" data-act="${a}">${actLabel(a)}<kbd>${ACTIONS[a].key}/${i + 1}</kbd></button>`).join("");

        $("#drill-feedback").classList.add("waiting");
        $("#drill-feedback").innerHTML = `
            <div class="fb-empty">
                <div style="font-size:18px; font-weight:700; color:var(--text)">アクションを選んでください</div>
                <div class="keys hide-touch">
                    <div><kbd>F</kbd> フォールド　<kbd>C</kbd> コール　<kbd>R</kbd> レイズ／リレイズ</div>
                    <div><kbd>1</kbd>〜<kbd>3</kbd> 左からボタンを選択</div>
                    <div><kbd>Enter</kbd> 次の問題　<kbd>Esc</kbd> 終了</div>
                </div>
            </div>`;

        updateDrillHeader();
        S.t0 = performance.now();
        const timerEl = $("#drill-timer");
        timerEl.textContent = "0.0s";
        S.timer = setInterval(() => { timerEl.textContent = fmtSec(performance.now() - S.t0); }, 100);
    }

    function updateDrillHeader() {
        const shown = Math.min(S.n + (S.answered ? 0 : 1), S.total || Infinity);
        const label = S.pool ? "苦手克服" : (S.total ? "" : "エンドレス");
        $("#drill-progress-text").textContent = S.total ? `${label ? label + " " : ""}${shown} / ${S.total}問` : `${label} ${S.n}問回答`;
        $("#drill-progress-bar").style.width = S.total ? `${(S.n / S.total) * 100}%` : "100%";
        $("#drill-acc").textContent = S.n ? pct(S.ok / S.n) : "-";
        $("#drill-streak").textContent = S.streak;
    }

    function answer(act) {
        if (!S || S.answered) return;
        const q = S.q;
        const ms = Math.round(performance.now() - S.t0);
        clearInterval(S.timer);
        $("#drill-timer").textContent = fmtSec(ms);
        S.answered = true;
        const correct = q.result.action;
        const ok = act === correct;
        S.n++; S.totalMs += ms;
        if (ok) { S.ok++; S.streak++; S.best = Math.max(S.best, S.streak); }
        else { S.streak = 0; S.wrong.push({ ...q, picked: act }); }

        Store.addAnswer({ t: Date.now(), h: q.hand, m: q.my, o: q.opp || "", a: act, c: correct, ms });
        const meta = Store.getMeta();
        if (S.streak > meta.bestStreak) { meta.bestStreak = S.streak; Store.saveMeta(meta); }
        if (!ok) Store.recordMistake(q.hand, q.my, q.opp);
        else if (q.fromMistake) Store.removeMistake(q.key);
        updateBadge();

        $$("#drill-actions .act-btn").forEach(b => {
            b.disabled = true;
            if (b.dataset.act === act) b.classList.add("picked");
            if (b.dataset.act === correct) b.classList.add("answer");
        });

        const last = S.total && S.n >= S.total;
        const r = q.result;
        $("#drill-feedback").innerHTML = `
            <div class="verdict ${ok ? "ok" : "ng"}">
                <div class="verdict-icon">${ok ? "✓" : "✕"}</div>
                <div>
                    <div class="verdict-title">${ok ? "正解" : "不正解"}</div>
                    <div class="verdict-sub">${ok ? `${actLabel(correct)}・${fmtSec(ms)}` : `あなた: ${actLabel(act)} → 正解: ${actLabel(correct)}`}</div>
                </div>
            </div>
            <div class="reason">${rankBadge(q.hand)} はランク${r.rank}（${RANK_INFO[r.rank].label}）<br>${esc(r.reason)}</div>
            <div class="fb-grid-title"><span>${Engine.spotLabel(q.my, q.opp)} の正解レンジ</span><span>□ = ${q.hand}</span></div>
            ${UI.grid({ type: "action", my: q.my, opp: q.opp, highlight: q.hand, compact: true })}
            ${UI.actionLegend(q.my, q.opp)}
            <button class="btn btn-primary next-btn" data-action="next">${last ? "結果を見る" : "次の問題へ"} <kbd class="hide-touch">Enter</kbd></button>
        `;
        updateDrillHeader();
        const fb = $("#drill-feedback");
        fb.classList.remove("waiting");
        // スマホなどで解説が画面外にあるときはスクロールして見せる（自動で次へ進む正解時は除く）
        if (!(ok && S.cfg.autoNext) && fb.getBoundingClientRect().top > window.innerHeight * 0.6) {
            fb.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        if (ok && S.cfg.autoNext) S.autoTimer = setTimeout(() => { if (currentView === "drill") nextQuestion(); }, 900);
    }

    function finishDrill() {
        stopDrillTimers();
        if (!S || S.n === 0) { S = null; go("home"); return; }
        go("summary");
    }

    // =========================================================
    // ドリル結果
    // =========================================================
    renderers.summary = () => {
        if (!S) return;
        $("#summary-tiles").innerHTML =
            UI.tile("正解率", pct(S.ok / S.n), `${S.ok} / ${S.n}問`) +
            UI.tile("平均回答時間", fmtSec(S.totalMs / S.n), "1問あたり") +
            UI.tile("最大連続正解", S.best, "問") +
            UI.tile("ミス", S.wrong.length, "問");
        $("#summary-actions").innerHTML = `
            <button class="btn btn-primary" data-action="retry">もう一度（同じ設定）</button>
            ${S.wrong.length ? `<button class="btn" data-action="retry-wrong">間違えた${S.wrong.length}問に再挑戦</button>` : ""}
            <button class="btn" data-nav="setup">設定を変える</button>
            <button class="btn btn-ghost" data-nav="home">ホームへ</button>`;
        $("#summary-mistakes").innerHTML = S.wrong.length
            ? `<h2 class="section-title">間違えた問題</h2>` + mistakeRows(S.wrong.map(w => ({ hand: w.hand, my: w.my, opp: w.opp, picked: w.picked })), false)
            : `<div class="empty-state" style="color:var(--ok); font-weight:700">✓ パーフェクト！全問正解です。</div>`;
    };

    function mistakeRows(list, withDelete) {
        return `<div class="list">` + list.map(m => {
            const r = Engine.judge(m.hand, m.my, m.opp || null);
            const metaParts = [];
            if (m.picked) metaParts.push(`あなた: ${actLabel(m.picked)}`);
            if (m.count) metaParts.push(`ミス ${m.count}回`);
            if (m.last) metaParts.push(`最終 ${fmtDate(m.last)}`);
            return `<div class="list-item">
                ${rankBadge(m.hand)}
                <div class="grow"><b>${Engine.spotLabel(m.my, m.opp || null)}</b><div class="meta">${metaParts.join("・")}</div></div>
                ${pill(r.action)}
                <button class="btn btn-sm btn-ghost" data-action="show-spot" data-hand="${m.hand}" data-my="${m.my}" data-opp="${m.opp || ""}">解説</button>
                ${withDelete ? `<button class="btn btn-sm btn-ghost btn-danger" data-action="del-mistake" data-key="${esc(m.key)}" title="削除">✕</button>` : ""}
            </div>`;
        }).join("") + `</div>`;
    }

    function showSpotModal(hand, my, opp) {
        const r = Engine.judge(hand, my, opp);
        UI.modal(`${hand}・${Engine.spotLabel(my, opp)}`, `
            <div class="reason">${rankBadge(hand)} はランク${r.rank}（${RANK_INFO[r.rank].label}）→ 正解は ${pill(r.action)}<br>${esc(r.reason)}</div>
            ${UI.grid({ type: "action", my, opp, highlight: hand, compact: true })}
            ${UI.actionLegend(my, opp)}`);
    }

    // =========================================================
    // レンジ表
    // =========================================================
    const RV = { my: "BTN", opp: null, view: "action", hand: null, showImg: false };
    // 元のレンジ表画像は公開版には含めないので、存在するときだけボタンを出す
    let hasRangeImage = false;
    const probe = new Image();
    probe.onload = () => { hasRangeImage = true; if (currentView === "ranges") renderRangeDetail(); };
    probe.src = "range_table.jpg";

    renderers.ranges = () => {
        if (!Engine.isValidSpot(RV.my, RV.opp)) RV.opp = RV.my === "BB" ? "BTN" : null;
        const myIdx = POS[RV.my].index;
        const posChips = POS_NAMES.map(p => `<button class="chip${p === RV.my ? " on" : ""}" data-action="rv" data-k="my" data-v="${p}">${p}</button>`).join("");
        const oppChips = POS_NAMES.slice(0, myIdx).map(p => `<button class="chip${p === RV.opp ? " on" : ""}" data-action="rv" data-k="opp" data-v="${p}">${p}</button>`).join("");
        $("#range-controls").innerHTML = `
            <div class="ctrl-row"><div class="field-label">自分のポジション</div><div class="chips">${posChips}</div></div>
            <div class="ctrl-row" style="display:flex; gap:16px; flex-wrap:wrap">
                <div><div class="field-label">状況</div><div class="seg">
                    <button class="${!RV.opp ? "on" : ""}" data-action="rv" data-k="sit" data-v="open" ${RV.my === "BB" ? "disabled" : ""}>未レイズ</button>
                    <button class="${RV.opp ? "on" : ""}" data-action="rv" data-k="sit" data-v="raised" ${myIdx === 0 ? "disabled" : ""}>レイズあり</button>
                </div></div>
                <div><div class="field-label">表示</div><div class="seg">
                    <button class="${RV.view === "action" ? "on" : ""}" data-action="rv" data-k="view" data-v="action">正解アクション</button>
                    <button class="${RV.view === "rank" ? "on" : ""}" data-action="rv" data-k="view" data-v="rank">ランク表</button>
                </div></div>
            </div>
            ${RV.opp ? `<div class="ctrl-row"><div class="field-label">オープンした人</div><div class="chips">${oppChips}</div></div>` : ""}`;
        $("#range-grid").innerHTML = UI.grid({ type: RV.view, my: RV.my, opp: RV.opp, highlight: RV.hand });
        $("#range-legend").innerHTML = RV.view === "action" ? UI.actionLegend(RV.my, RV.opp) : UI.rankLegend();
        renderRangeDetail();
    };

    function renderRangeDetail() {
        const { my, opp, hand } = RV;
        let html = `<h3 style="margin-bottom:8px">${Engine.spotLabel(my, opp)}</h3>`;
        if (!opp) {
            const b = Engine.boundaryRanks(my, null)[0];
            html += `<p class="muted small">${my}は後ろ${POS[my].behind}人。ランク${b}までオープンします。</p>`;
        } else {
            const k = Engine.openRangeRank(POS[opp].behind);
            html += `<p class="muted small">${opp}（後ろ${POS[opp].behind}人）のオープンはランク${k}まで。<br>` +
                `ランク${Math.max(1, k - 2)}以上（ランク1は常に）→ リレイズ<br>ランク${k - 1} → コール<br>それ以外 → フォールド` +
                (my === "BB" && opp === "BTN" ? `<br><b style="color:var(--text)">特別ルール:</b> BB vs BTN はランク8までコール` : "") + `</p>`;
        }
        if (hand) {
            const r = Engine.judge(hand, my, opp);
            html += `<hr style="border:none; border-top:1px solid var(--border); margin:16px 0">
                <div class="detail-hand">${hand}</div>
                <dl class="kv">
                    <dt>ランク</dt><dd>${rankBadge(hand)} ランク${r.rank}（${RANK_INFO[r.rank].label}）</dd>
                    <dt>コンボ数</dt><dd>${Engine.combos(hand)}通り</dd>
                    <dt>正解</dt><dd>${pill(r.action)}</dd>
                </dl>
                <div class="reason">${esc(r.reason)}</div>`;
        } else {
            html += `<p class="muted small" style="margin-top:12px">マスをタップするとハンドの詳細が表示されます。</p>`;
        }
        html += `<div style="display:grid; gap:8px; margin-top:16px">
            <button class="btn btn-primary" data-action="practice-spot" data-my="${my}" data-opp="${opp || ""}">このスポットでドリル</button>
            ${hasRangeImage ? `<button class="btn" data-action="toggle-img">${RV.showImg ? "元のレンジ表画像を閉じる" : "元のレンジ表画像を見る"}</button>` : ""}
        </div>
        ${hasRangeImage && RV.showImg ? `<img class="range-img" src="range_table.jpg" alt="ヨコサワ流レンジ表">` : ""}`;
        $("#range-detail").innerHTML = html;
    }

    function rvSet(k, v) {
        if (k === "my") {
            RV.my = v;
            if (RV.opp && !Engine.isValidSpot(v, RV.opp)) RV.opp = POS[v].index > 0 ? POS_NAMES[POS[v].index - 1] : null;
        } else if (k === "sit") {
            RV.opp = v === "open" ? null : (RV.my === "BB" ? "BTN" : POS_NAMES[POS[RV.my].index - 1]);
        } else if (k === "opp") RV.opp = v;
        else if (k === "view") RV.view = v;
        renderers.ranges();
    }

    // =========================================================
    // 成績
    // =========================================================
    let statsPeriod = 30;

    renderers.stats = () => {
        $("#stats-filter").innerHTML = [[7, "7日間"], [30, "30日間"], [0, "全期間"]].map(([d, l]) =>
            `<button class="chip${statsPeriod === d ? " on" : ""}" data-action="period" data-v="${d}">${l}</button>`).join("");
        const all = Store.getAnswers();
        const since = statsPeriod ? Date.now() - statsPeriod * 86400000 : 0;
        const list = all.filter(a => a.t >= since);
        const body = $("#stats-body");
        if (!list.length) {
            body.innerHTML = `<div class="empty-state">この期間の回答はまだありません。ドリルを解くと、ここに成績と弱点の分析が表示されます。<br><br><button class="btn btn-primary" data-nav="setup">ドリルを始める</button></div>`;
            return;
        }
        const ok = list.filter(isOk).length;
        const avgMs = list.reduce((s, a) => s + (a.ms || 0), 0) / list.length;

        // 日別
        const days = statsPeriod || 30;
        const byDay = agg(list, a => dayKey(a.t));
        const dayItems = [];
        for (let i = days - 1; i >= 0; i--) {
            const t = Date.now() - i * 86400000;
            const v = byDay[dayKey(t)];
            const step = days > 14 ? 5 : 1;
            dayItems.push({
                label: (i % step === 0) ? fmtDate(t) : "",
                value: v ? v.ok / v.n : null,
                tip: v ? `<b>${fmtDate(t)}</b><br>正解率 ${pct(v.ok / v.n, 1)}<br>${v.ok} / ${v.n}問` : `<b>${fmtDate(t)}</b><br>回答なし`
            });
        }

        const byPos = agg(list, a => a.m);
        const bySit = agg(list, a => a.o ? "raised" : "open");
        const byAct = agg(list, a => a.c);
        const byRank = agg(list, a => HAND_RANK[a.h]);
        const byHand = agg(list, a => a.h);
        const row = (map, k, label) => ({ label, ok: map[k] ? map[k].ok : 0, n: map[k] ? map[k].n : 0 });

        body.innerHTML = `
            <div class="tiles">
                ${UI.tile("回答数", list.length, "問")}
                ${UI.tile("正解率", pct(ok / list.length), `${ok} / ${list.length}問`)}
                ${UI.tile("平均回答時間", fmtSec(avgMs), "1問あたり")}
                ${UI.tile("最高連続正解", Store.getMeta().bestStreak, "全期間")}
            </div>
            <div class="stats-grid">
                <div class="card wide">
                    <div class="chart-title">日別の正解率</div>
                    <div class="chart-sub">直近${days}日間。棒にカーソルを合わせると問題数が表示されます</div>
                    ${UI.columns(dayItems)}
                </div>
                <div class="card">
                    <div class="chart-title">ポジション別の正解率</div>
                    <div class="chart-sub">自分のポジションごと</div>
                    ${UI.hbars(POS_NAMES.map(p => row(byPos, p, p)))}
                </div>
                <div class="card">
                    <div class="chart-title">状況・正解アクション別の正解率</div>
                    <div class="chart-sub">どんな判断を間違えやすいか</div>
                    ${UI.hbars([row(bySit, "open", "未レイズ"), row(bySit, "raised", "vs オープン")])}
                    <div style="height:14px"></div>
                    ${UI.hbars(["raise", "3bet", "call", "fold"].map(a => row(byAct, a, `正解${actLabel(a)}`)))}
                </div>
                <div class="card">
                    <div class="chart-title">ランク別の正解率</div>
                    <div class="chart-sub">ハンドのランク（1が最強）ごと</div>
                    ${UI.hbars([1, 2, 3, 4, 5, 6, 7, 8, 9].map(r => row(byRank, r, `ランク${r}`)))}
                </div>
                <div class="card">
                    <div class="chart-title">苦手なスポット</div>
                    <div class="chart-sub">5問以上解いたスポットのうち、正解率が低い順</div>
                    ${weakSpotList(weakSpots(list, 5, 6))}
                </div>
                <div class="card wide">
                    <div class="chart-title">ハンド別のミス率</div>
                    <div class="chart-sub">色が濃いほどミスが多いハンド。グレーは回答なし。マスをタップすると、そのハンドを含むミスを確認できます</div>
                    <div style="max-width:620px">${UI.grid({ type: "heat", heat: byHand, compact: true })}</div>
                    <div class="legend"><span class="legend-item"><span class="swatch" style="background:rgba(217,89,38,.12)"></span>ミス少</span><span class="legend-item"><span class="swatch" style="background:rgba(217,89,38,1)"></span>ミス多</span><span class="legend-item"><span class="swatch" style="background:var(--surface-2)"></span>回答なし</span></div>
                </div>
            </div>
            <div class="row-actions" style="justify-content:flex-end">
                <button class="btn btn-ghost btn-danger btn-sm" data-action="reset-stats">成績をリセット</button>
            </div>`;
    };

    function showHandMistakes(hand) {
        const since = statsPeriod ? Date.now() - statsPeriod * 86400000 : 0;
        const list = Store.getAnswers().filter(a => a.t >= since && a.h === hand);
        if (!list.length) return;
        const g = agg(list, a => `${a.m}|${a.o || ""}`);
        const rows = Object.entries(g).map(([k, v]) => { const [my, opp] = k.split("|"); return { my, opp: opp || null, ...v }; })
            .sort((a, b) => (a.ok / a.n) - (b.ok / b.n));
        UI.modal(`${hand} のスポット別成績`, `<div class="list">` + rows.map(r => `
            <div class="list-item">
                <div class="grow"><b>${Engine.spotLabel(r.my, r.opp)}</b><div class="meta">正解率 ${pct(r.ok / r.n)}（${r.ok}/${r.n}問）</div></div>
                ${pill(Engine.judge(hand, r.my, r.opp).action)}
                <button class="btn btn-sm btn-ghost" data-action="show-spot" data-hand="${hand}" data-my="${r.my}" data-opp="${r.opp || ""}">解説</button>
            </div>`).join("") + `</div>`);
    }

    // =========================================================
    // 復習
    // =========================================================
    renderers.review = () => {
        const list = Store.getMistakes();
        const body = $("#review-body");
        if (!list.length) {
            body.innerHTML = `<div class="empty-state">苦手スポットはありません。<br>ドリルで間違えた問題がここに溜まり、復習で正解すると消えていきます。</div>`;
            return;
        }
        body.innerHTML = `
            <p class="muted" style="margin-bottom:14px">間違えた ${list.length} 件のスポットです。苦手克服ドリルで正解すると一覧から消えます。</p>
            <div class="row-actions" style="margin-top:0">
                <button class="btn btn-primary" data-action="quick" data-id="mistakes">苦手克服ドリル（${list.length}問）</button>
                <button class="btn btn-ghost btn-danger" data-action="clear-mistakes">すべて削除</button>
            </div>
            ${mistakeRows(list, true)}`;
    };

    // =========================================================
    // イベント
    // =========================================================
    document.addEventListener("click", e => {
        const nav = e.target.closest("[data-nav]");
        if (nav) {
            if (nav.dataset.nav === "setup" && currentView === "drill" && S && S.n > 0) { finishDrill(); return; }
            go(nav.dataset.nav);
            return;
        }
        const cell = e.target.closest(".cell[data-hand]");
        if (cell && currentView === "ranges" && cell.closest("#range-grid")) { RV.hand = RV.hand === cell.dataset.hand ? null : cell.dataset.hand; renderers.ranges(); return; }
        if (cell && currentView === "stats" && cell.closest("#stats-body")) { showHandMistakes(cell.dataset.hand); return; }

        const el = e.target.closest("[data-action]");
        if (!el) return;
        const d = el.dataset;
        switch (d.action) {
            case "quick-start": startDrill({ ...settings, fixedOpp: null }); break;
            case "quick": quickStart(d.id); break;
            case "set": setSetting(d.group, d.value); break;
            case "start-drill": startDrill({ ...settings, fixedOpp: null }); break;
            case "answer": answer(d.act); break;
            case "next": nextQuestion(); break;
            case "quit-drill": finishDrill(); break;
            case "retry": startDrill(S.cfg, S.pool ? shuffle(S.pool) : null); break;
            case "retry-wrong": startDrill({ ...S.cfg, adaptive: false }, shuffle(S.wrong.map(w => ({ hand: w.hand, my: w.my, opp: w.opp })))); break;
            case "show-spot": showSpotModal(d.hand, d.my, d.opp || null); break;
            case "practice-spot": startDrill({ ...settings, count: 20, positions: [d.my], situation: d.opp ? "raised" : "open", fixedOpp: d.opp || null, handMode: "boundary" }); break;
            case "rv": rvSet(d.k, d.v); break;
            case "toggle-img": RV.showImg = !RV.showImg; renderRangeDetail(); break;
            case "period": statsPeriod = Number(d.v); renderers.stats(); break;
            case "reset-stats":
                if (confirm("回答ログと最高連続正解をすべて削除します。よろしいですか？（苦手スポットは残ります）")) { Store.clearAnswers(); renderers.stats(); }
                break;
            case "del-mistake": Store.removeMistake(d.key); renderers.review(); updateBadge(); break;
            case "clear-mistakes":
                if (confirm("苦手スポットをすべて削除しますか？")) { Store.clearMistakes(); renderers.review(); updateBadge(); }
                break;
        }
    });

    document.addEventListener("change", e => {
        const t = e.target;
        if (t.dataset.action === "toggle") {
            settings[t.dataset.key] = t.checked;
            Store.saveSettings(settings);
        }
    });

    document.addEventListener("keydown", e => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === "Escape" && !$("#modal").hidden) { UI.closeModal(); return; }
        if (currentView === "home" && e.key === "Enter" && !e.target.closest("button")) { startDrill({ ...settings, fixedOpp: null }); return; }
        if (currentView !== "drill" || !S) return;
        const k = e.key.toLowerCase();
        if (e.key === "Escape") { finishDrill(); return; }
        if (S.answered) {
            if (k === "enter" || k === " ") { e.preventDefault(); nextQuestion(); }
            return;
        }
        const legal = Engine.legalActions(S.q.opp);
        let act = null;
        if (k === "f") act = "fold";
        else if (k === "c" && legal.includes("call")) act = "call";
        else if (k === "r") act = S.q.opp ? "3bet" : "raise";
        else if (/^[1-9]$/.test(k) && legal[Number(k) - 1]) act = legal[Number(k) - 1];
        if (act) { e.preventDefault(); answer(act); }
    });

    $(".brand").addEventListener("keydown", e => { if (e.key === "Enter") go("home"); });

    // =========================================================
    // 起動
    // =========================================================
    Store.migrate();
    UI.initTooltip();
    go("home");

    // オフライン対応（http/https で配信したときのみ有効）
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        navigator.serviceWorker.register("sw.js").catch(() => { });
    }
})();
