/**
  FangLing F2100K (Toploong 1325) - post dopasowany 1:1 do formatu SheetCAM "Toploong Koike simple".
  Bazuje na Autodesk FangLing post (FORKID {652161EC-F5A5-405D-816F-2749CA555654}).

  Format wyjscia:
    G21 / G90 / G40
    M08 M08 -> G00X..Y.. -> M07 -> G01/G02/G03 ... (dla kazdego konturu)
    M08 M08 / G00X+0.0000Y+0.0000 / M02
  Bez spacji, jawny znak +/-, 4 miejsca po przecinku, bez F, bez G92/G99.
*/

description = "FangLing F2100K (SheetCAM-compatible)";
vendor = "FangLing";
vendorUrl = "http://www.flcnc.com/?_l=en";
legal = "Copyright (C) 2012-2022 by Autodesk, Inc.";
certificationLevel = 2;
minimumRevision = 45702;

longDescription = "F2100K v5 (Toploong 1325). Output matches SheetCAM 'Toploong Koike simple' format.";

extension = "txt";
programNameIsInteger = false;
setCodePage("ascii");

// MILLING tylko po to, zeby przyjac operacje Drill z osobnego setupu Milling
// i zamienic ja na punktowanie plazma (M07 -> M08 bez ruchu, wiec THC nie ma czym jechac)
capabilities = CAPABILITY_JET | CAPABILITY_MILLING;
tolerance = spatial(0.002, MM);

minimumChordLength = spatial(0.25, MM);
minimumCircularRadius = spatial(0.01, MM);
maximumCircularRadius = spatial(4000, MM);
minimumCircularSweep = toRad(0.01);
maximumCircularSweep = toRad(180); // pelne okregi zawsze jako 2 polowki - F2100 nie lubi luku start==koniec
allowHelicalMoves = false;
allowedCircularPlanes = 1 << PLANE_XY;
highFeedrate = (unit == IN) ? 200 : 5000;

properties = {
  useCircularInterpolation: {
    title      : "Circular interpolation",
    description: "G02/G03 dla lukow. Wylacz, zeby wszystko szlo jako G01.",
    type       : "boolean",
    value      : true,
    scope      : "post"
  },
  minimumSegment: {
    title      : "Minimum segment length (mm)",
    description: "Laczy mikroodcinki G01 krotsze niz ta wartosc (blad ksztaltu max. tyle). 0 = wylaczone.",
    type       : "number",
    value      : 0.05,
    scope      : "post"
  },
  punchDwell: {
    title      : "Punch extra dwell (s)",
    description: "Dodatkowe G04 miedzy M07 a M08 przy punktowaniu. 0 = tylko czas przebicia ze sterownika. Ma pierwszenstwo 'Dwelling before retract' z operacji Drill (gdy > 0).",
    type       : "number",
    value      : 0,
    scope      : "post"
  },
  returnToZero: {
    title      : "Return to X0 Y0 at end",
    description: "G00 X0 Y0 na koncu programu (jak SheetCAM).",
    type       : "boolean",
    value      : true,
    scope      : "post"
  }
};

var gFormat = createFormat({prefix:"G", decimals:0, width:2, zeropad:true});
var mFormat = createFormat({prefix:"M", decimals:0, width:2, zeropad:true});

// X+12.3450 / I-1.9200 - jak SheetCAM
var xyzFormat = createFormat({decimals:4, trim:false, forceSign:true});
var hundredthsecFormat = createFormat({decimals:0, scale:100});

var xOutput = createVariable({prefix:"X", force:true}, xyzFormat);
var yOutput = createVariable({prefix:"Y", force:true}, xyzFormat);
var iOutput = createReferenceVariable({prefix:"I", force:true}, xyzFormat);
var jOutput = createReferenceVariable({prefix:"J", force:true}, xyzFormat);

var torchOn = false;
var compActive = false;
var pendingRadiusCompensation = -1;
var lastX; // ostatnia WYPISANA pozycja (undefined = nieznana)
var lastY;
var isPunchSection = false;
var pendingLinear = null; // pominiety mikroodcinek - do wypisania przed kolejnym ruchem/M08

function writeBlock() {
  writeWords(arguments);
}

function writeComment(text) {
  // F2100K - komentarze pomijamy
}

function onOpen() {
  if (!getProperty("useCircularInterpolation")) {
    allowedCircularPlanes = 0;
  }
  setWordSeparator("");

  if (unit != MM) {
    error(localize("Uzyj jednostek MM."));
    return;
  }

  writeBlock(gFormat.format(21));
  writeBlock(gFormat.format(90));
  writeBlock(gFormat.format(40));
}

