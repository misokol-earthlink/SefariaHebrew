document.getElementById("ipadDebugBox").innerHTML +=
  "Inline body script ran<br>";
let startupModeSelected = false;
let editExistingMode = false;
let lineCount = 0;
let displayVowels = false;
let dummyvar ;
let playAllEnable = false;
let playAllResolve = null;
let audioPlaybackMode = null;
//alert("SCRIPT START");
function ipadLog(msg) {
  const box = document.getElementById("ipadDebugBox");
  if (box) {
    box.innerHTML += String(msg) + "<br>";
  }
  console.log(msg);
}
console.log("TropePlayer JS version: EDIT-BUTTON-TEST-1");
window.onerror = function(message, source, lineno, colno, error) {
  ipadLog("ERROR: " + message + " at line " + lineno + ":" + colno);
};

window.addEventListener("unhandledrejection", function(event) {
  ipadLog("PROMISE ERROR: " + event.reason);
});

ipadLog("Script started");
let buildTableOpen = false;
let activeBuildLineIndex = 0;
const comboTropeNames = [
  "SofAliyah",
  "SofAliyah2",
  "SofAliyah3",
  "Munach-Katon",
  "Kadma-V'azlah",
  "Munach-Rvi'i"
];

/* =========================================================
   DEVICE / MODE SELECTION
   ========================================================= */

/*
  PC testing flags:
    - Use these only when the filename does NOT contain IPAD.
    - If filename contains IPAD, these flags are ignored.
*/
const forceTouchDevice = true;    // PC debug: true = simulate iPad/touch
const forceDesktopMode = false;   // PC debug: true = force desktop mode

const currentFileName =
  window.location.pathname
    .split("/")
    .pop()
    .toUpperCase();

const fileNameIsIPad =
  currentFileName.includes("IPAD");

const actualTouchDevice =
  ("ontouchstart" in window) ||
  (navigator.maxTouchPoints > 0);

let isTouchDevice = false;
let touchModeActive = false;
if (fileNameIsIPad) {

  // Real iPad/IPAD-named version always wins.
  // Force flags are irrelevant here.
  isTouchDevice = true;

} else if (forceDesktopMode) {

  // PC override: force desktop behavior.
  isTouchDevice = false;

} else if (forceTouchDevice) {

  // PC override: simulate iPad/touch behavior.
  isTouchDevice = true;

} else {

  // Normal automatic detection.
  isTouchDevice = actualTouchDevice;

}


console.log("currentFileName =", currentFileName);
console.log("fileNameIsIPad =", fileNameIsIPad);
console.log("actualTouchDevice =", actualTouchDevice);
console.log("forceTouchDevice =", forceTouchDevice);
console.log("forceDesktopMode =", forceDesktopMode);
console.log("touchModeActive =", touchModeActive);
let viewLyricsMode = false;
let activeLyricsLines = [];
let smoothAudioContext = null;
let smoothSourceNode = null;
let activeFileLines = [];
let activeFiles = [];
let ptEnabled = false;
let usePocketTorah = false;
let ptParshaName = "";
let ptLineData = [];
let ptPlaybackSegments = [];

let resolveMunachChoice = null;
const dirtyColor = "maroon";
const cleanColor = "darkgreen";
const comboColor = "blue";
var buildMode = false;
let currentModalTropeWave = "";
let currentMunachFollowingTrope = "";
/* Folder containing WAV files */
//const audioPath =    "file:///C:/Users/misok/OneDrive/Documents/MuseScore3/Scores/Trope/";
const audioPath = "./Trope/";
const imagePath = "./Images/";
/* File names without extension */
const tropeNames = [
  "Darga",
  "EtNachTah",
  "Geresh",
  "Gershayim",
  "Kadma",
  "Kadma-V'azlah",
  "Karne-farah",
  "Katon",
  "Mapach",
  "Merchah",
  "MerchahK'fulah",
  "Munach",
  "Munach-Katon",
  "Munach-l'garmeih",
  "Munach-Rvi'i",
  "PashTa",
  "Pazer",
  "Rvi'i",
  "Segol",
  "Shalshelet",
  "SofAliyah",
  "SofAliyah2",
  "SofAliyah3",
  "SofPaSuk",
  "Tipchah",
  "T'LishaGadola",
  "T'LishaK'tanah",
  "Tvir",
  "V'azlah",
  "YareachBenYomo",
  "Y'tiv",
  "ZakefGadol",
  "Zarka"
];

const hebrewTropeNames = {
  Darga:             "דַּרְגָּ֧א",
  EtNachTah:         "אֶתְנַחְתָּ֑א",
  Geresh:            "גֵּרֵ֜שׁ",
  Gershayim:         "גֵּרְשַׁ֞יִם",
  Kadma:             "קַדְמָ֨א",
 "Kadma-V'azlah": "קַדְמָ֨א אַזְלָ֜א",
  "Karne-farah":     "קַרְנֵי פָרָ֟ה",
  Katon:             "קָטֹ֔ן",
  Mapach:            "מַהְפַּ֤ךְ",
  Merchah:           "מֵרְכָ֥א",
  "MerchahK'fulah":  "מֵרְכָ֦א כְּפוּלָה",
  Munach:            "מֻנַּ֣ח",
  "Munach-Katon":    "מֻנַּ֣ח קָטֹ֔ן",
  "Munach-l'garmeih": "מֻנַּ֣ח ׀ (לְגַרְמֵיהּ)",
  "Munach-Rvi'i":    "מֻנַּ֣ח רְבִיעִ֗י",
  PashTa:            "פַּשְׁטָ֙א",
  Pazer:             "פָּזֵ֡ר",
  "Rvi'i":           "רְבִיעִ֗י",
  Segol:             "סֶגּ֒וֹל",
  Shalshelet:        "שַׁלְשֶׁ֓לֶת",
  SofAliyah:          "מֵרְכָ֥א טִפְּחָ֖א מֵרְכָ֥א סוֹף פָּסֽוּק׃",
  SofAliyah2:        "מֵרְכָ֥א טִפְּחָ֖א סוֹף פָּסֽוּק׃",
 SofAliyah3:        "טִפְּחָ֖א סוֹף פָּסֽוּק׃",
  SofPaSuk:          "סוֹף פָּסֽוּק׃",
  Tipchah:           "טִפְּחָ֖א",
  "T'LishaGadola":   "תְּלִישָׁא גְּדוֹלָ֠ה",
  "T'LishaK'tanah":  "תְּלִישָׁא קְטַנָּ֩ה",
  Tvir:              "תְּבִירָ֛א",
 "V'azlah":         "אַזְלָ֜א",
  YareachBenYomo:    "יָרֵחַ בֶּן יוֹמ֪וֹ",
  "Y'tiv":           "יְתִ֚יב",
  ZakefGadol:        "גָּד֕וֹל",
  Zarka:             "זַרְקָ֮א"
};

