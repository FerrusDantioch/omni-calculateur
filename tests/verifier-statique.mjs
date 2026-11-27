/* Omni-Calculateur — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, "..");

function lire(rel) {
  return fs.readFileSync(path.join(RACINE, rel), "utf8");
}

function normaliserChemin(ref) {
  const propre = ref.split("#")[0].split("?")[0].trim();
  if (!propre || propre === "./" || propre === ".") return "index.html";
  return propre.replace(/^\.\//, "");
}

function sansCommentairesJs(js) {
  return js.replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (m, chaine) => chaine || ""
  );
}

test("1. Hygiène GitHub Pages : .nojekyll présent à la racine", () => {
  assert.ok(fs.existsSync(path.join(RACINE, ".nojekyll")), ".nojekyll manquant");
});

test("2. Syntaxe JS valide (node --check) et zéro eval/innerHTML", () => {
  const fichiers = [
    "calc-engine.js",
    "app.js",
    "service-worker.js",
    path.join("tests", "outils.js"),
    path.join("tests", "tester.js"),
    path.join("tests", "unit.test.mjs"),
    path.join("tests", "verifier-statique.mjs")
  ];

  for (const rel of fichiers) {
    execFileSync(process.execPath, ["--check", path.join(RACINE, rel)], { stdio: "pipe" });
  }

  for (const rel of ["calc-engine.js", "app.js", "service-worker.js"]) {
    const js = sansCommentairesJs(lire(rel));
    assert.ok(!/\beval\s*\(/.test(js), `eval() interdit dans ${rel}`);
    assert.ok(!/\bnew\s+Function\b/.test(js), `new Function interdit dans ${rel}`);
    assert.ok(!/\.innerHTML\s*=/.test(js), `.innerHTML = interdit dans ${rel}`);
  }
});

test("3. Cohérence réciproque index.html / style.css / manifest.json <-> service-worker.js", () => {
  const sw = lire("service-worker.js");
  const match = sw.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\]\s*;/);
  assert.ok(match, "APP_SHELL introuvable dans service-worker.js");
  const swFiles = new Set([...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => normaliserChemin(m[1])));

  for (const f of swFiles) {
    assert.ok(fs.existsSync(path.join(RACINE, f)), `Fichier APP_SHELL manquant : ${f}`);
  }

  const refs = new Set();
  const html = lire("index.html");
  for (const m of html.matchAll(/<(?:link|script|img)\b[^>]*\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const u = (m[1] ?? m[2] ?? "").trim();
    if (!u || /^(#|mailto:|data:|https?:|\/\/)/i.test(u)) continue;
    refs.add(normaliserChemin(u));
  }

  const css = lire("style.css");
  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const u = m[1].trim();
    if (/^(data:|https?:|\/\/)/i.test(u)) continue;
    refs.add(normaliserChemin(u));
  }

  const manifest = JSON.parse(lire("manifest.json"));
  assert.equal(manifest.theme_color, "#14111d");
  assert.equal(manifest.background_color, "#14111d");
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3, "Shortcuts manquants dans manifest.json");
  assert.ok(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 2, "Screenshots manquants dans manifest.json");

  if (manifest.start_url) refs.add(normaliserChemin(manifest.start_url));
  for (const icon of manifest.icons || []) {
    if (icon.src) refs.add(normaliserChemin(icon.src));
  }
  for (const sc of manifest.shortcuts || []) {
    if (sc.url) refs.add(normaliserChemin(sc.url));
    for (const icon of sc.icons || []) {
      if (icon.src) refs.add(normaliserChemin(icon.src));
    }
  }

  for (const ref of refs) {
    assert.ok(fs.existsSync(path.join(RACINE, ref)), `Ressource manquante sur disque : ${ref}`);
    assert.ok(swFiles.has(ref), `Ressource absente de APP_SHELL : ${ref}`);
  }

  for (const shot of manifest.screenshots || []) {
    assert.ok(fs.existsSync(path.join(RACINE, shot.src)), `Capture manquante : ${shot.src}`);
  }
});

test("4. Icônes PNG valides (180x180 apple-touch-icon, 192x192, 512x512, maskable)", () => {
  const checks = [
    ["icons/apple-touch-icon.png", 180],
    ["icons/icon-192.png", 192],
    ["icons/icon-512.png", 512],
    ["icons/icon-maskable-512.png", 512]
  ];
  for (const [rel, dim] of checks) {
    const buf = fs.readFileSync(path.join(RACINE, rel));
    assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `PNG invalide : ${rel}`);
    assert.equal(buf.subarray(12, 16).toString("ascii"), "IHDR");
    assert.equal(buf.readUInt32BE(16), dim, `${rel} largeur != ${dim}`);
    assert.equal(buf.readUInt32BE(20), dim, `${rel} hauteur != ${dim}`);
    assert.equal(buf[25], 2, `${rel} doit être RGB opaque`);
  }
});

test("5. Conformité charte Omni-Système (contact, licence FR, thème nuit par défaut)", () => {
  const html = lire("index.html");
  const readme = lire("README.md");
  const license = lire("LICENSE");
  const polices = lire("POLICES-OFL.txt");

  assert.match(html, /<html[^>]+data-theme="nuit"/);
  assert.ok(!/Omni-Time/i.test(polices), "POLICES-OFL.txt mentionne encore Omni-Time");

  for (const [nom, contenu] of [["index.html", html], ["README.md", readme], ["LICENSE", license]]) {
    assert.ok(contenu.includes("Ferrus Dantioch"), `Auteur manquant dans ${nom}`);
    assert.ok(contenu.includes("BY-NC-ND 4.0"), `Licence manquante dans ${nom}`);
    assert.ok(contenu.includes("omni-systeme.choking513@passmail.net"), `Contact manquant dans ${nom}`);
  }
  assert.ok(/non\s+commercial|pas\s+la\s+vendre/i.test(readme), "Traduction FR licence manquante dans README.md");
});
