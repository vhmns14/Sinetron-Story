// Headless balance simulation: a simple bot plays the game (pure sim, no browser).
// usage: node .balance.mjs [smart|dumb|casual] [years] [runs]
//   runs = 1 prints the full log of one game; runs > 1 prints aggregate stats.
//   smart: good combos, careful spending, buys money sinks (equipment, studio Lv4/5, star contracts, kampanye), plays twists sparingly
//   dumb: random combos, overspends (max staff, mewah budget, pricey locations & OST, spams twists, endless sequels)
//   casual: random-ish combos and budgets, moderate spending, never treats tired staff
import { Sim, franchiseBonus } from '../src/sim';
import { newGame, dateOf, fmtShort, isSeleb, type Pending, type GameState, type Show } from '../src/state';
import { GENRES, THEMES, PLATFORMS, compat, STUDIOS, sequelTitle, spinoffTitle } from '../src/data';
import { LOCATIONS, locCost, locMatches } from '../src/locations';
import { EQUIPMENT } from '../src/economy';
import { SINGERS, singerFee, singerFits } from '../src/ost';
import * as v5 from '../src/v5';
import { ACHIEVEMENTS } from '../src/achievements';

const mode = process.argv[2] ?? 'smart';
const smart = mode === 'smart';
const casual = mode === 'casual';
const dumb = mode === 'dumb';
const years = Number(process.argv[3] ?? 6);
const runs = Number(process.argv[4] ?? 1);
void franchiseBonus; void sequelTitle;

interface Stats {
  moneyByYear: number[]; fansByYear: number[]; costsByYear: number[]; cancels: number; warns: number; tops: number; shows: number; gameOver: boolean; gameOverYear: number;
  promos: number; camps: number; exts: number; locShoots: number; locCombos: number; dibajak: number; left: number; selebs: number; stars: number;
  ranks: number[]; hof: number; endorse: number; byBucket: Record<string, [number, number]>;
  minMoney: number; debtMonths: number; sinks: number; sinkByKind: Record<string, number>; studioEnd: number; equip: number; platEnd: number;
  twists: number; muakShows: number; osts: number; ostHits: number; ostViral: number; ramadanSlots: number; spinoffs: number; maxPart: number;
  nasionalWeek: number; streamWeek: number; maxIdle: number; profitLoss: number;
  // v5
  gossips: number; goreng: number; boikots: number; kpiWarns: number; kpiSanctions: number; slotMoves: number; fines: number; sowans: number;
  placements: number; plPenShows: number; castings: number; mogok: number; achv: number; ending: boolean; kpiMax: number;
}

const SINK_CATS = ['Renovasi studio', 'Peralatan', 'Kontrak bintang', 'Promo & kampanye', 'Lokasi syuting', 'OST'];
const bucket = (t: number) => (t < 24 ? '<24' : t < 32 ? '24-31' : '32+');

