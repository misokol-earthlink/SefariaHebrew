    let currentLyricsJson = {
      title: "",
      lines: []
    };

    let selectedTropeType = "lower";
    let wordDetailsVisible = false;
    let paragraphMarkersVisible = false;
    let lastFetchedRef = "";
    let lastSefariaData = null;

    // Set only by the Pocket Torah retrieval path.  Ordinary Sefaria
    // retrievals continue to use the editable JSON title as the save name.
    let ptSaveContext = null;

    const torahBooks = [
      {
        label: "Genesis / Bereishit",
        sefariaBook: "Genesis",
        chapters: [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26]
      },
      {
        label: "Exodus / Shemot",
        sefariaBook: "Exodus",
        chapters: [22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,37,30,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38]
      },
      {
        label: "Leviticus / Vayikra",
        sefariaBook: "Leviticus",
        chapters: [17,16,17,35,26,23,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34]
      },
      {
        label: "Numbers / Bamidbar",
        sefariaBook: "Numbers",
        chapters: [54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,39,17,54,42,56,29,34,13]
      },
      {
        label: "Deuteronomy / Devarim",
        sefariaBook: "Deuteronomy",
        chapters: [46,37,29,49,33,25,26,20,29,22,32,31,19,29,23,22,20,22,21,20,23,30,25,22,19,19,26,69,28,20,30,52,29,12]
      }
    ];

    const bookSelect = document.getElementById("bookSelect");
    const chapterSelect = document.getElementById("chapterSelect");
    const startVerseSelect = document.getElementById("startVerseSelect");
    const endVerseSelect = document.getElementById("endVerseSelect");
    const generatedRefDisplay = document.getElementById("generatedRefDisplay");
    const titleInput = document.getElementById("titleInput");
    const lowerTropeBtn = document.getElementById("lowerTropeBtn");
    const upperTropeBtn = document.getElementById("upperTropeBtn");
    const dualTropeBtn = document.getElementById("dualTropeBtn");
    document.getElementById("downloadDocBtn").addEventListener("click", downloadHebrewDocument);
    document.getElementById("fetchBtn").addEventListener("click", fetchSelectedTorahText);
    document.getElementById("manualFetchBtn").addEventListener("click", fetchManualRef);
    document.getElementById("refreshJsonBtn").addEventListener("click", rebuildJsonFromEditor);
    document.getElementById("copyJsonBtn").addEventListener("click", copyCurrentJson);
    document.getElementById("saveJsonBtn").addEventListener("click", saveCurrentJson);
    document.getElementById("toggleTranslitBtn").addEventListener("click", toggleWordDetails);
    document.getElementById("toggleParagraphBtn").addEventListener("click", toggleParagraphMarkers);
    titleInput.addEventListener("input", rebuildJsonFromEditor);

    lowerTropeBtn.addEventListener("click", function () {
      setTropeSelection("lower");
      document.getElementById("status").textContent =
        "Trope type set to Lower / Tahton.";
    });

    upperTropeBtn.addEventListener("click", function () {
      setTropeSelection("upper");
      document.getElementById("status").textContent =
        "Trope type set to Upper / Elyon.";
    });

dualTropeBtn.addEventListener("click", function () {
  setTropeSelection("dual");
  document.getElementById("status").textContent =
    "Trope type set to Dual.";
});


    bookSelect.addEventListener("change", function () {
      populateChapterSelect();
      chapterSelect.value = "1";
      populateVerseSelects();
      startVerseSelect.value = "1";
      endVerseSelect.value = "1";
      updateGeneratedRefDisplay(true);
    });

    chapterSelect.addEventListener("change", function () {
      populateVerseSelects();
      startVerseSelect.value = "1";
      endVerseSelect.value = "1";
      updateGeneratedRefDisplay(true);
    });

    startVerseSelect.addEventListener("change", function () {
      endVerseSelect.value = startVerseSelect.value;
      updateGeneratedRefDisplay(true);
    });

    endVerseSelect.addEventListener("change", function () {
      keepEndVerseAtOrAfterStart();
      updateGeneratedRefDisplay(true);
    });

    window.addEventListener("load", function () {
      initializeSelectors();
    });

    function initializeSelectors() {
      bookSelect.innerHTML = "";
      torahBooks.forEach(function (book, index) {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = book.label;
        bookSelect.appendChild(option);
      });

      bookSelect.value = "0";
      populateChapterSelect();
      chapterSelect.value = "1";
      populateVerseSelects();
      startVerseSelect.value = "1";
      endVerseSelect.value = "1";
      updateGeneratedRefDisplay(true);
      titleInput.value = buildSelectedRef();
    }

    function populateChapterSelect() {
      const book = getSelectedBook();
      chapterSelect.innerHTML = "";

      book.chapters.forEach(function (_verseCount, index) {
        const chapterNumber = index + 1;
        const option = document.createElement("option");
        option.value = chapterNumber;
        option.textContent = chapterNumber;
        chapterSelect.appendChild(option);
      });
    }

    function populateVerseSelects() {
      const verseCount = getSelectedChapterVerseCount();
      const oldStart = parseInt(startVerseSelect.value || "1", 10);
      const oldEnd = parseInt(endVerseSelect.value || "1", 10);

      startVerseSelect.innerHTML = "";
      endVerseSelect.innerHTML = "";

      for (let i = 1; i <= verseCount; i++) {
        const startOption = document.createElement("option");
        startOption.value = i;
        startOption.textContent = i;
        startVerseSelect.appendChild(startOption);

        const endOption = document.createElement("option");
        endOption.value = i;
        endOption.textContent = i;
        endVerseSelect.appendChild(endOption);
      }

      startVerseSelect.value = Math.min(oldStart, verseCount);
      endVerseSelect.value = Math.min(Math.max(oldEnd, parseInt(startVerseSelect.value, 10)), verseCount);
    }

    function keepEndVerseAtOrAfterStart() {
      const start = parseInt(startVerseSelect.value, 10);
      const end = parseInt(endVerseSelect.value, 10);
      if (end < start) endVerseSelect.value = start;
    }

    function getSelectedBook() {
      return torahBooks[parseInt(bookSelect.value, 10)];
    }

    function getSelectedChapterVerseCount() {
      const book = getSelectedBook();
      const chapter = parseInt(chapterSelect.value, 10);
      return book.chapters[chapter - 1];
    }
