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
     Thèmes
  ------------------------------------------------------------------ */

  const THEME_KEY = "omni-theme";
  const themeSelect = $("#theme-select");
  const themeMeta = $("#theme-color-meta");

  const validThemes = ["clair", "sombre", "nuit"];

  const themeColors = {
    clair: "#f4f6fb",
    sombre: "#0f141b",
    nuit: "#0d0916"
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

  if (
    new URLSearchParams(location.search).get("vue") === "devises"
  ) {
    activateTab("devises");
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

  calculator.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) {
      return;
    }

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

      button.append(expression, result);
      listItem.append(button);
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
    previous = null;
    pendingOperator = null;
    waitingForOperand = true;
    overwriteCurrent = false;
    lastExpression = "";

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

  const CURRENCIES = {
    EUR: "Euro",
    USD: "Dollar américain",
    GBP: "Livre sterling",
    JPY: "Yen japonais",
    CHF: "Franc suisse",
    CAD: "Dollar canadien"
  };

  const CURRENCY_CODES = Object.keys(CURRENCIES);
  const RATES_KEY = "omni-rates-v1";

  /*
   * Correction de l'ancienne adresse api.frankfurter.app,
   * qui provoquait l'erreur 301.
   */
  const RATES_URL =
    "https://api.frankfurter.dev/v1/latest" +
    "?base=EUR&symbols=USD,GBP,JPY,CHF,CAD";

  // Valeurs de dernier recours, et non cours de marché actuels.
  const EMBEDDED_RATES = {
    base: "EUR",
    date: null,
    source: null,
    rates: {
      EUR: 1,
      USD: 1.08,
      GBP: 0.85,
      JPY: 161.5,
      CHF: 0.95,
      CAD: 1.47
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

  let rateState = EMBEDDED_RATES;
  let rateKind = "embedded";
  let isFetchingRates = false;

  function validRateData(data) {
    return Boolean(
      data &&
      data.rates &&
      CURRENCY_CODES.every((code) => {
        const rate = Number(data.rates[code]);

        return Number.isFinite(rate) && rate > 0;
      })
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

  function populateCurrencySelects() {
    CURRENCY_CODES.forEach((code) => {
      const fromOption = document.createElement("option");
      const toOption = document.createElement("option");

      fromOption.value = code;
      fromOption.textContent =
        `${code} — ${CURRENCIES[code]}`;

      toOption.value = code;
      toOption.textContent =
        `${code} — ${CURRENCIES[code]}`;

      fromSelect.append(fromOption);
      toSelect.append(toOption);
    });

    fromSelect.value = "EUR";
    toSelect.value = "USD";
  }

  function formatRate(value) {
    return new Intl.NumberFormat("fr-FR", {
      maximumSignificantDigits: 8
    }).format(value);
  }

  function updateConversion() {
    const rawAmount = amountInput.value.trim();

    const amount = Number(
      rawAmount.replace(",", ".")
    );

    const from = fromSelect.value;
    const to = toSelect.value;

    if (
      !rawAmount ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      conversionResult.textContent = "—";
      unitRate.textContent =
        "Saisissez un montant positif ou nul.";
      return;
    }

    const fromRate = Number(rateState.rates[from]);
    const toRate = Number(rateState.rates[to]);

    if (
      !Number.isFinite(fromRate) ||
      !Number.isFinite(toRate) ||
      fromRate <= 0 ||
      toRate <= 0
    ) {
      conversionResult.textContent = "—";
      unitRate.textContent =
        "Les taux nécessaires à cette conversion sont indisponibles.";
      return;
    }

    const converted =
      amount * (toRate / fromRate);

    if (!Number.isFinite(converted)) {
      conversionResult.textContent = "—";
      unitRate.textContent =
        "Le montant est trop grand pour être converti.";
      return;
    }

    conversionResult.textContent =
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: to,
        maximumFractionDigits: to === "JPY" ? 0 : 2
      }).format(converted);

    const oneUnit = toRate / fromRate;
    const inverseUnit = fromRate / toRate;

    unitRate.textContent =
      `1 ${from} = ${formatRate(oneUnit)} ${to} · ` +
      `1 ${to} = ${formatRate(inverseUnit)} ${from}`;
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

      const candidate = {
        base: "EUR",
        date: data.date || null,
        fetchedAt: Date.now(),
        source: "Frankfurter / BCE",
        rates: {
          EUR: 1,
          ...data.rates
        }
      };

      if (!validRateData(candidate)) {
        throw new Error(
          "Certaines devises nécessaires sont absentes ou invalides"
        );
      }

      const ratesUnchanged =
        rateKind !== "embedded" &&
        candidate.date === rateState.date &&
        CURRENCY_CODES.every((code) =>
          Number(candidate.rates[code]) ===
          Number(rateState.rates[code])
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

  fromSelect.addEventListener(
    "change",
    updateConversion
  );

  toSelect.addEventListener(
    "change",
    updateConversion
  );

  swapButton.addEventListener("click", () => {
    const previousFrom = fromSelect.value;

    fromSelect.value = toSelect.value;
    toSelect.value = previousFrom;

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

  if (canRegisterServiceWorker) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js")
        .catch((error) => {
          console.warn(
            "Service Worker non enregistré :",
            error
          );
        });
    });
  }
})();
