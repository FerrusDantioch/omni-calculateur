(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  /* ------------------------------------------------------------------
     Outils communs : nombres, copie, petit message
  ------------------------------------------------------------------ */

  /*
   * Lit un nombre tapé à la française ou à l'anglaise :
   * « 1,5 », « 1.5 », « 1 000 », « -3 ». Renvoie NaN si le texte
   * n'est pas un nombre.
   */
  function parseNumber(text, allowNegative = false) {
    const raw = String(text)
      .replace(/[\s  ]/g, "")
      .replace(",", ".")
      .replace("−", "-");

    const pattern = allowNegative
      ? /^-?(\d+\.?\d*|\.\d+)$/
      : /^(\d+\.?\d*|\.\d+)$/;

    return pattern.test(raw) ? Number(raw) : NaN;
  }

  /*
   * Écrit un nombre lisiblement (« 1 609,344 »). Les nombres très
   * grands ou très petits passent en notation scientifique.
   * grouping = false donne la version à copier (« 1609,344 »).
   */
  function formatNumber(value, grouping = true, digits = 10) {
    if (!Number.isFinite(value)) {
      return "—";
    }

    if (value === 0) {
      return "0";
    }

    const size = Math.abs(value);

    if (size >= 1e15 || size < 1e-6) {
      return value
        .toExponential(5)
        .replace(/\.?0+e/, "e")
        .replace(".", ",");
    }

    return new Intl.NumberFormat("fr-FR", {
      maximumSignificantDigits: digits,
      useGrouping: grouping
    }).format(value);
  }

  /* Montant à deux décimales (« 12,50 »). */
  function formatMoney(value, grouping = true) {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: grouping
    }).format(value);
  }

  /*
   * Affiche un résultat et retient la version à copier : le nombre
   * seul, sans espaces de milliers, pour le coller dans un tableur
   * ou un message.
   */
  function setCopyable(element, text, copyValue = null) {
    element.textContent = text;

    if (copyValue === null) {
      delete element.dataset.copyValue;
    } else {
      element.dataset.copyValue = copyValue;
    }
  }

  const toast = $("#toast");
  let toastTimer = null;

  function showToast(message) {
    clearTimeout(toastTimer);

    toast.textContent = message;
    toast.hidden = false;

    // Relance l'animation d'apparition.
    toast.classList.remove("visible");
    void toast.offsetWidth;
    toast.classList.add("visible");

    toastTimer = setTimeout(() => {
      toast.classList.remove("visible");
      toast.hidden = true;
    }, 2200);
  }

  /* Ancienne méthode de copie, pour les navigateurs qui refusent la nouvelle. */
  function copyWithSelection(text) {
    const field = document.createElement("textarea");

    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }

    field.remove();
    return copied;
  }

  async function copyText(text) {
    if (!text || text === "—" || text === "Erreur") {
      return;
    }

    let copied = false;

    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (error) {
      copied = copyWithSelection(text);
    }

    showToast(copied ? `Copié : ${text}` : "La copie a échoué.");
  }

  /* Tout élément marqué « copyable » se copie quand on le touche. */
  function copyFromElement(element) {
    copyText(element.dataset.copyValue || element.textContent.trim());
  }

  document.addEventListener("click", (event) => {
    const element = event.target.closest(".copyable");

    if (element) {
      copyFromElement(element);
    }
  });

  document.addEventListener("keydown", (event) => {
    const element = event.target.closest && event.target.closest(".copyable");

    if (element && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      copyFromElement(element);
    }
  });

  /* ------------------------------------------------------------------
     Thèmes
  ------------------------------------------------------------------ */

  const THEME_KEY = "omni-theme";
  const themeSelect = $("#theme-select");
  const themeMeta = $("#theme-color-meta");

  const validThemes = ["clair", "sombre", "nuit"];

  const themeColors = {
    clair: "#f4f6fb",
    sombre: "#0f141b",
    nuit: "#14111d"
  };

  function applyTheme(theme, persist = true) {
    const safeTheme = validThemes.includes(theme) ? theme : "clair";

    document.documentElement.dataset.theme = safeTheme;
    themeSelect.value = safeTheme;
    themeMeta.content = themeColors[safeTheme];

    if (persist) {
      storageSet(THEME_KEY, safeTheme);
    }
  }

  applyTheme(document.documentElement.dataset.theme, false);

  themeSelect.addEventListener("change", () => {
    applyTheme(themeSelect.value);
  });

  /* ------------------------------------------------------------------
     Navigation par onglets
  ------------------------------------------------------------------ */

  const tabs = Array.from(
    document.querySelectorAll("[role='tab']")
  );

  function activateTab(name) {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      const panel = document.getElementById(
        tab.getAttribute("aria-controls")
      );

      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panel.hidden = !active;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
    });

    tab.addEventListener("keydown", (event) => {
      let nextIndex = null;

      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        activateTab(tabs[nextIndex].dataset.tab);
        tabs[nextIndex].focus();
      }
    });
  });

  const requestedTab = new URLSearchParams(location.search).get("vue");

  if (tabs.some((tab) => tab.dataset.tab === requestedTab)) {
    activateTab(requestedTab);
  }

  /* ------------------------------------------------------------------
     Calculatrice
  ------------------------------------------------------------------ */

  const calcDisplay = $("#calc-display");
  const calcExpression = $("#calc-expression");
  const calculator = $(".calculator");
  const historyList = $("#history-list");
  const clearHistoryButton = $("#clear-history");

  const HISTORY_KEY = "omni-history-v1";
  const MAX_HISTORY = 40;

  const operatorSymbols = {
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷",
    "^": "^"
  };

  let current = "0";
  let previous = null;
  let pendingOperator = null;
  let waitingForOperand = false;
  let overwriteCurrent = false;
  let lastExpression = "";

  function numberToString(value) {
    if (Object.is(value, -0)) {
      value = 0;
    }

    // Limite les artefacts comme 0.1 + 0.2 = 0.30000000000000004.
    return String(
      Number.parseFloat(value.toPrecision(12))
    );
  }

  function formatDisplay(value) {
    const text = typeof value === "number"
      ? numberToString(value)
      : String(value);

    return text === "Erreur"
      ? text
      : text.replace(".", ",");
  }

  function updateDisplay() {
    calcDisplay.textContent = formatDisplay(current);

    if (pendingOperator && previous !== null) {
      calcExpression.textContent =
        `${formatDisplay(previous)} ${operatorSymbols[pendingOperator]}`;
    } else {
      calcExpression.textContent = lastExpression;
    }
  }

  function clearAll() {
    current = "0";
    previous = null;
    pendingOperator = null;
    waitingForOperand = false;
    overwriteCurrent = false;
    lastExpression = "";

    updateDisplay();
  }

  function showError(error) {
    current = "Erreur";
    previous = null;
    pendingOperator = null;
    waitingForOperand = false;
    overwriteCurrent = false;
    lastExpression = error.message || "Calcul impossible";

    updateDisplay();
  }

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
      throw new Error(
        "Le résultat n’est pas un nombre fini"
      );
    }

    return result;
  }

  function inputDigit(digit) {
    if (current === "Erreur") {
      clearAll();
    }

    if (waitingForOperand || overwriteCurrent) {
      current = digit;
      waitingForOperand = false;
      overwriteCurrent = false;
    } else if (current === "0") {
      current = digit;
    } else if (current === "-0") {
      current = `-${digit}`;
    } else {
      const digitCount = current.replace(/\D/g, "").length;

      if (digitCount >= 16) {
        return;
      }

      current += digit;
    }

    if (!pendingOperator) {
      lastExpression = "";
    }

    updateDisplay();
  }

  function inputDecimal() {
    if (current === "Erreur") {
      clearAll();
    }

    if (waitingForOperand || overwriteCurrent) {
      current = "0.";
      waitingForOperand = false;
      overwriteCurrent = false;
    } else if (
      !current.includes(".") &&
      !current.toLowerCase().includes("e")
    ) {
      current += ".";
    }

    if (!pendingOperator) {
      lastExpression = "";
    }

    updateDisplay();
  }

  function clearEntry() {
    if (current === "Erreur") {
      clearAll();
      return;
    }

    current = "0";
    waitingForOperand = false;
    overwriteCurrent = false;

    if (!pendingOperator) {
      previous = null;
      lastExpression = "";
    }

    updateDisplay();
  }

  function backspace() {
    if (
      current === "Erreur" ||
      waitingForOperand ||
      overwriteCurrent
    ) {
      return;
    }

    if (
      current.length <= 1 ||
      (current.length === 2 && current.startsWith("-"))
    ) {
      current = "0";
    } else {
      current = current.slice(0, -1);
    }

    updateDisplay();
  }

  function toggleSign() {
    if (
      current === "Erreur" ||
      current === "0" ||
      (waitingForOperand && pendingOperator)
    ) {
      return;
    }

    current = current.startsWith("-")
      ? current.slice(1)
      : `-${current}`;

    if (!pendingOperator) {
      lastExpression = "";
    }

    updateDisplay();
  }

  function chooseOperator(nextOperator) {
    if (current === "Erreur") {
      return;
    }

    // Remplace l'opérateur si le deuxième nombre
    // n'a pas encore été saisi.
    if (pendingOperator && waitingForOperand) {
      pendingOperator = nextOperator;
      updateDisplay();
      return;
    }

    const inputValue = Number(current);

    if (!Number.isFinite(inputValue)) {
      return;
    }

    try {
      if (previous === null) {
        previous = inputValue;
      } else if (pendingOperator) {
        const result = calculate(
          previous,
          inputValue,
          pendingOperator
        );

        previous = result;
        current = numberToString(result);
      } else {
        previous = inputValue;
      }
    } catch (error) {
      showError(error);
      return;
    }

    pendingOperator = nextOperator;
    waitingForOperand = true;
    overwriteCurrent = false;
    lastExpression = "";

    updateDisplay();
  }

  function equals() {
    if (
      current === "Erreur" ||
      !pendingOperator ||
      previous === null ||
      waitingForOperand
    ) {
      return;
    }

    const left = previous;
    const right = Number(current);
    const operator = pendingOperator;

    try {
      const result = calculate(left, right, operator);
      const resultText = numberToString(result);

      const expression =
        `${formatDisplay(left)} ` +
        `${operatorSymbols[operator]} ` +
        `${formatDisplay(right)}`;

      current = resultText;
      previous = null;
      pendingOperator = null;
      waitingForOperand = true;
      overwriteCurrent = false;
      lastExpression = `${expression} =`;

      addHistory(expression, resultText);
      updateDisplay();
    } catch (error) {
      showError(error);
    }
  }

  function applyUnary(operation) {
    if (
      current === "Erreur" ||
      (waitingForOperand && pendingOperator)
    ) {
      return;
    }

    const value = Number(current);

    if (!Number.isFinite(value)) {
      return;
    }

    let result;
    let label;

    try {
      switch (operation) {
        case "percent":
          // 200 + 10 % donne 220.
          // 200 × 10 % donne 20.
          if (
            previous !== null &&
            pendingOperator &&
            ["+", "-"].includes(pendingOperator)
          ) {
            result = previous * value / 100;
          } else {
            result = value / 100;
          }

          label = `${formatDisplay(value)} %`;
          break;

        case "sqrt":
          if (value < 0) {
            throw new Error(
              "Racine carrée d’un nombre négatif impossible"
            );
          }

          result = Math.sqrt(value);
          label = `√(${formatDisplay(value)})`;
          break;

        case "square":
          result = value * value;
          label = `(${formatDisplay(value)})²`;
          break;

        case "inverse":
          if (value === 0) {
            throw new Error("Inverse de zéro impossible");
          }

          result = 1 / value;
          label = `1 ÷ (${formatDisplay(value)})`;
          break;

        default:
          return;
      }

      if (!Number.isFinite(result)) {
        throw new Error(
          "Le résultat n’est pas un nombre fini"
        );
      }
    } catch (error) {
      showError(error);
      return;
    }

    const resultText = numberToString(result);
    current = resultText;

    if (pendingOperator && previous !== null) {
      // Le résultat devient l'opérande de droite.
      waitingForOperand = false;
      overwriteCurrent = true;
    } else {
      previous = null;
      pendingOperator = null;
      waitingForOperand = true;
      overwriteCurrent = false;
      lastExpression = `${label} =`;

      addHistory(label, resultText);
    }

    updateDisplay();
  }

  /* Vibration légère des touches (Android ; l'iPhone ne sait pas). */
  const VIBRATION_KEY = "omni-vibration";
  const vibrationSetting = $("#vibration-setting");
  const vibrationToggle = $("#vibration-toggle");
  const canVibrate = typeof navigator.vibrate === "function";

  vibrationSetting.hidden = !canVibrate;
  vibrationToggle.checked = storageGet(VIBRATION_KEY) !== "off";

  vibrationToggle.addEventListener("change", () => {
    storageSet(VIBRATION_KEY, vibrationToggle.checked ? "on" : "off");

    if (vibrationToggle.checked) {
      navigator.vibrate(12);
    }
  });

  function keyFeedback() {
    if (canVibrate && vibrationToggle.checked) {
      navigator.vibrate(8);
    }
  }

  $("#calc-screen").addEventListener("click", () => {
    copyText(formatDisplay(current));
  });

  calculator.addEventListener("click", (event) => {
    const button = event.target.closest("button.key");

    if (!button) {
      return;
    }

    keyFeedback();

    if (button.dataset.digit !== undefined) {
      inputDigit(button.dataset.digit);
      return;
    }

    if (button.dataset.operator) {
      chooseOperator(button.dataset.operator);
      return;
    }

    if (button.dataset.unary) {
      applyUnary(button.dataset.unary);
      return;
    }

    const actions = {
      "clear-all": clearAll,
      "clear-entry": clearEntry,
      backspace,
      decimal: inputDecimal,
      "toggle-sign": toggleSign,
      equals
    };

    const action = actions[button.dataset.action];

    if (action) {
      action();
    }
  });

  /* ------------------------------------------------------------------
     Historique des calculs
  ------------------------------------------------------------------ */

  function loadHistory() {
    try {
      const parsed = JSON.parse(
        storageGet(HISTORY_KEY) || "[]"
      );

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item) =>
          item &&
          typeof item.expression === "string" &&
          typeof item.result === "string" &&
          Number.isFinite(Number(item.result))
        )
        .slice(0, MAX_HISTORY);
    } catch (error) {
      return [];
    }
  }

  let calculationHistory = loadHistory();

  function saveHistory() {
    storageSet(
      HISTORY_KEY,
      JSON.stringify(calculationHistory)
    );
  }

  function renderHistory() {
    historyList.replaceChildren();

    clearHistoryButton.disabled =
      calculationHistory.length === 0;

    if (calculationHistory.length === 0) {
      const emptyItem = document.createElement("li");

      emptyItem.className = "history-empty";
      emptyItem.textContent = "Aucun calcul enregistré.";

      historyList.append(emptyItem);
      return;
    }

    calculationHistory.forEach((item, index) => {
      const listItem = document.createElement("li");
      const button = document.createElement("button");
      const expression = document.createElement("span");
      const result = document.createElement("strong");

      button.type = "button";
      button.className = "history-entry";
      button.dataset.historyIndex = String(index);

      button.setAttribute(
        "aria-label",
        `Reprendre le résultat ${formatDisplay(item.result)}`
      );

      expression.textContent = `${item.expression} =`;
      result.textContent = formatDisplay(item.result);

      const copyButton = document.createElement("button");

      copyButton.type = "button";
      copyButton.className = "history-copy";
      copyButton.dataset.copyIndex = String(index);
      copyButton.textContent = "⧉";
      copyButton.title = "Copier";
      copyButton.setAttribute(
        "aria-label",
        `Copier le résultat ${formatDisplay(item.result)}`
      );

      button.append(expression, result);
      listItem.append(button, copyButton);
      historyList.append(listItem);
    });
  }

  function addHistory(expression, result) {
    calculationHistory.unshift({
      expression,
      result
    });

    calculationHistory = calculationHistory.slice(
      0,
      MAX_HISTORY
    );

    saveHistory();
    renderHistory();
  }

  historyList.addEventListener("click", (event) => {
    const copyButton = event.target.closest("button[data-copy-index]");

    if (copyButton) {
      const copied = calculationHistory[Number(copyButton.dataset.copyIndex)];

      if (copied) {
        copyText(formatDisplay(copied.result));
      }

      return;
    }

    const button = event.target.closest(
      "button[data-history-index]"
    );

    if (!button) {
      return;
    }

    const item = calculationHistory[
      Number(button.dataset.historyIndex)
    ];

    if (!item) {
      return;
    }

    current = item.result;

    if (pendingOperator && previous !== null) {
      // Calcul en cours (ex. « 5 + ») : le résultat repris
      // devient le second nombre au lieu d'annuler le calcul.
      waitingForOperand = false;
      overwriteCurrent = true;
    } else {
      previous = null;
      pendingOperator = null;
      waitingForOperand = true;
      overwriteCurrent = false;
      lastExpression = "";
    }

    updateDisplay();
  });

  clearHistoryButton.addEventListener("click", () => {
    calculationHistory = [];

    saveHistory();
    renderHistory();
  });

  renderHistory();
  updateDisplay();

  /* ------------------------------------------------------------------
     Convertisseur de devises
  ------------------------------------------------------------------ */

  /* Devises publiées chaque jour par la Banque centrale européenne. */
  const CURRENCIES = {
    EUR: "Euro",
    USD: "Dollar américain",
    GBP: "Livre sterling",
    CHF: "Franc suisse",
    CAD: "Dollar canadien",
    JPY: "Yen japonais",
    AUD: "Dollar australien",
    BRL: "Réal brésilien",
    CNY: "Yuan chinois",
    CZK: "Couronne tchèque",
    DKK: "Couronne danoise",
    HKD: "Dollar de Hong Kong",
    HUF: "Forint hongrois",
    IDR: "Roupie indonésienne",
    ILS: "Shekel israélien",
    INR: "Roupie indienne",
    ISK: "Couronne islandaise",
    KRW: "Won sud-coréen",
    MXN: "Peso mexicain",
    MYR: "Ringgit malaisien",
    NOK: "Couronne norvégienne",
    NZD: "Dollar néo-zélandais",
    PHP: "Peso philippin",
    PLN: "Złoty polonais",
    RON: "Leu roumain",
    SEK: "Couronne suédoise",
    SGD: "Dollar de Singapour",
    THB: "Baht thaïlandais",
    TRY: "Livre turque",
    ZAR: "Rand sud-africain",
    XOF: "Franc CFA d’Afrique de l’Ouest",
    XAF: "Franc CFA d’Afrique centrale",
    XPF: "Franc pacifique",
    KMF: "Franc comorien"
  };

  const CURRENCY_CODES = Object.keys(CURRENCIES);
  const RATES_KEY = "omni-rates-v1";
  const FAVORITES_KEY = "omni-favorite-currencies-v1";
  const PAIR_KEY = "omni-currency-pair-v1";
  const DEFAULT_FAVORITES = ["EUR", "USD", "GBP", "CHF", "CAD", "JPY"];

  /*
   * Monnaies à parité fixe avec l'euro : leur taux ne change jamais,
   * il est donc exact même sans connexion.
   */
  const FIXED_RATES = {
    EUR: 1,
    XOF: 655.957,
    XAF: 655.957,
    XPF: 119.331742,
    KMF: 491.96775
  };

  /*
   * Correction de l'ancienne adresse api.frankfurter.app,
   * qui provoquait l'erreur 301. Sans liste de devises, l'API
   * renvoie toutes celles de la BCE.
   */
  const RATES_URL =
    "https://api.frankfurter.dev/v1/latest?base=EUR";

  // Valeurs de dernier recours, et non cours de marché actuels.
  const EMBEDDED_RATES = {
    base: "EUR",
    date: null,
    source: null,
    rates: {
      USD: 1.16,
      GBP: 0.87,
      CHF: 0.93,
      CAD: 1.62,
      JPY: 175,
      AUD: 1.77,
      BRL: 6.3,
      CNY: 8.3,
      CZK: 24.4,
      DKK: 7.46,
      HKD: 9.05,
      HUF: 390,
      IDR: 19200,
      ILS: 3.9,
      INR: 102,
      ISK: 143,
      KRW: 1650,
      MXN: 21.6,
      MYR: 4.9,
      NOK: 11.7,
      NZD: 2.0,
      PHP: 67,
      PLN: 4.25,
      RON: 5.08,
      SEK: 11.0,
      SGD: 1.5,
      THB: 37.5,
      TRY: 48,
      ZAR: 20.3
    }
  };

  const amountInput = $("#amount");
  const fromSelect = $("#from-currency");
  const toSelect = $("#to-currency");
  const conversionResult = $("#conversion-result");
  const unitRate = $("#unit-rate");
  const rateStatus = $("#rate-status");
  const refreshRatesButton = $("#refresh-rates");
  const swapButton = $("#swap-currencies");
  const starButtons = Array.from(
    document.querySelectorAll("[data-favorite-for]")
  );

  let rateState = EMBEDDED_RATES;
  let rateKind = "embedded";
  let isFetchingRates = false;

  function validRateData(data) {
    return Boolean(
      data &&
      data.rates &&
      typeof data.rates === "object" &&
      Number(data.rates.USD) > 0
    );
  }

  function loadStoredRates() {
    try {
      const data = JSON.parse(
        storageGet(RATES_KEY) || "null"
      );

      return validRateData(data) ? data : null;
    } catch (error) {
      return null;
    }
  }

  /*
   * Taux d'une devise par rapport à l'euro, et sa provenance :
   * « fixed » (parité fixe), « current » (taux téléchargés)
   * ou « embedded » (valeur de secours approximative).
   */
  function rateFor(code) {
    if (FIXED_RATES[code]) {
      return { rate: FIXED_RATES[code], kind: "fixed" };
    }

    const downloaded = Number(rateState.rates[code]);

    if (rateKind !== "embedded" && Number.isFinite(downloaded) && downloaded > 0) {
      return { rate: downloaded, kind: "current" };
    }

    const embedded = Number(EMBEDDED_RATES.rates[code]);

    return Number.isFinite(embedded) && embedded > 0
      ? { rate: embedded, kind: "embedded" }
      : null;
  }

  /* Favoris et dernière paire choisie */

  function loadFavorites() {
    try {
      const stored = JSON.parse(storageGet(FAVORITES_KEY) || "null");

      if (Array.isArray(stored)) {
        return stored.filter((code) => CURRENCY_CODES.includes(code));
      }
    } catch (error) {
      // Favoris illisibles : on repart des favoris par défaut.
    }

    return DEFAULT_FAVORITES.slice();
  }

  let favorites = loadFavorites();

  function currencyLabel(code) {
    return `${code} — ${CURRENCIES[code]}`;
  }

  function fillCurrencySelect(select) {
    const value = select.value;
    const others = CURRENCY_CODES
      .filter((code) => !favorites.includes(code))
      .sort((a, b) => CURRENCIES[a].localeCompare(CURRENCIES[b], "fr"));

    select.replaceChildren();

    [["Favoris", favorites], ["Autres devises", others]].forEach(
      ([label, codes]) => {
        if (codes.length === 0) {
          return;
        }

        const group = document.createElement("optgroup");
        group.label = label;

        codes.forEach((code) => {
          const option = document.createElement("option");

          option.value = code;
          option.textContent = currencyLabel(code);
          group.append(option);
        });

        select.append(group);
      }
    );

    if (value) {
      select.value = value;
    }
  }

  function populateCurrencySelects() {
    fillCurrencySelect(fromSelect);
    fillCurrencySelect(toSelect);

    let pair = null;

    try {
      pair = JSON.parse(storageGet(PAIR_KEY) || "null");
    } catch (error) {
      pair = null;
    }

    const valid = (code) => CURRENCY_CODES.includes(code);

    fromSelect.value = pair && valid(pair.from) ? pair.from : "EUR";
    toSelect.value = pair && valid(pair.to) ? pair.to : "USD";
  }

  function savePair() {
    storageSet(
      PAIR_KEY,
      JSON.stringify({ from: fromSelect.value, to: toSelect.value })
    );
  }

  function updateStars() {
    starButtons.forEach((button) => {
      const code = document.getElementById(button.dataset.favoriteFor).value;
      const favorite = favorites.includes(code);

      button.textContent = favorite ? "★" : "☆";
      button.setAttribute("aria-pressed", String(favorite));
      button.setAttribute(
        "aria-label",
        favorite
          ? `Retirer ${code} des favoris`
          : `Ajouter ${code} aux favoris`
      );
      button.title = button.getAttribute("aria-label");
    });
  }

  function toggleFavorite(code) {
    if (favorites.includes(code)) {
      favorites = favorites.filter((item) => item !== code);
      showToast(`${code} retiré des favoris`);
    } else {
      favorites.push(code);
      showToast(`${code} ajouté aux favoris`);
    }

    storageSet(FAVORITES_KEY, JSON.stringify(favorites));
    fillCurrencySelect(fromSelect);
    fillCurrencySelect(toSelect);
    updateStars();
  }

  starButtons.forEach((button) => {
    button.addEventListener("click", () => {
      toggleFavorite(
        document.getElementById(button.dataset.favoriteFor).value
      );
    });
  });

  function formatRate(value) {
    return new Intl.NumberFormat("fr-FR", {
      maximumSignificantDigits: 8
    }).format(value);
  }

  function updateConversion() {
    // Accepte « 1,5 », « 1.5 » et « 1 000 » (espaces de milliers).
    const amount = parseNumber(amountInput.value);

    const from = fromSelect.value;
    const to = toSelect.value;

    if (!Number.isFinite(amount)) {
      setCopyable(conversionResult, "—");
      unitRate.textContent =
        "Saisissez un montant positif ou nul.";
      return;
    }

    const fromRate = rateFor(from);
    const toRate = rateFor(to);

    if (!fromRate || !toRate) {
      setCopyable(conversionResult, "—");
      unitRate.textContent =
        "Les taux nécessaires à cette conversion sont indisponibles.";
      return;
    }

    const oneUnit = toRate.rate / fromRate.rate;
    const converted = amount * oneUnit;

    if (!Number.isFinite(converted)) {
      setCopyable(conversionResult, "—");
      unitRate.textContent =
        "Le montant est trop grand pour être converti.";
      return;
    }

    // Chaque devise garde son nombre habituel de décimales (0 pour le yen).
    const formatter = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: to
    });
    const decimals = formatter.resolvedOptions().maximumFractionDigits;

    setCopyable(
      conversionResult,
      formatter.format(converted),
      new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: false
      }).format(converted)
    );

    let detail =
      `1 ${from} = ${formatRate(oneUnit)} ${to} · ` +
      `1 ${to} = ${formatRate(1 / oneUnit)} ${from}`;

    // Devise absente des derniers taux téléchargés : on le signale.
    const approximate = [fromRate, toRate].some((rate) => rate.kind === "embedded");

    if (approximate && rateKind !== "embedded") {
      detail += " · Taux approximatif : actualisez les taux.";
    } else if (fromRate.kind === "fixed" && toRate.kind === "fixed") {
      detail += " · Parité fixe, taux exact.";
    }

    unitRate.textContent = detail;
  }

  function formatRateDate(isoDate) {
    if (!isoDate) {
      return "date inconnue";
    }

    const date = new Date(`${isoDate}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return isoDate;
    }

    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long"
    }).format(date);
  }

  function updateRateStatus(prefix = "") {
    const offlineText = navigator.onLine
      ? ""
      : "Hors ligne. ";

    if (rateKind === "embedded") {
      rateStatus.textContent =
        `${offlineText}${prefix}` +
        "Taux de secours intégrés, approximatifs et non actualisés. " +
        "Connectez-vous pour télécharger des taux récents.";
      return;
    }

    const source = rateState.source || "enregistrés";
    const date = formatRateDate(rateState.date);

    rateStatus.textContent =
      `${offlineText}${prefix}` +
      `Taux ${source} du ${date}. ` +
      "La dernière version connue est conservée sur cet appareil.";
  }

  async function refreshRates() {
    if (isFetchingRates) {
      return;
    }

    if (!navigator.onLine) {
      updateRateStatus("Actualisation impossible. ");
      return;
    }

    isFetchingRates = true;
    refreshRatesButton.disabled = true;
    refreshRatesButton.setAttribute("aria-busy", "true");
    rateStatus.textContent = "Actualisation des taux…";

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    try {
      const response = await fetch(RATES_URL, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          `Le serveur des taux a répondu HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (
        !data ||
        !data.rates ||
        typeof data.rates !== "object"
      ) {
        throw new Error(
          "La réponse de l’API ne contient pas de taux exploitables"
        );
      }

      // On ne garde que les devises connues, avec un taux valable.
      const rates = {};

      CURRENCY_CODES.forEach((code) => {
        const rate = Number(data.rates[code]);

        if (Number.isFinite(rate) && rate > 0) {
          rates[code] = rate;
        }
      });

      const candidate = {
        base: "EUR",
        date: data.date || null,
        fetchedAt: Date.now(),
        source: "Frankfurter / BCE",
        rates
      };

      if (!validRateData(candidate)) {
        throw new Error(
          "Certaines devises nécessaires sont absentes ou invalides"
        );
      }

      const codes = Object.keys(rates);
      const ratesUnchanged =
        rateKind !== "embedded" &&
        candidate.date === rateState.date &&
        codes.length === Object.keys(rateState.rates).length &&
        codes.every((code) =>
          rates[code] === Number(rateState.rates[code])
        );

      // Application des données reçues à l'état du convertisseur.
      rateState = candidate;
      rateKind = "live";

      const saved = storageSet(
        RATES_KEY,
        JSON.stringify(candidate)
      );

      if (!saved) {
        console.warn(
          "Les taux ont été appliqués, mais n’ont pas pu " +
          "être enregistrés localement."
        );
      }

      // Mise à jour immédiate du résultat et du taux unitaire.
      updateConversion();

      const time = new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date());

      if (ratesUnchanged) {
        updateRateStatus(
          `Vérification effectuée à ${time} : ` +
          "le fournisseur n’a publié aucun nouveau taux. "
        );
      } else {
        updateRateStatus(
          `Nouveaux taux appliqués à ${time}. `
        );
      }

      console.info(
        "Taux de change correctement récupérés :",
        candidate
      );
    } catch (error) {
      console.error(
        "Échec de l’actualisation des taux :",
        error
      );

      updateRateStatus(
        "Actualisation impossible ; " +
        "les derniers taux connus sont conservés. "
      );
    } finally {
      clearTimeout(timeout);

      isFetchingRates = false;
      refreshRatesButton.disabled = false;
      refreshRatesButton.removeAttribute("aria-busy");
    }
  }

  amountInput.addEventListener(
    "input",
    updateConversion
  );

  [fromSelect, toSelect].forEach((select) => {
    select.addEventListener("change", () => {
      savePair();
      updateStars();
      updateConversion();
    });
  });

  swapButton.addEventListener("click", () => {
    const previousFrom = fromSelect.value;

    fromSelect.value = toSelect.value;
    toSelect.value = previousFrom;

    savePair();
    updateStars();
    updateConversion();
  });

  refreshRatesButton.addEventListener(
    "click",
    refreshRates
  );

  window.addEventListener("offline", () => {
    updateRateStatus();
  });

  window.addEventListener("online", refreshRates);

  populateCurrencySelects();
  updateStars();

  const storedRates = loadStoredRates();

  if (storedRates) {
    rateState = storedRates;
    rateKind = "stored";
  }

  updateConversion();
  updateRateStatus();

  if (navigator.onLine) {
    refreshRates();
  }

  /* ------------------------------------------------------------------
     Convertisseur d'unités
  ------------------------------------------------------------------ */

  /*
   * Chaque unité a un coefficient vers l'unité de référence de sa
   * grandeur (le mètre pour les longueurs, le kilogramme pour les
   * masses…). Les températures, qui ne sont pas proportionnelles,
   * ont leurs propres formules.
   */
  const UNIT_CATEGORIES = [
    {
      id: "longueur",
      label: "Longueur",
      defaults: ["km", "mi"],
      units: [
        ["mm", "millimètre", 0.001],
        ["cm", "centimètre", 0.01],
        ["m", "mètre", 1],
        ["km", "kilomètre", 1000],
        ["in", "pouce", 0.0254],
        ["ft", "pied", 0.3048],
        ["yd", "yard", 0.9144],
        ["mi", "mile", 1609.344],
        ["M", "mille marin", 1852]
      ]
    },
    {
      id: "masse",
      label: "Poids (masse)",
      defaults: ["kg", "lb"],
      units: [
        ["mg", "milligramme", 1e-6],
        ["g", "gramme", 0.001],
        ["kg", "kilogramme", 1],
        ["t", "tonne", 1000],
        ["oz", "once", 0.028349523125],
        ["lb", "livre anglaise", 0.45359237],
        ["st", "stone", 6.35029318]
      ]
    },
    {
      id: "temperature",
      label: "Température",
      defaults: ["°C", "°F"],
      units: [
        ["°C", "degré Celsius"],
        ["°F", "degré Fahrenheit"],
        ["K", "kelvin"]
      ],
      toBase: {
        "°C": (value) => value,
        "°F": (value) => (value - 32) * 5 / 9,
        K: (value) => value - 273.15
      },
      fromBase: {
        "°C": (value) => value,
        "°F": (value) => value * 9 / 5 + 32,
        K: (value) => value + 273.15
      }
    },
    {
      id: "volume",
      label: "Volume et cuisine",
      defaults: ["c. à s.", "mL"],
      units: [
        ["mL", "millilitre", 0.001],
        ["cL", "centilitre", 0.01],
        ["dL", "décilitre", 0.1],
        ["L", "litre", 1],
        ["m³", "mètre cube", 1000],
        ["c. à c.", "cuillère à café", 0.005],
        ["c. à s.", "cuillère à soupe", 0.015],
        ["tasse", "tasse (25 cL)", 0.25],
        ["cup", "tasse américaine (cup)", 0.2365882365],
        ["fl oz", "once liquide américaine", 0.0295735295625],
        ["pt", "pinte anglaise", 0.56826125],
        ["gal", "gallon américain", 3.785411784]
      ]
    },
    {
      id: "surface",
      label: "Surface",
      defaults: ["m²", "ft²"],
      units: [
        ["cm²", "centimètre carré", 1e-4],
        ["m²", "mètre carré", 1],
        ["a", "are", 100],
        ["ha", "hectare", 10000],
        ["km²", "kilomètre carré", 1e6],
        ["ft²", "pied carré", 0.09290304],
        ["ac", "acre", 4046.8564224],
        ["mi²", "mile carré", 2589988.110336]
      ]
    },
    {
      id: "vitesse",
      label: "Vitesse",
      defaults: ["km/h", "mi/h"],
      units: [
        ["m/s", "mètre par seconde", 1],
        ["km/h", "kilomètre par heure", 1 / 3.6],
        ["mi/h", "mile par heure", 0.44704],
        ["nd", "nœud", 1852 / 3600]
      ]
    },
    {
      id: "duree",
      label: "Durée",
      defaults: ["h", "min"],
      units: [
        ["s", "seconde", 1],
        ["min", "minute", 60],
        ["h", "heure", 3600],
        ["j", "jour", 86400],
        ["sem.", "semaine", 604800],
        ["an", "année (365 jours)", 31536000]
      ]
    },
    {
      id: "energie",
      label: "Énergie (calories)",
      defaults: ["kcal", "kJ"],
      units: [
        ["J", "joule", 1],
        ["kJ", "kilojoule", 1000],
        ["cal", "calorie", 4.184],
        ["kcal", "kilocalorie", 4184],
        ["Wh", "wattheure", 3600],
        ["kWh", "kilowattheure", 3.6e6]
      ]
    },
    {
      id: "donnees",
      label: "Données informatiques",
      defaults: ["Go", "Mo"],
      units: [
        ["bit", "bit", 0.125],
        ["o", "octet", 1],
        ["Ko", "kilooctet", 1e3],
        ["Mo", "mégaoctet", 1e6],
        ["Go", "gigaoctet", 1e9],
        ["To", "téraoctet", 1e12],
        ["Kio", "kibioctet", 1024],
        ["Mio", "mébioctet", 1024 ** 2],
        ["Gio", "gibioctet", 1024 ** 3]
      ]
    }
  ];

  const UNITS_KEY = "omni-units-v1";
  const unitCategorySelect = $("#unit-category");
  const unitValueInput = $("#unit-value");
  const unitFromSelect = $("#unit-from");
  const unitToSelect = $("#unit-to");
  const unitResult = $("#unit-result");
  const unitDetail = $("#unit-detail");

  function currentCategory() {
    return UNIT_CATEGORIES.find(
      (category) => category.id === unitCategorySelect.value
    ) || UNIT_CATEGORIES[0];
  }

  function convertUnit(category, value, from, to) {
    if (category.toBase) {
      return category.fromBase[to](category.toBase[from](value));
    }

    const factor = (symbol) =>
      category.units.find((unit) => unit[0] === symbol)[2];

    return value * factor(from) / factor(to);
  }

  function fillUnitSelects(category, from, to) {
    [unitFromSelect, unitToSelect].forEach((select) => {
      select.replaceChildren(
        ...category.units.map(([symbol, name]) => {
          const option = document.createElement("option");

          option.value = symbol;
          option.textContent = symbol === name ? name : `${name} (${symbol})`;
          return option;
        })
      );
    });

    const known = (symbol) => category.units.some((unit) => unit[0] === symbol);

    unitFromSelect.value = known(from) ? from : category.defaults[0];
    unitToSelect.value = known(to) ? to : category.defaults[1];
  }

  function saveUnits() {
    storageSet(UNITS_KEY, JSON.stringify({
      category: unitCategorySelect.value,
      from: unitFromSelect.value,
      to: unitToSelect.value
    }));
  }

  function updateUnitConversion() {
    const category = currentCategory();
    const value = parseNumber(unitValueInput.value, true);
    const from = unitFromSelect.value;
    const to = unitToSelect.value;

    if (!Number.isFinite(value)) {
      setCopyable(unitResult, "—");
      unitDetail.textContent = "Saisissez une valeur, par exemple 12,5.";
      return;
    }

    const result = convertUnit(category, value, from, to);

    if (!Number.isFinite(result)) {
      setCopyable(unitResult, "—");
      unitDetail.textContent = "La valeur est trop grande pour être convertie.";
      return;
    }

    setCopyable(
      unitResult,
      `${formatNumber(result)} ${to}`,
      formatNumber(result, false)
    );

    if (category.toBase) {
      unitDetail.textContent =
        `L’eau gèle à 0 °C, soit 32 °F ou 273,15 K, ` +
        "et bout à 100 °C, soit 212 °F.";
    } else {
      unitDetail.textContent =
        `1 ${from} = ${formatNumber(convertUnit(category, 1, from, to))} ${to}`;
    }
  }

  function setupUnits() {
    unitCategorySelect.replaceChildren(
      ...UNIT_CATEGORIES.map((category) => {
        const option = document.createElement("option");

        option.value = category.id;
        option.textContent = category.label;
        return option;
      })
    );

    let saved = null;

    try {
      saved = JSON.parse(storageGet(UNITS_KEY) || "null");
    } catch (error) {
      saved = null;
    }

    const savedCategory = saved && UNIT_CATEGORIES.find(
      (category) => category.id === saved.category
    );

    unitCategorySelect.value = (savedCategory || UNIT_CATEGORIES[0]).id;
    fillUnitSelects(
      currentCategory(),
      savedCategory ? saved.from : null,
      savedCategory ? saved.to : null
    );
    updateUnitConversion();

    unitCategorySelect.addEventListener("change", () => {
      fillUnitSelects(currentCategory(), null, null);
      saveUnits();
      updateUnitConversion();
    });

    [unitFromSelect, unitToSelect].forEach((select) => {
      select.addEventListener("change", () => {
        saveUnits();
        updateUnitConversion();
      });
    });

    unitValueInput.addEventListener("input", updateUnitConversion);

    $("#swap-units").addEventListener("click", () => {
      const previousFrom = unitFromSelect.value;

      unitFromSelect.value = unitToSelect.value;
      unitToSelect.value = previousFrom;
      saveUnits();
      updateUnitConversion();
    });
  }

  setupUnits();

  /* ------------------------------------------------------------------
     Outils : addition et pourboire, remise, pourcentages
  ------------------------------------------------------------------ */

  const MAX_PEOPLE = 99;
  const billAmountInput = $("#bill-amount");
  const tipInput = $("#tip-percent");
  const tipChips = Array.from(document.querySelectorAll("[data-tip]"));
  const peopleOutput = $("#people-count");
  let people = 1;

  /* Montant et version à copier, ou un tiret si le calcul est impossible. */
  function showMoney(element, value) {
    if (Number.isFinite(value)) {
      setCopyable(element, formatMoney(value), formatMoney(value, false));
    } else {
      setCopyable(element, "—");
    }
  }

  function updateBill() {
    const amount = parseNumber(billAmountInput.value);
    const tipPercent = parseNumber(tipInput.value);

    tipChips.forEach((chip) => {
      chip.setAttribute(
        "aria-pressed",
        String(Number(chip.dataset.tip) === tipPercent)
      );
    });

    peopleOutput.textContent = String(people);

    if (!Number.isFinite(amount) || !Number.isFinite(tipPercent)) {
      ["#bill-tip", "#bill-total", "#bill-share"].forEach((id) => {
        setCopyable($(id), "—");
      });
      $("#bill-share").title = "";
      return;
    }

    const tip = amount * tipPercent / 100;
    const total = amount + tip;

    /*
     * La part de chacun est arrondie au centime supérieur : en
     * payant tous cette somme, l'addition est toujours couverte.
     */
    const exactShare = total / people;
    const share = Math.ceil(Math.round(exactShare * 1e6) / 1e4) / 100;

    showMoney($("#bill-tip"), tip);
    showMoney($("#bill-total"), total);
    showMoney($("#bill-share"), share);

    $("#bill-share").title = share > exactShare + 1e-9
      ? "Arrondi au centime supérieur"
      : "";
  }

  tipChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      tipInput.value = chip.dataset.tip;
      updateBill();
    });
  });

  document.querySelectorAll("[data-people-step]").forEach((button) => {
    button.addEventListener("click", () => {
      people = Math.min(
        MAX_PEOPLE,
        Math.max(1, people + Number(button.dataset.peopleStep))
      );
      updateBill();
    });
  });

  [billAmountInput, tipInput].forEach((input) => {
    input.addEventListener("input", updateBill);
  });

  function updateDiscount() {
    const price = parseNumber($("#discount-price").value);
    const percent = parseNumber($("#discount-percent").value);

    if (!Number.isFinite(price) || !Number.isFinite(percent) || percent > 100) {
      setCopyable($("#discount-saving"), "—");
      setCopyable(
        $("#discount-final"),
        Number.isFinite(percent) && percent > 100 ? "Remise > 100 %" : "—"
      );
      return;
    }

    const saving = price * percent / 100;

    showMoney($("#discount-saving"), saving);
    showMoney($("#discount-final"), price - saving);
  }

  ["#discount-price", "#discount-percent"].forEach((id) => {
    $(id).addEventListener("input", updateDiscount);
  });

  function formatPercent(value, signed = false) {
    const sign = signed && value > 0 ? "+" : "";

    return `${sign}${formatNumber(value, true, 6)} %`;
  }

  function updatePercentages() {
    const read = (id) => parseNumber($(id).value, true);

    // Combien font X % de Y ?
    const rate = read("#pct-of-rate");
    const base = read("#pct-of-base");
    const ofResult = rate * base / 100;

    setCopyable(
      $("#pct-of-result"),
      Number.isFinite(ofResult) ? formatNumber(ofResult) : "—",
      Number.isFinite(ofResult) ? formatNumber(ofResult, false) : null
    );

    // X représente quel pourcentage de Y ?
    const part = read("#pct-part");
    const whole = read("#pct-whole");
    const share = whole === 0 ? NaN : part / whole * 100;

    setCopyable(
      $("#pct-share-result"),
      Number.isFinite(share) ? formatPercent(share) : "—",
      Number.isFinite(share) ? formatNumber(share, false, 6) : null
    );

    // Évolution de A à B, en pourcentage.
    const start = read("#pct-from");
    const end = read("#pct-to");
    const change = start === 0 ? NaN : (end - start) / Math.abs(start) * 100;

    setCopyable(
      $("#pct-change-result"),
      Number.isFinite(change)
        ? `${formatPercent(change, true)} ${change > 0 ? "(hausse)" : change < 0 ? "(baisse)" : ""}`.trim()
        : "—",
      Number.isFinite(change) ? formatNumber(change, false, 6) : null
    );
  }

  document.querySelectorAll("#tool-percent input").forEach((input) => {
    input.addEventListener("input", updatePercentages);
  });

  // Ces formulaires calculent en direct : la touche Entrée ne recharge rien.
  document.querySelectorAll(".tool").forEach((form) => {
    form.addEventListener("submit", (event) => event.preventDefault());
  });

  updateBill();
  updateDiscount();
  updatePercentages();

  /* ------------------------------------------------------------------
     À propos
  ------------------------------------------------------------------ */

  const aboutDialog = $("#about-dialog");

  $("#about-button").addEventListener("click", () => {
    aboutDialog.showModal();
  });

  // Un appui à côté de la fenêtre la ferme aussi.
  aboutDialog.addEventListener("click", (event) => {
    if (event.target === aboutDialog) {
      aboutDialog.close();
    }
  });

  /* ------------------------------------------------------------------
     Installation et Service Worker
  ------------------------------------------------------------------ */

  const installButton = $("#install-button");
  let deferredInstallPrompt = null;

  window.addEventListener(
    "beforeinstallprompt",
    (event) => {
      event.preventDefault();

      deferredInstallPrompt = event;
      installButton.hidden = false;
    }
  );

  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    deferredInstallPrompt.prompt();

    try {
      await deferredInstallPrompt.userChoice;
    } finally {
      deferredInstallPrompt = null;
      installButton.hidden = true;
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });

  const canRegisterServiceWorker =
    "serviceWorker" in navigator &&
    (
      location.protocol === "https:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(
        location.hostname
      )
    );

  /*
   * Nouvelle version : le Service Worker la télécharge en arrière-plan
   * puis attend. On propose alors un bandeau « Mettre à jour » ; un
   * appui active la nouvelle version et recharge la page.
   */
  const updateBanner = $("#update-banner");
  const updateButton = $("#update-button");
  let waitingWorker = null;
  let updateRequested = false;

  function offerUpdate(worker) {
    waitingWorker = worker;
    updateBanner.hidden = false;
  }

  function watchForUpdates(registration) {
    if (registration.waiting && navigator.serviceWorker.controller) {
      offerUpdate(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;

      if (!worker) {
        return;
      }

      worker.addEventListener("statechange", () => {
        // Sans « controller », c'est la toute première installation.
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          offerUpdate(worker);
        }
      });
    });

    // Cherche une mise à jour à chaque retour dans l'application.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        registration.update().catch(() => {});
      }
    });
  }

  updateButton.addEventListener("click", () => {
    if (!waitingWorker) {
      return;
    }

    updateRequested = true;
    updateButton.disabled = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  });

  if (canRegisterServiceWorker) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (updateRequested) {
        updateRequested = false;
        location.reload();
      }
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js")
        .then(watchForUpdates)
        .catch((error) => {
          console.warn(
            "Service Worker non enregistré :",
            error
          );
        });
    });
  }
})();