/* clean / dirty playback collections */
const cleanNames = [
  {hover: "Etnachtah Family", name: "EtNachTah", unicode: "0591", wav: "EtNachTah.wav", image: "" },
  {hover: "Very rare trope found once in Torah (Numbers 35:5).", name: "Karne-farah", unicode: "059F", wav: "Karne-farah.wav", image: "" },
  {hover: "May be in combo tropes such as Munach-Katon and often called Zakef Katon.  Since Portnoy et.al. use Katon for this trop name this is how it appears in the trope names. Zakef does not appear in trope name transliterations or in the image of the music scale and associated lyrics in the trope detail display popup window.", name: "Katon", unicode: "0594", wav: "Katon.wav", image: "" },
  {hover: "Rare trope found in Torah 5 times.  Repeated note then finishing on higher pitch trill on closing melisma.", name: "MerchahK'fulah", unicode: "05A6", wav: "MerchahK'fulah.wav", image: "" },
  {hover: "Text", name: "Pazer", unicode: "05A1", wav: "Pazer.wav", image: "" },
  {hover: "Text", name: "Rvi'i", unicode: "0597", wav: "Rvi'i.wav", image: "" },
  {hover: "Always on the last letter of the word.  If the accented syllable is elsewhere, the same mark is used again.  Howver this is a single applction of the trope.", name: "Segol", unicode: "0592", wav: "Segol.wav", image: "" },
  {hover: "Text", name: "Shalshelet", unicode: "0593", wav: "Shalshelet.wav", image: "" },
  {hover: "Text", name: "SofPaSuk", unicode: "05C3", wav: "SofPaSuk.wav", image: "" },
  {hover: "Text", name: "Tipchah", unicode: "0596", wav: "Tipchah.wav", image: "" },
  {hover: "Text", name: "Tvir", unicode: "059B", wav: "Tvir.wav", image: "" },
  {hover: "Trope name is Azlah and must follow Kadma.  See Kadma-V'azlah. Use v' with the name to emphasize this relationshp.  Without Kadma, see Geresh.", name: "V'azlah", unicode: "059C", wav: "V'azlah.wav", image: "" },
  {hover: "Very rare trope found once in Torah (Numbers 35:5).", name: "YareachBenYomo", unicode: "05AA", wav: "YareachBenYomo.wav", image: "" },
  {hover: "Text", name: "Y'tiv", unicode: "059A", wav: "Y'tiv.wav", image: "" },
  {hover: "Text", name: "ZakefGadol", unicode: "0595", wav: "ZakefGadol.wav", image: "" },
  {hover: "Always on the last letter of the word.  If the accented syllable is elsewhere, the same mark is used again.  Howver this is a single applction of the trope.", name: "Zarka", unicode: "05AE", wav: "Zarka.wav", image: "" },
  {hover: "Text", name: "Geresh", unicode: "059C", wav: "Geresh.wav", image: "" },
  {hover: "Text", name: "Mapach", unicode: "05A4", wav: "Mapach.wav", image: "" },
  {hover: "Treated as a single trope name but in reality it is an instance of Munach appearing before a Munach Rvi'i sequence. Also the two words marked with Munach trope are separated with a vertical line called a pasik. In this unique situtation, the trope is named Muncah L'garmeih and the melody of the munach is more complex than other melodies for the trope. In the cantillation symbol on the display page tropemark is just a munach but the pasik in the following text character postion is shown for emphasis.", name: "Munach-l'garmeih", unicode: "05A3", wav: "Munach-l'garmeih.wav", image: "" },
  {hover: "Always on the last letter of the word.  If the accented syllable is elsewhere, the same mark is used again.  Howver this is a single applction of the trope.", name: "PashTa", unicode: "0599", wav: "PashTa.wav", image: "" },
  {hover: "Always on the first letter of the word.  If the accented syllable is elsewhere, the same mark is used again.  Howver this is a single applction of the trope.", name: "T'LishaGadola", unicode: "05A0", wav: "T'LishaGadola.wav",    image: "" },
  {hover: "Always on the last letter of the word.  If the accented syllable is elsewhere, the same mark is used again.  Howver this is a single applction of the trope.", name: "T'LishaK'tanah", unicode: "05A9", wav: "T'LishaK'tanah.wav",  image: "" }
];
const comboHoverText = {
  "SofAliyah": "Combined aliyah-ending playback for the sequence Merchah, Tipchah, Merchah, Sof Pasuk.",
  "SofAliyah2": "Combined aliyah-ending playback for the sequence Merchah, Tipchah, Sof Pasuk.",
  "SofAliyah3": "Combined aliyah-ending playback for the sequence Tipchah,  Sof Pasuk.",
  "Munach-Katon": "Combo entry for  Munach, Katon.",
  "Munach-Rvi'i": "Combo entry for  Munach, Rvi'i.",
  "Kadma-V'azlah": "Combo entry for Kadma, Azlah and label as a special trope sequence in Rvi'i family. Without the Kadma,  the folowing trope would be Geresh with same marking."
};
const dirtyNames = [
  {
    hover: "Text",
    name: "Darga",
    unicode: "05A7",
    wav: "Darga.wav",
    image: "",
    families: ["Default", "Tvir", "Rvi'i"]
  },
  {
    hover: "Text",
    name: "Gershayim",
    unicode: "059E",
    wav: "Gershayim.wav",
    image: "",
    families: ["Default", "Tvir", "Rvi'i"]
  },
  {
    hover: "See comment for Kadma V'azlah.  Otherwise Kadma is played with a common melody regardless of the following trope, but in actual Cantillation there could be more variation than provided for  in this applicaiton.",
    name: "Kadma",
    unicode: "05A8",
    wav: "Kadma.wav",
    image: "",
    families: ["Default", "Katon", "Tvir", "Segol", "Rvi'i"]
  },
  {
    hover: "Text",
    name: "Merchah",
    unicode: "05A5",
    wav: "Merchah.wav",
    image: "",
    families: ["Default", "EtNachTah", "SofPaSuk", "Katon", "Tvir", "Segol"]
  },
/*
 {
    hover: "Text",
    name: "T'LishaGadola",
    unicode: "05A0",
    wav: "T'LishaGadola.wav",
    image: "",
    families: ["Default", "Katon", "Segol", "Rvi'i"]
  },
  {
    hover: "Text",
    name: "T'LishaK'tanah",
    unicode: "05A9",
    wav: "T'LishaK'tanah.wav",
    image: "",
    families: ["Default", "Tvir", "Rvi'i"]
  },
*/
  {
    hover: "Appears in several families.  Melody chanes with the trope following.  Sound played is based on this distinction.  Munach L'garmeih is separtely identified for correct playback.",
    name: "Munach",
    unicode: "05A3",
    wav: "Munach.wav",
    image: "",
    families: ["Default", "EtNachTah", "Katon", "Tvir", "Segol", "Rvi'i"]
  }
 
];
const tropeFamilyMap = {
  "Darga": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": true,
    "Rvi'i": true,
    "Segol": false
  },
  "EtNachTah": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Geresh": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Gershayim": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": true,
    "Rvi'i": true,
    "Segol": false
  },
  "Kadma": {
    "EtNachTah": false,
    "Katon": true,
    "SofPasuk": false,
    "Tvir": true,
    "Rvi'i": true,
    "Segol": true
  },
"Kadma-V'azlah": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": true,
    "Segol": false
  },

  "Karne-farah": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Katon": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Mapach": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Merchah": {
    "EtNachTah": true,
    "Katon": true,
    "SofPasuk": true,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": true
  },
  "MerchahK'fulah": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Munach": {
    "EtNachTah": true,
    "Katon": true,
    "SofPasuk": false,
    "Tvir": true,
    "Rvi'i": true,
    "Segol": true
  },
  "Munach-Katon": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Munach-l'garmeih": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Munach-Rvi'i": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "PashTa": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Pazer": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Rvi'i": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Segol": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Shalshelet": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "SofAliyah": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "SofAliyah2": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
 "SofAliyah3": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "SofPaSuk": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Tipchah": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "T'LishaGadola": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "T'LishaK'tanah": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Tvir": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "V'azlah": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "YareachBenYomo": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Y'tiv": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "ZakefGadol": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  },
  "Zarka": {
    "EtNachTah": false,
    "Katon": false,
    "SofPasuk": false,
    "Tvir": false,
    "Rvi'i": false,
    "Segol": false
  }
};

const FAMILY_GLYPHS = {
  EtNachTah:
    `<span class="familyGlyph" style="background:darkblue;">ET</span>`,

  SofPasuk:
    `<span class="familyGlyph" style="background:maroon;">SP</span>`,

  Katon:
    `<span class="familyGlyph" style="background:darkgreen;">K</span>`,

  Segol:
    `<span class="familyGlyph" style="background:purple;">S</span>`,

  Tvir:
    `<span class="familyGlyph" style="background:brown;">T</span>`,

  "Rvi'i":
    `<span class="familyGlyph" style="background:darkorange;">R</span>`
};

const table = document.getElementById("tropeTable");
const player = document.getElementById("player");

function buildTropeUnicodeDisplay(tropeName) {
  if (comboTropeNames.includes(tropeName)) {
    return "";
  }
  const tropeInfo = findTropeInfo(tropeName);
  if (!tropeInfo || !tropeInfo.unicode) {
    return "";
  }
  if (tropeInfo.name === "SofPaSuk") {
    return "\u00A0" + "\u05BD" + "\u05C3";
  }
  if (tropeInfo.name === "Munach-l'garmeih") {
    return "\u00A0" +
      String.fromCharCode(parseInt(tropeInfo.unicode, 16)) +
      "\u00A0" +
      "\u05C0";
  }

  return "\u00A0" +
    String.fromCharCode(parseInt(tropeInfo.unicode, 16));
}

function buildTropeTable() {tropeNames.forEach((name, index) => {
  const row = document.createElement("tr");

  /* Index column */
  const indexCell = document.createElement("td");
  indexCell.textContent = index + 1;

indexCell.onclick = function(event) {
  event.stopPropagation();
  if (!buildTableOpen) {
    return;
  }

  addTropeToCurrentBuildLine(name);
};
  /* Trope column */
  const tropeCell = document.createElement("td");
//  tropeCell.textContent = name;
tropeCell.innerHTML = formatTropeNameForDisplay(name);

tropeCell.dataset.hoverText = getHoverText(name);

if (touchModeActive) {
  const infoGlyph = document.createElement("span");

  infoGlyph.textContent = "❓";
  infoGlyph.className = "touch-info-glyph";
  infoGlyph.title = "Show trope information";

infoGlyph.onclick = function(event) {
  event.stopPropagation();

  const hoverBox = document.getElementById("tropeHoverBox");
  const hoverText = getHoverText(name);

  if (!hoverText) {
    return;
  }

 if (
  hoverBox.style.display === "block" &&
  hoverBox.textContent === hoverText
) {
  hoverBox.style.display = "none";
  return;
}

hoverBox.style.display = "block";
hoverBox.style.position = "fixed";
hoverBox.style.left =   (touch.clientX - 80) + "px";
hoverBox.style.top =   (touch.clientY - 60) + "px";
hoverBox.style.transform = "";
hoverBox.style.zIndex = "300000";
hoverBox.style.pointerEvents = "auto";

};  tropeCell.appendChild(infoGlyph);
}

  tropeCell.style.cursor = "pointer";
tropeCell.style.fontWeight = "bold";

tropeCell.onclick = function () {
  if (buildMode === false) {
    openTropeModal(name);
  } else {
    addTropeToActiveLine(name);
  }
};

/* hover actions */

if (!touchModeActive) {

 tropeCell.onmouseenter = function(event) {

  const hoverBox =
    document.getElementById("tropeHoverBox");

  if (!this.dataset.hoverText) {
    return;
  }

  const rect =
    this.getBoundingClientRect();

  hoverBox.textContent =
    this.dataset.hoverText;

  hoverBox.style.left =
    (rect.right + 12) + "px";

  hoverBox.style.top =
    rect.top + "px";

  hoverBox.style.display = "block";
};

tropeCell.onmousemove = function(event) {
  // fixed position
};

tropeCell.onmouseleave = function() {
  document.getElementById("tropeHoverBox").style.display = "none";
};

}


  /* Symbol column */
const symbolCell = document.createElement("td");
symbolCell.textContent = buildTropeUnicodeDisplay(name);
symbolCell.style.fontFamily = "'Times New Roman', serif";
symbolCell.style.fontSize = "28px";
symbolCell.style.fontWeight = "bold";
symbolCell.style.direction = "rtl";
symbolCell.style.unicodeBidi = "isolate";
symbolCell.style.textAlign = "center";
symbolCell.style.color = "maroon";

  /* Family column */
  const familyCell = document.createElement("td");
  familyCell.innerHTML = buildFamilyGlyphString(name);

  /* Empty columns */
  const hebrewCell = document.createElement("td");
  const notesCell = document.createElement("td");

  row.appendChild(indexCell);
  row.appendChild(tropeCell);
row.appendChild(symbolCell);
  row.appendChild(familyCell);


  table.appendChild(row);
});

}

