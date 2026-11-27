/* Omni-Calculateur — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

(function (globalScope) {
  "use strict";

  const PRECEDENCE = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2,
    "^": 3
  };

  const RIGHT_ASSOCIATIVE = new Set(["^"]);

  /**
   * Lit un nombre tapé à la française ou à l'anglaise, y compris en notation
   * scientifique (« 1,23e+16 », « 1e-7 », « −3,5 »). Renvoie NaN si invalide.
   */
  function parseNumber(text, allowNegative = false) {
    const raw = String(text)
      .replace(/[\s\u00a0\u202f]/g, "")
      .replaceAll(",", ".")
      .replaceAll("−", "-");

    const pattern = allowNegative
      ? /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/
      : /^\+?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

    if (!pattern.test(raw)) {
      return NaN;
    }

    const value = Number(raw);
    return Number.isFinite(value) ? value : NaN;
  }

  /**
   * Formate un nombre fini en limitant les artefacts binaires (0.1 + 0.2)
   * et en normalisant -0 vers 0.
   */
  function numberToString(value) {
    if (Object.is(value, -0)) {
      value = 0;
    }

    return String(Number.parseFloat(value.toPrecision(15)));
  }

  /**
   * Compte les chiffres saisis sans pénaliser le « 0 » initial de « 0,… ».
   */
  function countSignificantDigits(text) {
    return String(text)
      .replace(/^-/, "")
      .replace(/^0\./, ".")
      .replace(/\D/g, "")
      .length;
  }

  /**
   * Exécute une opération binaire élémentaire de manière fermée et sûre.
   */
  function calculate(left, right, operator) {
    let result;

    switch (operator) {
      case "+":
        result = left + right;
        break;

      case "-":
        result = left - right;
        break;

      case "*":
        result = left * right;
        break;

      case "/":
        if (right === 0) {
          throw new Error("Division par zéro impossible");
        }
        result = left / right;
        break;

      case "^":
        result = Math.pow(left, right);
        break;

      default:
        throw new Error("Opération inconnue");
    }

    if (!Number.isFinite(result)) {
      throw new Error("Le résultat n’est pas un nombre fini");
    }

    return result;
  }

  /**
   * Évalue une liste de jetons ({type:"num",value}, {type:"op",op},
   * {type:"lparen"}, {type:"rparen"}) selon les priorités algébriques
   * via l'algorithme Shunting-yard (sans eval ni new Function).
   */
  function evaluateTokens(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      throw new Error("Expression vide");
    }

    const output = [];
    const ops = [];

    for (const token of tokens) {
      if (token.type === "num") {
        if (!Number.isFinite(token.value)) {
          throw new Error("Nombre invalide");
        }
        output.push(token.value);
      } else if (token.type === "op") {
        const prec = PRECEDENCE[token.op];
        if (!prec) {
          throw new Error("Opération inconnue");
        }

        while (ops.length > 0) {
          const top = ops[ops.length - 1];
          if (top.type !== "op") {
            break;
          }
          const topPrec = PRECEDENCE[top.op];
          const shouldPop = RIGHT_ASSOCIATIVE.has(token.op)
            ? topPrec > prec
            : topPrec >= prec;

          if (!shouldPop) {
            break;
          }
          output.push(ops.pop());
        }

        ops.push(token);
      } else if (token.type === "lparen") {
        ops.push(token);
      } else if (token.type === "rparen") {
        let foundLeft = false;
        while (ops.length > 0) {
          const top = ops.pop();
          if (top.type === "lparen") {
            foundLeft = true;
            break;
          }
          output.push(top);
        }
        if (!foundLeft) {
          throw new Error("Parenthèse fermante sans parenthèse ouvrante");
        }
      } else {
        throw new Error("Jeton inconnu");
      }
    }

    while (ops.length > 0) {
      const top = ops.pop();
      if (top.type === "lparen" || top.type === "rparen") {
        throw new Error("Parenthèse non refermée");
      }
      output.push(top);
    }

    const stack = [];
    for (const item of output) {
      if (typeof item === "number") {
        stack.push(item);
      } else {
        if (stack.length < 2) {
          throw new Error("Expression incomplète");
        }
        const right = stack.pop();
        const left = stack.pop();
        stack.push(calculate(left, right, item.op));
      }
    }

    if (stack.length !== 1 || !Number.isFinite(stack[0])) {
      throw new Error("Expression invalide");
    }

    return stack[0];
  }

  /**
   * Formate une séquence de jetons en chaîne lisible.
   */
  function formatTokens(tokens, operatorSymbols, formatValue) {
    let result = "";

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const prev = tokens[i - 1];

      if (token.type === "num") {
        if (prev && prev.type === "rparen") {
          result += " ";
        }
        result += formatValue(token.text !== undefined ? token.text : token.value);
      } else if (token.type === "op") {
        result += ` ${operatorSymbols[token.op] || token.op} `;
      } else if (token.type === "lparen") {
        if (prev && (prev.type === "num" || prev.type === "rparen")) {
          result += " ";
        }
        result += "(";
      } else if (token.type === "rparen") {
        result += ")";
      }
    }

    return result.trim();
  }

  const api = {
    parseNumber,
    numberToString,
    countSignificantDigits,
    calculate,
    evaluateTokens,
    formatTokens
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.OmniCalcEngine = api;
}(typeof globalThis !== "undefined" ? globalThis : window));
