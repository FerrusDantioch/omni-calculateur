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

/* Tape une suite de touches : chiffres, « , », + - * / ^ ( ), « = ». */
async function taper(p, suite) {
  await p.click('[data-action="clear-all"]');
  for (const k of suite) {
    if (/\d/.test(k)) await p.click(`[data-digit="${k}"]`);
    else if (k === ',') await p.click('[data-action="decimal"]');
    else if (k === '=') await p.click('[data-action="equals"]');
    else if (k === '(' || k === ')') await p.click(`[data-paren="${k}"]`);
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
  const frankfurterCalls = [];
  ctx.on('request', (r) => {
    if (/api\.frankfurter\.dev/.test(r.url())) frankfurterCalls.push(r.url());
  });

  await section('Thème par défaut, accessibilité et À propos', async () => {
    const theme = await p.evaluate(() => document.documentElement.dataset.theme);
    verifier(theme === 'nuit', 'le thème par défaut est « nuit »', theme);
    const nested = await p.$('button #calc-display');
    verifier(!nested, '#calc-display n’est pas imbriqué dans un <button>');
    const copyBox = await p.locator('#calc-copy-button').boundingBox();
    verifier(copyBox && copyBox.width >= 44 && copyBox.height >= 44, '#calc-copy-button >= 44×44 px', copyBox);

    await p.click('#about-button');
    const aboutText = await texte(p, '#about-dialog');
    verifier(aboutText.includes('omni-systeme.choking513@passmail.net'), 'contact officiel présent dans À propos');
    verifier(aboutText.includes('Creative Commons BY-NC-ND 4.0'), 'licence présente dans À propos');
    await p.click('.about-close');
  });

  await section('Sobriété réseau au démarrage', async () => {
    await p.waitForTimeout(400);
    verifier(frankfurterCalls.length === 0, '0 requête Frankfurter au lancement sur Calcul', frankfurterCalls.length);
  });

  await section('Calculatrice (priorités, parenthèses, répétition =, précision)', async () => {
    const cas = [
      ['2+3=', '5'],
      ['0,1+0,2=', '0,3'],
      ['7/2=', '3,5'],
      ['2^1+0=', '2'],
      ['2+3*4=', '14'],
      ['(2+3)*4=', '20'],
      ['2^3^2=', '512'],
      ['123456789012345+0=', '123456789012345'],
      ['9999999*9999999=', '99999980000001'],
      ['1,1*1,1=', '1,21']
    ];
    for (const [suite, attendu] of cas) {
      const obtenu = await taper(p, suite);
      verifier(obtenu === attendu, `${suite} donne ${attendu}`, obtenu);
    }
    verifier(await taper(p, '5+2=') === '7', '5+2= donne 7');
    await p.click('[data-action="equals"]');
    verifier(await texte(p, '#calc-display') === '9', 'répétition de = donne 9', await texte(p, '#calc-display'));

    verifier(await taper(p, '1234567890123456') === '123456789012345', 'pas plus de 15 chiffres à la saisie');
    verifier(await taper(p, '0,123456789012345') === '0,123456789012345', '0, accepte 15 décimales significatives');

    await p.click('[data-action="clear-all"]');
    await p.click('[data-digit="9"]');
    await p.click('[data-unary="sqrt"]');
    verifier(await texte(p, '#calc-display') === '3', '√9 = 3');
    await p.click('[data-unary="square"]');
    verifier(await texte(p, '#calc-display') === '9', '3² = 9');
    await p.click('[data-digit="4"]');
    await p.click('[data-unary="inverse"]');
    verifier(await texte(p, '#calc-display') === '0,25', '1/4 = 0,25');
    await p.click('[data-action="clear-all"]');
    await p.click('[data-digit="1"]');
    await p.click('[data-digit="2"]');
    await p.click('[data-digit="3"]');
    await p.click('[data-action="toggle-sign"]');
    verifier(await texte(p, '#calc-display') === '-123', 'changement de signe ±');
    await p.click('[data-action="backspace"]');
    verifier(await texte(p, '#calc-display') === '-12', 'touche ⌫ efface un caractère');
    await p.click('[data-action="clear-entry"]');
    verifier(await texte(p, '#calc-display') === '0', 'touche CE remet la saisie à 0');

    await taper(p, '5/0=');
    verifier(await texte(p, '#calc-display') === 'Erreur', 'division par zéro : « Erreur »');
  });

  await section('Clavier physique et historique', async () => {
    await p.click('#tab-calculatrice');
    await p.click('[data-action="clear-all"]');
    await p.keyboard.press('Escape');
    for (const ch of ['(', '2', '+', '3', ')', '*', '4']) {
      await p.keyboard.press(ch);
    }
    await p.keyboard.press('Enter');
    verifier(await texte(p, '#calc-display') === '20', 'saisie clavier (2+3)*4 Entrée = 20', await texte(p, '#calc-display'));

    const histEntries = await p.$$('.history-entry');
    verifier(histEntries.length > 0, 'historique alimenté');
    await p.click('.history-entry >> nth=0');
    verifier(await texte(p, '#calc-display') === '20', 'reprise d’une entrée d’historique');
  });

  await section('Pourcentages, outils et notation scientifique', async () => {
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
    await remplir(p, { '#pct-of-rate': '10', '#pct-of-base': '1,5e3' });
    verifier(await texte(p, '#pct-of-result') === '150', 'notation scientifique acceptée (10 % de 1,5e3 = 150)', await texte(p, '#pct-of-result'));

    const outBox = await p.locator('#pct-of-result').boundingBox();
    verifier(outBox && outBox.width >= 44 && outBox.height >= 44, '.tool-answer output >= 44×44 px', outBox);
  });

  await section('Addition partagée et remise (non-copie erreur)', async () => {
    await remplir(p, { '#bill-amount': '100', '#tip-percent': '0' });
    // 3 personnes : 33,333… → arrondi au centime SUPÉRIEUR, pour couvrir l'addition
    for (let i = 0; i < 2; i++) await p.click('[data-people-step="1"]');
    verifier(await texte(p, '#bill-share') === '33,34', '100 € à 3 : 33,34 € chacun', await texte(p, '#bill-share'));
    await remplir(p, { '#discount-price': '59,90', '#discount-percent': '30' });
    verifier(await texte(p, '#discount-final') === '41,93', '59,90 € moins 30 % = 41,93 €', await texte(p, '#discount-final'));

    await remplir(p, { '#discount-price': '50', '#discount-percent': '120' });
    verifier(await texte(p, '#discount-final') === 'Remise > 100 %', 'remise > 100 % signalée');
    await p.evaluate(() => { const t = document.getElementById('toast'); t.hidden = true; });
    await p.click('#discount-final');
    const toastVisible = await p.evaluate(() => !document.getElementById('toast').hidden);
    verifier(!toastVisible, '« Remise > 100 % » n’est pas copié au clic');
  });

  await section('Devises (chargement à la demande, favoris, inversion)', async () => {
    await p.click('#tab-devises');
    await p.waitForTimeout(300);
    verifier(frankfurterCalls.length >= 1, 'les taux sont chargés à l’ouverture de Devises', frankfurterCalls.length);
    await p.selectOption('#from-currency', 'EUR');
    await p.selectOption('#to-currency', 'USD');
    await p.fill('#amount', '10');
    await p.waitForTimeout(100);
    const res = await texte(p, '#conversion-result');
    verifier(res.replace(/\s/g, '').startsWith('11'), '10 € = 11 $', res);

    const starBox = await p.locator('[data-favorite-for="from-currency"]').boundingBox();
    verifier(starBox && starBox.width >= 44 && starBox.height >= 44, '.star-button >= 44×44 px', starBox);
    await p.click('#swap-currencies');
    verifier(await p.$eval('#from-currency', (e) => e.value) === 'USD', 'inversion des devises ⇄');
  });

  await section('Convertisseur d’unités', async () => {
    await p.click('#tab-unites');
    await p.selectOption('#unit-category', 'longueur');
    await p.selectOption('#unit-from', 'm');
    await p.selectOption('#unit-to', 'km');
    await p.fill('#unit-value', '1500');
    verifier(await texte(p, '#unit-result') === '1,5 km', '1500 m = 1,5 km', await texte(p, '#unit-result'));

    await p.selectOption('#unit-category', 'temperature');
    await p.selectOption('#unit-from', '°C');
    await p.selectOption('#unit-to', '°F');
    await p.fill('#unit-value', '100');
    verifier(await texte(p, '#unit-result') === '212 °F', '100 °C = 212 °F', await texte(p, '#unit-result'));
  });

  await section('Mise en page desktop et hors ligne sur ressource absente', async () => {
    await p.click('#tab-calculatrice');
    await p.setViewportSize({ width: 1280, height: 800 });
    const desktop = await p.evaluate(() => ({
      debord: document.documentElement.scrollWidth - innerWidth,
      cols: getComputedStyle(document.querySelector('.calculator-layout')).gridTemplateColumns.split(' ').length
    }));
    verifier(desktop.debord <= 0, 'aucun débordement horizontal sur desktop', desktop.debord);
    verifier(desktop.cols === 2, 'affichage en 2 colonnes sur desktop', desktop.cols);

    await ctx.setOffline(true);
    const p503 = await ctx.newPage();
    await p503.goto(require('./outils.js').adresse());
    const status = await p503.evaluate(async () => {
      const res = await fetch('./ressource-inexistante-test.txt');
      return res.status;
    });
    await p503.close();
    verifier(status === 503, 'ressource absente hors ligne renvoie HTTP 503 propre', status);
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
    const preparer = async (ctx) => {
      await fauxTaux(ctx);
      const q = await ctx.newPage();
      await q.goto(new URL('manifest.json', require('./outils.js').adresse()).href);
      await q.evaluate(async () => {
        localStorage.setItem('omni-theme', 'clair');
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
    verifier(etat.theme === 'clair', 'le thème migré est gardé', etat.theme);
    verifier(etat.historique, 'l’historique des calculs est gardé');
    verifier(etat.cles.every((c) => c.startsWith('omni-calculateur-')), 'plus aucun ancien nom de stockage', etat.cles);
    const caches1 = await p.evaluate(async () => {
      await navigator.serviceWorker.ready;
      for (let i = 0; i < 20 && (await caches.keys()).some((k) => k.startsWith('omni-shell-')); i++) await new Promise((ok) => setTimeout(ok, 250));
      return caches.keys();
    });
    verifier(!caches1.some((k) => k.startsWith('omni-shell-') || k === 'omni-fonts-v1'), 'les anciens caches sont effacés', caches1);
    verifier(caches1.some((k) => k.startsWith('omni-calculateur-')), 'le nouveau cache existe', caches1);
    await ctx.close();
  });
}, { autorises: ['https://api.frankfurter.dev/'] });