function buildSelectedRef() {
  const book = getSelectedBook();
  const chapter = parseInt(chapterSelect.value, 10);
  const startVerse = parseInt(startVerseSelect.value, 10);
  const endVerse = parseInt(endVerseSelect.value, 10);

  if (startVerse === endVerse) {
    return book.sefariaBook + " " + chapter + ":" + startVerse;
  }

  return book.sefariaBook + " " + chapter + ":" + startVerse + "-" + endVerse;
}
function parseSimpleTorahRef(ref) {
  const match = ref.trim().match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);

  if (!match) return null;

  return {
    book: match[1],
    chapter: parseInt(match[2], 10),
    startVerse: parseInt(match[3], 10),
    endVerse: match[4] ? parseInt(match[4], 10) : parseInt(match[3], 10)
  };
}

function getPocketTorahBookCode(bookName) {
  const bookCodes = {
    Genesis: "GE", Exodus: "EX", Leviticus: "LE",
    Numbers: "NU", Deuteronomy: "DE"
  };
  return bookCodes[bookName] || "";
}

function buildPocketTorahLineName(bookName, chapter, verse) {
  const bookCode = getPocketTorahBookCode(bookName);
  if (!bookCode) {
    return String(chapter).padStart(2, "0") + ":" +
           String(verse).padStart(2, "0");
  }
  return bookCode + ":" +
         String(chapter).padStart(2, "0") + ":" +
         String(verse).padStart(2, "0");
}

function getDualTropeBounds(parsed) {
  if (!parsed) return null;

  if (parsed.book === "Exodus" && parsed.chapter === 20) {
    return { dualStart: 2, dualEnd: 14 };
  }

  if (parsed.book === "Deuteronomy" && parsed.chapter === 5) {
   return { dualStart: 6, dualEnd: 18 };
  }

  return null;
}

function isEntirelyInsideDualTropeDomain(parsed) {
  const bounds = getDualTropeBounds(parsed);
  if (!bounds) return false;

  return (
    parsed.startVerse >= bounds.dualStart &&
    parsed.endVerse <= bounds.dualEnd
  );
}

function isMixedTropeDomain(parsed) {
  const bounds = getDualTropeBounds(parsed);
  if (!bounds) return false;

  const overlapsDual =
    parsed.startVerse <= bounds.dualEnd &&
    parsed.endVerse >= bounds.dualStart;

  const entirelyInsideDual = isEntirelyInsideDualTropeDomain(parsed);
  const entirelyOutsideDual = !overlapsDual;

  return !entirelyInsideDual && !entirelyOutsideDual;
}

function isSpecialDualTropeRequest(parsed) {
  return isEntirelyInsideDualTropeDomain(parsed);
}

function setTropeSelection(tropeType) {
  if (tropeType === "upper") {
    selectedTropeType = "upper";
  } else if (tropeType === "dual") {
    selectedTropeType = "dual";
  } else {
    selectedTropeType = "lower";
  }

  lowerTropeBtn.classList.toggle("active", selectedTropeType === "lower");
  upperTropeBtn.classList.toggle("active", selectedTropeType === "upper");
  dualTropeBtn.classList.toggle("active", selectedTropeType === "dual");
}
function resetTropeSelectionToLower() {
  setTropeSelection("lower");
}

function updateTropeButtonVisibility(resetToLower) {
  const parsed = getCurrentSelectorParsedRef();
  const tropeControl = lowerTropeBtn.closest(".control-group");
  const showDualTropeButtons = isEntirelyInsideDualTropeDomain(parsed);

  if (showDualTropeButtons) {
    tropeControl.style.display = "flex";
    tropeControl.style.flexDirection = "column";

    /*
      Only reset Lower/Upper when the user changes the selected book/chapter/verse.
      Do not reset merely because the screen is refreshed or a fetch is started.
    */
    if (resetToLower) {
      resetTropeSelectionToLower();
    }
  } else {
    tropeControl.style.display = "none";
    resetTropeSelectionToLower();
  }
}