function run(verbose: boolean): Stats {
  const s: GameState = newGame();
  const sim = new Sim(s);
  const log: string[] = [];
  const st: Stats = {
    moneyByYear: [], fansByYear: [], costsByYear: [], cancels: 0, warns: 0, tops: 0, shows: 0, gameOver: false, gameOverYear: 0, promos: 0, camps: 0, exts: 0, locShoots: 0, locCombos: 0,
    dibajak: 0, left: 0, selebs: 0, stars: 0, ranks: [], hof: 0, endorse: 0, byBucket: { '<24': [0, 0], '24-31': [0, 0], '32+': [0, 0] },
    minMoney: Infinity, debtMonths: 0, sinks: 0, sinkByKind: {}, studioEnd: 1, equip: 0, platEnd: 1, twists: 0, muakShows: 0, osts: 0, ostHits: 0, ostViral: 0,
    ramadanSlots: 0, spinoffs: 0, maxPart: 1, nasionalWeek: -1, streamWeek: -1, maxIdle: 0, profitLoss: 0,
    gossips: 0, goreng: 0, boikots: 0, kpiWarns: 0, kpiSanctions: 0, slotMoves: 0, fines: 0, sowans: 0, placements: 0, plPenShows: 0, castings: 0, mogok: 0, achv: 0, ending: false, kpiMax: 0,
  };
  let lastStart = 0;
  const spend: Record<string, number> = {};
  const trackLedger = () => {
    for (const [k, v] of Object.entries(s.ledger.spend)) spend[`${s.ledger.year}|${k}`] = v;
  };

  function pickCombo(): { genre: string; theme: string } {
    let best = { genre: s.unlockedGenres[0], theme: s.unlockedThemes[0] }, bv = -99;
    for (const g of s.unlockedGenres) for (const t of s.unlockedThemes) {
      const last = s.shows[s.shows.length - 1];
      if (last && last.genre === g && last.theme === t && !casual && !dumb) continue;
      const known = s.knownCombos[g + '|' + t];
      let v = Math.random();
      if (smart) {
        const c = known ?? (Math.random() < 0.25 ? compat(g, t) : 'ok');
        v += c === 'great' ? 3 : c === 'good' ? 2 : c === 'bad' ? -2 : 0;
        if (s.trend === g) v += 0.5;
        if (sim.weeksToRamadan() < 16 && ['religi', 'keluarga'].includes(g)) v += 0.8;
      }
      // casual players read the wizard: avoid combos already known to be weird
      if (casual && (known === 'bad' || (known && Math.random() < 0.3 && known === 'great'))) v += known === 'bad' ? -2 : 0.6;
      if (v > bv) { bv = v; best = { genre: g, theme: t }; }
    }
    return best;
  }

  function handle(p: Pending) {
    switch (p.kind) {
      case 'editDone': {
        const pr = s.prod!;
        if (pr.bloopers > 3 && s.money > 0) sim.extendEditing(); else sim.release();
        break;
      }
      case 'event': {
        let choice = 0;
        if (p.eventId === 'dibajak') { st.dibajak++; const n0 = s.staff.length; choice = smart ? (s.money > 200e6 ? 0 : 2) : Math.floor(Math.random() * 3); sim.resolveEvent(p, choice); if (s.staff.length < n0) st.left++; break; }
        if (p.eventId === 'endorse') { st.endorse++; choice = Math.floor(Math.random() * 3); }
        if (p.eventId === 'lokasi') choice = Math.floor(Math.random() * 2);
        if (p.eventId === 'gaji') choice = smart ? (s.money > 50e6 ? 0 : 1) : Math.random() < 0.5 ? 0 : 1;
        if (p.eventId === 'skandal' && smart && s.money < 30e6) choice = 1;
        if (p.eventId === 'sahur' && s.money < 10e6) choice = 1;
        const R = (n: number) => Math.floor(Math.random() * n);
        if (p.eventId === 'gosip') {
          st.gossips++;
          if (p.data.kind === 'viral') choice = smart || dumb ? 0 : R(2);
          else choice = smart ? (s.boikot >= 30 ? (s.money > Number(p.data.cost) * 4 ? 0 : 2) : s.money > Number(p.data.cost) * 6 && Math.random() < 0.5 ? 0 : 1) : dumb ? 1 : R(3);
          if (choice === 1 && p.data.kind !== 'viral') st.goreng++;
        }
        if (p.eventId === 'boikot') choice = smart ? (s.money > Number(p.data.cost) * 3 ? 0 : 1) : dumb ? 1 : R(2);
        if (p.eventId === 'rewel') { const x = s.staff.find((y) => y.id === p.data.staffId); choice = smart ? (s.money > 60e6 && x && x.salary < sim.marketSalary(x) ? 0 : 1) : R(2); }
        if (p.eventId === 'mogok') { st.mogok++; choice = smart ? (s.money > Number(p.data.cost) * 3 ? 0 : 1) : R(3); }
        if (p.eventId === 'kpi') {
          if (Number(p.data.stage) === 1) { st.kpiWarns++; choice = 0; }
          else { st.kpiSanctions++; const canMove = Number(p.data.showId) >= 0 && s.shows.some((x) => x.id === p.data.showId && sim.isAiring(x)); choice = !canMove ? 0 : smart ? (Number(p.data.fine) < s.money * 0.25 ? 1 : 0) : dumb ? 0 : R(2); if (canMove && choice === 0) st.slotMoves++; else st.fines++; }
        }
        if (p.eventId === 'placement') { const pr = s.prod; const w = pr ? v5.placementWeight({ genre: pr.genre, placements: pr.placements }) : 0; const fit = v5.sponsorById(String(p.data.id))?.fit.includes(pr?.genre ?? '') ? 0.5 : 1; choice = smart ? (w + fit <= v5.PLACEMENT_SAFE ? 0 : 1) : dumb ? 0 : R(2); if (choice === 0) st.placements++; }
        sim.resolveEvent(p, choice);
        break;
      }
      case 'ending': st.ending = true; break;
      case 'release': {
        const sh = s.shows.find((x) => x.id === p.showId)!;
        st.shows++;
        if (sh.placements >= 3) st.plPenShows++;
        st.byBucket[bucket(sh.total)][1]++;
        if (sh.location) { st.locShoots++; if (sh.locMatches.length) st.locCombos++; }
        if (sh.ost) { st.osts++; if (sh.ost.hit) st.ostHits++; if (sh.ost.viral) st.ostViral++; }
        if (sh.ramadan) st.ramadanSlots++;
        if (sh.parentId != null) { st.spinoffs++; st.maxPart = Math.max(st.maxPart, sh.part); }
        const d = dateOf(sh.releaseWeek);
        if (verbose) log.push(`Y${d.year}M${d.month} ${sh.genre}/${sh.theme} ${sh.compat} ${sh.platform} ${sh.eps}ep tot=${sh.total} rating=${sh.rating}% loc=${sh.location ?? '-'}${sh.ost ? ' ost=' + sh.ost.singer + (sh.ost.viral ? '(VIRAL)' : sh.ost.hit ? '(hit)' : '') : ''}${sh.ramadan ? ' RAMADAN' : ''}${sh.part > 1 ? ' part' + sh.part : ''} cost=${fmtShort(sh.cost)} money=${fmtShort(s.money)} fans=${s.fans} staff=${s.staff.length} gaji=${fmtShort(sim.monthlyCosts())}/bln`);
        break;
      }
      case 'airEnd': {
        const sh = s.shows.find((x) => x.id === p.showId)!;
        st.ranks.push(...sh.ranks);
        if (sh.revenue < sh.cost) st.profitLoss++;
        if (sh.muak > 0) st.muakShows++;
        if (verbose) log.push(`   ended ${sh.platform} tot=${sh.total}: revenue ${fmtShort(sh.revenue)} (cost ${fmtShort(sh.cost)}) ranks=${sh.ranks.join(',')}${sh.twists.length ? ' twists=' + sh.twists.join('/') + ' muak=' + sh.muak : ''}`);
        break;
      }
      case 'rating': {
        const sh = s.shows.find((x) => x.id === p.showId)!;
        if (p.type === 'cancel') { st.cancels++; st.byBucket[bucket(sh.total)][0]++; st.ranks.push(...sh.ranks); if (sh.revenue < sh.cost) st.profitLoss++; }
        if (p.type === 'warn') st.warns++;
        if (p.type === 'top') st.tops++;
        if (verbose) log.push(`   RATING ${p.type} ${sh.platform} tot=${sh.total} wk=${sh.weeksAired}/${sh.airWeeks} money+${fmtShort(p.money)}`);
        break;
      }
      case 'award': if (verbose) log.push(`AWARD Y${p.year}: ${p.won ? 'WON ' + fmtShort(p.prize) : 'lost'} score ${p.score} vs ${p.rivalScore}`); break;
      case 'gameover': log.push('GAME OVER'); break;
      case 'warning': st.debtMonths = Math.max(st.debtMonths, p.months); if (verbose) log.push(`warning debt ${p.months} money=${fmtShort(s.money)}`); break;
      default: break;
    }
  }

  const reserve = () => sim.monthlyCosts() * (smart ? 3 : dumb ? 0.5 : 1.5);
  let ticks = 0;
  const maxTicks = years * 48 * 8 * 3;
  while (s.absWeek < years * 48 && ticks < maxTicks && !s.gameOver) {
    while (s.queue.length) { const p = sim.shift()!; handle(p); }
    if (s.gameOver) break;
    st.minMoney = Math.min(st.minMoney, s.money);
    // rating war: promo when slipping, kampanye when rich, extend while #1, plot twists
    for (const sh of s.shows.filter((x) => sim.isAiring(x) && x.ranks.length)) {
      const rk = sim.currentRank(sh);
      const saving = smart && STUDIOS[s.studio] && s.fans >= STUDIOS[s.studio].fans && s.money < STUDIOS[s.studio].cost * 1.3 + reserve();
      if (!saving && !sim.canCampaign(sh) && s.money > sim.campaignCost(sh) * (smart ? 4 : 2) + reserve() && rk > 1 && Math.random() < (smart ? 0.35 : dumb ? 0.3 : 0.1)) { if (!sim.campaign(sh)) st.camps++; }
      if (rk > 3 && !sim.canPromo(sh) && s.money > sim.promoCost(sh) * 4 && Math.random() < (smart ? 0.5 : 0.15)) { if (!sim.promo(sh)) st.promos++; }
      if (rk === 1 && !sim.canExtend(sh) && s.money > sim.extendCost(sh) * 3 && Math.random() < (smart ? 0.4 : 0.1)) { if (!sim.extend(sh)) st.exts++; }
      if (!sim.canTwist(sh)) {
        const cards = sim.twistsUnlocked();
        if (smart && rk > 1 && sh.twists.length < 2) {
          const ok = cards.map((id) => ({ id, pv: sim.twistPreview(sh, id) })).filter((x) => !x.pv.risky).sort((a, b) => b.pv.eff - a.pv.eff)[0];
          if (ok && typeof sim.playTwist(sh, ok.id) !== 'string') st.twists++;
        } else if ((dumb && Math.random() < 0.3) || (casual && Math.random() < 0.01)) {
          const id = cards[Math.floor(Math.random() * cards.length)];
          if (id && typeof sim.playTwist(sh, id) !== 'string') st.twists++;
        }
      }
    }
    // v5: product placement offers, sensor mandiri, sowan to KPI
    if (s.prod && s.prod.offers.length) {
      const pr = s.prod;
      for (const o of [...pr.offers]) {
        const fit = v5.sponsorById(o.id)?.fit.includes(pr.genre) ? 0.5 : 1;
        const w = v5.placementWeight({ genre: pr.genre, placements: pr.placements });
        const take = smart ? w + fit <= v5.PLACEMENT_SAFE : dumb ? true : Math.random() < 0.3;
        if (take) { if (!v5.acceptOffer(sim, o.id)) st.placements++; } else if (smart) v5.declineOffer(sim, o.id);
      }
    }
    if (smart && s.prod && !s.prod.sensor && s.kpi >= 35 && ['azab', 'horor', 'siluman', 'laga'].includes(s.prod.genre)) s.prod.sensor = true;
    if (smart && s.kpi >= 50 && !v5.canSowan(s) && s.money > v5.sowanCost(s) * 5) { if (!v5.sowan(sim)) st.sowans++; }
    st.kpiMax = Math.max(st.kpiMax, s.kpi);
    // smart: cash running thin -> trim the priciest extra staff before it turns into debt
    if (smart && s.money < sim.monthlyCosts() * 1.2 && s.staff.length > 5 && !s.prod) {
      const core = new Set(['sutradara', 'penulis', 'aktor', 'aktris'].map((r) => s.staff.find((x) => x.role === r)?.id));
      const x = [...s.staff].filter((y) => !core.has(y.id)).sort((a, b) => b.salary - a.salary)[0];
      if (x) sim.fire(x);
    }
    // in debt: smart/casual let the priciest extra staff go (a real player would too)
    if (!dumb && s.money < 0 && s.debtWeeks >= 8 && s.staff.length > 4) {
      const core = new Set(['sutradara', 'penulis', 'aktor', 'aktris'].map((r) => s.staff.find((x) => x.role === r)?.id));
      const x = [...s.staff].filter((y) => !core.has(y.id)).sort((a, b) => b.salary - a.salary)[0];
      if (x) sim.fire(x);
    }
    if (!s.prod && !s.job) {
      for (const g of GENRES) if (!s.unlockedGenres.includes(g.id) && s.rp >= g.unlockCost + 4) sim.unlockGenre(g.id);
      for (const t of THEMES) if (!s.unlockedThemes.includes(t.id) && s.rp >= t.unlockCost + 4) sim.unlockTheme(t.id);
      for (const p of PLATFORMS) if (!s.platforms.includes(p.id) && s.money > p.unlockCost * (dumb ? 1.1 : 1.6) + reserve()) sim.unlockPlatform(p.id);
      const nx = STUDIOS[s.studio];
      if (nx && s.money > nx.cost * (dumb ? 1.05 : smart ? 1.3 : 1.6) + reserve()) sim.upgradeStudio();
      // equipment (smart: when comfortably rich; dumb: as soon as affordable)
      if (!casual) for (const e of EQUIPMENT) if (!sim.canBuyEquip(e.id) && s.money > sim.equipPrice(e.id) * (dumb ? 1.1 : 2.2) + reserve()) sim.buyEquip(e.id);
      // star contracts
      if (!sim.canSignStar() && s.starOffers.length && s.staff.length < sim.maxStaff()) {
        const o = s.starOffers[0];
        if (s.money > sim.signFee(o) * (dumb ? 1.1 : 2.5) + reserve() && Math.random() < (casual ? 0.1 : 0.5)) { if (!sim.signStar(o)) st.stars++; }
      }
      // smart bot makes room for a star: lets the least popular actor go
      if (smart && !sim.canSignStar() && s.starOffers.length && s.staff.length >= sim.maxStaff()) {
        const o = s.starOffers[0];
        const weak = s.staff.filter((x) => x.role === o.role).sort((a, b) => a.followers - b.followers)[0];
        if (weak && s.money > sim.signFee(o) * 3 + reserve() && Math.random() < 0.3) { sim.fire(weak); if (!sim.signStar(o)) st.stars++; }
      }
      if (s.staff.length < sim.maxStaff() && s.money > (dumb ? 8e6 : 25e6)) {
        const roles = s.staff.map((x) => x.role);
        const c = s.candidates.find((x) => !roles.includes(x.role)) ?? [...s.candidates].sort((a, b) => b.level - a.level)[0];
        if (c && s.money > sim.hireFee(c) * (dumb ? 1.5 : 3) + (dumb ? 0 : reserve())) { if (!sim.hire(c) && c.star) st.stars++; }
      }
      if (!casual && s.staff.some((x) => x.energy < 50) && s.money > 10e6) sim.treat();
      // v5: auditions (smart: now and then when rich and there's room; dumb: often; casual: rarely)
      if (s.staff.length < sim.maxStaff() && s.money > v5.auditionCost(s) * (dumb ? 2 : 8) + reserve() && Math.random() < (smart ? 0.03 : dumb ? 0.08 : 0.01)) {
        const role = s.staff.filter((x) => x.role === 'aktris').length <= s.staff.filter((x) => x.role === 'aktor').length ? 'aktris' : 'aktor';
        if (!v5.startAudition(sim, role)) {
          st.castings++;
          v5.auditionScene(s, (['nangis', 'marah', 'romantis', 'lucu'] as const)[Math.floor(Math.random() * 4)]);
          const a = s.audition!;
          const best = a.cands.map((c, i) => ({ i, v: a.scores[i] * 10 + a.chem[i] * (smart ? 0.6 : 0.1) - (smart && c.trait === 'rewel' ? 15 : 0) })).sort((x, y) => y.v - x.v)[0];
          if (s.money > sim.hireFee(a.cands[best.i]) * (dumb ? 1.2 : 3) + reserve()) v5.auditionHire(sim, best.i);
          s.audition = null;
        }
      }
      const pl = dumb
        ? [...s.platforms].reverse().find((id) => sim.prodCost(id, 13, 'standar') < s.money * 0.8) ?? 'lokal'
        : smart ? [...s.platforms].reverse().find((id) => sim.prodCost(id, 13, 'standar') < s.money - sim.monthlyCosts() * 1.5) ?? 'lokal'
        : [...s.platforms].reverse().find((id) => sim.prodCost(id, 13, 'standar') < s.money * 0.4 - reserve() * 0.3) ?? 'lokal';
      const eps = dumb ? (s.money > 60e6 ? (Math.random() < 0.4 ? 52 : 26) : 13) : s.money > 150e6 ? 26 : 13;
      const budget = casual ? (Math.random() < 0.5 ? 'hemat' : 'standar') : dumb ? (s.money > sim.prodCost(pl, eps, 'mewah') * 1.5 ? 'mewah' : 'standar') : s.money > 400e6 ? 'mewah' : 'standar';
      // sequel / spin-off
      let parentId: number | null = null, spin: 'sekuel' | 'spinoff' | null = null;
      let c = pickCombo();
      const cands = sim.spinoffCandidates();
      if (cands.length) {
        const par = cands[0];
        const part = sim.franchisePart(par) + 1;
        const want = smart ? part <= 3 && Math.random() < 0.35 : dumb ? Math.random() < 0.6 : Math.random() < 0.15;
        if (want) { parentId = par.id; spin = Math.random() < 0.5 ? 'sekuel' : 'spinoff'; c = { genre: par.genre, theme: spin === 'sekuel' ? par.theme : c.theme }; }
      }
      const m = s.staff.filter((x) => x.role === 'aktor').sort((a, b) => b.followers - a.followers)[0]?.id ?? null;
      const f = s.staff.filter((x) => x.role === 'aktris').sort((a, b) => b.followers - a.followers)[0]?.id ?? null;
      const base = { title: 'X', genre: c.genre, theme: c.theme, platform: pl, eps, budget, leadM: m, leadF: f, parentId, spin };
      const cost0 = sim.quote(base).total;
      if (s.money > cost0 + (dumb ? 2e6 : reserve() * 0.5) || s.shows.length === 0 || (s.money > cost0 && ticks - lastStart > 8 * 8)) {
        // location
        let location: string | null = null;
        const locs = LOCATIONS.filter((l) => sim.locAvailable(l.id) && s.money > cost0 + locCost(l, pl, eps) * (dumb ? 1.2 : 3) + (dumb ? 0 : reserve()));
        if (!process.env.NOLOC && locs.length && Math.random() < (smart ? 0.6 : dumb ? 0.6 : 0.25)) {
          const good = locs.filter((l) => locMatches(l, c.genre, c.theme).length);
          location = (smart && good.length ? good[Math.floor(Math.random() * good.length)] : locs[Math.floor(Math.random() * locs.length)]).id;
        }
        // OST
        let ost: string | null = null;
        const sgs = SINGERS.filter((x) => s.fans >= x.unlockFans && s.money > cost0 + singerFee(x, pl) * (dumb ? 1.3 : 4) + (dumb ? 0 : reserve()));
        if (sgs.length && Math.random() < (smart ? 0.7 : dumb ? 0.7 : 0.25)) {
          const fit = sgs.filter((x) => singerFits(x, c.genre)).sort((a, b) => b.pop - a.pop);
          ost = (smart && fit.length ? fit[0] : dumb ? sgs.sort((a, b) => b.pop - a.pop)[0] : sgs[Math.floor(Math.random() * sgs.length)]).id;
        }
        const ramadan = !sim.canRamadanSlot(c.genre) && (smart || Math.random() < 0.3);
        const opts = { ...base, location, ost, ramadan };
        if (s.money < sim.quote(opts).total) { opts.location = null; opts.ost = null; }
        const err = sim.startProduction(opts);
        if (!err) { st.maxIdle = Math.max(st.maxIdle, ticks - lastStart); lastStart = ticks; }
        else if (s.jobOffers.length) sim.startJob(s.jobOffers[0]);
      } else if (s.jobOffers.length) sim.startJob(s.jobOffers[0]);
    }
    sim.tick();
    ticks++;
    if (s.platforms.includes('nasional') && st.nasionalWeek < 0) st.nasionalWeek = s.absWeek;
    if (s.platforms.includes('streaming') && st.streamWeek < 0) st.streamWeek = s.absWeek;
    trackLedger();
    if (s.absWeek >= (st.moneyByYear.length + 1) * 48) { st.moneyByYear.push(s.money); st.fansByYear.push(s.fans); st.costsByYear.push(sim.monthlyCosts()); }
  }
  while (s.queue.length) { const p = sim.shift()!; handle(p); }
  st.maxIdle = Math.max(st.maxIdle, ticks - lastStart);
  st.gameOver = s.gameOver;
  st.gameOverYear = s.gameOver ? dateOf(s.absWeek).year : 0;
  st.selebs = s.staff.filter(isSeleb).length;
  st.hof = s.shows.filter((x) => x.hof).length;
  st.studioEnd = s.studio; st.equip = s.equipment.length; st.platEnd = s.platforms.length;
  st.achv = Object.keys(s.achievements).length; st.boikots = s.stats5.boikots;
  for (const [k, v] of Object.entries(spend)) { const cat = k.split('|')[1]; if (SINK_CATS.includes(cat)) { st.sinks += v; st.sinkByKind[cat] = (st.sinkByKind[cat] ?? 0) + v; } }
  if (verbose) {
    console.log(log.join('\n'));
    const d = dateOf(s.absWeek);
    console.log(`END Y${d.year}M${d.month} money=${fmtShort(s.money)} fans=${s.fans} shows=${s.shows.length} hof=${st.hof} trophies=${s.trophies} studio=${s.studio} equip=${s.equipment.join(',')} plats=${s.platforms} costs/bln=${fmtShort(sim.monthlyCosts())} staff=${s.staff.map((x) => `${x.role}:${fmtShort(x.salary)}${x.star ? '*' : ''}`).join(' ')}`);
    console.log('sinks', JSON.stringify(Object.fromEntries(Object.entries(st.sinkByKind).map(([k, v]) => [k, fmtShort(v)]))), 'minMoney', fmtShort(st.minMoney));
    console.log('ledger last year', JSON.stringify(s.ledger.last ? { inc: Object.fromEntries(Object.entries(s.ledger.last.income).map(([k, v]) => [k, fmtShort(v)])), sp: Object.fromEntries(Object.entries(s.ledger.last.spend).map(([k, v]) => [k, fmtShort(v)])) } : null));
  }
  return st;
}