function buildFamilyGlyphString(tropeName) {
  const familyMap = tropeFamilyMap[tropeName];

  if (!familyMap) return "";

  let html = "";

  if (familyMap.EtNachTah === true) html += FAMILY_GLYPHS.EtNachTah + "&nbsp;";
  if (familyMap.SofPasuk === true)  html += FAMILY_GLYPHS.SofPasuk  + "&nbsp;";
  if (familyMap.Katon === true)     html += FAMILY_GLYPHS.Katon     + "&nbsp;";
  if (familyMap.Segol === true)     html += FAMILY_GLYPHS.Segol     + "&nbsp;";
  if (familyMap.Tvir === true)      html += FAMILY_GLYPHS.Tvir      + "&nbsp;";
  if (familyMap["Rvi'i"] === true)  html += FAMILY_GLYPHS["Rvi'i"]  + "&nbsp;";

  return html.trim();
}

let currentModalTrope = "";

async function openTropeModal(tropeName) {

  const tropeInfo = findTropeInfo(tropeName);

  let tropeWave = tropeName + ".wav";
let noteImageName = tropeName + ".jpg";

 if (tropeName === "Munach") {
  tropeWave = await openMunachChoiceModal();

  if (!tropeWave) {
    return;
  }

  noteImageName = tropeWave.replace(".wav", ".jpg");

  if (currentMunachFollowingTrope === "Segol") {
    noteImageName = "Munach4S.jpg";
  }
}

 currentModalTrope = tropeName;
currentModalTropeWave = tropeWave;

document.getElementById("modalTropeName").textContent = tropeName;

  document.getElementById("modalTropeName").textContent = tropeName;
 const symbolBox =
  document.getElementById("modalSymbolBox");

const imageBox =
  document.getElementById("modalTropeImageBox");
const noteBox =
  document.getElementById("modalNoteBox");

if (tropeInfo && tropeInfo.unicode) {

  if (tropeInfo.name === "SofPaSuk") {

   symbolBox.textContent =
    "\u05C3" +
    "\u00A0" +
    "\u05BD";
  } else if (tropeInfo.name === "Munach-l'garmeih") {

    symbolBox.textContent =
      String.fromCharCode(parseInt("05C0", 16)) +
      "\u00A0" +
      "\u00A0" +
      String.fromCharCode(parseInt(tropeInfo.unicode, 16));

  } else {

    symbolBox.textContent =
      "\u00A0" +
      String.fromCharCode(parseInt(tropeInfo.unicode, 16));

  }

} else {

  symbolBox.textContent = "";

}
/* Large trope image */

const hebrewName =
  hebrewTropeNames[tropeName] || tropeName;

imageBox.innerHTML =
  `<div
      style="
        width:100%;
        height:100%;

        display:flex;
        justify-content:center;
        align-items:center;

        direction:rtl;
        unicode-bidi:isolate;

        font-family:'Times New Roman', serif;
        font-size:28px;
        font-weight:bold;
        color:maroon;

        white-space:nowrap;

        box-sizing:border-box;
        padding:0 12px;

        text-align:center;
      "
    >
      ${hebrewName}
    </div>`;

const comboMessage =
  document.getElementById("comboNoteMessage");

if (comboTropeNames.includes(tropeName)) {

  comboMessage.textContent =
    tropeName +
    " is not an actual trope name but has been used to group several actual trope names, as indicated by the lyrics in the music score above, for enhanced audio playback. The actual text portion would be marked with these distinct trope symbols.";

  comboMessage.style.display = "inline-block";

} else {

  comboMessage.textContent = "";
  comboMessage.style.display = "none";

}


document.querySelector(".tropeModalBox")
  .classList.remove("modalExpanded");

document.getElementById("modalSizeButton")
  .textContent = "⊕";

document.getElementById("tropeModal").style.display = "block";

const noteImageFile =
  imagePath +
  encodeURIComponent(noteImageName) +
  "?v=" +
  Date.now();

noteBox.innerHTML =
  `<div
      style="
        width:100%;
        height:100%;
        display:flex;
        justify-content:center;
        align-items:center;
      "
    >
      <img
        src="${noteImageFile}"
        style="
          max-width:90%;
          max-height:67%;
          object-fit:contain;
        "
      >
    </div>`;



}

function closeTropeModal() {
  document.getElementById("tropeModal").style.display = "none";
}

function findTropeInfo(tropeName) {
  return cleanNames.find(t => t.name === tropeName) ||
         dirtyNames.find(t => t.name === tropeName) ||
         null;
}

document.getElementById("modalCloseButton").onclick = closeTropeModal;

document.getElementById("modalPlayButton").onclick = function () {
  const wavFile =
    audioPath +
    encodeURIComponent(currentModalTropeWave) +
    "?v=" +
    Date.now();

  player.src = wavFile;

  player.play();
};
/* ==========================================================================
     3. THE JAVASCRIPT LOGIC ENGINE
     Add this directly into your global script file or within open <script> tags.
     ========================================================================== */
/* Blue panel global state */
 buildMode = false;
 lineItems = [];
let lineCounter = 0;

/* Blue panel DOM references */

let bluePanel = null;
let dynamicContainer = null;
let minimizeBtn = null;
let resetBtn = null;
let saveBtn = null;

/* Initialize after page elements exist */

function initializeBluePanel() {
  bluePanel = document.getElementById("blueFormPanel");
  dynamicContainer = document.getElementById("dynamicLinesContainer");
  minimizeBtn = document.getElementById("minimizePanelBtn");
  resetBtn = document.getElementById("resetPanelBtn");
  saveBtn = document.getElementById("savePanelBtn");
  addLineBtn = document.getElementById("addLineBtn");
  minimizeBtn.onclick = minimizeBluePanel;
  resetBtn.onclick = resetBluePanel;
  saveBtn.onclick = saveBluePanelData;
  addLineBtn.onclick = addNewBluePanelLine;
 if (lineItems.length === 0) {
  addNewBluePanelLine();
} else {
  renderBluePanel();
}
}

/* Render panel contents */

function renderBluePanel() {
 if (!dynamicContainer) {
    console.error("dynamicContainer is not defined or #dynamicLinesContainer was not found.");
    return;
  }

  dynamicContainer.innerHTML = "";

 
  lineItems.forEach(renderLineItemRow);
}


function renderLineItemRow(item, index) {
  const lineDiv = document.createElement("div");
  lineDiv.className = "data-line-row";

  if (index === activeLineIndex) {
    lineDiv.classList.add("active-line-row");
  }

  lineDiv.dataset.id = item.id;

  const lineNumber = document.createElement("span");
  lineNumber.className = "line-number";
  lineNumber.textContent = "Line " + (index + 1) + ":";

  const valueInput = document.createElement("div");
  valueInput.className = "line-value-input";
  valueInput.contentEditable = "true";
  valueInput.spellcheck = false;

valueInput.onclick = function(event) {
  event.stopPropagation();

  activeLineIndex = index;

  document
    .querySelectorAll(".data-line-row")
    .forEach(function(row) {
      row.classList.remove("active-line-row");
    });

  lineDiv.classList.add("active-line-row");
};

valueInput.onfocus = function() {
  activeLineIndex = index;

  document
    .querySelectorAll(".data-line-row")
    .forEach(function(row) {
      row.classList.remove("active-line-row");
    });

  lineDiv.classList.add("active-line-row");
};

  valueInput.innerHTML = item.tropes
    .map(function (tropeName) {
      return formatTropeNameForDisplay(tropeName);
    })
    .join('<span class="trope-delimiter">+</span>');

  valueInput.onblur = function () {
    const editedText =
      valueInput.innerText.trim();

    item.tropes =
      editedText
        .split("+")
        .map(function(name) {
          return name.trim();
        })
        .filter(function(name) {
          return name.length > 0;
        });

    renderBluePanel();
  };

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-line-btn";
  deleteButton.textContent = "✕";

  deleteButton.onclick = function () {
    removeLineItem(item.id);
  };

  lineDiv.appendChild(lineNumber);
  lineDiv.appendChild(valueInput);
  lineDiv.appendChild(deleteButton);

  dynamicContainer.appendChild(lineDiv);
}