function updateGeneratedRefDisplay(resetToLower) {
  const ref = buildSelectedRef();

  generatedRefDisplay.textContent = ref;
  titleInput.value = ref;

  updateTropeButtonVisibility(resetToLower === true);
}

function getCurrentSelectorParsedRef() {
  const book = getSelectedBook();

  return {
    book: book.sefariaBook,
    chapter: parseInt(chapterSelect.value, 10),
    startVerse: parseInt(startVerseSelect.value, 10),
    endVerse: parseInt(endVerseSelect.value, 10)
  };
}
    async function fetchSelectedTorahText() {
      ptSaveContext = null;
      updateGeneratedRefDisplay(false);
      titleInput.value = buildSelectedRef();
      await fetchSefariaText(buildSelectedRef());
    }

    async function fetchManualRef() {
      ptSaveContext = null;
      const manualRef = document.getElementById("manualRefInput").value.trim();
      if (!manualRef) {
        document.getElementById("status").textContent = "Enter a manual source reference first.";
        return;
      }
      titleInput.value = manualRef;
      await fetchSefariaText(manualRef);
    }

 async function fetchSefariaText(ref) {
  const status = document.getElementById("status");
  const lineEditor = document.getElementById("lineEditor");
  const jsonOutput = document.getElementById("jsonOutput");
  const parsedRef = parseSimpleTorahRef(ref);

  if (parsedRef && isMixedTropeDomain(parsedRef)) {
    alert(
      "Please select a verse range exclusively within a single or dual trope range domain."
    );
    return;
  }

  status.textContent = "Fetching from Sefaria...";
  lineEditor.innerHTML = "";
  jsonOutput.textContent = "{}";

  try {
    const url = buildSefariaUrl(ref);

    console.log("FETCH URL:", url);
    status.textContent = "Fetching: " + url;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Sefaria returned HTTP " + response.status);
    }

    const data = await response.json();

if (
  parsedRef &&
  isSpecialDualTropeRequest(parsedRef) &&
  (selectedTropeType === "upper" || selectedTropeType === "lower")
) {
  const sourceVersion = findHebrewVersion(data);

  if (data.text !== undefined) {
    data.text = flattenSefariaText(data.text)
      .map(replaceColonWithSofPasuq);
  } else if (sourceVersion && sourceVersion.text !== undefined) {
    sourceVersion.text = flattenSefariaText(sourceVersion.text)
      .map(replaceColonWithSofPasuq);
  }
}

const textMessage =
  "No Hebrew text was returned by Sefaria for this request. " +
  "This usually means the selected version is not available for the requested reference.";

if (responseHasNoText(data)) {
  alert(textMessage);
  status.textContent = textMessage;
  lineEditor.innerHTML = "";
  jsonOutput.textContent = "{}";
  return;
}

    if (parsedRef && isSpecialDualTropeRequest(parsedRef)) {
      restrictSpecialLowerDualTropeResponseToRequestedRange(data, parsedRef, ref);
    }

    lastFetchedRef = ref;
    lastSefariaData = data;
    updateSourceAttribution(data, ref);
    console.log("Final Sefaria URL:", url);
    console.log("Sefaria response:", data);

    /*
      Both Lower / Tahton and Upper / Elyon should now use the v3 parser.

      Upper / Elyon is no longer using the old legacy /api/texts endpoint.
      The confirmed Elyon response has Hebrew in the v3-style response,
      not in data.he.
    */
    const lines = normalizeSefariaToEditorLines(ref, data);

    renderEditorLines(lines);
    rebuildJsonFromEditor();

status.textContent =
  "Loaded " +
  ref +
  " as " +
  lines.length +
  " line(s). " +
  getTropeStatusText(parsedRef);
  } catch (err) {
    console.error(err);
    status.textContent = "Load failed: " + err.message;
  }
}

/*
const specialBaseUrl =
      "https://www.sefaria.org/api/v3/texts/" +
      encodeURIComponent(chapterRef);
*/
function getTropeStatusText(parsedRef) {
  if (parsedRef && isSpecialDualTropeRequest(parsedRef)) {
    if (selectedTropeType === "upper") {
      return "Using special Upper / Elyon Decalogue source.";
    }

    if (selectedTropeType === "dual") {
      return "Using standard Dual Decalogue source.";
    }

    return "Using special Lower / Tahton Decalogue source.";
  }

  return "Using standard source.";
}
function buildSefariaUrl(ref) {
  const parsed = parseSimpleTorahRef(ref);

  /*
    Special handling only for the Exodus 20 dual-trope section.
    All three choices (Upper / Lower / Dual) now fetch the chapter
    and post-process the requested verse range.
  */
  if (parsed && isEntirelyInsideDualTropeDomain(parsed)) {

    const chapterRef = parsed.book + " " + parsed.chapter;

    const baseUrl =
      "https://www.sefaria.org/api/v3/texts/" +
      encodeURIComponent(chapterRef);

    const params = new URLSearchParams();
    params.set("return_format", "text_only");

    if (selectedTropeType === "upper") {

      params.set(
        "version",
        "hebrew|Wikisource -- Upper Accents"
      );

    } else if (selectedTropeType === "lower") {

      params.set(
        "version",
        "hebrew|Wikisource_--_Lower_Accents"
      );

      /*
        Later we may change the version string to the
        canonical "Wikisource -- Lower Accents"
        after Sefaria confirms the preferred form.
      */

    }
    /*
      Dual uses the standard Sefaria source,
      so no version parameter is added.
    */

    return baseUrl + "?" + params.toString();
  }

  /*
    All non-Decalogue requests continue exactly
    as before.
  */
  const encodedRef = encodeURIComponent(ref);
  const baseUrl =
    "https://www.sefaria.org/api/v3/texts/" +
    encodedRef;

  const params = new URLSearchParams();
  params.set("return_format", "text_only");

  if (selectedTropeType === "upper") {
    params.set(
      "version",
      "hebrew|Wikisource -- Upper Accents"
    );
  }

  return baseUrl + "?" + params.toString();
}

