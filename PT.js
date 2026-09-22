/*
 * PT.js
 * Pocket Torah data/analysis support shared by applications.
 *
 * This file deliberately contains no application DOM access.  Applications
 * supply their own UI values as arguments and, when audio metadata is needed,
 * supply an audio-duration loader callback.
 *
 * Local PocketTorah repository layout is preserved.  No PocketTorah web API
 * or remote resource URLs are used.
 */
(function(global) {
  "use strict";

  const DEFAULT_BASE_PATH = "PocketTorah";

  let basePath = DEFAULT_BASE_PATH;
  let resourcesLoaded = false;
  let aliyahData = null;
  let resourceNames = {};
  const torahData = {};
  const labelData = {};
  const audioDurationData = {};

  function setBasePath(newBasePath) {
    if (typeof newBasePath !== "string" || !newBasePath.trim()) {
      throw new Error("Pocket Torah base path must be a non-empty string.");
    }

    basePath = newBasePath.replace(/\/$/, "");
  }

  function getBasePath() {
    return basePath;
  }

  function buildLocalPath(relativePath) {
    return basePath + "/" + relativePath.replace(/^\//, "");
  }

  async function ensureResourcesLoaded() {
    if (resourcesLoaded) {
      return;
    }

    const aliyahResponse = await fetch(
      buildLocalPath("data/aliyah.json") + "?v=" + Date.now(),
      { cache: "no-store" }
    );

    if (!aliyahResponse.ok) {
      throw new Error(
        "Could not load PocketTorah/data/aliyah.json. Status: " +
        aliyahResponse.status
      );
    }

    aliyahData = await aliyahResponse.json();

    const resourceMapResponse = await fetch(
      buildLocalPath("data/PocketTorahResourceMap.json") + "?v=" + Date.now(),
      { cache: "no-store" }
    );

    if (!resourceMapResponse.ok) {
      throw new Error(
        "Could not load PocketTorah/data/PocketTorahResourceMap.json. Status: " +
        resourceMapResponse.status
      );
    }

    resourceNames = await resourceMapResponse.json();
    resourcesLoaded = true;

    console.log("Pocket Torah aliyah data loaded.");
    console.log("Pocket Torah resource names loaded:", resourceNames);
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

  global.PocketTorah = Object.freeze({
    setBasePath: setBasePath,
    getBasePath: getBasePath,
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
    getParsha: getParsha
  });
})(globalThis);