/* Data updates */

function addLineItem(cellText) {
  lineCounter++;

  lineItems.push({
    id: lineCounter,
    value: cellText,
    note: ""
  });

  renderBluePanel();
}

function removeLineItem(id) {

  lineItems = lineItems.filter(function (item) {
    return item.id !== id;
  });

  if (lineItems.length === 0) {
    addNewBluePanelLine();
    return;
  }

  if (activeLineIndex >= lineItems.length) {
    activeLineIndex = lineItems.length - 1;
  }

  renderBluePanel();
}

function resetBluePanel() {
  if (confirm("Are you sure you want to completely discard current modifications?")) {
    lineItems = [];
   activeLineIndex = 0;
   addNewBluePanelLine();
    lineCounter = 0;
    renderBluePanel();
  }
}

function saveBluePanelData() {
  if (lineItems.length === 0) {
    alert("Save operation canceled: The workspace is completely blank.");
    return;
  }

downloadBluePanelData();
  console.log(
    "Transmitting dataset to structural repository database:",
    JSON.stringify(lineItems)
  );

  alert("Dataset safely committed to data repository.");

 lineItems = [];
activeLineIndex = 0;
addNewBluePanelLine();
}

/* Mode and panel visibility */

function togglePanelMode() {
if (!startupModeSelected) {
return;
}
  buildMode = !buildMode;

  if (buildMode) {
    showBluePanel();
buildTableOpen = true;
  } else {
    hideBluePanel();
buildTableOpen = false;
  }

  return buildMode;
}
function downloadBluePanelData() {

  const fileBaseName = prompt(
    "Enter repository name for this trope file:",
    "NewTropeFile"
  );

  if (!fileBaseName) {
    alert("Save canceled: no file name entered.");
    return;
  }

  const repositoryData = {
    name: fileBaseName,
    description: "Description",
    lines: lineItems.map(function(item, index) {
      return {
        lineName: "Line-" + (index + 1),
        tropes: item.tropes
      };
    })
  };

  const jsonText =
    JSON.stringify(repositoryData, null, 2);

  const blob = new Blob(
    [jsonText],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileBaseName + ".json";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
function setBuildMode(newMode) {
  buildMode = newMode === true;

  if (buildMode) {
    showBluePanel();
    buildTableOpen = true;
  } else {
    hideBluePanel();
    buildTableOpen = false;
  }

  return buildMode;
}
function showBluePanel() {
  renderBluePanel();
  bluePanel.classList.remove("hidden");
}

function hideBluePanel() {
  bluePanel.classList.add("hidden");
}

function minimizeBluePanel() {
  setBuildMode(false);
}

/* Table click helper */

function handleTropeCellClick(tropeName) {
  if (isBuildModeActive()) {
    addLineItem(tropeName);
  } else {
    openTropeModal(tropeName);
  }
}

/* =========================================================
   BLUE PANEL LINE MANAGEMENT
   ========================================================= */

lineItems = [];
let activeLineIndex = 0;

/* Add a brand new empty line and make it active */

function addNewBluePanelLine() {

  lineItems.push({
   id: Date.now() + Math.random(),
  tropes: [],
  });

  activeLineIndex = lineItems.length - 1;

  renderBluePanel();
}

/* Add a trope/name to the currently active line */

function addTropeToActiveLine(name) {

  /* Safety check in case no line exists yet */

  if (lineItems.length === 0) {
    addNewBluePanelLine();
  }

  const activeLine = lineItems[activeLineIndex];

activeLine.tropes.push(name);

  renderBluePanel();
}

/* Optional helper to clear all lines */

function resetBluePanelLines() {

  lineItems = [];
  activeLineIndex = 0;

  renderBluePanel();
}
const munachChoices = [
  "Mapach",
  "Darga",
  "EtNachTah",
  "PashTa",
  "Segol",
  "T'LishaGadola",
  "T'LishaK'tanah",
  "Katon",
  "Zarka"
];

const munachFollowingTropeMap = {
  Mapach: "Munach4.wav",
  Darga: "Munach4.wav",

  EtNachTah: "Munach3.wav",
  PashTa: "Munach3.wav",
  Segol: "Munach3.wav",
  "T'LishaGadola": "Munach3.wav",
  "T'LishaK'tanah": "Munach3.wav",
  Katon: "Munach3.wav",
  Zarka: "Munach3.wav"
};

let pendingMunachTropeInfo = null;

function buildMunachChoiceButtons() {
  const buttonContainer = document.getElementById("munachChoiceButtons");

  if (!buttonContainer) {
    alert("munachChoiceButtons container not found.");
    return;
  }

  buttonContainer.innerHTML = "";

  munachChoices.forEach(function(tropeName) {
    const btn = document.createElement("button");

    btn.type = "button";
    btn.textContent = tropeName;

    btn.onclick = function() {
      selectMunachFollowingTrope(tropeName);
    };

    buttonContainer.appendChild(btn);
  });
}

function openMunachChoiceModal() {
  buildMunachChoiceButtons();

  document.getElementById("munachChoiceOverlay").style.display = "flex";

  return new Promise(function(resolve) {
    resolveMunachChoice = resolve;
  });
}

function closeMunachChoiceModal() {
  document.getElementById("munachChoiceOverlay").style.display = "none";
  pendingMunachTropeInfo = null;
}

function selectMunachFollowingTrope(followingTropeName) {
  currentMunachFollowingTrope = followingTropeName;
  let selectedWav;
  if (followingTropeName === "Darga" || followingTropeName === "Mapach") {
    selectedWav = "Munach4.wav";
  } else {
    selectedWav = "Munach3.wav";
  }

  document.getElementById("munachChoiceOverlay").style.display = "none";

  if (resolveMunachChoice) {
    resolveMunachChoice(selectedWav);
    resolveMunachChoice = null;
  }
}

document.addEventListener("DOMContentLoaded", function() {

console.log("DOMContentLoaded reached for edit button test");
const editExistingBtn =    document.getElementById("editExistingBtn");

if (editExistingBtn) {
  editExistingBtn.onclick = function() {
    //alert("Edit Existing clicked");
    openActiveFilesSelector(true);
  };
}
  const cancelButton = document.getElementById("munachChoiceCancel");

  if (cancelButton) {
    cancelButton.onclick = function() {
      document.getElementById("munachChoiceOverlay").style.display = "none";

      if (resolveMunachChoice) {
        resolveMunachChoice(null);
        resolveMunachChoice = null;
      }
    };
  }
  buildMunachChoiceButtons();
  initializeBluePanel();
  initializeTropeHoverBoxClickClose();
const modalSizeButton =
  document.getElementById("modalSizeButton");

if (modalSizeButton) {

  modalSizeButton.onclick = function() {

    const modalBox =
      document.querySelector(".tropeModalBox");

    modalBox.classList.toggle("modalExpanded");

    this.textContent =
      modalBox.classList.contains("modalExpanded")
        ? "⊖"
        : "⊕";
  };

}

const tropeNoteInfoButton =
  document.getElementById("tropeNoteInfoButton");

if (tropeNoteInfoButton) {

  tropeNoteInfoButton.onclick =
    async function(event) {

      event.stopPropagation();

    await openInfoPopupFromJson(
  "TropeNoteInfo.json"
);

const popup =
  document.getElementById("activeFileInfoPopup");

popup.style.display = "block";
popup.style.zIndex = "400000";
popup.style.background = "yellow";

      document.getElementById("activeFileInfoPopup")
        .style.zIndex = "300000";

    };

}const activeFileTitleBox =
  document.getElementById("activeFileViewerTitle");

 // loadParshaRepositoryIndex();
});

document.addEventListener("click", function(event) {

  const titleBox =
    event.target.closest("#activeFileViewerTitle");

  if (!titleBox) {
    return;
  }

  viewLyricsMode = !viewLyricsMode;

  toggleLyricsDisplayRows();

});
async function loadParshaRepositoryIndex() {
 ipadTrace("ENTER loadParshaDirectory");
  try {
    const url =
      "ParshaRepository/index.json?v=" +
      new Date().getTime();

    const response = await fetch(url, {
      cache: "no-store"
    });
ipadTrace("FETCH returned status=" + response.status + " ok=" + response.ok);
    if (!response.ok) {
      alert("Could not load ParshaRepository/index.json. Status: " + response.status);
      return;
    }
ipadTrace("ABOUT TO parse index.json");
    activeFiles = await response.json();

  } catch (err) {
    console.error(err);
    alert("Error loading Parsha repository index: " + err.message);
  }
}
async function openActiveFilesSelector(useEditMode = false) {
  editExistingMode = useEditMode;
if (!startupModeSelected) {
return;
}

ipadTrace("ENTER openActiveFilesSelector");
  await loadParshaRepositoryIndex();

  const popup = document.getElementById("activeFilesPopup");
  const select = document.getElementById("activeFilesSelect");

  select.innerHTML = "";

  if (!activeFiles || activeFiles.length === 0) {
    alert("No active files were loaded from index.json.");
    return;
  }

  activeFiles.forEach(function(fileName) {
    const opt = document.createElement("option");
    opt.value = fileName;
    opt.textContent = fileName;
    select.appendChild(opt);
  });

  popup.style.display = "block";
}
function closeActiveFilesSelector() {
  document.getElementById("activeFilesPopup").style.display = "none";
}
function populateBluePanelFromFile(data) {

  const sourceLines =
    data.lines || data.lineItems || data;

  if (!sourceLines || sourceLines.length === 0) {
    alert("Selected file does not contain editable line data.");
    return;
  }

  lineItems = sourceLines.map(function(lineItem, index) {
    return {
      id: Date.now() + index + Math.random(),
      tropes: lineItem.tropes || []
    };
  });

  activeLineIndex = 0;

  showBluePanel();
  renderBluePanel();

  console.log(
    "Blue panel populated from existing file."
  );
}
async function loadPocketTorahAudioDurationFromElement(audioPath) {
  return await new Promise(function(resolve, reject) {
    const audio = document.createElement("audio");

    audio.preload = "metadata";
    audio.src = audioPath;

    audio.onloadedmetadata = function() {
      resolve(audio.duration);
    };

    audio.onerror = function() {
      reject(
        new Error(
          "Could not load Pocket Torah audio metadata: " +
          audioPath
        )
      );
    };
  });
}

async function loadSelectedActiveFile() {
 ipadTrace("ENTER SelectedActiveFile");
  const selectedFile = document.getElementById("activeFilesSelect").value;

  if (!selectedFile) {
    alert("No file selected.");
    return;
  }
 const jsonFile =
    selectedFile.endsWith(".json")
      ? selectedFile
      : selectedFile + ".json";

  try {
console.log("selectedFile =", selectedFile);
console.log("jsonFile =", jsonFile);
    const response =
     await fetch(
  "ParshaRepository/" +
  encodeURIComponent(jsonFile) +
  "?v=" +
  Date.now(),
  { cache: "no-store" }
);

    if (!response.ok) {
      alert("Could not load " + jsonFile);
      return;
    }

    const data = await response.json();
// Test Diag

const lyricsData =
  await loadMatchingLyricsFile(selectedFile);

if (!editExistingMode) {
  displayVowels = confirm(
    "Confirm displaying vowels on YHVH if contained in source reference.\n\nClick Cancel to omit vowels."
  );
}

ptEnabled = false;
usePocketTorah = false;
ptParshaName = "";
ptLineData = [];
ptPlaybackSegments = [];
pocketTorahCheckbox.checked = false;
pocketTorahControl.style.display = "none";

if (
  lyricsData &&
  typeof lyricsData.title === "string" &&
  lyricsData.title.endsWith("-PT")
) {
  ptEnabled = true;
  ptParshaName = lyricsData.title.slice(0, -3);

  const preparedPocketTorah =
    await PocketTorah.preparePlaybackData(
      ptParshaName,
      lyricsData.lines,
      loadPocketTorahAudioDurationFromElement
    );

  ptLineData = preparedPocketTorah.lineData;
  ptPlaybackSegments = preparedPocketTorah.playbackSegments;

  pocketTorahControl.style.display = "";

  console.log(
    "Pocket Torah portion:",
    ptParshaName
  );

  console.log(
    "Pocket Torah lines:",
    ptLineData
  );
}

buildActiveLyricsLines(lyricsData);
if (editExistingMode) {

  populateBluePanelFromFile(data);

  editExistingMode = false;

} else {

  openActiveFileViewer(selectedFile, data);

}

closeActiveFilesSelector();

  } catch (err) {
    console.error(err);
    alert("Error loading selected active file.");
  }
}
async function loadMatchingLyricsFile(selectedFile) {

ipadTrace("ENTER loadMatchingLyrcsFile");
const baseName =
  selectedFile.endsWith(".json")
    ? selectedFile.replace(".json", "")
    : selectedFile;


  const lyricsFile =
  baseName + "_Lyrics.json";

console.log("selectedFile for lyrics =", selectedFile);
console.log("lyricsFile =", lyricsFile);

  try {
    const response =
      await fetch(
        "ParshaRepository/" +
        encodeURIComponent(lyricsFile) +
        "?v=" +
        Date.now(),
        { cache: "no-store" }
      );

    if (!response.ok) {
      console.warn("No matching lyrics file found:", lyricsFile);
      return null;
    }

    return await response.json();

  } catch (err) {
    console.warn("Error loading lyrics file:", lyricsFile, err);
    return null;
  }
}

function buildActiveLyricsLines(lyricsData) {
  activeLyricsLines = [];

  if (!lyricsData || !lyricsData.lines) {
    return;
  }

  lyricsData.lines.forEach(function(lineItem, lineIndex) {
    const lineNumber = lineItem.line || lineIndex + 1;

    activeLyricsLines[lineNumber] =
      lineItem.words || [];
  });
}

function normalizeHebrewDisplayWord(hebrew) {

  if (!hebrew) return "";

  return String(hebrew)
    .trim()
    .replace(/\s*\u05C0/g, " \u05C0");   // pasik
}

function openActiveFileViewer(fileName, data) {
  viewLyricsMode = false;
  const overlay =
    document.getElementById("activeFileViewerOverlay");

  const titleBox =
    document.getElementById("activeFileViewerTitle");

  const linesContainer =
    document.getElementById("activeFileLinesContainer");
  titleBox.textContent =
    fileName.replace(".json", "");
document.getElementById("activeFileInfoIconHolder").innerHTML =
  buildInfoIconSvg();

document.getElementById("activeFileInfoIcon").onclick = function(event) {
  event.stopPropagation();

 openActiveFileInfoPopup();

};

  linesContainer.innerHTML = "";

  buildActiveFileLines(data);

  for (let lineNumber = 1; lineNumber < activeFileLines.length; lineNumber++) {

    if (!activeFileLines[lineNumber]) {
      continue;
    }

    const lineRow = document.createElement("div");
lineRow.className = "active-file-line-row";

lineRow.style.cursor = "pointer";

lineRow.onclick = function() {

  if (audioPlaybackMode !== null) {
    return;
  }

  audioPlaybackMode = "trope";

  if (document.getElementById("notePlaybackCheckbox").checked) {

    playActiveFileLine(lineNumber);

  } else {

    playSmooth(lineNumber);

  }

};
    const lineNumberBox = document.createElement("div");
    lineNumberBox.className = "active-file-line-number";
    lineNumberBox.textContent = lineNumber;

    const lineBox = document.createElement("div");
    lineBox.className = "active-file-line-box";

   lineBox.innerHTML =
  activeFileLines[lineNumber]
    .map(function(item) {

      return item.displayNames
        .map(function(name) {
          return formatTropeNameForDisplay(name);
        })
        .join("");

    })
    .join(" + ");

    lineRow.appendChild(lineNumberBox);
    lineRow.appendChild(lineBox);

    linesContainer.appendChild(lineRow);
const lyricsRow = document.createElement("div");
lyricsRow.className = "active-file-lyrics-row";
lyricsRow.dataset.lineNumber = lineNumber;

lyricsRow.onclick = function(event) {

  event.stopPropagation();
  if (audioPlaybackMode !== null) {
    return;
  }

  audioPlaybackMode = "lyrics";
if (usePocketTorah) {
  playPocketTorahAudio(lineNumber);
  return;
}

lyricsBox.classList.add("lyrics-playing");

  showTropeTrainerCreditLine(lineNumber);

  const sectionName =
    document.getElementById("activeFileViewerTitle")
      .textContent
      .trim();

  const wavPath =
    audioPath +
    encodeURIComponent(sectionName) +
    "/" +
    encodeURIComponent(sectionName + "_line" + lineNumber + ".wav");

  playTropeTrainerLineAudio(wavPath, lineNumber);

};

const lyricsBox = document.createElement("div");
lyricsBox.className = "active-file-lyrics-box";

lyricsBox.innerHTML = "";

if (activeLyricsLines[lineNumber]) {

  activeLyricsLines[lineNumber].forEach(function(wordItem, wordIndex) {

    const wordSpan = document.createElement("span");

    wordSpan.className = "lyrics-hebrew-word";

wordSpan.textContent =
  normalizeHebrewDisplayWord(
   displayVowels
          ? (wordItem.hebrew || "")
            : stripYHVHVowelsOnly(wordItem.hebrew || "")
  );

if (isYHVH(wordItem.hebrew)) {
  wordSpan.classList.add("yhvh-highlight");
}
    wordSpan.dataset.translit =
      wordItem.translit || "";

    wordSpan.dataset.wordIndex = wordIndex;if (!touchModeActive) {

wordSpan.onmouseenter = function(event) {
  const hoverBox = document.getElementById("tropeHoverBox");
  const rect = wordSpan.getBoundingClientRect();

  hoverBox.textContent =
    wordItem.translit || "[no transliteration]";

  hoverBox.style.position = "fixed";
  hoverBox.style.left =
    (rect.left + rect.width / 2) + "px";
  hoverBox.style.top =
    (rect.bottom + 8) + "px";

  hoverBox.style.transform = "translateX(-50%)";
  hoverBox.style.zIndex = "300000";
  hoverBox.style.display = "block";
};

wordSpan.onmousemove = function(event) {
  // Do nothing. Position stays centered under the word.
};

wordSpan.onmouseleave = function() {
  document.getElementById("tropeHoverBox").style.display = "none";
};}
if (touchModeActive) {

  let lyricsTouchTimer = null;

  wordSpan.addEventListener("touchstart", function(event) {

    const touch = event.touches[0];

    lyricsTouchTimer = setTimeout(function() {
    //alert("Touch timer fired");

 const hoverBox =
 document.getElementById("tropeHoverBox");

 hoverBox.textContent =
  "Translit: " + (wordItem.translit || "[blank]");

hoverBox.style.display = "block";
hoverBox.style.position = "fixed";

hoverBox.style.left =
  Math.max(10, touch.clientX - 120) + "px";

hoverBox.style.top =
  Math.max(10, touch.clientY - 90) + "px";

hoverBox.style.transform = "";
hoverBox.style.zIndex = "300000";
hoverBox.style.pointerEvents = "auto";
    }, 300);

  });

}

    lyricsBox.appendChild(wordSpan);

if (wordIndex < activeLyricsLines[lineNumber].length - 1) {

  const MAQAF = "\u05BE";

  const currentHebrew =
    (wordItem.hebrew || "").trim();

  const nextHebrew =
    (activeLyricsLines[lineNumber][wordIndex + 1].hebrew || "").trim();

  const suppressSpace =
    currentHebrew.endsWith(MAQAF) ||
    nextHebrew.startsWith(MAQAF);

  if (!suppressSpace) {
    lyricsBox.appendChild(
      document.createTextNode(" ")
    );
  }
}
  });
}

lyricsRow.appendChild(lyricsBox);
linesContainer.appendChild(lyricsRow);
  }
toggleLyricsDisplayRows();
  overlay.style.display = "block";
}

function playPocketTorahAll() {
  if (playPocketTorahAll.stopHandler) {

    player.pause();

    player.removeEventListener(
      "timeupdate",
      playPocketTorahAll.stopHandler
    );

       playPocketTorahAll.stopHandler = null;

    clearLyricsPlayingHighlight();

    document.getElementById(
      "hebrewLinePopup"
    ).style.display = "none";

    audioPlaybackMode = null;
    setPlayAllButtonStopped();

    return;
  }

audioPlaybackMode = "playAll";
  const segment =
    ptPlaybackSegments[0];

  if (!segment) {
    console.error(
      "Pocket Torah playback segment not found."
    );
audioPlaybackMode = null;
    return;
  }

  /*
    Remove an individual-verse stop handler
    if one is still attached.
  */
  if (playPocketTorahAudio.stopHandler) {
    player.removeEventListener(
      "timeupdate",
      playPocketTorahAudio.stopHandler
    );

    playPocketTorahAudio.stopHandler = null;
  }

  player.pause();

  player.src =
    segment.audioPath;

  player.currentTime =
    segment.startTime;
  highlightLyricsLineForPlayAll(1);
  scrollLyricsLineIntoView(1);
  showTropeTrainerCreditLine(1);

let currentLineNumber = 1;
playPocketTorahAll.stopHandler =
  function() {
    for (
      let lineIndex = currentLineNumber;
      lineIndex < ptLineData.length;
      lineIndex++
    ) {
      const nextLine =
        ptLineData[lineIndex];

      if (
        player.currentTime >=
        nextLine.startTime
      ) {
        currentLineNumber =
          lineIndex + 1;

        highlightLyricsLineForPlayAll(
          currentLineNumber
        );

        scrollLyricsLineIntoView(
          currentLineNumber
        );

        showTropeTrainerCreditLine(
          currentLineNumber
        );
      } else {
        break;
      }
    }
    if (
      player.currentTime >=
      segment.endTime
    ) {
      player.pause();

player.removeEventListener(
  "timeupdate",
  playPocketTorahAll.stopHandler
);

playPocketTorahAll.stopHandler = null;

clearLyricsPlayingHighlight();

document.getElementById(
  "hebrewLinePopup"
).style.display = "none";

audioPlaybackMode = null;
setPlayAllButtonStopped();
    }  };

player.addEventListener(
  "timeupdate",
  playPocketTorahAll.stopHandler
);
setPlayAllButtonRunning();
  player.play();

  console.log(
    "Pocket Torah Play All started:",
    segment
  );
}
function closeActiveFileViewer() {

  // Stop any playback using the normal audio player.
  stopPlayAllLyrics();

  // Remove any Pocket Torah individual-line stop handler.
  if (playPocketTorahAudio.stopHandler) {
    player.removeEventListener(
      "timeupdate",
      playPocketTorahAudio.stopHandler
    );

    playPocketTorahAudio.stopHandler = null;
  }

  // Remove any Pocket Torah Play All stop handler.
  if (playPocketTorahAll.stopHandler) {
    player.removeEventListener(
      "timeupdate",
      playPocketTorahAll.stopHandler
    );

    playPocketTorahAll.stopHandler = null;
  }

  // Stop Smooth trope playback if it is active.
  if (smoothSourceNode) {
    try {
      smoothSourceNode.stop();
    } catch (err) {
      console.warn(
        "Could not stop Smooth playback:",
        err
      );
    }

    smoothSourceNode = null;
  }

  // Clear any remaining audio callbacks.
  player.onended = null;
  player.onerror = null;

  // Restore playback to the idle state.
  audioPlaybackMode = null;

  clearLyricsPlayingHighlight();
  setPlayAllButtonStopped();

  document.getElementById(
    "hebrewLinePopup"
  ).style.display = "none";

  lineCount = 0;

  document.getElementById(
    "activeFileViewerOverlay"
  ).style.display = "none";
}
async function loadParshaFile(fileName) {

  const response = await fetch(
    "ParshaRepository/" +
    encodeURIComponent(fileName) +
    "?v=" +
    Date.now(),
    { cache: "no-store" }
  );

  if (!response.ok) {
    alert("Could not load " + fileName);
    return;
  }

  const data = await response.json();

  // action here with the loaded file data
  console.log(data);
}

function toggleLyricsDisplayRows() {

  lineCount = 0;

  const playBtn =
    document.getElementById("playAllLyricsBtn");

  document
    .querySelectorAll(".active-file-lyrics-row")
    .forEach(function(row) {

      if (viewLyricsMode) {
        row.style.display = "block";
        lineCount++;
      } else {
        row.style.display = "none";
      }

    });

  if (playBtn) {
    playBtn.style.display =
      viewLyricsMode ? "inline-block" : "none";
  }
}

function buildActiveFileLines(data) {
  const sourceLines = data.lines || data.lineItems || data;
  activeFileLines = [];
  sourceLines.forEach(function(item, lineIndex) {
    const lineNumber = lineIndex + 1;
    activeFileLines[lineNumber] = [];
    const tropes = item.tropes || item.value || item.line || [];
    for (let i = 0; i < tropes.length; i++) {
      let tropeName = tropes[i];
      if (tropeName.endsWith("*")) {
        const firstName =
          tropeName.replace("*", "");
        const secondName =
          tropes[i + 1];

        activeFileLines[lineNumber].push({
          displayNames: [firstName, secondName],
          playbackName: firstName + secondName
        });

        i++;

      } else {

        activeFileLines[lineNumber].push({
          displayNames: [tropeName],
          playbackName: tropeName
        });

      }

    }

  });

}

function playActiveFileLine(lineNumber) {

  const tropes = activeFileLines[lineNumber];

  if (!tropes || tropes.length === 0) {
    return;
  }

  showHebrewLineForPlayback(tropes);

  playTropeSequence(tropes)
    .then(function() {

      document.getElementById(
        "hebrewLinePopup"
      ).style.display = "none";
audioPlaybackMode = null;
    });
}

async function playTropeSequence(tropes) {

  console.log("Starting trope sequence. Count:", tropes.length);
  console.log("Tropes array:", tropes);

  for (let i = 0; i < tropes.length; i++) {

    highlightHebrewTrope(i);

    const playbackName =
      tropes[i].playbackName;

   const wavFile =
  audioPath +
  encodeURIComponent(playbackName + ".wav") +
  "?v=" +
  Date.now();

    console.log(
      "About to play index:",
      i,
      "playbackName:",
      playbackName,
      "wavFile:",
      wavFile
    );

    await playOneWav(wavFile);

    console.log(
      "Finished playing index:",
      i,
      "playbackName:",
      playbackName
    );
  }

  console.log("Completed full trope sequence.");

  highlightHebrewTrope(-1);
}

function playOneWav(wavFile) {
  return new Promise(function(resolve) {

    player.pause();

    player.onended = null;
    player.onerror = null;

    player.src = wavFile;
    player.load();

    player.onended = function() {
      resolve();
    };

    player.onerror = function() {
      console.error("Could not play:", wavFile, player.error);
      resolve();
    };

    const playPromise = player.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function(err) {
        console.error("player.play() failed:", wavFile, err);
        resolve();
      });
    }
  });
}
function showHebrewLineForPlayback(tropes) {

  const hebrewText =
    tropes
      .map(function(tropeName) {
        return hebrewTropeNames[tropeName] || tropeName;
      })
      .join("\u00A0\u00A0");

 const hebrewLineBox =
  document.getElementById("hebrewLineText");
hebrewLineBox.style.fontSize = "34px";
hebrewLineBox.innerHTML = "";

tropes.forEach(function(item, index) {
  const span = document.createElement("span");

span.textContent =
  item.displayNames
    .map(function(name) {
      return hebrewTropeNames[name] || name;
    })
    .join("");
  span.dataset.tropeIndex = index;

  span.className = "hebrew-trope-span";

  hebrewLineBox.appendChild(span);

  if (index < tropes.length - 1) {
    hebrewLineBox.appendChild(
      document.createTextNode("\u00A0\u00A0")
    );
  }

});

  document.getElementById("hebrewLinePopup").style.display =
    "block";
}