function onComment(message) {
}

function onSection() {
  isPunchSection = (currentSection.getType() == TYPE_MILLING);
  if (!isPunchSection) {
    checkJetMode();
  }

  var remaining = currentSection.workPlane;
  if (!isSameDirection(remaining.forward, new Vector(0, 0, 1))) {
    error(localize("Tool orientation is not supported."));
    return;
  }
  setRotation(remaining);

  xOutput.reset();
  yOutput.reset();

  if (isPunchSection) {
    return; // dojazdy robi onCyclePoint
  }

  // zawsze dojazd G00 na punkt startowy sekcji PRZED M07
  var p = getFramePosition(currentSection.getInitialPosition());
  writeG00(p.x, p.y);
}

function checkJetMode() {
  switch (currentSection.jetMode) {
  case JET_MODE_THROUGH:
    break;
  case JET_MODE_ETCHING:
    error(localize("Etch cutting mode is not supported."));
    return;
  case JET_MODE_VAPORIZE:
    error(localize("Vaporize cutting mode is not supported."));
    return;
  default:
    error(localize("Unsupported cutting mode."));
    return;
  }
}

function writeG00(_x, _y) {
  writeBlock(gFormat.format(0), xOutput.format(_x), yOutput.format(_y));
  lastX = _x;
  lastY = _y;
}

function flushLinear() {
  if (pendingLinear) {
    var p = pendingLinear;
    pendingLinear = null;
    writeBlock(gFormat.format(1), xOutput.format(p.x), yOutput.format(p.y));
    lastX = p.x;
    lastY = p.y;
  }
}

function torchOff() {
  flushLinear(); // koniec konturu zawsze dokladnie w punkcie koncowym
  if (torchOn) {
    writeBlock(mFormat.format(8));
    writeBlock(mFormat.format(8));
    torchOn = false;
  }
}

function onPower(power) {
  if (power) {
    if (!torchOn) {
      writeBlock(mFormat.format(7));
      torchOn = true;
    }
  } else {
    torchOff();
  }
}

function onRadiusCompensation() {
  pendingRadiusCompensation = radiusCompensation;
}

// G41/G42 tylko przy kompensacji "In control"; przy "In computer"/Center nic nie wypisuje
function flushCompensation() {
  if (pendingRadiusCompensation < 0) {
    return;
  }
  switch (pendingRadiusCompensation) {
  case RADIUS_COMPENSATION_LEFT:
    writeBlock(gFormat.format(41));
    compActive = true;
    break;
  case RADIUS_COMPENSATION_RIGHT:
    writeBlock(gFormat.format(42));
    compActive = true;
    break;
  default:
    if (compActive) {
      writeBlock(gFormat.format(40));
      compActive = false;
    }
  }
  pendingRadiusCompensation = -1;
}

function samePos(_x, _y) {
  if (lastX === undefined || lastY === undefined) {
    return false;
  }
  return !xyzFormat.areDifferent(_x, lastX) && !xyzFormat.areDifferent(_y, lastY);
}

function onRapid(_x, _y, _z) {
  if (isPunchSection) {
    return; // w sekcji punktowania ruchy robi tylko onCyclePoint (tu sa glownie odjazdy w Z)
  }
  if (samePos(_x, _y) && pendingRadiusCompensation < 0) {
    return; // tylko ruch w Z - pomijamy
  }
  flushLinear();
  if (torchOn) {
    torchOff(); // nigdy G00 z wlaczonym lukiem
  }
  flushCompensation();
  writeG00(_x, _y);
}

function onLinear(_x, _y, _z, feed) {
  if (isPunchSection) {
    error(localize("W setupie Milling obslugiwane jest tylko Drill (punktowanie plazma)."));
    return;
  }
  if (samePos(_x, _y) && pendingRadiusCompensation < 0) {
    return; // odcinek zerowej dlugosci - pomijamy
  }
  if (lastX === undefined) {
    error(localize("Brak pozycji startowej przed G01 - przerwano, zeby nie ciac od X0 Y0."));
    return;
  }
  var minSeg = getProperty("minimumSegment");
  if (torchOn && (minSeg > 0) && (pendingRadiusCompensation < 0) &&
      (Math.sqrt(Math.pow(_x - lastX, 2) + Math.pow(_y - lastY, 2)) < minSeg)) {
    pendingLinear = {x:_x, y:_y}; // za krotki - czekamy, az odleglosc od ostatniego punktu przekroczy minSeg
    return;
  }
  pendingLinear = null;
  flushCompensation();
  writeBlock(gFormat.format(1), xOutput.format(_x), yOutput.format(_y));
  lastX = _x;
  lastY = _y;
}

