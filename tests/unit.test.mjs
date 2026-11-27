/* Omni-Calculateur — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const engine = require(path.join(RACINE, "calc-engine.js"));

test("parseNumber gère français, anglais, espaces et notation scientifique", () => {
  assert.equal(engine.parseNumber("1 234,5"), 1234.5);
  assert.equal(engine.parseNumber("1,23e+16"), 1.23e16);
  assert.equal(engine.parseNumber("1e-7"), 1e-7);
  assert.equal(engine.parseNumber("2,5E4"), 25000);
  assert.equal(engine.parseNumber("−1,5e−3", true), -1.5e-3);
  assert.ok(Number.isNaN(engine.parseNumber("-5", false)));
  assert.ok(Number.isNaN(engine.parseNumber("1,2e", true)));
  assert.ok(Number.isNaN(engine.parseNumber("abc", true)));
});

test("countSignificantDigits ne pénalise pas le 0 initial de 0,…", () => {
  assert.equal(engine.countSignificantDigits("0.123456789012345"), 15);
  assert.equal(engine.countSignificantDigits("123456789012345"), 15);
  assert.equal(engine.countSignificantDigits("-0.12345"), 5);
});

test("evaluateTokens respecte la priorité des opérateurs et les parenthèses", () => {
  const tokens1 = [
    { type: "num", value: 2 },
    { type: "op", op: "+" },
    { type: "num", value: 3 },
    { type: "op", op: "*" },
    { type: "num", value: 4 }
  ];
  assert.equal(engine.evaluateTokens(tokens1), 14);

  const tokens2 = [
    { type: "lparen" },
    { type: "num", value: 2 },
    { type: "op", op: "+" },
    { type: "num", value: 3 },
    { type: "rparen" },
    { type: "op", op: "*" },
    { type: "num", value: 4 }
  ];
  assert.equal(engine.evaluateTokens(tokens2), 20);

  // Associativité à droite pour l'exponentiation : 2^(3^2) = 512
  const tokens3 = [
    { type: "num", value: 2 },
    { type: "op", op: "^" },
    { type: "num", value: 3 },
    { type: "op", op: "^" },
    { type: "num", value: 2 }
  ];
  assert.equal(engine.evaluateTokens(tokens3), 512);
});

test("evaluateTokens rejette les divisions par zéro et expressions invalides", () => {
  assert.throws(() => engine.evaluateTokens([
    { type: "num", value: 5 },
    { type: "op", op: "/" },
    { type: "num", value: 0 }
  ]), /Division par zéro/);

  assert.throws(() => engine.evaluateTokens([
    { type: "lparen" },
    { type: "num", value: 2 }
  ]), /Parenthèse/);
});

test("Zéro eval ou new Function dans le moteur de calcul", () => {
  const src = fs.readFileSync(path.join(RACINE, "calc-engine.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  assert.ok(!/\beval\s*\(/.test(src));
  assert.ok(!/\bnew\s+Function\b/.test(src));
});