function highlightHebrewTrope(index) {

  document
    .querySelectorAll(".hebrew-trope-span")
    .forEach(function(span) {
      span.classList.remove("hebrew-trope-active");
    });

  const activeSpan =
    document.querySelector(
      '.hebrew-trope-span[data-trope-index="' + index + '"]'
    );

  if (activeSpan) {
    activeSpan.classList.add("hebrew-trope-active");
  }
}
const notePlaybackCheckbox =
  document.getElementById("notePlaybackCheckbox");

const smoothPlaybackCheckbox =
  document.getElementById("smoothPlaybackCheckbox");

const pocketTorahControl =
  document.getElementById("pocketTorahControl");

const pocketTorahCheckbox =
  document.getElementById("pocketTorahCheckbox");

pocketTorahCheckbox.addEventListener("change", function() {
  usePocketTorah = pocketTorahCheckbox.checked;
});

function playPocketTorahAudio(lineNumber) {

  const lineData =
    ptLineData[lineNumber - 1];

  if (!lineData) {
    console.error(
      "Pocket Torah line data not found:",
      lineNumber
    );
    return;
  }

  /*
    Remove the stop monitor from any previous
    Pocket Torah line playback.
  */
  if (playPocketTorahAudio.stopHandler) {
    player.removeEventListener(
      "timeupdate",
      playPocketTorahAudio.stopHandler
    );

    playPocketTorahAudio.stopHandler = null;
  }

  player.pause();

  player.src =
    lineData.audioPath;

  player.currentTime =
    lineData.startTime;

  /*
    Stop when this verse reaches its prepared
    Pocket Torah end time.
  */

  highlightLyricsLineForPlayAll(lineNumber);
  scrollLyricsLineIntoView(lineNumber);
  showTropeTrainerCreditLine(lineNumber);
  playPocketTorahAudio.stopHandler =
    function() {

      if (
        player.currentTime >=
        lineData.endTime
      ) {
        player.pause();

        player.removeEventListener(
          "timeupdate",
          playPocketTorahAudio.stopHandler
        );

               playPocketTorahAudio.stopHandler = null;

        clearLyricsPlayingHighlight();

        document.getElementById(
          "hebrewLinePopup"
        ).style.display = "none";

        audioPlaybackMode = null;
      }
    };

  player.addEventListener(
    "timeupdate",
    playPocketTorahAudio.stopHandler
  );

  player.play();

  console.log(
    "Pocket Torah line playback:",
    lineNumber,
    lineData
  );
}