function onCircular(clockwise, cx, cy, cz, x, y, z, feed) {
  if (isPunchSection) {
    error(localize("W setupie Milling obslugiwane jest tylko Drill (punktowanie plazma)."));
    return;
  }
  if (getCircularPlane() != PLANE_XY) {
    linearize(tolerance);
    return;
  }
  flushLinear();
  if (lastX === undefined) {
    error(localize("Brak pozycji startowej przed lukiem - przerwano."));
    return;
  }
  if (samePos(x, y)) {
    // po zaokragleniu do 0.0001 start == koniec - F2100 wykonalby PELNY okrag
    if (Math.abs(getCircularSweep()) < Math.PI) {
      return; // mikroluk - pomijamy
    }
    error(localize("Luk ze startem rownym koncowi - przerwano."));
    return;
  }
  flushCompensation();
  var start = getCurrentPosition();
  writeBlock(
    gFormat.format(clockwise ? 2 : 3),
    xOutput.format(x), yOutput.format(y),
    iOutput.format(cx - start.x, 0), jOutput.format(cy - start.y, 0)
  );
  lastX = x;
  lastY = y;
}

function onRapid5D(_x, _y, _z, _a, _b, _c) {
  error(localize("The CNC does not support 5-axis simultaneous toolpath."));
}

function onLinear5D(_x, _y, _z, _a, _b, _c, feed) {
  error(localize("The CNC does not support 5-axis simultaneous toolpath."));
}

function onDwell(seconds) {
  flushLinear();
  seconds = clamp(0.01, seconds, 999.99);
  writeBlock(gFormat.format(4), "F" + hundredthsecFormat.format(seconds));
}

function onCycle() {
  if (!isPunchSection) {
    error(localize("Canned cycles are not supported by CNC."));
    return;
  }
  switch (cycleType) {
  case "drilling":
  case "counter-boring":
  case "chip-breaking":
  case "deep-drilling":
  case "break-through-drilling":
  case "gun-drilling":
  case "reaming":
  case "boring":
    break;
  default:
    error(localize("Punktowanie: nieobslugiwany cykl '") + cycleType + "'. Uzyj zwyklego Drill.");
  }
}

// Punktowanie pod wiercenie: G00 nad punkt -> M07 (przebicie wg czasu ze sterownika) -> [G04] -> M08
function onCyclePoint(x, y, z) {
  if (!isPunchSection) {
    return;
  }
  flushLinear();
  torchOff();
  if (!samePos(x, y)) {
    writeG00(x, y);
  }
  writeBlock(mFormat.format(7));
  torchOn = true;

  var dwell = (cycle.dwell > 0) ? cycle.dwell : getProperty("punchDwell");
  if (dwell > 0) {
    writeBlock(gFormat.format(4), "F" + hundredthsecFormat.format(clamp(0.01, dwell, 999.99)));
  }
  torchOff(); // M08 M08
}

function onCycleEnd() {
}

function onParameter(name, value) {
}

var mapCommand = {
  COMMAND_STOP         : 0,
  COMMAND_OPTIONAL_STOP: 1
};

function onCommand(command) {
  switch (command) {
  case COMMAND_POWER_ON:
  case COMMAND_POWER_OFF:
  case COMMAND_LOCK_MULTI_AXIS:
  case COMMAND_UNLOCK_MULTI_AXIS:
  case COMMAND_BREAK_CONTROL:
  case COMMAND_TOOL_MEASURE:
  case COMMAND_SPINDLE_CLOCKWISE:
  case COMMAND_SPINDLE_COUNTERCLOCKWISE:
  case COMMAND_STOP_SPINDLE:
  case COMMAND_START_SPINDLE:
  case COMMAND_COOLANT_ON:
  case COMMAND_COOLANT_OFF:
  case COMMAND_LOAD_TOOL:
    return; // wrzeciono/chlodziwo/narzedzie nie istnieja na plazmie
  }
  var mcode = mapCommand[getCommandStringId(command)];
  if (mcode != undefined) {
    writeBlock(mFormat.format(mcode));
  } else {
    onUnsupportedCommand(command);
  }
}

function onSectionEnd() {
  torchOff();
  xOutput.reset();
  yOutput.reset();
}

function onClose() {
  torchOff();
  if (compActive) {
    writeBlock(gFormat.format(40));
    compActive = false;
  }
  if (getProperty("returnToZero")) {
    writeG00(0, 0);
  }
  writeBlock(mFormat.format(2));
}

function setProperty(property, value) {
  properties[property].current = value;
}
