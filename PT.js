/*
 * PT.js
 * Pocket Torah data/analysis support shared by applications.
 *
 * The core Pocket Torah processing is shared by applications. Sefaria also
 * uses the optional modal adapter in this file; TropePlayer does not call it.
 * Both applications use the same source-selection, canonical-reference,
 * aliyah/timing, and audio-path processing.
 *
 * source.json controls whether LOCAL, WEB, or both sources are permitted.
 */
(function(global) {
  "use strict";

  const WEB_BASE_PATH = "https://raw.githubusercontent.com/rneiss/PocketTorah/master";
  const LOCAL_BASE_PATH = "PocketTorah";
  const SOURCE_CONFIG_PATH = "source.json";

  let availableSources = [];
  let activeSource = null;
  let sourceConfigLoaded = false;
  let basePath = WEB_BASE_PATH;
  let resourcesLoaded = false;
  let aliyahData = null;
  let resourceNames = {};
  const torahData = {};
  const labelData = {};
  const audioDurationData = {};

  function clearObject(object) {
    Object.keys(object).forEach(function(key) { delete object[key]; });
  }

  function resetResourceCaches() {
    resourcesLoaded = false;
    aliyahData = null;
    resourceNames = {};
    clearObject(torahData);
    clearObject(labelData);
    clearObject(audioDurationData);
  }

  function setBasePath(newBasePath) {
    if (typeof newBasePath !== "string" || !newBasePath.trim()) {
      throw new Error("Pocket Torah base path must be a non-empty string.");
    }
    basePath = newBasePath.replace(/\/$/, "");
  }

  function getBasePath() {
    return basePath;
  }

  function getAvailableSources() {
    return availableSources.slice();
  }

  function getActiveSource() {
    return activeSource;
  }

  function applyActiveSource(source) {
    const normalized = String(source || "").toUpperCase();
    if (!availableSources.includes(normalized)) {
      throw new Error("Pocket Torah source is not allowed: " + normalized);
    }

    activeSource = normalized;
    basePath = normalized === "LOCAL" ? LOCAL_BASE_PATH : WEB_BASE_PATH;
    resetResourceCaches();
    console.log("Pocket Torah active source:", activeSource);
  }

  async function ensureSourceConfigLoaded() {
    if (sourceConfigLoaded) return;

    const response = await fetch(SOURCE_CONFIG_PATH + "?v=" + Date.now(), {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error("Could not load Pocket Torah source.json. Status: " + response.status);
    }

    const config = await response.json();
    const rawSources = Array.isArray(config.sources) ? config.sources : [];
    availableSources = rawSources
      .map(function(source) { return String(source).toUpperCase(); })
      .filter(function(source, index, array) {
        return (source === "LOCAL" || source === "WEB") && array.indexOf(source) === index;
      });

    if (!availableSources.length) {
      throw new Error("Pocket Torah source.json contains no valid sources.");
    }

    sourceConfigLoaded = true;

    // When LOCAL is permitted, try it first.  A real resource failure may
    // switch the session one-way to WEB.  WEB-only configurations never run
    // LOCAL fallback logic.
    applyActiveSource(availableSources.includes("LOCAL") ? "LOCAL" : "WEB");
    console.log("Pocket Torah allowed sources:", availableSources);
  }

  async function setActiveSource(source) {
    await ensureSourceConfigLoaded();
    applyActiveSource(source);
  }

  async function resetSourceForNewReading() {
    await ensureSourceConfigLoaded();

    // A host application calls this when its definition of the reading changes.
    // Sefaria calls it for Parsha / reading-type / Aliyah changes. TropePlayer
    // calls it when a new Lyrics JSON is loaded. PT.js owns what reset means;
    // each host owns the event that triggers it.
    const preferredSource = availableSources.includes("LOCAL") ? "LOCAL" : "WEB";

    if (activeSource !== preferredSource) {
      applyActiveSource(preferredSource);
    }

    return activeSource;
  }

  function buildLocalPath(relativePath) {
    return basePath + "/" + relativePath.replace(/^\//, "");
  }

  async function runWithSourceFallback(operation) {
    await ensureSourceConfigLoaded();

    try {
      return await operation();
    } catch (error) {
      if (activeSource === "LOCAL" && availableSources.includes("WEB")) {
        console.warn(
          "Pocket Torah LOCAL source failed; switching to WEB and retrying once:",
          error
        );
        applyActiveSource("WEB");
        return await operation();
      }
      throw error;
    }
  }

  async function ensureResourcesLoaded() {
    await ensureSourceConfigLoaded();
    if (resourcesLoaded) return;

    const aliyahResponse = await fetch(
      buildLocalPath("data/aliyah.json") + "?v=" + Date.now(),
      { cache: "no-store" }
    );

    if (!aliyahResponse.ok) {
      throw new Error(
        "Could not load Pocket Torah " + activeSource + " aliyah.json. Status: " +
        aliyahResponse.status
      );
    }

    aliyahData = await aliyahResponse.json();

    if (activeSource === "LOCAL") {
      const resourceMapResponse = await fetch(
        buildLocalPath("data/PocketTorahResourceMap.json") + "?v=" + Date.now(),
        { cache: "no-store" }
      );
      if (!resourceMapResponse.ok) {
        throw new Error(
          "Could not load Pocket Torah LOCAL PocketTorahResourceMap.json. Status: " +
          resourceMapResponse.status
        );
      }
      resourceNames = await resourceMapResponse.json();
    } else {
      // Known upstream PocketTorah filename exceptions for WEB mode.
      resourceNames = {
        "Yitro": { labels: "yitro", audio: "Yitro" },
        "Ki Teitzei": { labels: "Ki Teitzei", audio: "KiTeitzei" }
      };
    }

    resourcesLoaded = true;
    console.log("Pocket Torah resources loaded from", activeSource + ".");
  }

  function resolveResourceName(parshaName) {
    const matchKey = Object.keys(resourceNames).find(function(resourceName) {
      return resourceName.toLowerCase() === String(parshaName).toLowerCase();
    });

    if (matchKey) {
      return resourceNames[matchKey];
    }

    return {
      labels: parshaName,
      audio: parshaName
    };
  }

  function findAliyah(parshaName, bookCode, chapter, verse) {
    if (
      !aliyahData ||
      !aliyahData.parshiot ||
      !Array.isArray(aliyahData.parshiot.parsha)
    ) {
      return null;
    }

    const parsha = aliyahData.parshiot.parsha.find(function(item) {
      return item._id === parshaName;
    });

    if (
      !parsha ||
      !parsha.fullkriyah ||
      !Array.isArray(parsha.fullkriyah.aliyah)
    ) {
      return null;
    }

    for (const aliyah of parsha.fullkriyah.aliyah) {
      const beginParts = aliyah._begin.split(":");
      const endParts = aliyah._end.split(":");

      const beginChapter = Number(beginParts[0]);
      const beginVerse = Number(beginParts[1]);
      const endChapter = Number(endParts[0]);
      const endVerse = Number(endParts[1]);

      const afterOrAtBeginning =
        chapter > beginChapter ||
        (chapter === beginChapter && verse >= beginVerse);

      const beforeOrAtEnd =
        chapter < endChapter ||
        (chapter === endChapter && verse <= endVerse);

      if (afterOrAtBeginning && beforeOrAtEnd) {
        return {
          aliyah: Number(aliyah._num),
          beginChapter: beginChapter,
          beginVerse: beginVerse,
          endChapter: endChapter,
          endVerse: endVerse
        };
      }
    }

    return null;
  }

  function getBookName(bookCode) {
    const bookMap = {
      GE: "Genesis",
      EX: "Exodus",
      LE: "Leviticus",
      NU: "Numbers",
      DE: "Deuteronomy"
    };

    return bookMap[bookCode] || null;
  }

  async function loadBook(bookName) {
    if (torahData[bookName]) {
      return torahData[bookName];
    }

    const response = await fetch(
      buildLocalPath("data/torah/json/") +
      encodeURIComponent(bookName + ".json") +
      "?v=" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        "Could not load Pocket Torah book " +
        bookName +
        ". Status: " +
        response.status
      );
    }

    torahData[bookName] = await response.json();

    console.log("Pocket Torah book data loaded:", bookName);

    return torahData[bookName];
  }

  async function loadLabels(parshaName, aliyahNumber) {
    const resourceName = resolveResourceName(parshaName);
    const labelKey = resourceName.labels + "-" + aliyahNumber;

    if (labelData[labelKey]) {
      return labelData[labelKey];
    }

    const response = await fetch(
      buildLocalPath("data/torah/labels/") +
      encodeURIComponent(labelKey + ".txt") +
      "?v=" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        "Could not load Pocket Torah labels " +
        labelKey +
        ". Status: " +
        response.status
      );
    }

    const labelText = await response.text();

    labelData[labelKey] = labelText
      .split(",")
      .map(function(value) {
        return Number(value.trim());
      })
      .filter(function(value) {
        return Number.isFinite(value);
      });

    console.log(
      "Pocket Torah labels loaded:",
      labelKey,
      labelData[labelKey].length
    );

    return labelData[labelKey];
  }

  function getAudioPath(parshaName, aliyahNumber) {
    const resourceName = resolveResourceName(parshaName);
    const audioKey = resourceName.audio + "-" + aliyahNumber;

    return buildLocalPath("data/audio/") +
      encodeURIComponent(audioKey + ".mp3");
  }

  async function loadAudioDuration(parshaName, aliyahNumber, durationLoader) {
    if (typeof durationLoader !== "function") {
      throw new Error(
        "Pocket Torah audio duration requires a durationLoader(audioPath) callback."
      );
    }

    const resourceName = resolveResourceName(parshaName);
    const audioKey = resourceName.audio + "-" + aliyahNumber;

    if (Number.isFinite(audioDurationData[audioKey])) {
      return audioDurationData[audioKey];
    }

    const audioPath = getAudioPath(parshaName, aliyahNumber);
    const duration = await durationLoader(audioPath);

    audioDurationData[audioKey] = duration;

    console.log(
      "Pocket Torah audio duration loaded:",
      audioKey,
      duration
    );

    return duration;
  }

  function getVerse(bookName, chapter, verse) {
    const bookData = torahData[bookName];

    if (
      !bookData ||
      !bookData.Tanach ||
      !bookData.Tanach.tanach ||
      !bookData.Tanach.tanach.book ||
      !Array.isArray(bookData.Tanach.tanach.book.c)
    ) {
      return null;
    }

    const chapterData = bookData.Tanach.tanach.book.c[chapter - 1];

    if (!chapterData || !Array.isArray(chapterData.v)) {
      return null;
    }

    const verseData = chapterData.v[verse - 1];

    if (!verseData || !Array.isArray(verseData.w)) {
      return null;
    }

    return verseData;
  }

  function countWordsBeforeVerse(
    bookName,
    beginChapter,
    beginVerse,
    targetChapter,
    targetVerse
  ) {
    let wordCount = 0;

    for (let chapter = beginChapter; chapter <= targetChapter; chapter++) {
      const firstVerse = chapter === beginChapter ? beginVerse : 1;
      const lastVerse =
        chapter === targetChapter
          ? targetVerse - 1
          : torahData[bookName]
              .Tanach.tanach.book.c[chapter - 1]
              .v.length;

      for (let verse = firstVerse; verse <= lastVerse; verse++) {
        const verseData = getVerse(bookName, chapter, verse);

        if (!verseData) {
          return null;
        }

        wordCount += verseData.w.length;
      }
    }

    return wordCount;
  }

  function parseCanonicalLineName(lineName) {
    const parts = String(lineName || "").split(":");

    return {
      bookCode: parts[0],
      chapter: Number(parts[1]),
      verse: Number(parts[2])
    };
  }

  async function preparePlaybackData(parshaName, lyricsLines, durationLoader) {
    await ensureResourcesLoaded();

    const lineData = (lyricsLines || []).map(function(lineItem, lineIndex) {
      const reference = parseCanonicalLineName(lineItem.lineName);

      return {
        lineIndex: lineIndex,
        lineName: lineItem.lineName,
        bookCode: reference.bookCode,
        chapter: reference.chapter,
        verse: reference.verse
      };
    });

    lineData.forEach(function(item) {
      const aliyah = findAliyah(
        parshaName,
        item.bookCode,
        item.chapter,
        item.verse
      );

      if (aliyah) {
        item.aliyah = aliyah.aliyah;
        item.aliyahBeginChapter = aliyah.beginChapter;
        item.aliyahBeginVerse = aliyah.beginVerse;
        item.aliyahEndChapter = aliyah.endChapter;
        item.aliyahEndVerse = aliyah.endVerse;
      }
    });

    const bookNames = [...new Set(
      lineData
        .map(function(item) {
          return getBookName(item.bookCode);
        })
        .filter(Boolean)
    )];

    for (const bookName of bookNames) {
      await loadBook(bookName);
      console.log("Pocket Torah book structure:", bookName, torahData[bookName]);
    }

    lineData.forEach(function(item) {
      const bookName = getBookName(item.bookCode);

      item.labelStartIndex = countWordsBeforeVerse(
        bookName,
        item.aliyahBeginChapter,
        item.aliyahBeginVerse,
        item.chapter,
        item.verse
      );

      console.log(
        "PT label index diagnostic:",
        item.lineName,
        "aliyah begins",
        item.aliyahBeginChapter + ":" + item.aliyahBeginVerse,
        "target",
        item.chapter + ":" + item.verse,
        "labelStartIndex",
        item.labelStartIndex
      );

      const verseData = getVerse(bookName, item.chapter, item.verse);

      if (verseData) {
        item.wordCount = verseData.w.length;
        item.labelEndIndex = item.labelStartIndex + item.wordCount;
      }
    });

    const aliyahNumbers = [...new Set(
      lineData
        .map(function(item) {
          return item.aliyah;
        })
        .filter(function(aliyahNumber) {
          return Number.isFinite(aliyahNumber);
        })
    )];

    for (const aliyahNumber of aliyahNumbers) {
      await loadLabels(parshaName, aliyahNumber);
      await loadAudioDuration(parshaName, aliyahNumber, durationLoader);
    }

    lineData.forEach(function(item) {
      const resourceName = resolveResourceName(parshaName);
      const labelKey = resourceName.labels + "-" + item.aliyah;
      const labels = labelData[labelKey];

      if (!labels) {
        return;
      }

      const audioKey = resourceName.audio + "-" + item.aliyah;

      item.startTime = labels[item.labelStartIndex];

      console.log(
        "PT start time diagnostic:",
        item.lineName,
        "index",
        item.labelStartIndex,
        "value",
        item.startTime,
        "finite",
        Number.isFinite(item.startTime)
      );

      item.endTime =
        labels[item.labelEndIndex] ??
        audioDurationData[audioKey];

      item.audioPath = getAudioPath(parshaName, item.aliyah);
    });

    const playbackSegments = [];

    lineData.forEach(function(item) {
      const lastSegment = playbackSegments[playbackSegments.length - 1];

      if (lastSegment && lastSegment.audioPath === item.audioPath) {
        lastSegment.endTime = item.endTime;
      } else {
        playbackSegments.push({
          audioPath: item.audioPath,
          startTime: item.startTime,
          endTime: item.endTime
        });
      }
    });

    console.log("Pocket Torah playback segments:", playbackSegments);
    console.log(`Playback: ${activeSource}`);
    return {
      lineData: lineData,
      playbackSegments: playbackSegments
    };
  }

  function getAliyahData() {
    return aliyahData;
  }

  function getParsha(parshaName) {
    if (
      !aliyahData ||
      !aliyahData.parshiot ||
      !Array.isArray(aliyahData.parshiot.parsha)
    ) {
      return null;
    }

    return aliyahData.parshiot.parsha.find(function(item) {
      return item._id === parshaName;
    }) || null;
  }


  function getParshaNames() {
    if (
      !aliyahData ||
      !aliyahData.parshiot ||
      !Array.isArray(aliyahData.parshiot.parsha)
    ) {
      return [];
    }

    return aliyahData.parshiot.parsha
      .map(function(item) { return item && item._id; })
      .filter(Boolean);
  }

  function parseChapterVerse(value) {
    const parts = String(value || "").split(":");
    const chapter = Number(parts[0]);
    const verse = Number(parts[1]);

    if (!Number.isFinite(chapter) || !Number.isFinite(verse)) {
      return null;
    }

    return { chapter: chapter, verse: verse };
  }

  function compareChapterVerse(a, b) {
    if (a.chapter !== b.chapter) {
      return a.chapter - b.chapter;
    }
    return a.verse - b.verse;
  }

  function laterReference(a, b) {
    return compareChapterVerse(a, b) >= 0 ? a : b;
  }

  function earlierReference(a, b) {
    return compareChapterVerse(a, b) <= 0 ? a : b;
  }

  function getParshaBookName(parsha) {
    const match = String((parsha && parsha._verse) || "")
      .match(/^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\b/);

    return match ? match[1] : null;
  }

  function getBookCodeFromName(bookName) {
    const bookMap = {
      Genesis: "GE",
      Exodus: "EX",
      Leviticus: "LE",
      Numbers: "NU",
      Deuteronomy: "DE"
    };

    return bookMap[bookName] || null;
  }

  function resolveTriennialYear(parsha, yearNumber) {
    const years =
      parsha &&
      parsha.triennial &&
      Array.isArray(parsha.triennial.year)
        ? parsha.triennial.year
        : [];

    const requested = years[yearNumber - 1] || null;

    if (!requested) {
      return null;
    }

    if (Array.isArray(requested.aliyah)) {
      return requested;
    }

    if (requested._sameas) {
      return years.find(function(year) {
        return year && year._variation === requested._sameas &&
               Array.isArray(year.aliyah);
      }) || null;
    }

    return null;
  }

  function getReadingAliyot(parsha, readingType) {
    if (!parsha) {
      return null;
    }

    if (readingType === "full") {
      return parsha.fullkriyah &&
             Array.isArray(parsha.fullkriyah.aliyah)
        ? parsha.fullkriyah.aliyah
        : null;
    }

    const match = String(readingType || "").match(/^triennial([123])$/);
    if (match) {
      const year = resolveTriennialYear(parsha, Number(match[1]));
      return year && Array.isArray(year.aliyah) ? year.aliyah : null;
    }

    return null;
  }

  function getReadingAliyahNumbers(parshaName, readingType) {
    const parsha = getParsha(parshaName);
    const aliyot = getReadingAliyot(parsha, readingType);
    if (!aliyot) return [];
    return aliyot.filter(function(a) { return a && a._num != null; })
      .map(function(a) { return String(a._num).toUpperCase(); });
  }

  function getReadingSelection(parshaName, readingType, aliyahNumber) {
    const parsha = getParsha(parshaName);
    if (!parsha) return null;
    const aliyot = getReadingAliyot(parsha, readingType);
    if (!aliyot || !aliyot.length) return null;
    let selectedAliyot;
    if (aliyahNumber) {
      const requested = String(aliyahNumber).toUpperCase();
      selectedAliyot = aliyot.filter(function(a) {
        return a && String(a._num).toUpperCase() === requested;
      });
    } else {
      selectedAliyot = aliyot.filter(function(a) {
        return a && String(a._num).toUpperCase() !== "M";
      });
    }
    if (!selectedAliyot.length) return null;
    const start = parseChapterVerse(selectedAliyot[0]._begin);
    const end = parseChapterVerse(selectedAliyot[selectedAliyot.length - 1]._end);
    const bookName = getParshaBookName(parsha);
    if (!start || !end || !bookName) return null;
    return { parshaName: parshaName, readingType: readingType,
      aliyah: aliyahNumber ? String(aliyahNumber).toUpperCase() : null,
      book: bookName, bookCode: getBookCodeFromName(bookName),
      startChapter: start.chapter, startVerse: start.verse,
      endChapter: end.chapter, endVerse: end.verse };
  }

  async function prepareReadingTiming(parshaName, readingType, durationLoader, aliyahNumber) {
    await ensureResourcesLoaded();

    const selection = getReadingSelection(parshaName, readingType, aliyahNumber);
    const parsha = getParsha(parshaName);

    if (!selection || !parsha) {
      throw new Error("Pocket Torah reading selection could not be resolved.");
    }

    const fullAliyot =
      parsha.fullkriyah && Array.isArray(parsha.fullkriyah.aliyah)
        ? parsha.fullkriyah.aliyah.filter(function(aliyah) {
            return aliyah && String(aliyah._num).toUpperCase() !== "M";
          })
        : [];

    if (!fullAliyot.length) {
      throw new Error("Pocket Torah full K'riyah aliyot are unavailable.");
    }

    await loadBook(selection.book);

    const selectionStart = {
      chapter: selection.startChapter,
      verse: selection.startVerse
    };
    const selectionEnd = {
      chapter: selection.endChapter,
      verse: selection.endVerse
    };

    const segments = [];

    for (const aliyah of fullAliyot) {
      const aliyahStart = parseChapterVerse(aliyah._begin);
      const aliyahEnd = parseChapterVerse(aliyah._end);

      if (!aliyahStart || !aliyahEnd) {
        continue;
      }

      if (
        compareChapterVerse(aliyahEnd, selectionStart) < 0 ||
        compareChapterVerse(aliyahStart, selectionEnd) > 0
      ) {
        continue;
      }

      const segmentStart = laterReference(aliyahStart, selectionStart);
      const segmentEnd = earlierReference(aliyahEnd, selectionEnd);
      const aliyahNumber = Number(aliyah._num);

      await loadLabels(parshaName, aliyahNumber);
      await loadAudioDuration(parshaName, aliyahNumber, durationLoader);

      const resourceName = resolveResourceName(parshaName);
      const labelKey = resourceName.labels + "-" + aliyahNumber;
      const audioKey = resourceName.audio + "-" + aliyahNumber;
      const labels = labelData[labelKey];

      if (!labels) {
        throw new Error("Pocket Torah labels are unavailable for aliyah " + aliyahNumber + ".");
      }

      const startIndex = countWordsBeforeVerse(
        selection.book,
        aliyahStart.chapter,
        aliyahStart.verse,
        segmentStart.chapter,
        segmentStart.verse
      );

      const wordsBeforeEndVerse = countWordsBeforeVerse(
        selection.book,
        aliyahStart.chapter,
        aliyahStart.verse,
        segmentEnd.chapter,
        segmentEnd.verse
      );

      const endVerseData = getVerse(
        selection.book,
        segmentEnd.chapter,
        segmentEnd.verse
      );

      if (
        startIndex === null ||
        wordsBeforeEndVerse === null ||
        !endVerseData
      ) {
        throw new Error("Pocket Torah word timing could not be calculated.");
      }

      const endIndex = wordsBeforeEndVerse + endVerseData.w.length;
      const startTime = labels[startIndex];
      const endTime =
        labels[endIndex] ??
        audioDurationData[audioKey];

      if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
        throw new Error("Pocket Torah audio timing could not be resolved.");
      }

      segments.push({
        aliyah: aliyahNumber,
        audioPath: getAudioPath(parshaName, aliyahNumber),
        startChapter: segmentStart.chapter,
        startVerse: segmentStart.verse,
        endChapter: segmentEnd.chapter,
        endVerse: segmentEnd.verse,
        startTime: startTime,
        endTime: endTime
      });
    }

    return {
      selection: selection,
      playbackSegments: segments
    };
  }

  /*
   * Sefaria Pocket Torah modal adapter.
   *
   * Pocket Torah selection/range/timing logic stays in PT.js.  Sefaria.js
   * does not calculate or interpret Pocket Torah readings.
   */
  let modalCalculationSerial = 0;
  let preparedModalReading = null;

  // Sefaria modal audio playback state.  Playback consumes the already
  // calculated aliyah-relative audioPath/startTime/endTime segments.
  let modalAudio = null;
  let modalPlaybackSegments = [];
  let modalPlaybackIndex = -1;
  let modalPlaybackToken = 0;
  let modalTimeUpdateHandler = null;

  function setAudioTogglePlaying(isPlaying) {
    const button = document.getElementById("ptAudioToggle");
    const icon = document.getElementById("ptAudioToggleIcon");
    if (button) {
      button.setAttribute("aria-pressed", isPlaying ? "true" : "false");
      button.setAttribute(
        "aria-label",
        isPlaying ? "Stop Pocket Torah audio" : "Play Pocket Torah audio"
      );
    }
    if (icon) {
      icon.innerHTML = isPlaying ? "&#9632;" : "&#9654;";
    }
  }

  function stopModalAudio() {
    modalPlaybackToken += 1;

    if (modalAudio) {
      if (modalTimeUpdateHandler) {
        modalAudio.removeEventListener("timeupdate", modalTimeUpdateHandler);
      }
      modalAudio.pause();
      modalAudio.removeAttribute("src");
      modalAudio.load();
    }

    modalAudio = null;
    modalTimeUpdateHandler = null;
    modalPlaybackSegments = [];
    modalPlaybackIndex = -1;
    setAudioTogglePlaying(false);
  }

  function playModalSegment(index, token) {
    if (token !== modalPlaybackToken) return;

    if (index >= modalPlaybackSegments.length) {
      stopModalAudio();
      return;
    }

    const segment = modalPlaybackSegments[index];
    modalPlaybackIndex = index;

    const audio = new Audio();
    modalAudio = audio;
    audio.preload = "auto";
    audio.src = segment.audioPath;

    const startTime = Number(segment.startTime) || 0;
    const endTime = Number(segment.endTime);

    function advance() {
      if (token !== modalPlaybackToken) return;
      if (modalTimeUpdateHandler) {
        audio.removeEventListener("timeupdate", modalTimeUpdateHandler);
      }
      audio.pause();
      playModalSegment(index + 1, token);
    }

    audio.addEventListener("loadedmetadata", function() {
      if (token !== modalPlaybackToken) return;

      try {
        audio.currentTime = Math.max(0, startTime);
      } catch (error) {
        console.error("Pocket Torah audio seek failed:", error);
        stopModalAudio();
        return;
      }

      modalTimeUpdateHandler = function() {
        if (
          token === modalPlaybackToken &&
          Number.isFinite(endTime) &&
          audio.currentTime >= endTime
        ) {
          advance();
        }
      };
      audio.addEventListener("timeupdate", modalTimeUpdateHandler);

      audio.play().catch(function(error) {
        console.error("Pocket Torah audio playback failed:", error);
        stopModalAudio();
      });
    }, { once: true });

    audio.addEventListener("ended", function() {
      if (token === modalPlaybackToken) {
        advance();
      }
    }, { once: true });

    audio.addEventListener("error", function() {
      console.error(
        "Could not play Pocket Torah audio segment:",
        segment.audioPath
      );
      stopModalAudio();
    }, { once: true });
  }

  function toggleModalAudioPlayback() {
    if (modalAudio && !modalAudio.paused) {
      stopModalAudio();
      return;
    }

    if (
      !preparedModalReading ||
      !Array.isArray(preparedModalReading.playbackSegments) ||
      preparedModalReading.playbackSegments.length === 0
    ) {
      console.warn(
        "Pocket Torah audio is not ready. Select a Parsha and wait for its timing calculation."
      );
      return;
    }

    stopModalAudio();
    modalPlaybackSegments = preparedModalReading.playbackSegments.slice();
    const token = ++modalPlaybackToken;
    setAudioTogglePlaying(true);
    playModalSegment(0, token);
  }

  function setModalText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent =
      value === null || value === undefined || value === ""
        ? "\u00a0"
        : String(value);
  }

  function clearModalReference() {
    setModalText("ptBookDisplay", "");
    setModalText("ptStartChapterDisplay", "");
    setModalText("ptStartVerseDisplay", "");
    setModalText("ptEndChapterDisplay", "");
    setModalText("ptEndVerseDisplay", "");
  }

  function displayModalReference(selection) {
    setModalText("ptBookDisplay", selection.book);
    setModalText("ptStartChapterDisplay", selection.startChapter);
    setModalText("ptStartVerseDisplay", selection.startVerse);
    setModalText("ptEndChapterDisplay", selection.endChapter);
    setModalText("ptEndVerseDisplay", selection.endVerse);
  }

  function getModalReadingType() {
    const selected = document.querySelector('input[name="ptReading"]:checked');
    return selected ? selected.value : "full";
  }

  function getModalAliyahNumber() {
    const select = document.getElementById("ptAliyahSelect");
    if (!select || !select.value || select.value === "-1") return null;
    return select.value;
  }

  function populateModalAliyahSelect() {
    /*
     * Aliyah is intentionally independent of the Full/TR radio group.
     * The HTML owns the fixed 1-7/M choices.  Do not rebuild or reset this
     * select when the reading type changes.
     */
    const aliyahSelect = document.getElementById("ptAliyahSelect");
    if (!aliyahSelect) return;
    if (!aliyahSelect.value) aliyahSelect.value = "-1";
  }

  function browserDurationLoader(audioPath) {
    return new Promise(function(resolve, reject) {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.src = audioPath;

      audio.onloadedmetadata = function() {
        resolve(audio.duration);
      };

      audio.onerror = function() {
        reject(
          new Error("Could not load Pocket Torah audio metadata: " + audioPath)
        );
      };
    });
  }

  async function recalculateSefariaModal() {
    const parshaSelect = document.getElementById("ptParshaSelect");
    if (!parshaSelect) return;

    const parshaName = parshaSelect.value;
    stopModalAudio();
    preparedModalReading = null;
    clearModalReference();

    if (!parshaName) return;

    const aliyahNumber = getModalAliyahNumber();
    if (!aliyahNumber) return;

    const serial = ++modalCalculationSerial;

    try {
      /*
       * Show the reading range immediately.  This gives visible evidence that
       * aliyah.json was loaded and interpreted before slower timing resources
       * are fetched.
       */
      const selection = getReadingSelection(parshaName, getModalReadingType(), aliyahNumber);
      if (!selection) {
        throw new Error("Pocket Torah reading range could not be resolved.");
      }
      displayModalReference(selection);

      const prepared = await runWithSourceFallback(function() {
        return prepareReadingTiming(
          parshaName,
          getModalReadingType(),
          browserDurationLoader,
          aliyahNumber
        );
      });

      if (serial !== modalCalculationSerial) return;

      preparedModalReading = prepared;
      console.log("Pocket Torah reading calculated:", prepared);
    } catch (error) {
      if (serial !== modalCalculationSerial) return;

      /*
       * Keep a successfully resolved Book/Chapter/Verse range visible even
       * if a downstream label/audio timing resource fails.  The console then
       * identifies the specific resource that still needs attention.
       */
      console.error("Pocket Torah timing calculation failed:", error);
    }
  }


  function getPTReadingFileSuffix(readingType, aliyahNumber) {
    if (String(aliyahNumber || "").toUpperCase() === "M") {
      return "Maftir";
    }

    if (readingType === "triennial1") return "TR1";
    if (readingType === "triennial2") return "TR2";
    if (readingType === "triennial3") return "TR3";
    return "Full";
  }

  async function getSefariaHebrewForModalSelection() {
    const parshaSelect = document.getElementById("ptParshaSelect");
    if (!parshaSelect || !parshaSelect.value) {
      alert("Select a Parsha first.");
      return;
    }

    const parshaName = parshaSelect.value;
    const readingType = getModalReadingType();
    const aliyahNumber = getModalAliyahNumber();

    if (!aliyahNumber) {
      alert("Select an individual Aliyah (1-7 or M) before getting Hebrew text.");
      return;
    }

    const selection = getReadingSelection(
      parshaName,
      readingType,
      aliyahNumber
    );

    if (!selection) {
      alert("The selected Pocket Torah reading range could not be resolved.");
      return;
    }

    const aliyahName = parshaName + "-" + aliyahNumber;
    const jsonTitle = aliyahName + "-PT";
    const fileBase =
      aliyahName + "-" +
      (aliyahNumber === "M"
        ? "Maftir"
        : getPTReadingFileSuffix(readingType, aliyahNumber));

    if (
      !window.SefariaPT ||
      typeof window.SefariaPT.loadPocketTorahHebrew !== "function"
    ) {
      alert("The Sefaria Hebrew retrieval function is not available.");
      return;
    }

    stopModalAudio();

    const loaded = await window.SefariaPT.loadPocketTorahHebrew({
      parshaName: parshaName,
      readingType: readingType,
      aliyahNumber: aliyahNumber,
      jsonTitle: jsonTitle,
      fileBase: fileBase,
      book: selection.book,
      startChapter: selection.startChapter,
      startVerse: selection.startVerse,
      endChapter: selection.endChapter,
      endVerse: selection.endVerse
    });

    if (loaded) {
      // Close the :target modal immediately so the retrieved Hebrew/editor
      // and the main-page Save JSON control are visible.
      if (window.location.hash === "#pocketTorahModal") {
        window.location.hash = "";
      }
    }
  }

  async function initializeSefariaPocketTorahModal() {
    const parshaSelect = document.getElementById("ptParshaSelect");
    if (!parshaSelect) return;

    try {
      await runWithSourceFallback(function() {
        return ensureResourcesLoaded();
      });

      const parshaNames = getParshaNames();

      while (parshaSelect.options.length > 1) {
        parshaSelect.remove(1);
      }

      parshaNames.forEach(function(parshaName) {
        const option = document.createElement("option");
        option.value = parshaName;
        option.textContent = parshaName;
        parshaSelect.appendChild(option);
      });

      const aliyahSelect = document.getElementById("ptAliyahSelect");

      async function resetAndRecalculateSefariaModal() {
        try {
          await resetSourceForNewReading();
          await runWithSourceFallback(function() {
            return ensureResourcesLoaded();
          });
          await recalculateSefariaModal();
        } catch (error) {
          console.error("Pocket Torah reading reset failed:", error);
        }
      }

      parshaSelect.addEventListener("change", resetAndRecalculateSefariaModal);
      document.querySelectorAll('input[name="ptReading"]').forEach(function(input) {
        input.addEventListener("change", resetAndRecalculateSefariaModal);
      });
      if (aliyahSelect) {
        aliyahSelect.addEventListener("change", resetAndRecalculateSefariaModal);
      }
      populateModalAliyahSelect();

      const audioToggle = document.getElementById("ptAudioToggle");
      if (audioToggle) {
        audioToggle.addEventListener("click", toggleModalAudioPlayback);
      }

      const getHebrewText = document.getElementById("ptGetHebrewText");
      if (getHebrewText) {
        getHebrewText.addEventListener(
          "click",
          getSefariaHebrewForModalSelection
        );
      }

      setAudioTogglePlaying(false);

      console.log(
        "Pocket Torah parsha list loaded:",
        parshaNames.length,
        "parshiot"
      );
    } catch (error) {
      clearModalReference();
      console.error("Pocket Torah parsha list could not be loaded:", error);
    }
  }

  function getPreparedModalReading() {
    return preparedModalReading;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeSefariaPocketTorahModal);
    } else {
      initializeSefariaPocketTorahModal();
    }
    window.addEventListener("hashchange", function() {
      if (window.location.hash !== "#pocketTorahModal") stopModalAudio();
    });
    document.addEventListener("click", function(event) {
      if (event.target.closest && event.target.closest(".pt-modal-close")) stopModalAudio();
    });
  }

  global.PocketTorah = Object.freeze({
    setBasePath: setBasePath,
    getBasePath: getBasePath,
    getAvailableSources: getAvailableSources,
    getActiveSource: getActiveSource,
    setActiveSource: setActiveSource,
    resetSourceForNewReading: resetSourceForNewReading,
    ensureSourceConfigLoaded: ensureSourceConfigLoaded,
    runWithSourceFallback: runWithSourceFallback,
    ensureResourcesLoaded: ensureResourcesLoaded,
    resolveResourceName: resolveResourceName,
    findAliyah: findAliyah,
    getBookName: getBookName,
    loadBook: loadBook,
    loadLabels: loadLabels,
    getAudioPath: getAudioPath,
    loadAudioDuration: loadAudioDuration,
    getVerse: getVerse,
    countWordsBeforeVerse: countWordsBeforeVerse,
    parseCanonicalLineName: parseCanonicalLineName,
    preparePlaybackData: preparePlaybackData,
    getAliyahData: getAliyahData,
    getParsha: getParsha,
    getParshaNames: getParshaNames,
    getReadingSelection: getReadingSelection,
    getReadingAliyahNumbers: getReadingAliyahNumbers,
    prepareReadingTiming: prepareReadingTiming,
    initializeSefariaPocketTorahModal: initializeSefariaPocketTorahModal,
    recalculateSefariaModal: recalculateSefariaModal,
    getPreparedModalReading: getPreparedModalReading,
    getSefariaHebrewForModalSelection: getSefariaHebrewForModalSelection,
    toggleModalAudioPlayback: toggleModalAudioPlayback,
    stopModalAudio: stopModalAudio
  });
})(globalThis);