notePlaybackCheckbox.addEventListener("change", function() {

  if (notePlaybackCheckbox.checked) {
    smoothPlaybackCheckbox.checked = false;
  } else {
    smoothPlaybackCheckbox.checked = true;
  }

});

smoothPlaybackCheckbox.addEventListener("change", function() {

  if (smoothPlaybackCheckbox.checked) {
    notePlaybackCheckbox.checked = false;
  } else {
    notePlaybackCheckbox.checked = true;
  }

});

async function playSmooth(lineNumber) {
ipadTrace("ENTER playSmooth");
  const lineItems = activeFileLines[lineNumber];

  if (!lineItems || lineItems.length === 0) {
    return;
  }

  showHebrewLineForPlayback(lineItems);

  if (!smoothAudioContext) {
    smoothAudioContext = new AudioContext();
  }

  if (smoothSourceNode) {
    smoothSourceNode.stop();
    smoothSourceNode = null;
  }

  const buffers = [];

  for (let i = 0; i < lineItems.length; i++) {

    const playbackName = lineItems[i].playbackName;

    const wavPath =
      audioPath +
      encodeURIComponent(playbackName + ".wav");

    const response = await fetch(
  wavPath + "?v=" + Date.now(),
  { cache: "no-store" }
);

    if (!response.ok) {
      alert("Could not load " + wavPath);
audioPlaybackMode = null;
      return;
    }

    const arrayBuffer = await response.arrayBuffer();

    const audioBuffer =
      await smoothAudioContext.decodeAudioData(arrayBuffer);

    buffers.push(audioBuffer);
  }

  const mergedBuffer =
    mergeAudioBuffers(buffers, smoothAudioContext);

  smoothSourceNode =
    smoothAudioContext.createBufferSource();

  smoothSourceNode.buffer = mergedBuffer;

  smoothSourceNode.connect(
    smoothAudioContext.destination
  );

 smoothSourceNode.onended = function() {
  document.getElementById("hebrewLinePopup").style.display = "none";
  smoothSourceNode = null;
  audioPlaybackMode = null;
};

  smoothSourceNode.start();
}