function restrictSpecialLowerDualTropeResponseToRequestedRange(data, parsed, requestedRef) {
  const bounds = getDualTropeBounds(parsed);
  if (!bounds) return;

  const sourceVersion = findHebrewVersion(data);

  const rawText =
    data && data.text !== undefined
      ? data.text
      : (sourceVersion && sourceVersion.text !== undefined ? sourceVersion.text : []);

  const textArray = flattenSefariaText(rawText);
console.log("textArray length =", textArray.length);
console.log(textArray);
/*
const firstIndex = parsed.startVerse - bounds.dualStart + 1;
const lastIndex = parsed.endVerse - bounds.dualStart + 1;
const selectedText = textArray.slice(firstIndex, lastIndex + 1);
*/
const firstIndex = parsed.startVerse - 1;
const lastIndex = parsed.endVerse - 1;
const selectedText = textArray.slice(firstIndex, lastIndex + 1);

  if (data && data.text !== undefined) {
    data.text = selectedText;
  } else if (sourceVersion) {
    sourceVersion.text = selectedText;
  }

  data.ref = requestedRef;
}

function normalizeSefariaToEditorLines(requestedRef, data) {
  const sourceVersion = findHebrewVersion(data);

  let rawText = [];

  if (sourceVersion && sourceVersion.text !== undefined) {
    rawText = sourceVersion.text;
  } else if (data && data.text !== undefined) {
    rawText = data.text;
  }

  const textArray = flattenSefariaText(rawText);

  const cleanTextArray = textArray.map(cleanSefariaHebrewText);
  console.log(cleanTextArray);
  const startVerse = getStartVerseNumber(data.ref || requestedRef);
  const parsedRef = parseSimpleTorahRef(requestedRef);
  const sourceBook = parsedRef ? parsedRef.book : "";
  const sourceChapter = parsedRef ? parsedRef.chapter : null;

  return cleanTextArray.map(function (cleanHebrew, index) {
    const tokens = extractHebrewWordTokens(cleanHebrew);
    const sourceVerseNumber =
      startVerse === null ? index + 1 : startVerse + index;

    return {
      line: index + 1,
      lineName:
        sourceChapter === null
          ? String(sourceVerseNumber).padStart(2, "0")
          : buildPocketTorahLineName(sourceBook, sourceChapter, sourceVerseNumber),
      sourceVerseNumber: sourceVerseNumber,
      displayHebrew: cleanHebrew,
      words: tokens.map(function (hebrewWord) {
        return {
          hebrew: hebrewWord,
          translit: roughTransliterateHebrew(hebrewWord)
        };
      })
    };
  });
}

