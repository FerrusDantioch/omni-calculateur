/* Omni-Calculateur — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests automatiques d'Omni-Calculateur.
   Ils ouvrent l'application dans un vrai navigateur (Chromium, piloté
   par Playwright), appuient sur les touches comme une personne, et
   vérifient chaque résultat. Les taux de change sont faux et fournis
   par le test lui-même : rien n'est envoyé sur internet.

   Lancer (Playwright doit être installé) :  node tests/tester.js
   ============================================================ */
'use strict';
const { lancer, section, verifier, nouvellePage, controlesCommuns } = require('./outils.js');

/* Faux site des taux : 1 € = 1,10 $ = 0,85 £ = 160 ¥. */
const TAUX = { amount: 1, base: 'EUR', date: '2026-10-31', rates: { USD: 1.1, GBP: 0.85, JPY: 160, CHF: 0.95 } };
async function fauxTaux(ctx) {
  await ctx.route(/api\.frankfurter\.dev/, (r) => r.fulfill({ json: TAUX, headers: { 'access-control-allow-origin': '*' } }));
}

const texte = (p, sel) => p.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim());

/* Tape une suite de touches : chiffres, « , », + - * / ^, « = ». */
async function taper(p, suite) {
  await p.click('[data-action="clear-all"]');
  for (const k of suite) {
    if (/\d/.test(k)) await p.click(`[data-digit="${k}"]`);
    else if (k === ',') await p.click('[data-action="decimal"]');
    else if (k === '=') await p.click('[data-action="equals"]');
    else await p.click(`[data-operator="${k}"]`);
  }
  return texte(p, '#calc-display');
}

async function remplir(p, valeurs) {
  for (const [sel, v] of Object.entries(valeurs)) await p.fill(sel, v);
}

lancer('Omni-Calculateur', async () => {
  await controlesCommuns({ serviceWorker: 'service-worker.js', avant: fauxTaux });

  const { ctx, p } = await nouvellePage({ avant: fauxTaux });

  await section('Calculatrice', async () => {
    const cas = [
      ['2+3=', '5'],
      ['0,1+0,2=', '0,3'],
      ['7/2=', '3,5'],
      ['2^1+0=', '2'],
      ['123456789012345+0=', '123456789012345'],
      ['9999999*9999999=', '99999980000001'],
      ['1,1*1,1=', '1,21']
    ];
    for (const [suite, attendu] of cas) {
      const obtenu = await taper(p, suite);
      verifier(obtenu === attendu, `${suite} donne ${attendu}`, obtenu);
    }
    verifier(await taper(p, '1234567890123456') === '123456789012345', 'pas plus de 15 chiffres à la saisie');
    await taper(p, '5/0=');
    verifier(await texte(p, '#calc-display') === 'Erreur', 'division par zéro : « Erreur »');
  });

  await section('Pourcentages', async () => {
    await p.click('[data-action="clear-all"]');
    for (const k of '200') await p.click(`[data-digit="${k}"]`);
    await p.click('[data-operator="+"]');
    for (const k of '10') await p.click(`[data-digit="${k}"]`);
    await p.click('[data-unary="percent"]');
    await p.click('[data-action="equals"]');
    verifier(await texte(p, '#calc-display') === '220', '200 + 10 % = 220');

    await p.click('#tab-outils');
    await remplir(p, { '#pct-of-rate': '15', '#pct-of-base': '80' });
    verifier(await texte(p, '#pct-of-result') === '12', '15 % de 80 = 12', await texte(p, '#pct-of-result'));
    await remplir(p, { '#pct-from': '80', '#pct-to': '100' });
    verifier((await texte(p, '#pct-change-result')).startsWith('+25 %'), 'de 80 à 100 : +25 %', await texte(p, '#pct-change-result'));
  });

  await section('Addition partagée et remise', async () => {
    await remplir(p, { '#bill-amount': '100', '#tip-percent': '0' });
    // 3 personnes : 33,333… → arrondi au centime SUPÉRIEUR, pour couvrir l'addition
    for (let i = 0; i < 2; i++) await p.click('[data-people-step="1"]');
    verifier(await texte(p, '#bill-share') === '33,34', '100 € à 3 : 33,34 € chacun', await texte(p, '#bill-share'));
    await remplir(p, { '#discount-price': '59,90', '#discount-percent': '30' });
    verifier(await texte(p, '#discount-final') === '41,93', '59,90 € moins 30 % = 41,93 €', await texte(p, '#discount-final'));
  });

  await section('Devises (taux fournis par le test)', async () => {
    await p.click('#tab-devises');
    await p.selectOption('#from-currency', 'EUR');
    await p.selectOption('#to-currency', 'USD');
    await p.fill('#amount', '10');
    await p.waitForTimeout(300);
    const res = await texte(p, '#conversion-result');
    verifier(res.replace(/\s/g, '').startsWith('11'), '10 € = 11 $', res);
  });

  await section('Polices incluses dans l’application', async () => {
    const polices = await p.evaluate(async () => {
      for (const f of ['Oxanium', 'Literata', 'JetBrains Mono']) await document.fonts.load(`16px "${f}"`);
      return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
    });
    for (const f of ['Oxanium', 'Literata', 'JetBrains Mono']) verifier(polices.includes(f), `police ${f} chargée`, polices);
  });
  await ctx.close();

  await section('Reprise des réglages des anciennes versions', async () => {
    // Avant la toute première ouverture : on dépose ce qu'une ancienne
    // version aurait laissé (depuis une autre page du même site).
    const preparer = async (ctx) => {
      await fauxTaux(ctx);
      const q = await ctx.newPage();
      await q.goto(new URL('manifest.json', require('./outils.js').adresse()).href);
      await q.evaluate(async () => {
        localStorage.setItem('omni-theme', 'nuit');
        localStorage.setItem('omni-history-v1', JSON.stringify([{ expression: '6 × 7', result: '42', time: Date.now() }]));
        localStorage.setItem('omni-vibration', 'off');
        await caches.open('omni-shell-v1.2.1');
        await caches.open('omni-fonts-v1');
      });
      await q.close();
    };
    const { ctx, p } = await nouvellePage({ avant: preparer });
    await p.waitForTimeout(1000);
    const etat = await p.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      cles: Object.keys(localStorage).sort(),
      historique: document.body.innerText.includes('42')
    }));
    verifier(etat.theme === 'nuit', 'le thème choisi est gardé', etat.theme);
    verifier(etat.historique, 'l’historique des calculs est gardé');
    verifier(etat.cles.every((c) => c.startsWith('omni-calculateur-')), 'plus aucun ancien nom de stockage', etat.cles);
    // Le service worker efface les anciens caches à son activation.
    const caches1 = await p.evaluate(async () => {
      await navigator.serviceWorker.ready;
      for (let i = 0; i < 20 && (await caches.keys()).some((k) => k.startsWith('omni-shell-')); i++) await new Promise((ok) => setTimeout(ok, 250));
      return caches.keys();
    });
    verifier(!caches1.some((k) => k.startsWith('omni-shell-') || k === 'omni-fonts-v1'), 'les anciens caches sont effacés', caches1);
    verifier(caches1.some((k) => k.startsWith('omni-calculateur-')), 'le nouveau cache existe', caches1);
    await ctx.close();
  });
}, { autorises: ['https://api.frankfurter.dev/'] });   // seul site prévu : les taux de change (ici, faux)