function mergeAudioBuffers(buffers, audioContext) {

  const numberOfChannels =
    buffers[0].numberOfChannels;

  const sampleRate =
    buffers[0].sampleRate;

  let totalLength = 0;

  buffers.forEach(function(buffer) {
    totalLength += buffer.length;
  });

  const mergedBuffer =
    audioContext.createBuffer(
      numberOfChannels,
      totalLength,
      sampleRate
    );

  let offset = 0;

  buffers.forEach(function(buffer) {

    for (let channel = 0; channel < numberOfChannels; channel++) {

      const outputData =
        mergedBuffer.getChannelData(channel);

      const inputData =
        buffer.getChannelData(channel);

      outputData.set(inputData, offset);
    }

    offset += buffer.length;
  });

  return mergedBuffer;
}
function downloadAudioBufferAsWav(audioBuffer, fileName) {

  const wavBlob =
    audioBufferToWavBlob(audioBuffer);

  const url =
    URL.createObjectURL(wavBlob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
function audioBufferToWavBlob(buffer) {

  const numberOfChannels =
    buffer.numberOfChannels;

  const sampleRate =
    buffer.sampleRate;

  const format = 1;
  const bitDepth = 16;

  let result;

  if (numberOfChannels === 2) {

    result = interleave(
      buffer.getChannelData(0),
      buffer.getChannelData(1)
    );

  } else {

    result = buffer.getChannelData(0);

  }

  const bytesPerSample =
    bitDepth / 8;

  const blockAlign =
    numberOfChannels * bytesPerSample;

  const wavBuffer =
    new ArrayBuffer(
      44 + result.length * bytesPerSample
    );

  const view =
    new DataView(wavBuffer);

  writeString(view, 0, "RIFF");

  view.setUint32(
    4,
    36 + result.length * bytesPerSample,
    true
  );

  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");

  view.setUint32(16, 16, true);

  view.setUint16(20, format, true);

  view.setUint16(22, numberOfChannels, true);

  view.setUint32(24, sampleRate, true);

  view.setUint32(
    28,
    sampleRate * blockAlign,
    true
  );

  view.setUint16(32, blockAlign, true);

  view.setUint16(34, bitDepth, true);

  writeString(view, 36, "data");

  view.setUint32(
    40,
    result.length * bytesPerSample,
    true
  );

  floatTo16BitPCM(view, 44, result);

  return new Blob(
    [view],
    { type: "audio/wav" }
  );
}
function writeString(view, offset, string) {

  for (let i = 0; i < string.length; i++) {

    view.setUint8(
      offset + i,
      string.charCodeAt(i)
    );

  }

}
function floatTo16BitPCM(output, offset, input) {

  for (let i = 0; i < input.length; i++, offset += 2) {

    let s =
      Math.max(-1, Math.min(1, input[i]));

    output.setInt16(
      offset,
      s < 0 ? s * 0x8000 : s * 0x7FFF,
      true
    );

  }

}
function interleave(left, right) {

  const length =
    left.length + right.length;

  const result =
    new Float32Array(length);

  let inputIndex = 0;

  for (let index = 0; index < length;) {

    result[index++] = left[inputIndex];
    result[index++] = right[inputIndex];

    inputIndex++;
  }

  return result;
}
function buildInfoIconSvg() {
  return `
    <svg
      id="activeFileInfoIcon"
      class="active-file-info-icon"
      fill="currentColor"
      width="22"
      height="22"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      title="Information"
    >
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"></path>
      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"></path>
    </svg>
  `;
}
async function openActiveFileInfoPopup() {
await loadInfoPopupText(
  "TropeLyricsInfo.json"
);
  document.getElementById("activeFileInfoPopup").style.display = "block";
}
function closeActiveFileInfoPopup() {
  document.getElementById("activeFileInfoPopup").style.display = "none";
}

function showTropeTrainerCreditLine(lineNumber) {

  const popup = document.getElementById("hebrewLinePopup");
  const messageBox = document.getElementById("hebrewLineText");

  messageBox.style.fontSize = "24px";

   if (usePocketTorah) {
    messageBox.innerHTML =
      "Audio playback for line " +
      lineNumber +
      " is from an API connection to PocketTorah.com";
  } else {
    messageBox.innerHTML =
      "Audio playback for line " +
      lineNumber +
      " is derived from a recording of an audio segment originally generated by TropeTrainer.com";
  }
  if (lineNumber === 1) {
    popup.style.top = "420px";
  } else {
    popup.style.top = "200px";
  }

  popup.style.display = "block";
}

function getHoverText(tropeName) {
  const tropeInfo = findTropeInfo(tropeName);

  if (tropeInfo && tropeInfo.hover) {
    return tropeInfo.hover;
  }

  if (comboHoverText[tropeName]) {
    return comboHoverText[tropeName];
  }

  return "";
}

function initializeTropeHoverBoxClickClose() {
  const hoverBox = document.getElementById("tropeHoverBox");

  if (!hoverBox) {
    return;
  }

  hoverBox.style.cursor = "pointer";

  hoverBox.onclick = function(event) {
    event.stopPropagation();
    hoverBox.style.display = "none";
  };
}


function playTropeTrainerLineAudio(wavPath, lineNumber) {
  console.log("Playing TropeTrainer audio:");
  console.log("Line:", lineNumber);
  console.log("WAV path:", wavPath);

  player.pause();

  player.onended = null;
  player.onerror = null;

  player.src = wavPath + "?v=" + Date.now();
  player.load();

  player.onended = function() {
    clearLyricsPlayingHighlight();

    document.getElementById("hebrewLinePopup").style.display =
      "none";
  audioPlaybackMode = null;
  };

  player.onerror = function() {
    clearLyricsPlayingHighlight();

    console.error(
      "Could not play TropeTrainer line audio:",
      wavPath,
      player.error
    );

    document.getElementById("hebrewLinePopup").style.display =
      "none";
  audioPlaybackMode = null;
  };

  const playPromise = player.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(function(err) {
      clearLyricsPlayingHighlight();
audioPlaybackMode = null;
      console.error(
        "player.play() failed:",
        wavPath,
        err
      );

      document.getElementById("hebrewLinePopup").style.display =
        "none";
    });
  }
}
function clearLyricsPlayingHighlight() {
  document
    .querySelectorAll(".lyrics-playing")
    .forEach(function(box) {
      box.classList.remove("lyrics-playing");
    });
}
function ipadTrace(msg) {
  const box = document.getElementById("ipadDebugBox");
  if (box) box.innerHTML += msg + "<br>";
  console.log(msg);
}
document.getElementById("desktopModeBtn").onclick =
  function() {
  startupModeSelected = true;
    isTouchDevice = false;
    touchModeActive = false;
buildTropeTable();
    document.getElementById("startupModeBox").style.display = "none";
 document.getElementById("buildVersionBanner").style.display = "none";
   console.log(
  "Desktop selected:",
  isTouchDevice,
  touchModeActive
);
};

document.getElementById("touchModeBtn").onclick =
  function() {
   startupModeSelected = true;
    isTouchDevice = true;
    touchModeActive = true;
buildTropeTable();
    document.getElementById("startupModeBox").style.display =   "none";
 document.getElementById("buildVersionBanner").style.display = "none";

   console.log(
  "Touch selected:",
  isTouchDevice,
  touchModeActive
);
};
function addTropeToCurrentBuildLine(tropeName) {

  if (lineItems.length === 0) {
    return;
  }

  lineItems[activeBuildLineIndex].tropes.push(tropeName);

  renderBluePanel();
}

async function loadInfoPopupText(jsonFileName) {

  const target =
    document.getElementById("activeFileInfoText");

  if (!target) {
    console.error(
      "activeFileInfoText element not found."
    );
    return;
  }

  try {

    const response = await fetch(
      jsonFileName + "?v=" + Date.now(),
      { cache: "no-store" }
    );

    console.log(
      "Info popup response:",
      response.status,
      response.ok
    );

    if (!response.ok) {

      target.textContent =
        "Information Content will be added here.";

      return;
    }

    const data =
      await response.json();

    console.log(
      "Info popup JSON:",
      data
    );

    target.textContent =
      data.text ||
      "Information Content will be added here.";

  } catch (err) {

    console.error(
      "Info popup load error:",
      err
    );

    target.textContent =
      "Information Content will be added here.";
  }
}

async function openInfoPopupFromJson(jsonFileName) {

  await loadInfoPopupText(jsonFileName);

  const popup =
    document.getElementById("activeFileInfoPopup");

  popup.style.display = "block";
  popup.style.zIndex = "400000";

}

function formatTropeNameForDisplay(tropeName) {
  let colorToUse = comboColor;

  if (cleanNames.some(function(item) {
    return item.name === tropeName;
  })) {

    colorToUse = cleanColor;

  } else if (dirtyNames.some(function(item) {
    return item.name === tropeName;
  })) {

    colorToUse = dirtyColor;
  }

  return '<span style="color:' + colorToUse + ';">' + tropeName + '</span>';
}


document.getElementById("playAllLyricsBtn").onclick = function(event) {
  event.stopPropagation();
  if (
    audioPlaybackMode !== null &&
    audioPlaybackMode !== "playAll"
  ) {
    return;
  }
if (usePocketTorah) {
  playPocketTorahAll();
  return;
}
  if (playAllEnable) {
    stopPlayAllLyrics();
    return;
  }

  playAllLyricsLines();
};

function setPlayAllButtonRunning() {
  const btn = document.getElementById("playAllLyricsBtn");
  if (!btn) return;

  btn.style.background = "pink";
  btn.title = "Stop Play All";
}

function setPlayAllButtonStopped() {
  const btn = document.getElementById("playAllLyricsBtn");
  if (!btn) return;

  btn.style.background = "lightgreen";
  btn.title = "Play All Lyrics";
}

function stopPlayAllLyrics() {
  playAllEnable = false;

  player.pause();
  player.currentTime = 0;

  if (playAllResolve) {
    const resolveNow = playAllResolve;
    playAllResolve = null;
    resolveNow();
  }

  clearLyricsPlayingHighlight();
  setPlayAllButtonStopped();

  document.getElementById("hebrewLinePopup").style.display = "none";
}

async function playAllLyricsLines() {
  playAllEnable = true;
audioPlaybackMode = "playAll";
  setPlayAllButtonRunning();

  const sectionName =
    document.getElementById("activeFileViewerTitle")
      .textContent
      .trim();

  try {
    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {

      if (!playAllEnable) {
        return;
      }

      const wavPath =
        audioPath +
        encodeURIComponent(sectionName) +
        "/" +
        encodeURIComponent(sectionName + "_line" + lineNumber + ".wav");

      highlightLyricsLineForPlayAll(lineNumber);
      scrollLyricsLineIntoView(lineNumber);
      showTropeTrainerCreditLine(lineNumber);

      await playTropeTrainerLineAudioAndWait(wavPath, lineNumber);

      if (!playAllEnable) {
        return;
      }
    }

  } finally {
    playAllEnable = false;
audioPlaybackMode = null;
    playAllResolve = null;
    setPlayAllButtonStopped();
    clearLyricsPlayingHighlight();

    document.getElementById("hebrewLinePopup").style.display = "none";
  }
}

function highlightLyricsLineForPlayAll(lineNumber) {
  clearLyricsPlayingHighlight();

  const lyricsRow =
    document.querySelector(
      '.active-file-lyrics-row[data-line-number="' +
      lineNumber +
      '"]'
    );

  if (!lyricsRow) return;

  const lyricsBox =
    lyricsRow.querySelector(".active-file-lyrics-box");

  if (lyricsBox) {
    lyricsBox.classList.add("lyrics-playing");
  }
}

function playTropeTrainerLineAudioAndWait(wavPath, lineNumber) {
  return new Promise(function(resolve) {

    let alreadyResolved = false;

    function finishPlayback() {
      if (alreadyResolved) return;

      alreadyResolved = true;
      playAllResolve = null;

      clearLyricsPlayingHighlight();

      document.getElementById("hebrewLinePopup").style.display =
        "none";

      resolve();
    }

    playAllResolve = finishPlayback;

    player.pause();
    player.onended = null;
    player.onerror = null;

    player.src = wavPath + "?v=" + Date.now();
    player.load();

    player.onended = finishPlayback;
    player.onerror = finishPlayback;

    const playPromise = player.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function() {
        finishPlayback();
      });
    }
  });
}

function scrollLyricsLineIntoView(lineNumber) {
  const lyricsRow =
    document.querySelector(
      '.active-file-lyrics-row[data-line-number="' +
      lineNumber +
      '"]'
    );

  if (!lyricsRow) return;

  lyricsRow.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function isYHVH(hebrewText) {
  const consonants =
    String(hebrewText || "").replace(/[\u0591-\u05C7]/g, "");

  return (
    consonants.includes("יהוה") ||
    consonants.includes("יי")
  );
}

function stripYHVHVowelsOnly(hebrew) {

  if (!hebrew) return "";

  const YHVH_PATTERN =
    /י[\u0591-\u05C7]*ה[\u0591-\u05C7]*ו[\u0591-\u05C7]*ה/g;

  return String(hebrew).replace(
    YHVH_PATTERN,
    function(match) {
      return match.replace(
        /[\u05B0-\u05BC\u05C7]/g,
        ""
      );
    }
  );
}