function showT(x: Show) { return x; }
void showT;

if (runs <= 1) run(true);
else {
  const all: Stats[] = [];
  for (let i = 0; i < runs; i++) all.push(run(false));
  const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const out: string[] = [];
  out.push(`${runs} runs, ${mode} bot, ${years} years`);
  for (let y = 0; y < years; y++) {
    const m = all.map((x) => x.moneyByYear[y]).filter((v) => v !== undefined);
    const f = all.map((x) => x.fansByYear[y]).filter((v) => v !== undefined);
    const c = all.map((x) => x.costsByYear[y]).filter((v) => v !== undefined);
    if (!m.length) { out.push(`  end Y${y + 1}: (all runs bankrupt)`); continue; }
    out.push(`  end Y${y + 1}: money median ${fmtShort(med(m))} (min ${fmtShort(Math.min(...m))}, max ${fmtShort(Math.max(...m))})  fans median ${Math.round(med(f))}  costs/bln ${fmtShort(med(c))}  [${m.length} alive]`);
  }
  const go = all.filter((x) => x.gameOver);
  out.push(`  gameovers ${go.length}/${runs}${go.length ? ' (years ' + go.map((x) => x.gameOverYear).join(',') + ')' : ''}; runs that hit debt warnings ${all.filter((x) => x.debtMonths > 0).length}/${runs}; min money median ${fmtShort(med(all.map((x) => x.minMoney)))}`);
  out.push(`  per run avg: shows ${avg(all.map((x) => x.shows)).toFixed(1)} (money-losing ${avg(all.map((x) => x.profitLoss)).toFixed(1)}), cancels ${avg(all.map((x) => x.cancels)).toFixed(2)}, #1 bonuses ${avg(all.map((x) => x.tops)).toFixed(2)}, promos ${avg(all.map((x) => x.promos)).toFixed(1)}, kampanye ${avg(all.map((x) => x.camps)).toFixed(1)}, extensions ${avg(all.map((x) => x.exts)).toFixed(1)}`);
  out.push(`  progress: nasional by week ${med(all.map((x) => (x.nasionalWeek < 0 ? 999 : x.nasionalWeek)))}, streaming by week ${med(all.map((x) => (x.streamWeek < 0 ? 999 : x.streamWeek)))} (median; 999 = never), studio end ${avg(all.map((x) => x.studioEnd)).toFixed(1)}, equipment ${avg(all.map((x) => x.equip)).toFixed(1)}, longest idle stretch ${Math.round(Math.max(...all.map((x) => x.maxIdle)) / 8)} weeks`);
  out.push(`  sinks spent per run (median total ${fmtShort(med(all.map((x) => x.sinks)))}): ${SINK_CATS.map((k) => `${k} ${fmtShort(med(all.map((x) => x.sinkByKind[k] ?? 0)))}`).join(', ')}`);
  out.push(`  v4: twists ${avg(all.map((x) => x.twists)).toFixed(1)} (shows w/ muak ${avg(all.map((x) => x.muakShows)).toFixed(1)}), OST ${avg(all.map((x) => x.osts)).toFixed(1)} (hit ${avg(all.map((x) => x.ostHits)).toFixed(1)}, viral ${avg(all.map((x) => x.ostViral)).toFixed(1)}), Ramadan slots ${avg(all.map((x) => x.ramadanSlots)).toFixed(1)}, spin-offs ${avg(all.map((x) => x.spinoffs)).toFixed(1)} (max part ${Math.max(...all.map((x) => x.maxPart))}), stars ${avg(all.map((x) => x.stars)).toFixed(2)}, HoF ${avg(all.map((x) => x.hof)).toFixed(1)}`);
  out.push(`  v5: gossips ${avg(all.map((x) => x.gossips)).toFixed(1)} (goreng ${avg(all.map((x) => x.goreng)).toFixed(1)}), boikots ${avg(all.map((x) => x.boikots)).toFixed(2)}, KPI warns ${avg(all.map((x) => x.kpiWarns)).toFixed(2)} sanctions ${avg(all.map((x) => x.kpiSanctions)).toFixed(2)} (slot ${avg(all.map((x) => x.slotMoves)).toFixed(2)} / fine ${avg(all.map((x) => x.fines)).toFixed(2)}), KPI max median ${med(all.map((x) => x.kpiMax)).toFixed(0)}, sowan ${avg(all.map((x) => x.sowans)).toFixed(1)}`);
  out.push(`      placements ${avg(all.map((x) => x.placements)).toFixed(1)} (shows w/ 3+ ${avg(all.map((x) => x.plPenShows)).toFixed(1)}), castings ${avg(all.map((x) => x.castings)).toFixed(1)}, mogok ${avg(all.map((x) => x.mogok)).toFixed(1)}, achievements median ${med(all.map((x) => x.achv))}/${ACHIEVEMENTS.length} (min ${Math.min(...all.map((x) => x.achv))}, max ${Math.max(...all.map((x) => x.achv))}), ending reached ${all.filter((x) => x.ending).length}/${runs}`);
  const ranks = all.flatMap((x) => x.ranks);
  out.push(`  weekly rank distribution: ${[1, 2, 3, 4, 5, 6].map((r) => `#${r}:${Math.round((ranks.filter((v) => (r < 6 ? v === r : v >= 6)).length / Math.max(1, ranks.length)) * 100)}%`).join(' ')}`);
  console.log(out.join('\n'));
}