function flattenSefariaText(rawText) {
  if (rawText === null || rawText === undefined) {
    return [];
  }

  if (typeof rawText === "string") {
    return [rawText];
  }

  if (!Array.isArray(rawText)) {
    return [String(rawText)];
  }

  const result = [];

  rawText.forEach(function (item) {
    if (Array.isArray(item)) {
      flattenSefariaText(item).forEach(function (subItem) {
        result.push(subItem);
      });
    } else if (item !== null && item !== undefined) {
      result.push(String(item));
    }
  });

  return result;
}

    function normalizeLegacySefariaResponse(requestedRef, data) {
      /*
        Legacy endpoint shape:
          data.he contains the Hebrew text array/string.

        This path is used for Upper / Elyon while testing
          version=Torah Cantillation.
      */
      const rawText = data && data.he ? data.he : [];
      const textArray = Array.isArray(rawText) ? rawText : [rawText];
      const cleanTextArray = textArray.map(cleanSefariaHebrewText);
      const startVerse = getStartVerseNumber(data.ref || requestedRef);

      return cleanTextArray.map(function (cleanHebrew, index) {
        const verseNumber = startVerse === null ? index + 1 : startVerse + index;
        const tokens = extractHebrewWordTokens(cleanHebrew);

        return {
          line: index + 1,
          sourceVerseNumber: verseNumber,
          displayHebrew: cleanHebrew,
          words: tokens.map(function (hebrewWord) {
            return {
              hebrew: hebrewWord,
              translit: roughTransliterateHebrew(hebrewWord)
            };
          })
        };
      });
    }

    function findHebrewVersion(data) {
      if (!data || !Array.isArray(data.versions)) return null;
      return data.versions.find(function (version) {
        return version.language === "he" || version.language === "hebrew";
      }) || data.versions[0] || null;
    }

    function cleanSefariaHebrewText(rawValue) {
      let text = stripHtml(rawValue || "");

      /*
        Sefaria Tanakh text may include paragraph markers such as:
          {s}, {p}, {ס}, {פ}

        These indicate closed/open paragraph breaks in the masoretic layout.
        They are not Torah words and should not become JSON transliteration objects.

        For the Hebrew source-line display, this temporary flag controls whether
        they are shown visibly or removed.
      */
      if (paragraphMarkersVisible) {
  text = text.replace(/\{ס\}/g, "  [ס]  ");
  text = text.replace(/\{פ\}/g, "  [פ]  ");
  text = text.replace(/\{s\}/gi, "  [s]  ");
  text = text.replace(/\{p\}/gi, "  [p]  ");

  text = text.replace(/\(ס\)/g, "  [ס]  ");
  text = text.replace(/\(פ\)/g, "  [פ]  ");
  text = text.replace(/\(s\)/gi, "  [s]  ");
  text = text.replace(/\(p\)/gi, "  [p]  ");

  text = text.replace(/\{[^}]*\}/g, " ");
} else {
  text = text.replace(/\{[^}]*\}/g, " ");
  text = text.replace(/\([ספsp]\)/gi, " ");
}

      /*
        Normalize whitespace but keep internal Hebrew punctuation such as maqaf.
        Maqaf U+05BE belongs between connected Hebrew words and should remain
        inside a Hebrew token, e.g. בְּכָל־לְבָבְךָ.
      */
      text = text.replace(/\s+/g, " ").trim();

      return text;
    }

    function extractHebrewWordTokens(cleanHebrew) {
      /*
        We do NOT split merely on every non-letter mark because vowels and trope marks
        are combining marks that belong with the base Hebrew letters.

        A true token must contain at least one Hebrew letter U+05D0-U+05EA.

        We preserve:
          - Hebrew letters
          - niqqud and trope marks U+0591-U+05C7
          - maqaf U+05BE between Hebrew words

        We ignore as separate JSON word objects:
         - sof pasuk punctuation U+05C3 when standalone
          - Latin paragraph markers already removed
          - ordinary punctuation
      */

   const allowedInsideToken = /[\u0591-\u05C7\u05D0-\u05EA\u05BE]/;
  const hasHebrewLetter = /[\u05D0-\u05EA]/;
  const isPasikOnly = /^[\u05C0|׀]+$/;

  const roughParts = cleanHebrew.split(/\s+/).filter(Boolean);
  const tokens = [];

  roughParts.forEach(function (part) {
    if (/^\[[^\]]+\]$/.test(part)) return;

    let token = part;

   // token = token.replace(/\u05C3+$/g, "");
    token = trimNonHebrewEdges(token);

    if (!token) return;

    /*
      If pasik appears as its own separated item, attach it to the prior Hebrew word.
      This preserves Munach-l'garmeih-style markings in the JSON Hebrew string.
    */
    if (isPasikOnly.test(token)) {
      if (tokens.length > 0 && !tokens[tokens.length - 1].includes("\u05C0")) {
        tokens[tokens.length - 1] += "\u05C0";
      }
      return;
    }

    if (!hasHebrewLetter.test(token)) return;

    token = Array.from(token).filter(function (char) {
      return allowedInsideToken.test(char);
    }).join("");

    token = token.replace(/^\u05BE+|\u05BE+$/g, "");

    if (token && hasHebrewLetter.test(token)) {
      tokens.push(token);
    }
  });

  return tokens;
}

    function trimNonHebrewEdges(value) {
      let chars = Array.from(value);

      while (chars.length && !isHebrewTokenChar(chars[0])) {
        chars.shift();
      }

      while (chars.length && !isHebrewTokenChar(chars[chars.length - 1])) {
        chars.pop();
      }

      return chars.join("");
    }

    function isHebrewTokenChar(char) {
      return /[\u0591-\u05C7\u05D0-\u05EA\u05BE]/.test(char);
    }

    function renderEditorLines(lines) {
      const lineEditor = document.getElementById("lineEditor");
      lineEditor.innerHTML = "";

      lines.forEach(function (lineData) {
        const panel = document.createElement("div");
        panel.className = "line-panel";
        panel.dataset.line = String(lineData.line);
        panel.dataset.lineName = lineData.lineName || "";

        const title = document.createElement("div");
        title.className = "line-title";
        title.textContent =
  "Line " +
  lineData.lineName +
  " (Verse " +
  lineData.sourceVerseNumber +
  ")";

        const sourceHebrew = document.createElement("div");
        sourceHebrew.className = "source-hebrew";
        sourceHebrew.textContent = lineData.displayHebrew;

        const note = document.createElement("div");
        note.className = "small-note";
        if (!wordDetailsVisible) {
          note.classList.add("details-hidden");
        }
        note.textContent = "The source line above may show maqaf/punctuation. The editable rows below are only the JSON word objects.";

        panel.appendChild(title);
        panel.appendChild(sourceHebrew);
        panel.appendChild(note);

        lineData.words.forEach(function (wordData, index) {
          const row = document.createElement("div");
          row.className = "word-grid";
          if (!wordDetailsVisible) {
            row.classList.add("details-hidden");
          }
          row.dataset.wordIndex = String(index + 1);

          const hebrew = document.createElement("div");
          hebrew.className = "word-hebrew";
          hebrew.contentEditable = "true";
          hebrew.spellcheck = false;
          hebrew.setAttribute("role", "textbox");
          hebrew.setAttribute("aria-label", "Editable Hebrew word");
          hebrew.textContent = wordData.hebrew;
          hebrew.addEventListener("input", rebuildJsonFromEditor);

          const translit = document.createElement("input");
          translit.className = "word-translit";
          translit.type = "text";
          translit.value = wordData.translit || "";
          translit.addEventListener("input", rebuildJsonFromEditor);

          row.appendChild(hebrew);
          row.appendChild(translit);
          panel.appendChild(row);
        });

        lineEditor.appendChild(panel);
      });
     buildDownloadDocument(lines);
    }

    function rebuildJsonFromEditor() {
      const panels = Array.from(document.querySelectorAll(".line-panel"));
      const lines = panels.map(function (panel, panelIndex) {
        const wordRows = Array.from(panel.querySelectorAll(".word-grid"));

        return {
          lineName: panel.dataset.lineName,
          words: wordRows.map(function (row) {
            const hebrew = row.querySelector(".word-hebrew").textContent;
            const translit = row.querySelector(".word-translit").value;

            return {
              hebrew: hebrew,
              translit: translit
            };
          })
        };
      });

      currentLyricsJson = {
        title: titleInput.value.trim() || buildSelectedRef(),
        lines: lines
      };

      document.getElementById("jsonOutput").textContent =
        JSON.stringify(currentLyricsJson, null, 2);
    }

    function stripHtml(value) {
      const temp = document.createElement("div");
      temp.innerHTML = value;
      return temp.textContent || temp.innerText || "";
    }

    function getStartVerseNumber(ref) {
      const match = ref.match(/\d+:(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    }

    function roughTransliterateHebrew(hebrew) {
      /*
        This is still only a placeholder for testing.
        It gives every real Hebrew word a visible editable transliteration.
        The real AI-generated or manually corrected value can replace it later.
      */

      const normalized = hebrew.normalize("NFC");

      // Special handling for forms of the Divine Name.
      if (containsTetragrammaton(normalized)) {
        return "Adonai";
      }

      const consonantsOnly = normalized
        .replace(/[\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7]/g, "")
        .replace(/\u05BE/g, "-")
        .replace(/\u05C0/g, "")
        .replace(/\u05C3/g, "");

      const map = {
        "א": "'", "ב": "v", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z",
        "ח": "ch", "ט": "t", "י": "y", "כ": "ch", "ך": "ch", "ל": "l",
        "מ": "m", "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "'",
        "פ": "f", "ף": "f", "צ": "tz", "ץ": "tz", "ק": "k", "ר": "r",
        "ש": "sh", "ת": "t"
      };

      return Array.from(consonantsOnly).map(function (char) {
        return map[char] || char;
      }).join("").replace(/\s+/g, " ").trim();
    }

    function containsTetragrammaton(value) {
      /*
        Match yod-heh-vav-heh with optional vowels/trope marks after each letter.
      */
      return /\u05D9[\u0591-\u05C7]*\u05D4[\u0591-\u05C7]*\u05D5[\u0591-\u05C7]*\u05D4/.test(value);
    }

    function toggleWordDetails() {
      wordDetailsVisible = !wordDetailsVisible;

      /*
        Hide/show everything derived from the returned Hebrew source line:
          - note text
          - per-word Hebrew boxes
          - transliteration input boxes

        The actual returned Hebrew line remains visible.
      */
      document.querySelectorAll(".word-grid, .small-note").forEach(function (element) {
        element.classList.toggle("details-hidden", !wordDetailsVisible);
      });

      document.getElementById("toggleTranslitBtn").textContent =
        wordDetailsVisible ? "Hide Word Details" : "Show Word Details";
    }

   function toggleParagraphMarkers() {
  paragraphMarkersVisible = !paragraphMarkersVisible;

  document.getElementById("toggleParagraphBtn").textContent =
    paragraphMarkersVisible ? "Hide Paragraphs" : "Show Paragraphs";

  if (lastFetchedRef && lastSefariaData) {
    const lines = normalizeSefariaToEditorLines(lastFetchedRef, lastSefariaData);

    renderEditorLines(lines);
    rebuildJsonFromEditor();
  }
}

    async function copyCurrentJson() {
      const status = document.getElementById("status");
      rebuildJsonFromEditor();

      try {
        await navigator.clipboard.writeText(JSON.stringify(currentLyricsJson, null, 2));
        status.textContent = "Lyrics JSON copied to clipboard.";
      } catch (err) {
        status.textContent = "Copy failed. You can manually copy from the JSON box.";
      }
    }


    function sanitizeDownloadBaseName(value) {
      return String(value || "Lyrics")
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim() || "Lyrics";
    }

    function downloadJsonObject(jsonObject, fileName) {
      const blob = new Blob(
        [JSON.stringify(jsonObject, null, 2)],
        { type: "application/json;charset=utf-8" }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName.replace(/\.json$/i, "") + "_Lyrics.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function() { URL.revokeObjectURL(url); }, 0);
    }

    function getLineChapter(lineName) {
      const match = String(lineName || "").match(/^[A-Z]{2}:(\d+):\d+$/);
      return match ? parseInt(match[1], 10) : null;
    }

    function saveCurrentJson() {
      const status = document.getElementById("status");
      rebuildJsonFromEditor();

      if (!currentLyricsJson.lines.length) {
        status.textContent = "No Lyrics JSON is available to save.";
        return;
      }

      // The editor already contains the normalized, combined Lyrics structure.
      // Even when PT retrieval required two Sefaria chapter calls, save the
      // complete currentLyricsJson as one output file.
      const fileBase = ptSaveContext
        ? ptSaveContext.fileBase
        : sanitizeDownloadBaseName(currentLyricsJson.title);

      downloadJsonObject(currentLyricsJson, fileBase + ".json");
      status.textContent = "Saved " + fileBase + "_Lyrics.json.";
    }

    function getChapterVerseCount(bookName, chapter) {
      const book = torahBooks.find(function(item) {
        return item.sefariaBook === bookName;
      });
      if (!book || chapter < 1 || chapter > book.chapters.length) return null;
      return book.chapters[chapter - 1];
    }

    async function fetchStandardSefariaPart(ref) {
      const url = buildSefariaUrl(ref);
      console.log("PT FETCH URL:", url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Sefaria returned HTTP " + response.status);
      }

      const data = await response.json();
      if (responseHasNoText(data)) {
        throw new Error("No Hebrew text was returned by Sefaria for " + ref + ".");
      }

      return {
        ref: ref,
        data: data,
        lines: normalizeSefariaToEditorLines(ref, data)
      };
    }

    /*
      Bridge used by PT.js.  Pocket Torah supplies the already-resolved
      Book/Chapter/Verse range and the two names.  Yitro and Va'etchanan are
      deliberately excluded here until their dual-trope ranges are handled.
    */
    async function loadPocketTorahHebrew(request) {
      const status = document.getElementById("status");
      const normalizedParsha = String(request.parshaName || "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");

      if (
        normalizedParsha === "yitro" ||
        normalizedParsha === "vaetchanan" ||
        normalizedParsha === "veetchanan"
      ) {
        alert(
          "Pocket Torah Hebrew retrieval for Yitro and Va'etchanan is temporarily disabled because their Sefaria dual-trope verses require separate range handling."
        );
        return false;
      }

      if (!request.book || !request.startChapter || !request.endChapter) {
        throw new Error("Pocket Torah did not supply a complete Hebrew text range.");
      }

      // PT retrieval deliberately uses the normal/default Sefaria source.
      setTropeSelection("lower");

      titleInput.value = request.jsonTitle;
      ptSaveContext = {
        fileBase: sanitizeDownloadBaseName(request.fileBase),
        splitChapter: request.startChapter !== request.endChapter,
        startChapter: request.startChapter,
        endChapter: request.endChapter
      };

      document.getElementById("lineEditor").innerHTML = "";
      document.getElementById("jsonOutput").textContent = "{}";
      status.textContent = "Fetching Pocket Torah Hebrew range from Sefaria...";

      try {
        let parts = [];

        if (request.startChapter === request.endChapter) {
          const ref =
            request.book + " " +
            request.startChapter + ":" +
            request.startVerse + "-" +
            request.endVerse;
          parts.push(await fetchStandardSefariaPart(ref));
        } else {
          const lastVerse = getChapterVerseCount(
            request.book,
            request.startChapter
          );
          if (!lastVerse) {
            throw new Error("Could not determine the end of the starting chapter.");
          }

          const refA =
            request.book + " " +
            request.startChapter + ":" +
            request.startVerse + "-" +
            lastVerse;
          const refB =
            request.book + " " +
            request.endChapter + ":1-" +
            request.endVerse;

          parts.push(await fetchStandardSefariaPart(refA));
          parts.push(await fetchStandardSefariaPart(refB));
        }

        const allLines = [];
        parts.forEach(function(part) {
          part.lines.forEach(function(line) {
            allLines.push(line);
          });
        });

        // Renumber display-order line values while retaining canonical lineName.
        allLines.forEach(function(line, index) {
          line.line = index + 1;
        });

        lastFetchedRef = parts.map(function(part) { return part.ref; }).join(" + ");
        lastSefariaData = parts[0].data;
        updateSourceAttribution(parts[0].data, parts[0].ref);
        renderEditorLines(allLines);
        rebuildJsonFromEditor();

        status.textContent =
          "Loaded Pocket Torah range as " +
          allLines.length +
          " line(s). JSON title: " +
          request.jsonTitle +
          (ptSaveContext.splitChapter
            ? ". Save JSON will create A and B chapter files."
            : ".");

        return true;
      } catch (err) {
        console.error(err);
        ptSaveContext = null;
        status.textContent = "Pocket Torah Hebrew load failed: " + err.message;
        return false;
      }
    }

    // Deliberately small public bridge for PT.js; the rest of Sefaria.js
    // remains private to this page.
    window.SefariaPT = {
      loadPocketTorahHebrew: loadPocketTorahHebrew
    };

function buildDownloadDocument(lines) {
  const docDiv = document.getElementById("downloadDocument");
  docDiv.innerHTML = "";

  const title = document.createElement("div");
  title.textContent = titleInput.value.trim() || buildSelectedRef();
  title.style.fontFamily = "Arial, sans-serif";
  title.style.fontSize = "24px";
  title.style.fontWeight = "bold";
  title.style.textAlign = "center";
  title.style.marginBottom = "24px";

  docDiv.appendChild(title);
const attribution = document.createElement("div");
attribution.textContent =
  lastSefariaData
    ? getSourceAttributionText(lastSefariaData, lastFetchedRef)
    : document.getElementById("sourceAttribution").textContent;attribution.style.fontFamily = "Arial, sans-serif";
attribution.style.fontSize = "13px";
attribution.style.textAlign = "center";
attribution.style.marginBottom = "22px";
attribution.style.color = "#555";

docDiv.appendChild(attribution);
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.direction = "rtl";
  table.style.tableLayout = "fixed";

  lines.forEach(function(lineData) {
    const tr = document.createElement("tr");

    const verseTd = document.createElement("td");
    verseTd.textContent =
      String(lineData.sourceVerseNumber).padStart(2, "0") + ":";
  verseTd.style.width = "70px";
verseTd.style.direction = "ltr";
verseTd.style.unicodeBidi = "isolate";
verseTd.style.textAlign = "right";
verseTd.style.fontFamily = "Arial, sans-serif";
verseTd.style.fontSize = "24px";
verseTd.style.fontWeight = "bold";
verseTd.style.color = "black";
verseTd.style.verticalAlign = "middle";
verseTd.style.paddingTop = "0px";
verseTd.style.paddingBottom = "6px";
verseTd.style.paddingLeft = "24px";

/* Optical alignment adjustment */
verseTd.style.position = "relative";
verseTd.style.top = "5px";

    const hebrewTd = document.createElement("td");
    hebrewTd.textContent = lineData.displayHebrew;
    hebrewTd.style.verticalAlign = "top";
    hebrewTd.style.direction = "rtl";
    hebrewTd.style.textAlign = "right";
    hebrewTd.style.fontFamily = '"Times New Roman", Times, serif';
    hebrewTd.style.fontSize = "30px";
    hebrewTd.style.lineHeight = "1.8";
    hebrewTd.style.color = "royalblue";
    hebrewTd.style.paddingBottom = "12px";

    tr.appendChild(verseTd);
    tr.appendChild(hebrewTd);

    table.appendChild(tr);
  });

  docDiv.appendChild(table);
}

function downloadHebrewDocument() {
  const docDiv = document.getElementById("downloadDocument");

  if (!docDiv || !docDiv.innerHTML.trim()) {
    alert("No Hebrew document is available. Click Get Hebrew first.");
    return;
  }

  const title = titleInput.value.trim() || buildSelectedRef();
  const safeName = title.replace(/[\\/:*?"<>|]/g, "_");

  const html =
`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
</head>
<body>
${docDiv.innerHTML}
</body>
</html>`;

 const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = safeName + ".doc";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function getSourceAttributionText(data, requestedRef) {
  const version = findHebrewVersion(data);

  const refText = requestedRef || (data && data.ref) || buildSelectedRef();
//if (selectedTropeType === "dual") {
  //return "Source: Standard Sefaria Hebrew text with dual accents, retrieved via the Sefaria API";
//}
  let versionTitle = "";
  let versionSource = "";

  if (version) {
    versionTitle = version.versionTitle || "";
    versionSource = version.versionSource || "";
  } else {
    versionTitle = data.versionTitle || "";
    versionSource = data.versionSource || "";
  }

  let sourceName = versionTitle || "Default Hebrew text";

  if (versionSource.includes("he.wikisource.org")) {
    sourceName = sourceName
      .replace("Wikisource -- ", "")
      .replace("Wikisource_--_", "")
      .replace(/_/g, " ");

  return "Source: Hebrew Wikisource, " +
  sourceName +
  ", retrieved via the Sefaria API";
  }

 return "Source: " +
  sourceName +
  ", retrieved via the Sefaria API";
}

function updateSourceAttribution(data, requestedRef) {
  const attributionDiv = document.getElementById("sourceAttribution");
  if (!attributionDiv) return;

  attributionDiv.textContent = getSourceAttributionText(data, requestedRef);
}
function responseHasNoText(data) {
  const sourceVersion = findHebrewVersion(data);

  const rawText =
    data && data.text !== undefined
      ? data.text
      : (sourceVersion && sourceVersion.text !== undefined ? sourceVersion.text : null);

  if (rawText === null || rawText === undefined) return true;

  const textArray = flattenSefariaText(rawText);
  return textArray.length === 0 || textArray.every(function (item) {
    return !String(item).trim();
  });
}
function replaceColonWithSofPasuq(text) {
  return text.replace(/:/g, "\u05C3");
}
window.addEventListener("load", () => {
    const splash = document.getElementById("splash-screen");
    const mainDOM = document.getElementById("main-app-dom");

    setTimeout(() => {
        splash.style.opacity = "0";
        mainDOM.classList.add("visible");

        setTimeout(() => {
            splash.remove();
        }, 2000);

    }, 5000);
});
