// ===== 共通UI部品 =====
const UI = (() => {
    const $ = (s, r = document) => r.querySelector(s);
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tipAttr = html => `data-tip="${esc(html)}"`;
    const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
    const actClass = a => a === "3bet" ? "threebet" : a;
    const actLabel = a => ACTIONS[a].label;
    const pill = a => `<span class="pill ${actClass(a)}">${actLabel(a)}</span>`;
    const rankBadge = h => `<span class="rank-badge rk-${HAND_RANK[h]}">${h}</span>`;

    // ---------- ツールチップ ----------
    function initTooltip() {
        const tip = $("#tooltip");
        let current = null;
        const place = (target) => {
            const r = target.getBoundingClientRect();
            const tw = tip.offsetWidth, th = tip.offsetHeight;
            let x = r.left + r.width / 2 - tw / 2;
            let y = r.top - th - 8;
            if (y < 8) y = r.bottom + 8;
            x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
            tip.style.left = x + "px";
            tip.style.top = y + "px";
        };
        document.addEventListener("pointerover", e => {
            const t = e.target.closest("[data-tip]");
            if (t === current) return;
            current = t;
            if (!t) { tip.hidden = true; return; }
            tip.innerHTML = t.dataset.tip;
            tip.hidden = false;
            place(t);
        });
        const hide = () => { tip.hidden = true; current = null; };
        window.addEventListener("scroll", hide, { passive: true });
        document.addEventListener("pointerdown", e => { if (!e.target.closest("[data-tip]")) hide(); });
    }

    // ---------- 13×13 グリッド ----------
    // type: "action"（スポットの正解アクション） / "rank"（ヨコサワ表） / "heat"（ミス率）
    function grid(opts) {
        const { type, my, opp, highlight, heat, compact } = opts;
        let html = `<div class="grid${compact ? " compact" : ""}">`;
        ALL_HANDS.forEach(h => {
            const rank = HAND_RANK[h];
            let cls = "cell", style = "", tip = `<b>${h}</b>（ランク${rank}・${Engine.combos(h)}コンボ）`;
            if (type === "action") {
                const a = Engine.judge(h, my, opp).action;
                cls += ` act-${a}`;
                tip += `<br>正解: ${actLabel(a)}`;
            } else if (type === "rank") {
                cls += ` rk-${rank}`;
                tip += `<br>${RANK_INFO[rank].label}: ${RANK_INFO[rank].desc}`;
            } else if (type === "heat") {
                const v = heat[h];
                if (!v || !v.n) { cls += " empty"; tip += `<br>回答なし`; }
                else {
                    const err = 1 - v.ok / v.n;
                    style = `background: rgba(217, 89, 38, ${(0.12 + 0.88 * err).toFixed(2)});`;
                    tip += `<br>ミス率 ${pct(err)}（${v.n - v.ok}/${v.n}問）`;
                }
            }
            if (highlight === h) cls += " hl";
            html += `<div class="${cls}" data-hand="${h}" style="${style}" ${tipAttr(tip)}>${h}</div>`;
        });
        return html + `</div>`;
    }

    function actionLegend(my, opp) {
        const sum = Engine.rangeSummary(my, opp);
        return `<div class="legend">` + Engine.legalActions(opp).slice().reverse().map(a =>
            `<span class="legend-item"><span class="swatch" style="background: ${a === "fold" ? "#26303f" : `var(--${a === "3bet" ? "raise" : a})`}"></span>${actLabel(a)} <b>${pct(sum[a], 1)}</b></span>`
        ).join("") + `</div>`;
    }

    function rankLegend() {
        return `<div class="legend">` + Object.keys(RANK_INFO).map(r =>
            `<span class="legend-item"><span class="swatch rk-${r}"></span>ランク${r}: ${RANK_INFO[r].label}</span>`
        ).join("") + `</div>`;
    }

    // ---------- カード ----------
    const SUIT_CHAR = { s: "♠", h: "♥", d: "♦", c: "♣" };
    function cards(list) {
        return list.map(c => `<div class="pcard s-${c.s}"><span class="r">${c.r}</span><span class="s">${SUIT_CHAR[c.s]}</span></div>`).join("");
    }

    // ---------- テーブル ----------
    function table(wrap, { my, opp, cardList }) {
        const heroIdx = POS[my].index;
        const at = (k, rx, ry, extraDeg = 0) => {
            const d = (k - heroIdx + 9) % 9;
            const rad = (90 + d * 40 + extraDeg) * Math.PI / 180;
            return `left:${(50 + rx * Math.cos(rad)).toFixed(2)}%;top:${(50 + ry * Math.sin(rad)).toFixed(2)}%;`;
        };
        let pot = 1.5;
        if (opp) pot += opp === "SB" ? 2.0 : 2.5;
        let html = `<div class="felt"></div><div class="pot">ポット<br><b>${pot}BB</b></div>`;
        POSITIONS.forEach((p, k) => {
            let cls = "seat", status = "";
            if (p.name === my) { cls += " hero"; status = "あなた"; }
            else if (p.name === opp) { cls += " opener"; status = "レイズ 2.5"; }
            else if (k < heroIdx) { cls += " folded"; status = "フォールド"; }
            else status = "待機中";
            html += `<div class="${cls}" style="${at(k, 45, 44)}">${p.name}<small>${status}</small></div>`;
            if (p.name === opp) html += `<div class="chip-bet raise" style="${at(k, 29, 25)}">2.5</div>`;
            else if (p.name === "SB") html += `<div class="chip-bet" style="${at(k, 29, 25)}">0.5</div>`;
            else if (p.name === "BB") html += `<div class="chip-bet" style="${at(k, 29, 25)}">1</div>`;
            if (p.name === "BTN") html += `<div class="dealer" style="${at(k, 33, 28, 14)}">D</div>`;
        });
        html += `<div class="hero-cards">${cards(cardList)}</div>`;
        wrap.innerHTML = html;
    }

    // ---------- グラフ ----------
    // 縦棒（1系列）: items = [{label, value(0-1)|null, tip}]
    function columns(items) {
        let html = `<div class="cols">`;
        [0, 0.5, 1].forEach(v => html += `<div class="gridline" style="bottom:${v * 100}%"><span>${v * 100}%</span></div>`);
        items.forEach(it => {
            html += `<div class="col-slot" ${tipAttr(it.tip)}>` +
                (it.value == null ? `<div class="col-none"></div>` : `<div class="col-bar" style="height:${Math.max(it.value * 100, 1)}%"></div>`) +
                `</div>`;
        });
        html += `</div><div class="col-labels">${items.map(it => `<span>${it.label}</span>`).join("")}</div>`;
        return html;
    }

    // 横棒（1系列）: items = [{label, ok, n}]
    function hbars(items) {
        return `<div class="hbars">` + items.map(it => {
            if (!it.n) return `<div class="hbar empty"><span class="hbar-label">${it.label}</span><div class="hbar-track"></div><span class="hbar-val">回答なし</span></div>`;
            const acc = it.ok / it.n;
            return `<div class="hbar" ${tipAttr(`<b>${it.label}</b><br>正解率 ${pct(acc, 1)}<br>${it.ok} / ${it.n}問`)}>` +
                `<span class="hbar-label">${it.label}</span>` +
                `<div class="hbar-track"><div class="hbar-fill" style="width:${acc * 100}%"></div></div>` +
                `<span class="hbar-val">${pct(acc)} <small>${it.n}問</small></span></div>`;
        }).join("") + `</div>`;
    }

    function tile(label, value, sub = "") {
        return `<div class="tile"><div class="tile-label">${label}</div><div class="tile-value">${value}</div><div class="tile-sub">${sub}</div></div>`;
    }

    // ---------- モーダル ----------
    function modal(title, body) {
        const m = $("#modal");
        m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><div class="modal-head"><h3>${title}</h3><button class="btn btn-ghost btn-sm" data-close>✕</button></div>${body}</div>`;
        m.hidden = false;
        m.onclick = e => { if (e.target === m || e.target.closest("[data-close]")) closeModal(); };
    }
    function closeModal() { $("#modal").hidden = true; $("#modal").innerHTML = ""; }

    return { esc, tipAttr, pct, actClass, actLabel, pill, rankBadge, initTooltip, grid, actionLegend, rankLegend, cards, table, columns, hbars, tile, modal, closeModal };
})();
