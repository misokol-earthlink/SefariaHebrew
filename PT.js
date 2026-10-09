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

  const pocketTorahLabelFiles = Object.freeze({"achrei mot-1":"Achrei Mot-1","achrei mot-2":"Achrei Mot-2","achrei mot-3":"Achrei Mot-3","achrei mot-4":"Achrei Mot-4","achrei mot-5":"Achrei Mot-5","achrei mot-6":"Achrei Mot-6","achrei mot-7":"Achrei Mot-7","achrei mot-h":"Achrei Mot-h","balak-1":"Balak-1","balak-2":"Balak-2","balak-3":"Balak-3","balak-4":"balak-4","balak-5":"Balak-5","balak-6":"Balak-6","balak-7":"Balak-7","balak-h":"Balak-h","bamidbar-1":"Bamidbar-1","bamidbar-2":"Bamidbar-2","bamidbar-3":"Bamidbar-3","bamidbar-4":"Bamidbar-4","bamidbar-5":"Bamidbar-5","bamidbar-6":"Bamidbar-6","bamidbar-7":"Bamidbar-7","bamidbar-h":"Bamidbar-H","bechukotai-1":"Bechukotai-1","bechukotai-2":"Bechukotai-2","bechukotai-3":"Bechukotai-3","bechukotai-4":"Bechukotai-4","bechukotai-5":"Bechukotai-5","bechukotai-6":"Bechukotai-6","bechukotai-7":"Bechukotai-7","bechukotai-h":"Bechukotai-h","behar-1":"Behar-1","behar-2":"Behar-2","behar-3":"Behar-3","behar-4":"Behar-4","behar-5":"Behar-5","behar-6":"Behar-6","behar-7":"Behar-7","behar-h":"Behar-H","beha’alotcha-1":"Beha’alotcha-1","beha’alotcha-2":"Beha’alotcha-2","beha’alotcha-3":"Beha’alotcha-3","beha’alotcha-4":"Beha’alotcha-4","beha’alotcha-5":"Beha’alotcha-5","beha’alotcha-6":"Beha’alotcha-6","beha’alotcha-7":"Beha’alotcha-7","beha’alotcha-h":"Beha’alotcha-H","bereshit-1":"Bereshit-1","bereshit-2":"Bereshit-2","bereshit-3":"Bereshit-3","bereshit-4":"Bereshit-4","bereshit-5":"Bereshit-5","bereshit-6":"Bereshit-6","bereshit-7":"Bereshit-7","bereshit-h":"Bereshit-H","beshalach-1":"Beshalach-1","beshalach-2":"Beshalach-2","beshalach-3":"Beshalach-3","beshalach-4":"Beshalach-4","beshalach-5":"Beshalach-5","beshalach-6":"Beshalach-6","beshalach-7":"Beshalach-7","beshalach-h":"Beshalach-H","bo-1":"Bo-1","bo-2":"Bo-2","bo-3":"Bo-3","bo-4":"Bo-4","bo-5":"Bo-5","bo-6":"Bo-6","bo-7":"Bo-7","bo-h":"Bo-H","chayei sara-1":"chayei sara-1","chayei sara-2":"Chayei Sara-2","chayei sara-3":"Chayei Sara-3","chayei sara-4":"Chayei Sara-4","chayei sara-5":"Chayei Sara-5","chayei sara-6":"Chayei Sara-6","chayei sara-7":"Chayei Sara-7","chayei sara-h":"Chayei Sara-h","chukat-1":"Chukat-1","chukat-2":"Chukat-2","chukat-3":"Chukat-3","chukat-4":"Chukat-4","chukat-5":"Chukat-5","chukat-6":"Chukat-6","chukat-7":"Chukat-7","chukat-h":"Chukat-h","devarim-1":"devarim-1","devarim-2":"devarim-2","devarim-3":"devarim-3","devarim-4":"devarim-4","devarim-5":"devarim-5","devarim-6":"devarim-6","devarim-7":"devarim-7","devarim-h":"devarim-H","eikev-1":"eikev-1","eikev-2":"eikev-2","eikev-3":"eikev-3","eikev-4":"eikev-4","eikev-5":"eikev-5","eikev-6":"eikev-6","eikev-7":"eikev-7","eikev-h":"eikev-H","emor-1":"emor-1","emor-2":"Emor-2","emor-3":"Emor-3","emor-4":"Emor-4","emor-5":"Emor-5","emor-6":"Emor-6","emor-7":"Emor-7","emor-h":"Emor-H","haazinu-1":"haazinu-1","haazinu-2":"haazinu-2","haazinu-3":"haazinu-3","haazinu-4":"haazinu-4","haazinu-5":"haazinu-5","haazinu-6":"haazinu-6","haazinu-7":"haazinu-7","haazinu-h":"haazinu-h","kedoshim-1":"Kedoshim-1","kedoshim-2":"Kedoshim-2","kedoshim-3":"Kedoshim-3","kedoshim-4":"Kedoshim-4","kedoshim-5":"Kedoshim-5","kedoshim-6":"Kedoshim-6","kedoshim-7":"Kedoshim-7","kedoshim-h":"Kedoshim-h","ki tavo-1":"Ki Tavo-1","ki tavo-2":"Ki Tavo-2","ki tavo-3":"Ki Tavo-3","ki tavo-4":"Ki Tavo-4","ki tavo-5":"Ki Tavo-5","ki tavo-6":"Ki Tavo-6","ki tavo-7":"Ki Tavo-7","ki tavo-h":"Ki Tavo-H","ki teitzei-1":"Ki Teitzei-1","ki teitzei-2":"Ki Teitzei-2","ki teitzei-3":"Ki Teitzei-3","ki teitzei-4":"Ki Teitzei-4","ki teitzei-5":"Ki Teitzei-5","ki teitzei-6":"Ki Teitzei-6","ki teitzei-7":"Ki Teitzei-7","ki teitzei-h":"Ki Teitzei-h","ki tisa-1":"ki tisa-1","ki tisa-2":"ki tisa-2","ki tisa-3":"Ki Tisa-3","ki tisa-4":"Ki Tisa-4","ki tisa-5":"ki tisa-5","ki tisa-6":"ki tisa-6","ki tisa-7":"ki tisa-7","ki tisa-h":"ki tisa-h","korach-1":"korach-1","korach-2":"korach-2","korach-3":"Korach-3","korach-4":"Korach-4","korach-5":"Korach-5","korach-6":"Korach-6","korach-7":"Korach-7","korach-h":"Korach-h","lech-lecha-1":"lech-lecha-1","lech-lecha-2":"lech-lecha-2","lech-lecha-3":"lech-lecha-3","lech-lecha-4":"Lech-lecha-4","lech-lecha-5":"lech-lecha-5","lech-lecha-6":"lech-lecha-6","lech-lecha-7":"lech-lecha-7","lech-lecha-h":"lech-lecha-h","masei-1":"masei-1","masei-2":"masei-2","masei-3":"masei-3","masei-4":"masei-4","masei-5":"masei-5","masei-6":"masei-6","masei-7":"masei-7","masei-h":"masei-h","matot-1":"matot-1","matot-2":"matot-2","matot-3":"matot-3","matot-4":"matot-4","matot-5":"matot-5","matot-6":"matot-6","matot-7":"matot-7","matot-h":"matot-h","metzora-1":"metzora-1","metzora-2":"metzora-2","metzora-3":"metzora-3","metzora-4":"metzora-4","metzora-5":"metzora-5","metzora-6":"metzora-6","metzora-7":"metzora-7","metzora-h":"metzora-h","miketz-1":"Miketz-1","miketz-2":"Miketz-2","miketz-3":"Miketz-3","miketz-4":"Miketz-4","miketz-5":"Miketz-5","miketz-6":"Miketz-6","miketz-7":"Miketz-7","miketz-h":"Miketz-H","mishpatim-1":"Mishpatim-1","mishpatim-2":"Mishpatim-2","mishpatim-3":"Mishpatim-3","mishpatim-4":"Mishpatim-4","mishpatim-5":"Mishpatim-5","mishpatim-6":"Mishpatim-6","mishpatim-7":"Mishpatim-7","mishpatim-h":"mishpatim-H","nasso-1":"Nasso-1","nasso-2":"Nasso-2","nasso-3":"Nasso-3","nasso-4":"Nasso-4","nasso-5":"Nasso-5","nasso-6":"Nasso-6","nasso-7":"Nasso-7","nasso-h":"nasso-h","nitzavim-1":"Nitzavim-1","nitzavim-2":"Nitzavim-2","nitzavim-3":"Nitzavim-3","nitzavim-4":"Nitzavim-4","nitzavim-5":"Nitzavim-5","nitzavim-6":"Nitzavim-6","nitzavim-7":"nitzavim-7","nitzavim-h":"nitzavim-h","noach-1":"noach-1","noach-2":"Noach-2","noach-3":"Noach-3","noach-4":"Noach-4","noach-5":"Noach-5","noach-6":"Noach-6","noach-7":"Noach-7","noach-h":"Noach-H","pekudei-1":"pekudei-1","pekudei-2":"pekudei-2","pekudei-3":"pekudei-3","pekudei-4":"pekudei-4","pekudei-5":"pekudei-5","pekudei-6":"pekudei-6","pekudei-7":"pekudei-7","pekudei-h":"pekudei-h","pinchas-1":"Pinchas-1","pinchas-2":"Pinchas-2","pinchas-3":"Pinchas-3","pinchas-4":"Pinchas-4","pinchas-5":"Pinchas-5","pinchas-6":"Pinchas-6","pinchas-7":"Pinchas-7","pinchas-h":"Pinchas-H","re’eh-1":"re’eh-1","re’eh-2":"re’eh-2","re’eh-3":"re’eh-3","re’eh-4":"re’eh-4","re’eh-5":"re’eh-5","re’eh-6":"re’eh-6","re’eh-7":"re’eh-7","re’eh-h":"re’eh-h","shemot-1":"Shemot-1","shemot-2":"Shemot-2","shemot-3":"Shemot-3","shemot-4":"Shemot-4","shemot-5":"Shemot-5","shemot-6":"Shemot-6","shemot-7":"Shemot-7","shemot-h":"Shemot-H","shmini-1":"shmini-1","shmini-2":"shmini-2","shmini-3":"shmini-3","shmini-4":"shmini-4","shmini-5":"shmini-5","shmini-6":"shmini-6","shmini-7":"shmini-7","shmini-h":"shmini-h","shoftim-1":"shoftim-1","shoftim-2":"shoftim-2","shoftim-3":"shoftim-3","shoftim-4":"shoftim-4","shoftim-5":"shoftim-5","shoftim-6":"shoftim-6","shoftim-7":"shoftim-7","shoftim-h":"shoftim-h","sh’lach-1":"sh’lach-1","sh’lach-2":"sh’lach-2","sh’lach-3":"sh’lach-3","sh’lach-4":"sh’lach-4","sh’lach-5":"sh’lach-5","sh’lach-6":"sh’lach-6","sh’lach-7":"sh’lach-7","sh’lach-h":"sh’lach-H","tazria-1":"tazria-1","tazria-2":"tazria-2","tazria-3":"tazria-3","tazria-4":"tazria-4","tazria-5":"tazria-5","tazria-6":"tazria-6","tazria-7":"tazria-7","tazria-h":"tazria-h","terumah-1":"terumah-1","terumah-2":"terumah-2","terumah-3":"terumah-3","terumah-4":"terumah-4","terumah-5":"terumah-5","terumah-6":"terumah-6","terumah-7":"terumah-7","terumah-h":"Terumah-H","tetzaveh-1":"tetzaveh-1","tetzaveh-2":"tetzaveh-2","tetzaveh-3":"tetzaveh-3","tetzaveh-4":"tetzaveh-4","tetzaveh-5":"tetzaveh-5","tetzaveh-6":"tetzaveh-6","tetzaveh-7":"tetzaveh-7","tetzaveh-h":"tetzaveh-h","toldot-1":"toldot-1","toldot-2":"toldot-2","toldot-3":"toldot-3","toldot-4":"toldot-4","toldot-5":"toldot-5","toldot-6":"toldot-6","toldot-7":"toldot-7","toldot-h":"toldot-h","tzav-1":"Tzav-1","tzav-2":"Tzav-2","tzav-3":"Tzav-3","tzav-4":"Tzav-4","tzav-5":"Tzav-5","tzav-6":"Tzav-6","tzav-7":"tzav-7","tzav-h":"tzav-h","vaera-1":"Vaera-1","vaera-2":"Vaera-2","vaera-3":"Vaera-3","vaera-4":"Vaera-4","vaera-5":"Vaera-5","vaera-6":"Vaera-6","vaera-7":"Vaera-7","vaera-h":"Vaera-H","vayakhel-1":"vayakhel-1","vayakhel-2":"vayakhel-2","vayakhel-3":"vayakhel-3","vayakhel-4":"vayakhel-4","vayakhel-5":"vayakhel-5","vayakhel-6":"vayakhel-6","vayakhel-7":"vayakhel-7","vayakhel-h":"vayakhel-h","vayechi-1":"Vayechi-1","vayechi-2":"Vayechi-2","vayechi-3":"Vayechi-3","vayechi-4":"Vayechi-4","vayechi-5":"Vayechi-5","vayechi-6":"Vayechi-6","vayechi-7":"Vayechi-7","vayechi-h":"Vayechi-H","vayeilech-1":"vayeilech-1","vayeilech-2":"vayeilech-2","vayeilech-3":"vayeilech-3","vayeilech-4":"vayeilech-4","vayeilech-5":"vayeilech-5","vayeilech-6":"vayeilech-6","vayeilech-7":"vayeilech-7","vayeilech-h":"vayeilech-h","vayera-1":"vayera-1","vayera-2":"Vayera-2","vayera-3":"Vayera-3","vayera-4":"Vayera-4","vayera-5":"Vayera-5","vayera-6":"Vayera-6","vayera-7":"Vayera-7","vayera-h":"Vayera-h","vayeshev-1":"Vayeshev-1","vayeshev-2":"Vayeshev-2","vayeshev-3":"Vayeshev-3","vayeshev-4":"Vayeshev-4","vayeshev-5":"Vayeshev-5","vayeshev-6":"Vayeshev-6","vayeshev-7":"Vayeshev-7","vayeshev-h":"Vayeshev-H","vayetzei-1":"Vayetzei-1","vayetzei-2":"Vayetzei-2","vayetzei-3":"Vayetzei-3","vayetzei-4":"Vayetzei-4","vayetzei-5":"Vayetzei-5","vayetzei-6":"Vayetzei-6","vayetzei-7":"Vayetzei-7","vayetzei-h":"Vayetzei-H","vayigash-1":"Vayigash-1","vayigash-2":"Vayigash-2","vayigash-3":"Vayigash-3","vayigash-4":"Vayigash-4","vayigash-5":"Vayigash-5","vayigash-6":"Vayigash-6","vayigash-7":"Vayigash-7","vayigash-h":"Vayigash-H","vayikra-1":"vayikra-1","vayikra-2":"vayikra-2","vayikra-3":"vayikra-3","vayikra-4":"vayikra-4","vayikra-5":"vayikra-5","vayikra-6":"vayikra-6","vayikra-7":"vayikra-7","vayikra-h":"Vayikra-H","vayishlach-1":"Vayishlach-1","vayishlach-2":"Vayishlach-2","vayishlach-3":"Vayishlach-3","vayishlach-4":"Vayishlach-4","vayishlach-5":"Vayishlach-5","vayishlach-6":"Vayishlach-6","vayishlach-7":"Vayishlach-7","vayishlach-h":"Vayishlach-H","va’ethanan-1":"Va’ethanan-1","va’ethanan-2":"Va’ethanan-2","va’ethanan-3":"Va’ethanan-3","va’ethanan-4":"Va’ethanan-4","va’ethanan-5":"Va’ethanan-5","va’ethanan-6":"Va’ethanan-6","va’ethanan-7":"Va’ethanan-7","va’ethanan-h":"Va’ethanan-h","vezot haberakhah-1":"Vezot Haberakhah-1","vezot haberakhah-2":"Vezot Haberakhah-2","vezot haberakhah-3":"Vezot Haberakhah-3","vezot haberakhah-4":"Vezot Haberakhah-4","vezot haberakhah-5":"Vezot Haberakhah-5","vezot haberakhah-6":"Vezot Haberakhah-6","vezot haberakhah-7":"Vezot Haberakhah-7","vezot haberakhah-h":"Vezot Haberakhah-h","yitro-1":"yitro-1","yitro-2":"yitro-2","yitro-3":"yitro-3","yitro-4":"yitro-4","yitro-5":"yitro-5","yitro-6":"yitro-6","yitro-7":"yitro-7","yitro-h":"yitro-h"});

  async function loadLabels(parshaName, aliyahNumber) {
    const resourceName = resolveResourceName(parshaName);
    const logicalLabelKey = resourceName.labels + "-" + aliyahNumber;

    // Pocket Torah's historical labels directory is not consistently cased.
    // Resolve the logical parsha/aliyah name against the actual filename set
    // so case-sensitive GitHub/raw hosting receives the exact stored name.
    // The lookup is case-insensitive and also normalizes the repository's
    // literal #U2019 spelling used in a few filenames to a curly apostrophe.
    const manifestKey = String(logicalLabelKey).replace(/#U2019/gi, "’").toLowerCase();
    const labelKey = pocketTorahLabelFiles[manifestKey] || logicalLabelKey;

    // Cache under the logical key used by the rest of PT.js as well as the
    // exact physical filename key. The two can differ in capitalization.
    if (labelData[logicalLabelKey]) {
      return labelData[logicalLabelKey];
    }
    if (labelData[labelKey]) {
      labelData[logicalLabelKey] = labelData[labelKey];
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

    const parsedLabels = labelText
      .split(",")
      .map(function(value) {
        return Number(value.trim());
      })
      .filter(function(value) {
        return Number.isFinite(value);
      });

    // Downstream timing code addresses labels by the logical resource name
    // (for example "Noach-1"), while the physical file may be "noach-1.txt".
    // Store both aliases so both paths reference the same parsed label array.
    labelData[labelKey] = parsedLabels;
    labelData[logicalLabelKey] = parsedLabels;

    console.log(
      "Pocket Torah labels loaded:",
      logicalLabelKey,
      "from",
      labelKey + ".txt",
      parsedLabels.length
    );

    return parsedLabels;
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

  function resolveTriennialYear(parsha, yearNumber, useAlt) {
    const branch =
      parsha && useAlt && parsha["triennial-alt"]
        ? parsha["triennial-alt"]
        : parsha && parsha.triennial
          ? parsha.triennial
          : null;

    const years = branch && Array.isArray(branch.year) ? branch.year : [];

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

  function getReadingAliyot(parsha, readingType, useAlt) {
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
      const year = resolveTriennialYear(parsha, Number(match[1]), Boolean(useAlt));
      return year && Array.isArray(year.aliyah) ? year.aliyah : null;
    }

    return null;
  }

  function getReadingAliyahNumbers(parshaName, readingType, useAlt) {
    const parsha = getParsha(parshaName);
    const aliyot = getReadingAliyot(parsha, readingType, useAlt);
    if (!aliyot) return [];
    return aliyot.filter(function(a) { return a && a._num != null; })
      .map(function(a) { return String(a._num).toUpperCase(); });
  }

  function getReadingSelection(parshaName, readingType, aliyahNumber, useAlt) {
    const parsha = getParsha(parshaName);
    if (!parsha) return null;
    const aliyot = getReadingAliyot(parsha, readingType, useAlt);
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

  async function prepareReadingTiming(parshaName, readingType, durationLoader, aliyahNumber, useAlt) {
    await ensureResourcesLoaded();

    const selection = getReadingSelection(parshaName, readingType, aliyahNumber, useAlt);
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
  let hhCatalog = null;
  let cbsCatalog = null;
  let swfsCatalog = null;
  let selectedHHReading = null;
  let selectedHHSource = null; // "TS" or "CBS"
  let selectedPTParshaName = "";
  let selectedReadingName = "";
  const HH_CATALOG_PATH = "HH.json";
  const CBS_CATALOG_PATH = "HH2.json";
  const SWFS_CATALOG_PATH = "HH3.json";

  // Sefaria modal audio playback state.  Playback consumes the already
  // calculated aliyah-relative audioPath/startTime/endTime segments.
  let modalAudio = null;
  let modalPlaybackSegments = [];
  let modalPlaybackIndex = -1;
  let modalPlaybackToken = 0;
  let modalTimeUpdateHandler = null;
  let hhAudioWindow = null;
  let swfsWidgets = [];
  let swfsFrames = [];
  let swfsReady = [];
  let swfsActive = null;
  let swfsToken = 0;
  let swfsCurrent = 0;
  let swfsLoading = false;
  let swfsOffsetApplied = false;
  let swfsInitialTrack = [];
  let swfsScriptPromise = null;

  function ensureSoundCloudScript() {
    if (window.SC && window.SC.Widget) return Promise.resolve();
    if (swfsScriptPromise) return swfsScriptPromise;
    swfsScriptPromise = new Promise(function(resolve, reject) {
      const script = document.createElement("script");
      script.src = "https://w.soundcloud.com/player/api.js";
      script.onload = resolve;
      script.onerror = function() { swfsScriptPromise = null; reject(new Error("SoundCloud API unavailable")); };
      document.head.appendChild(script);
    });
    return swfsScriptPromise;
  }

  function swfsTrackUrl(track) { return "https://api.soundcloud.com/tracks/" + track.id; }
  function stopSWFS() {
    swfsToken++;
    swfsActive = null;
    swfsWidgets.forEach(function(widget) { try { widget.pause(); } catch (_) {} });
  }
  function clearSWFSPlayers() {
    stopSWFS();
    swfsFrames.forEach(function(frame) { frame.remove(); });
    swfsFrames = []; swfsWidgets = []; swfsReady = []; swfsInitialTrack = [];
  }
  async function prepareSWFSPlayers(reading) {
    clearSWFSPlayers();
    if (!reading || !Array.isArray(reading.aliyot)) return;
    const token = swfsToken;
    await ensureSoundCloudScript();
    if (token !== swfsToken) return;
    reading.aliyot.forEach(function(aliyah, index) {
      if (!aliyah.tracks || !aliyah.tracks.length) return;
      const frame = document.createElement("iframe");
      frame.title = "SWFS SoundCloud aliyah " + aliyah.num;
      frame.allow = "autoplay; encrypted-media";
      frame.style.cssText = "position:absolute;left:-10000px;top:-10000px;width:1px;height:1px;border:0";
      frame.src = "https://w.soundcloud.com/player/?url=" + encodeURIComponent(swfsTrackUrl(aliyah.tracks[0])) + "&auto_play=false";
      document.body.appendChild(frame);
      swfsFrames[index] = frame;
      swfsInitialTrack[index] = true;
      const widget = window.SC.Widget(frame);
      swfsWidgets[index] = widget;
      widget.bind(window.SC.Widget.Events.READY, function() { swfsReady[index] = true; });
      widget.bind(window.SC.Widget.Events.PLAY, function() {
        if (!swfsActive || swfsActive.index !== index) return;
        swfsLoading = false;
        if (!swfsOffsetApplied) {
          swfsOffsetApplied = true;
          widget.seekTo(Number(swfsCatalog.startOffsetMs) || 900);
        }
      });
      widget.bind(window.SC.Widget.Events.FINISH, function() {
        if (!swfsActive || swfsActive.index !== index || swfsLoading) return;
        const next = swfsCurrent + 1;
        if (next >= swfsActive.tracks.length) { stopSWFS(); setAudioTogglePlaying(false); return; }
        swfsCurrent = next; swfsLoading = true; swfsOffsetApplied = false;
        swfsInitialTrack[index] = false;
        widget.load(swfsTrackUrl(swfsActive.tracks[next]), {auto_play:true});
      });
      widget.bind(window.SC.Widget.Events.ERROR, function() {
        if (swfsActive && swfsActive.index === index) {
          console.warn("SWFS SoundCloud playback error", swfsActive.tracks[swfsCurrent].ref);
          stopSWFS(); setAudioTogglePlaying(false);
        }
      });
    });
  }
  function toggleSWFSPlayback(selection) {
    if (swfsActive) { stopModalAudio(); return; }
    const index = selectedHHReading.aliyot.findIndex(function(a) { return String(a.num) === String(getModalAliyahNumber()); });
    if (index < 0 || !swfsReady[index]) {
      console.warn("SWFS SoundCloud player is not ready. Please try again shortly."); return;
    }
    stopModalAudio();
    swfsCurrent = 0; swfsOffsetApplied = false;
    swfsActive = {index:index, tracks:selection.tracks};
    const widget = swfsWidgets[index];
    if (swfsInitialTrack[index]) { widget.seekTo(0); widget.play(); }
    else {
      swfsLoading = true;
      widget.load(swfsTrackUrl(selection.tracks[0]), {auto_play:true});
    }
    setAudioTogglePlaying(true);
  }


  function ensureReadingNameField() {
    let field = document.getElementById("ptReadingNameField");
    if (field) return field;

    const parshaSelect = document.getElementById("ptParshaSelect");
    const parshaField = parshaSelect ? parshaSelect.closest(".pt-modal-field") : null;
    if (!parshaField || !parshaField.parentNode) return null;

    field = document.createElement("div");
    field.id = "ptReadingNameField";
    field.className = "pt-modal-field";
    field.style.display = "none";

    const label = document.createElement("label");
    label.htmlFor = "ptReadingNameDisplay";
    label.textContent = "Reading Name";

    const input = document.createElement("input");
    input.id = "ptReadingNameDisplay";
    input.type = "text";
    input.readOnly = true;
    input.style.minWidth = "220px";

    field.appendChild(label);
    field.appendChild(input);
    parshaField.parentNode.insertBefore(field, parshaField.nextSibling);
    return field;
  }

  function setReadingName(name, showField) {
    selectedReadingName = String(name || "").trim();
    const field = ensureReadingNameField();
    const display = document.getElementById("ptReadingNameDisplay");
    if (display) display.value = selectedReadingName;
    if (field) field.style.display = showField ? "flex" : "none";
  }

  function setAudioTogglePlaying(isPlaying) {
    const button = document.getElementById("ptAudioToggle");
    const icon = document.getElementById("ptAudioToggleIcon");
    const sourceName = isHHMode()
      ? (selectedHHSource === "SWFS" ? "Stephen Wise Free Synagogue High Holiday" : selectedHHSource === "CBS" ? "Congregation Beth Shalom High Holiday" : "Temple Sinai High Holiday")
      : "Pocket Torah";
    if (button) {
      button.setAttribute("aria-pressed", isPlaying ? "true" : "false");
      button.setAttribute(
        "aria-label",
        isPlaying ? "Stop " + sourceName + " audio" : "Play " + sourceName + " audio"
      );
    }
    if (icon) {
      icon.innerHTML = isPlaying ? "&#9632;" : "&#9654;";
    }
  }

  function stopModalAudio() {
    modalPlaybackToken += 1;
    stopSWFS();

    if (hhAudioWindow && !hhAudioWindow.closed) {
      hhAudioWindow.close();
    }
    hhAudioWindow = null;

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
    if (isHHMode()) {
      const selection = getHHSelection();
      if (!selection) {
        console.warn("High Holiday audio is not ready. Select a reading and Aliyah first.");
        return;
      }

      if (selectedHHSource === "SWFS") { toggleSWFSPlayback(selection); return; }

      // Congregation Beth Shalom playback is source-specific: use the MP3 and
      // reviewed start/end segments stored in HH2.json.
      if (selectedHHSource === "CBS") {
        if (modalAudio && !modalAudio.paused) {
          stopModalAudio();
          return;
        }
        if (!Array.isArray(selection.playbackSegments) || !selection.playbackSegments.length) {
          console.warn("Congregation Beth Shalom playback segments are not available.");
          return;
        }
        stopModalAudio();
        modalPlaybackSegments = selection.playbackSegments.slice();
        const token = ++modalPlaybackToken;
        setAudioTogglePlaying(true);
        playModalSegment(0, token);
        return;
      }

      // Temple Sinai retains its existing direct-link playback path.
      if (hhAudioWindow && !hhAudioWindow.closed) {
        stopModalAudio();
        return;
      }
      if (!selection.audioUrl) {
        console.warn("Temple Sinai High Holiday audio URL is not available.");
        return;
      }

      stopModalAudio();

      const width = 400;
      const height = 180;
      const left = Math.max(0, screen.availWidth - width - 20);
      const top = Math.max(0, screen.availHeight - height - 60);

      hhAudioWindow = window.open(
        selection.audioUrl,
        "ShulCloudAudio",
        "width=" + width +
          ",height=" + height +
          ",left=" + left +
          ",top=" + top
      );

      if (!hhAudioWindow) {
        console.warn("High Holiday playback window was blocked by the browser.");
        setAudioTogglePlaying(false);
        return;
      }

      setAudioTogglePlaying(true);
      window.focus();
      return;
    }

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

  // Shared verse selector. Source adapters produce one independently playable verse.
  let verseEntries = [];
  let verseAudio = null;
  let verseWidget = null;
  let versePlaybackSerial = 0;
  let verseEndHandler = null;
  let verseFinishWidget = null;
  let verseFinishCallback = null;

  function verseStatus(message) {
    const el = document.getElementById("ptVerseStatus");
    if (el) el.textContent = message || "";
  }
  function stopVersePlayback() {
    ++versePlaybackSerial;
    if (verseAudio) {
      if (verseEndHandler) verseAudio.removeEventListener("timeupdate", verseEndHandler);
      verseAudio.pause(); verseAudio.removeAttribute("src"); verseAudio.load();
    }
    verseAudio = null; verseEndHandler = null;
    if (verseFinishWidget && verseFinishCallback && window.SC && window.SC.Widget) {
      try { verseFinishWidget.unbind(window.SC.Widget.Events.FINISH,verseFinishCallback); } catch (_) {}
    }
    verseFinishWidget=null;verseFinishCallback=null;
    if (verseWidget) { try { verseWidget.pause(); } catch (_) {} }
    verseWidget = null;
  }
  function finishVersePlayback(serial) {
    if (serial !== versePlaybackSerial) return;
    stopVersePlayback();
    const select = document.getElementById("ptVerseSelect");
    if (select) select.value = "";
    verseStatus("Select a verse to play.");
  }
  function closeVerseSelector() {
    stopVersePlayback();
    const modal = document.getElementById("ptVerseModal");
    if (modal) modal.style.display = "none";
    const checkbox = document.getElementById("ptVerseMode");
    if (checkbox) checkbox.checked = false;
    const select = document.getElementById("ptVerseSelect");
    if (select) select.value = "";
    const parent = document.getElementById("pocketTorahModal");
    if (parent) parent.style.display = "flex";
  }
  function verseRef(book, chapter, verse) {
    return book + " " + chapter + ":" + verse;
  }
  function expandVerseRange(book, startChapter, startVerse, endChapter, endVerse) {
    const result = [];
    const chapters = {
      Genesis:[31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26],
      Exodus:[22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,37,30,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38],
      Leviticus:[17,16,17,35,26,23,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34],
      Numbers:[54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,39,17,54,42,56,29,34,13],
      Deuteronomy:[46,37,29,49,33,25,26,20,29,22,32,31,19,29,23,22,20,22,21,20,23,30,25,22,19,19,26,69,28,20,30,52,29,12]
    }[book];
    if (!chapters) return result;
    for (let c=startChapter;c<=endChapter;c++) {
      const last = c===endChapter ? endVerse : chapters[c-1];
      for (let v=c===startChapter?startVerse:1;v<=last;v++) result.push({chapter:c,verse:v,ref:verseRef(book,c,v)});
    }
    return result;
  }
  function buildHHVerseEntries() {
    if (!selectedHHReading) return [];
    const entries = [];
    (selectedHHReading.aliyot || []).forEach(function(aliyah, ai) {
      if (selectedHHSource === "CBS") {
        (aliyah.segments || []).forEach(function(s) {
          entries.push({ref:s.verse, audioPath:aliyah.audioUrl,startTime:s.start,endTime:s.end});
        });
      } else if (selectedHHSource === "SWFS") {
        (aliyah.tracks || []).forEach(function(t) {
          const parts = t.ref.split(":");
          entries.push({ref:verseRef(selectedHHReading.book,Number(parts[1]),Number(parts[2])),track:t,widgetIndex:ai});
        });
      }
    });
    return entries;
  }
  async function buildPTVerseEntries() {
    const selection = preparedModalReading && preparedModalReading.selection;
    if (!selection) throw new Error("Choose an aliyah and wait for the Pocket Torah timing calculation.");
    const positions = expandVerseRange(selection.book,selection.startChapter,selection.startVerse,selection.endChapter,selection.endVerse);
    const entries=[];
    const prepared = preparedModalReading;
    for (const position of positions) {
      // Reuse loaded label data; the original segment defines the aliyah audio file.
      const segment = prepared.playbackSegments.find(function(s) {
        return compareChapterVerse(position,{chapter:s.startChapter,verse:s.startVerse})>=0 &&
          compareChapterVerse(position,{chapter:s.endChapter,verse:s.endVerse})<=0;
      });
      if (!segment) continue;
      const aliyahStart = getReadingSelection(selectedPTParshaName,"full",String(segment.aliyah),false);
      const resource = resolveResourceName(selectedPTParshaName);
      const labels = labelData[resource.labels+"-"+segment.aliyah];
      const wordIndex = countWordsBeforeVerse(selection.book,aliyahStart.startChapter,aliyahStart.startVerse,position.chapter,position.verse);
      const verse = getVerse(selection.book,position.chapter,position.verse);
      const start = labels && labels[wordIndex];
      const end = labels && verse && (labels[wordIndex+verse.w.length] ?? audioDurationData[resource.audio+"-"+segment.aliyah]);
      if (Number.isFinite(start) && Number.isFinite(end)) entries.push({ref:position.ref,audioPath:segment.audioPath,startTime:start,endTime:end});
    }
    return entries;
  }
  async function openVerseSelector() {
    stopModalAudio();
    stopVersePlayback();
    verseStatus("Preparing verse list...");
    const modal=document.getElementById("ptVerseModal");
    const select=document.getElementById("ptVerseSelect");
    if (!modal || !select) return;
    modal.style.display="flex";
    document.getElementById("ptVerseReference").textContent = isHHMode()
      ? (selectedHHReading ? selectedHHReading.displayRange || selectedHHReading.name : "")
      : (preparedModalReading && preparedModalReading.selection ?
        verseRef(preparedModalReading.selection.book,preparedModalReading.selection.startChapter,preparedModalReading.selection.startVerse)+" – "+
        preparedModalReading.selection.endChapter+":"+preparedModalReading.selection.endVerse : "");
    select.innerHTML='<option value="">Select verse</option>';
    try {
      verseEntries = isHHMode() ? buildHHVerseEntries() : await buildPTVerseEntries();
      verseEntries.forEach(function(entry,index) {
        const option=document.createElement("option");option.value=String(index);option.textContent=entry.ref;select.appendChild(option);
      });
      verseStatus(verseEntries.length ? "Select a verse to play." : "Verse playback is unavailable for this recording.");
    } catch(error) { console.error("Verse list failed:",error);verseStatus(error.message); }
  }
  function playSelectedVerse() {
    const select=document.getElementById("ptVerseSelect");
    if (!select || select.value==="") return;
    const entry=verseEntries[Number(select.value)];
    if (!entry) return;
    stopVersePlayback();
    const serial=versePlaybackSerial;
    verseStatus("Playing " + entry.ref);
    if (entry.track) {
      const widget=swfsWidgets[entry.widgetIndex];
      if (!widget || !swfsReady[entry.widgetIndex]) {verseStatus("SoundCloud player not ready; try again shortly.");return;}
      verseWidget=widget;
      widget.load(swfsTrackUrl(entry.track),{auto_play:true});
      // FINISH is also used by normal aliyah playback. This one-shot handler
      // only completes the selector when no aliyah sequence is active.
      const finished=function() {
        widget.unbind(window.SC.Widget.Events.FINISH,finished);
        if (serial===versePlaybackSerial) finishVersePlayback(serial);
      };
      verseFinishWidget=widget;verseFinishCallback=finished;
      widget.bind(window.SC.Widget.Events.FINISH,finished);
      return;
    }
    const audio=new Audio();verseAudio=audio;audio.preload="auto";audio.src=entry.audioPath;
    const end=Number(entry.endTime);
    const done=function(){finishVersePlayback(serial);};
    audio.addEventListener("loadedmetadata",function(){
      if(serial!==versePlaybackSerial)return;
      audio.currentTime=Math.max(0,Number(entry.startTime)||0);
      verseEndHandler=function(){if(Number.isFinite(end)&&audio.currentTime>=end)done();};
      audio.addEventListener("timeupdate",verseEndHandler);
      audio.play().catch(function(error){if(serial===versePlaybackSerial)verseStatus("Audio could not start: "+error.message);});
    },{once:true});
    audio.addEventListener("ended",done,{once:true});
    audio.addEventListener("error",function(){if(serial===versePlaybackSerial)verseStatus("Audio unavailable for this verse.");},{once:true});
  }

  function ensurePocketTorahSourceCitations() {
    if (document.getElementById("ptSourceCitations")) return;

    const referenceBox = document.querySelector("#pocketTorahModal .pt-reference-box");
    const actionRow = document.querySelector("#pocketTorahModal .pt-action-row");
    if (!referenceBox || !actionRow || !referenceBox.parentNode) return;

    const sources = document.createElement("div");
    sources.id = "ptSourceCitations";
    sources.style.margin = "8px 0 8px 22px";
    sources.style.fontSize = "14px";
    sources.style.lineHeight = "1.45";
    sources.style.fontWeight = "400";
    sources.style.color = "#555";

    function addSourceLine(label, href) {
      const line = document.createElement("div");
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = label;
      link.style.color = "#3f3f3f";
      link.style.textDecoration = "none";
      link.addEventListener("mouseenter", function() {
        link.style.textDecoration = "underline";
      });
      link.addEventListener("mouseleave", function() {
        link.style.textDecoration = "none";
      });
      line.appendChild(link);
      sources.appendChild(line);
    }

    addSourceLine(
      "Full K'riyah — Hebcal Traditional Schedule",
      "https://www.hebcal.com/home/category/sedrot"
    );
    addSourceLine(
      "Triennial — Jewish Law & Standards, Rabbinical Assembly, 2020",
      "https://www.rabbinicalassembly.org/sites/default/files/teshuvot/1703225420_30.pdf?id=49574+"
    );

    referenceBox.parentNode.insertBefore(sources, actionRow);

    // High Holiday attribution uses the same location/style as the PT sources,
    // but is shown only while the modal is in HH mode.
    let hhSources = document.getElementById("hhSourceCitations");
    if (!hhSources) {
      hhSources = document.createElement("div");
      hhSources.id = "hhSourceCitations";
      hhSources.style.margin = "10px 0 10px 22px";
      hhSources.style.fontSize = "14px";
      hhSources.style.lineHeight = "1.45";
      hhSources.style.fontWeight = "400";
      hhSources.style.color = "#555";
      hhSources.style.display = "none";

      const line1 = document.createElement("div");
      const templeLink = document.createElement("a");
      templeLink.href = "https://www.temple-sinai.com/worship-music/high-holy-days/high-holy-day-readings";
      templeLink.target = "_blank";
      templeLink.rel = "noopener noreferrer";
      templeLink.id = "hhSourceAttribution";
      templeLink.textContent = "High Holiday Trope — Temple Sinai, Sharon, MA — Cantor R. Khitrik";
      templeLink.style.color = "#3f3f3f";
      templeLink.style.textDecoration = "none";
      templeLink.addEventListener("mouseenter", function() {
        templeLink.style.textDecoration = "underline";
      });
      templeLink.addEventListener("mouseleave", function() {
        templeLink.style.textDecoration = "none";
      });
      line1.appendChild(templeLink);

      const line2 = document.createElement("div");
      line2.id = "hhPlaybackDescription";
      line2.textContent = "Playback directly from the synagogue site.";

      hhSources.appendChild(line1);
      hhSources.appendChild(line2);
      referenceBox.parentNode.insertBefore(hhSources, actionRow);
    }
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

  async function ensureHHCatalogLoaded() {
    if (hhCatalog) return hhCatalog;
    const response = await fetch(HH_CATALOG_PATH + "?v=" + Date.now(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not load " + HH_CATALOG_PATH + ". Status: " + response.status);
    }
    hhCatalog = await response.json();
    if (!hhCatalog || !Array.isArray(hhCatalog.readings)) {
      throw new Error(HH_CATALOG_PATH + " does not contain a readings array.");
    }
    return hhCatalog;
  }

  async function ensureCBSCatalogLoaded() {
    if (cbsCatalog) return cbsCatalog;
    const response = await fetch(CBS_CATALOG_PATH + "?v=" + Date.now(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not load " + CBS_CATALOG_PATH + ". Status: " + response.status);
    }
    cbsCatalog = await response.json();
    if (!cbsCatalog || typeof cbsCatalog !== "object") {
      throw new Error(CBS_CATALOG_PATH + " does not contain a valid CBS catalog.");
    }
    return cbsCatalog;
  }

  async function ensureSWFSCatalogLoaded() {
    if (swfsCatalog) return swfsCatalog;
    const response = await fetch(SWFS_CATALOG_PATH + "?v=" + Date.now(), {cache:"no-store"});
    if (!response.ok) throw new Error("Could not load HH3.json: " + response.status);
    swfsCatalog = await response.json();
    if (!Array.isArray(swfsCatalog.readings)) throw new Error("Invalid HH3.json readings");
    return swfsCatalog;
  }
  function getSWFSReadings(catalog) {
    return catalog.readings.map(function(reading) { return Object.assign({source:"SWFS"}, reading); });
  }

  function parseCBSReference(reference) {
    const match = String(reference || "").trim().match(/^(.+?)\s+(\d+):(\d+)[–-](\d+)$/);
    if (!match) return null;
    return {
      book: match[1],
      startChapter: Number(match[2]),
      startVerse: Number(match[3]),
      endChapter: Number(match[2]),
      endVerse: Number(match[4])
    };
  }

  function getCBSReadings(catalog) {
    return Object.keys(catalog || {}).map(function(id) {
      const item = catalog[id];
      const aliyot = Array.isArray(item && item.aliyot) ? item.aliyot : [];
      const firstRef = aliyot.length ? parseCBSReference(aliyot[0].reference) : null;
      const lastRef = aliyot.length ? parseCBSReference(aliyot[aliyot.length - 1].reference) : null;
      return {
        id: id,
        source: "CBS",
        name: item && item.name ? item.name : id,
        book: firstRef ? firstRef.book : "",
        aliyot: aliyot,
        displayRange: firstRef && lastRef
          ? firstRef.book + " " + firstRef.startChapter + ":" + firstRef.startVerse +
            "–" + lastRef.endChapter + ":" + lastRef.endVerse
          : ""
      };
    });
  }

  function isHHMode() {
    return window.PlayMode === "HH";
  }

  function setPTModalMode(mode) {
    const verseCheckbox=document.getElementById("ptVerseMode");
    if(verseCheckbox) verseCheckbox.checked=false;
    const verseModal=document.getElementById("ptVerseModal");
    if(verseModal && verseModal.style.display==="flex") closeVerseSelector();
    const hh = mode === "HH";
    window.PlayMode = hh ? "HH" : (mode === "PT" ? "PT" : null);

    const title = document.getElementById("pocketTorahModalTitle");
    if (title) title.textContent = hh
      ? (selectedHHSource === "SWFS" ? "Stephen Wise Free Synagogue High Holiday Trope Option" : selectedHHSource === "CBS" ? "Congregation Beth Shalom High Holiday Trope Option" : "High Holiday Trope Option")
      : "Pocket Torah Options";

    const readingField = document.getElementById("ptReadingOptionsField");
    if (readingField) readingField.style.display = hh ? "none" : "";

    const sources = document.getElementById("ptSourceCitations");
    if (sources) sources.style.display = hh ? "none" : "";

    const hhSources = document.getElementById("hhSourceCitations");
    if (hhSources) hhSources.style.display = hh ? "" : "none";

    const audioButton = document.getElementById("ptAudioToggle");
    if (audioButton) {
      audioButton.disabled = false;
      audioButton.style.opacity = "";
      audioButton.title = hh
        ? (selectedHHSource === "SWFS"
            ? "Play the selected SWFS aliyah as sequential SoundCloud verse tracks."
            : selectedHHSource === "CBS"
            ? "Play the selected Congregation Beth Shalom aliyah using its reviewed MP3 timing."
            : "Play the selected High Holiday recording directly from the synagogue site.")
        : "";
    }
    setAudioTogglePlaying(false);
  }

  function populateHHAliyot(reading) {
    const select = document.getElementById("ptAliyahSelect");
    if (!select) return;
    select.innerHTML = '<option value="-1" selected>Select Aliyah</option>';
    (reading && Array.isArray(reading.aliyot) ? reading.aliyot : []).forEach(function(aliyah) {
      const option = document.createElement("option");
      option.value = String(aliyah.num);
      option.textContent = String(aliyah.num);
      select.appendChild(option);
    });
  }

  function restorePTAliyot() {
    const select = document.getElementById("ptAliyahSelect");
    if (!select) return;
    select.innerHTML =
      '<option value="-1" selected>Select Aliyah</option>' +
      '<option value="1">1</option><option value="2">2</option>' +
      '<option value="3">3</option><option value="4">4</option>' +
      '<option value="5">5</option><option value="6">6</option>' +
      '<option value="7">7</option><option value="M">M</option>';
  }

  function getHHSelection() {
    if (!selectedHHReading) return null;
    const aliyahNumber = getModalAliyahNumber();
    if (!aliyahNumber) return null;
    const aliyah = selectedHHReading.aliyot.find(function(item) {
      return String(item.num) === String(aliyahNumber);
    });
    if (!aliyah) return null;

    if (selectedHHSource === "SWFS") {
      const first = aliyah.tracks && aliyah.tracks[0];
      const last = aliyah.tracks && aliyah.tracks[aliyah.tracks.length - 1];
      if (!first || !last) return null;
      const start = first.ref.split(":").map(Number);
      const end = last.ref.split(":").map(Number);
      return {book:selectedHHReading.book, startChapter:start[1], startVerse:start[2],
        endChapter:end[1], endVerse:end[2], tracks:aliyah.tracks};
    }
    if (selectedHHSource === "CBS") {
      const ref = parseCBSReference(aliyah.reference);
      if (!ref) return null;
      return {
        book: ref.book,
        startChapter: ref.startChapter,
        startVerse: ref.startVerse,
        endChapter: ref.endChapter,
        endVerse: ref.endVerse,
        playbackSegments: (Array.isArray(aliyah.segments) ? aliyah.segments : []).map(function(segment) {
          return {
            audioPath: aliyah.audioUrl,
            startTime: segment.start,
            endTime: segment.end
          };
        })
      };
    }

    const begin = parseChapterVerse(aliyah.begin);
    const end = parseChapterVerse(aliyah.end);
    if (!begin || !end) return null;

    return {
      book: selectedHHReading.book,
      startChapter: begin.chapter,
      startVerse: begin.verse,
      endChapter: end.chapter,
      endVerse: end.verse,
      audioUrl: aliyah.audioUrl
    };
  }

  function recalculateHHModal() {
    stopModalAudio();
    preparedModalReading = null;
    clearModalReference();
    const selection = getHHSelection();
    if (selection) displayModalReference(selection);
  }

  function getHHReadingRange(reading) {
    if (reading && reading.displayRange) return reading.displayRange;
    const aliyot = reading && Array.isArray(reading.aliyot) ? reading.aliyot : [];
    if (!aliyot.length) return "";
    const first = aliyot[0];
    const last = aliyot[aliyot.length - 1];
    if (!first || !last || !first.begin || !last.end) return "";
    return String(reading.book || "") + " " + String(first.begin) + "–" + String(last.end);
  }

  function addHHReadingRow(tbody, sourceLabel, reading) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.style.cursor = "pointer";
    tr.style.borderBottom = "1px solid #ddd";

    [sourceLabel, reading.name, getHHReadingRange(reading)].forEach(function(value) {
      const td = document.createElement("td");
      td.textContent = value || "";
      td.style.padding = "9px 8px";
      td.style.verticalAlign = "top";
      tr.appendChild(td);
    });

    tr.addEventListener("mouseenter", function() { tr.style.background = "#eef4ff"; });
    tr.addEventListener("mouseleave", function() { tr.style.background = ""; });
    tr.addEventListener("click", function() { selectHHReading(reading.id, reading.source || "TS"); });
    tr.addEventListener("keydown", function(event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectHHReading(reading.id, reading.source || "TS");
      }
    });
    tbody.appendChild(tr);
  }

  async function populateHHReadingTable() {
    const tbody = document.getElementById("hhReadingTableBody");
    const empty = document.getElementById("hhReadingEmpty");
    const templeSinai = document.getElementById("hhSourceTempleSinai");
    const bethShalom = document.getElementById("hhSourceBethShalom");
    const swfs = document.getElementById("hhSourceSWFS");
    if (!tbody) return;

    tbody.innerHTML = "";
    let count = 0;

    if (swfs && swfs.checked) {
      const catalog = await ensureSWFSCatalogLoaded();
      getSWFSReadings(catalog).forEach(function(reading) { addHHReadingRow(tbody, "Stephen Wise Free Synagogue", reading); count++; });
    } else if (!bethShalom || !bethShalom.checked) {
      const catalog = await ensureHHCatalogLoaded();
      catalog.readings.forEach(function(reading) {
        reading.source = "TS";
        addHHReadingRow(tbody, "Temple Sinai", reading);
        count += 1;
      });
    } else {
      const catalog = await ensureCBSCatalogLoaded();
      getCBSReadings(catalog).forEach(function(reading) {
        addHHReadingRow(tbody, "Congregation Beth Shalom", reading);
        count += 1;
      });
    }

    if (empty) empty.style.display = count ? "none" : "block";
  }

  async function openHHReadingSelector() {
    try {
      const modal = document.getElementById("hhReadingModal");
      if (!modal) return;
      await populateHHReadingTable();
      modal.style.display = "flex";
    } catch (error) {
      console.error("High Holiday catalog could not be loaded:", error);
      alert("The High Holiday selection catalog could not be loaded.");
    }
  }

  function closeHHReadingSelector() {
    const modal = document.getElementById("hhReadingModal");
    if (modal) modal.style.display = "none";
  }

  function restoreHighHolidayParshaLabel() {
    const parshaSelect = document.getElementById("ptParshaSelect");
    if (!parshaSelect) return;
    const hhOption = Array.from(parshaSelect.options).find(function(option) {
      return option.value === "__HH__";
    });
    if (hhOption) hhOption.textContent = "High Holidays";
  }

  async function selectHHReading(readingId, source) {
    stopModalAudio();
    clearSWFSPlayers();
    selectedHHSource = source === "SWFS" ? "SWFS" : source === "CBS" ? "CBS" : "TS";

    if (selectedHHSource === "SWFS") {
      const catalog = await ensureSWFSCatalogLoaded();
      selectedHHReading = getSWFSReadings(catalog).find(function(reading) { return reading.id === readingId; }) || null;
    } else if (selectedHHSource === "CBS") {
      const catalog = await ensureCBSCatalogLoaded();
      selectedHHReading = getCBSReadings(catalog).find(function(reading) {
        return reading.id === readingId;
      }) || null;
    } else {
      const catalog = await ensureHHCatalogLoaded();
      selectedHHReading = catalog.readings.find(function(reading) {
        return reading.id === readingId;
      }) || null;
    }

    if (!selectedHHReading) return;
    if (selectedHHSource === "SWFS") {
      prepareSWFSPlayers(selectedHHReading).catch(function(error) { console.error("SWFS player setup failed:", error); });
    }

    setPTModalMode("HH");
    populateHHAliyot(selectedHHReading);
    clearModalReference();

    const attribution = document.getElementById("hhSourceAttribution");
    if (attribution) {
      const credits = {
        TS: "High Holiday Trope — Temple Sinai, Sharon, MA — Cantor R. Khitrik",
        CBS: "High Holiday Trope — Congregation Beth Shalom — Cantor E. Cohen",
        SWFS: "High Holiday Trope — Stephen Wise Free Synagogue — Cantor D. Singer"
      };
      attribution.textContent = credits[selectedHHSource] || credits.TS;
      // The existing hyperlink points specifically to Temple Sinai.
      // Do not present that destination as a CBS or SWFS credit link.
      if (selectedHHSource === "TS") {
        attribution.href = "https://www.temple-sinai.com/worship-music/high-holy-days/high-holy-day-readings";
      } else {
        attribution.removeAttribute("href");
      }
    }

    const description = document.getElementById("hhPlaybackDescription");
    if (description) {
      description.textContent = selectedHHSource === "SWFS"
        ? "SoundCloud plays each verse sequentially using the SWFS recordings."
        : selectedHHSource === "CBS"
        ? "Playback uses the reviewed CBS MP3 start/end timing definitions."
        : "Playback directly from the synagogue site.";
    }

    selectedPTParshaName = "";
    setReadingName(selectedHHReading.name, true);

    const parshaSelect = document.getElementById("ptParshaSelect");
    if (parshaSelect) {
      restoreHighHolidayParshaLabel();
      // The selector is an action trigger, not retained state.  Programmatic
      // reset to the placeholder does not fire its normal change listener.
      parshaSelect.value = "";
    }

    closeHHReadingSelector();
  }

  function getModalReadingType() {
    const selected = document.querySelector('input[name="ptReading"]:checked');
    return selected ? selected.value : "full";
  }

  function parshaHasTriennialAlt(parshaName) {
    const parsha = getParsha(parshaName);
    const alt = parsha && parsha["triennial-alt"];
    return Boolean(alt && Array.isArray(alt.year) && alt.year.length);
  }

  function getModalUseAltBranch() {
    const wrapper = document.getElementById("ptUseAltWrapper");
    const checkbox = document.getElementById("ptUseAlt");

    // For parshiot that provide triennial-alt, the alternate branch is the
    // normal triennial reading. Checking "Use Full Holiday Reading"
    // deliberately switches back to Pocket Torah's regular triennial branch.
    return Boolean(wrapper && checkbox && !wrapper.hidden && !checkbox.checked);
  }

  function updateModalAltControl(resetChecked) {
    const wrapper = document.getElementById("ptUseAltWrapper");
    const checkbox = document.getElementById("ptUseAlt");
    const parshaSelect = document.getElementById("ptParshaSelect");
    if (!wrapper || !checkbox || !parshaSelect) return;

    if (resetChecked) checkbox.checked = false;

    const readingType = getModalReadingType();
    const show =
      readingType !== "full" &&
      parshaHasTriennialAlt(selectedPTParshaName || parshaSelect.value);

    wrapper.hidden = !show;
    if (!show) checkbox.checked = false;
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

    const parshaName = isHHMode() ? "" : (selectedPTParshaName || parshaSelect.value);
    stopModalAudio();
    preparedModalReading = null;
    clearModalReference();

    if (!parshaName) return;
    if (isHHMode()) {
      recalculateHHModal();
      return;
    }

    const aliyahNumber = getModalAliyahNumber();
    if (!aliyahNumber) return;

    const serial = ++modalCalculationSerial;

    try {
      /*
       * Show the reading range immediately.  This gives visible evidence that
       * aliyah.json was loaded and interpreted before slower timing resources
       * are fetched.
       */
      const selection = getReadingSelection(
        parshaName,
        getModalReadingType(),
        aliyahNumber,
        getModalUseAltBranch()
      );
      if (!selection) {
        throw new Error("Pocket Torah reading range could not be resolved.");
      }
      displayModalReference(selection);

      const prepared = await runWithSourceFallback(function() {
        return prepareReadingTiming(
          parshaName,
          getModalReadingType(),
          browserDurationLoader,
          aliyahNumber,
          getModalUseAltBranch()
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
    if (!parshaSelect) return;

    const parshaName = selectedPTParshaName;
    if (!isHHMode() && !parshaName) {
      alert("Select a Parsha first.");
      return;
    }
    if (isHHMode() && !selectedHHReading) {
      alert("Select a High Holiday reading first.");
      return;
    }

    const readingType = getModalReadingType();
    const aliyahNumber = getModalAliyahNumber();

    if (isHHMode()) {
      if (!aliyahNumber) {
        alert("Select an individual Aliyah before getting Hebrew text.");
        return;
      }
      const selection = getHHSelection();
      if (!selection) {
        alert("The selected High Holiday reading range could not be resolved.");
        return;
      }
      if (!window.SefariaPT || typeof window.SefariaPT.loadPocketTorahHebrew !== "function") {
        alert("The Sefaria Hebrew retrieval function is not available.");
        return;
      }
      const loaded = await window.SefariaPT.loadPocketTorahHebrew({
        sourceMode: "HH",
        parshaName: selectedHHReading.name,
        jsonTitle: selectedHHReading.name + "-Aliyah-" + aliyahNumber,
        book: selection.book,
        startChapter: selection.startChapter,
        startVerse: selection.startVerse,
        endChapter: selection.endChapter,
        endVerse: selection.endVerse
      });
      // Keep the common audio-selection modal open after Hebrew retrieval.
      // This preserves the selected reading/reference while the user plays audio.
      return;
    }

    if (!aliyahNumber) {
      alert("Select an individual Aliyah (1-7 or M) before getting Hebrew text.");
      return;
    }

    const selection = getReadingSelection(
      parshaName,
      readingType,
      aliyahNumber,
      getModalUseAltBranch()
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

    // Deliberately keep the modal open after Hebrew retrieval so the
    // selected reading/reference remains visible during audio playback.
  }

  async function initializeSefariaPocketTorahModal() {
    ensurePocketTorahSourceCitations();

    const parshaSelect = document.getElementById("ptParshaSelect");
    if (!parshaSelect) return;
    ensureReadingNameField();
    setReadingName("", false);

    try {
      await runWithSourceFallback(function() {
        return ensureResourcesLoaded();
      });

      const parshaNames = getParshaNames();

      while (parshaSelect.options.length > 1) {
        parshaSelect.remove(1);
      }

      const hhOption = document.createElement("option");
      hhOption.value = "__HH__";
      hhOption.textContent = "High Holidays";
      parshaSelect.appendChild(hhOption);

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

      parshaSelect.addEventListener("change", async function() {
        const selectedValue = parshaSelect.value;

        if (selectedValue === "__HH__") {
          selectedPTParshaName = "";
          setReadingName("", false);
          setPTModalMode("HH");
          selectedHHReading = null;
          selectedHHSource = null;
          clearSWFSPlayers();
          populateHHAliyot(null);
          clearModalReference();
          await openHHReadingSelector();
          return;
        }

        selectedHHReading = null;
        selectedHHSource = null;
        selectedPTParshaName = selectedValue;
        setReadingName(selectedPTParshaName, false);
        setPTModalMode(selectedPTParshaName ? "PT" : null);
        restorePTAliyot();
        updateModalAltControl(true);
        if (selectedPTParshaName) {
          await resetAndRecalculateSefariaModal();
          // Preserve the chosen PT parsha in selectedPTParshaName/Reading Name,
          // then silently return the command selector to its placeholder.
          parshaSelect.value = "";
        }
      });
      document.querySelectorAll('input[name="ptReading"]').forEach(function(input) {
        input.addEventListener("change", function() {
          updateModalAltControl(false);
          resetAndRecalculateSefariaModal();
        });
      });
      const useAlt = document.getElementById("ptUseAlt");
      if (useAlt) {
        useAlt.addEventListener("change", resetAndRecalculateSefariaModal);
      }
      if (aliyahSelect) {
        aliyahSelect.addEventListener("change", function() {
          if (isHHMode()) recalculateHHModal();
          else resetAndRecalculateSefariaModal();
        });
      }
      populateModalAliyahSelect();
      updateModalAltControl(true);

      const hhSourceTempleSinai = document.getElementById("hhSourceTempleSinai");
      const hhSourceBethShalom = document.getElementById("hhSourceBethShalom");
      const hhSourceSWFS = document.getElementById("hhSourceSWFS");
      if (hhSourceTempleSinai) {
        hhSourceTempleSinai.addEventListener("change", function() {
          if (hhSourceTempleSinai.checked) {
            if (hhSourceBethShalom) hhSourceBethShalom.checked = false;
            if (hhSourceSWFS) hhSourceSWFS.checked = false;
          }
          populateHHReadingTable().catch(function(error) {
            console.error("High Holiday source filter failed:", error);
          });
        });
      }
      if (hhSourceBethShalom) {
        hhSourceBethShalom.addEventListener("change", function() {
          if (hhSourceBethShalom.checked) {
            if (hhSourceTempleSinai) hhSourceTempleSinai.checked = false;
            if (hhSourceSWFS) hhSourceSWFS.checked = false;
          }
          populateHHReadingTable().catch(function(error) {
            console.error("High Holiday source filter failed:", error);
          });
        });
      }
      if (hhSourceSWFS) hhSourceSWFS.addEventListener("change", function() {
        if (hhSourceSWFS.checked) {
          if (hhSourceTempleSinai) hhSourceTempleSinai.checked = false;
          if (hhSourceBethShalom) hhSourceBethShalom.checked = false;
        } else if (hhSourceTempleSinai) hhSourceTempleSinai.checked = true;
        populateHHReadingTable().catch(function(error) { console.error("SWFS catalog failed", error); });
      });
      const hhClose = document.getElementById("hhReadingModalClose");
      if (hhClose) {
        hhClose.addEventListener("click", function() {
          closeHHReadingSelector();
          restoreHighHolidayParshaLabel();
          parshaSelect.value = "";
          selectedHHReading = null;
          selectedHHSource = null;
          clearSWFSPlayers();
          selectedPTParshaName = "";
          setReadingName("", false);
          setPTModalMode(null);
          restorePTAliyot();
          clearModalReference();
        });
      }

      const audioSelectionLink = document.querySelector('a.pocket-torah-link[href="#pocketTorahModal"]');
      if (audioSelectionLink) {
        audioSelectionLink.addEventListener("click", function() {
          stopModalAudio();
          restoreHighHolidayParshaLabel();
          selectedHHReading = null;
          selectedHHSource = null;
          clearSWFSPlayers();
          selectedPTParshaName = "";
          setReadingName("", false);
          setPTModalMode(null);
          restorePTAliyot();
          parshaSelect.value = "";
          clearModalReference();
          if (window.SefariaPT && typeof window.SefariaPT.clearAudioSelectionState === "function") {
            window.SefariaPT.clearAudioSelectionState();
          }
        });
      }

      const verseCheckbox = document.getElementById("ptVerseMode");
      if (verseCheckbox) verseCheckbox.addEventListener("change", function() {
        if (verseCheckbox.checked) {
          if (isHHMode() && selectedHHSource === "TS") {
            verseCheckbox.checked = false;
            alert("Temple Sinai recordings do not have verse-level timing data.");
            return;
          }
          openVerseSelector();
        } else closeVerseSelector();
      });
      const verseSelect = document.getElementById("ptVerseSelect");
      if (verseSelect) verseSelect.addEventListener("change",playSelectedVerse);
      const verseClose = document.getElementById("ptVerseClose");
      if (verseClose) verseClose.addEventListener("click",closeVerseSelector);

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
