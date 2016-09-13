var async = require("async");
var Canvas = require("canvas");
var debug = require("debug");
debug.enable("*");
debug = debug("bbdm");
var intersection = require("intersection").intersect;
var xtend = require("xtend");
var Vector = require("victor");
var stackblur = require("stackblur-canvas");
var lsd = require("line-segment-detector");
var isNode = require("detect-node");

var $ = !isNode ? document.querySelector.bind(document) : require("cheerio").load("<html><body></body></html>");

var downSize = 400;

var Detector = require("./jsdatamatrix/src/dm_detector.js");
var BitMatrix = require("./jsdatamatrix/src/dm_bitmatrix.js");

var DEFAULT_COLOR = "rgba(0, 255, 0, 0.3)";

const STEP = 1 / 100;
const MIN_AVG = 100;
const MAX_AVG = 134;
const AVG_DEVIATION = 70;
const COLOR_THRESHOLD = 55;

var debugMode = true;
var canvasDebug = debugMode;

function Line(p1, p2) {
  this.p1 = p1 instanceof Vector ? p1 : new Vector(p1.x, p1.y);
  this.p2 = p2 instanceof Vector ? p2 : new Vector(p2.x, p2.y);
}

Line.prototype = {
  get length() {
    return this.p1.distance(this.p2);
  },

  get x1() {
    return this.p1.x;
  },

  get x2() {
    return this.p2.x;
  },

  get y1() {
    return this.p1.y;
  },

  get y2() {
    return this.p2.y;
  }
}

function cloneCanvas(oldCanvas, opts) {
  opts = (opts || {});

	//create a new canvas
	var newCanvas = new Canvas();
	var context = newCanvas.getContext('2d');

	//set dimensions
	newCanvas.width = oldCanvas.width;
	newCanvas.height = oldCanvas.height;

  if(opts.blank !== true) {
    //apply the old canvas to the new one
    if(opts.preDraw) {
      opts.preDraw(context);
    }

    context.drawImage(oldCanvas, 0, 0);

    if(opts.postDraw) {
      opts.postDraw(context);
    }
  }

	//return the new canvas
	return newCanvas;
}

var debugCanvases = [];

var debugCanvasDisplay = true;

function debugCanvas(canvas, opts) {
  if(!debugMode) return;

  var d = cloneCanvas(canvas, opts);
  d.className = "debug-canvas";

  var div = document.createElement("div");
  document.querySelector(".canvas-layers").appendChild(div);

  $(".canvas-box").appendChild(d);
  debugCanvases.push(d);

  var input = document.createElement("input");
  input.checked = (opts.display === false || debugCanvasDisplay === false) ? false : true;

  input.type = "checkbox";
  input.addEventListener("change", function(evt) {
    d.style.setProperty("display", evt.target.checked ? "block" : "none");
  });
  d.style.setProperty("display", input.checked ? "block" : "none");

  div.appendChild(input);

  if(opts.name) {
    var label = document.createElement("label");
    label.textContent = opts.name;
    div.appendChild(label);
  }

  if(opts.halt) {
    debugCanvasDisplay = false;
  }

  return d.getContext("2d");
}

function traverseLine(p1, p2, opts, cb, done) {
  if(typeof opts === "function") {
    done = cb;
    cb = opts;
    opts = {
    };
  }

  if(!opts.step) opts.step = STEP;

  var dist = pointDist(p1, p2);
  var vx = p2.x - p1.x;
  var vy = p2.y - p1.y;

  var len = dist / opts.step;
  for(var i = 0, broke = false; !broke && i < dist; i += opts.step) {
    var d = i / dist;
    var x = p1.x + (d * vx);
    var y = p1.y + (d * vy);

    cb.call({
      break: function() {
        broke = true;
      }
    }, x, y, d, len);
  }

  done && done();
}

function randomColor() {
  return "#" + Math.round(Math.random() * 0xffffff).toString(16);
}

function sampleToColor(sample) {
  return "#" + [ sample.toString(16), sample.toString(16), sample.toString(16) ].join("");
}

function drawLine(ctx, x1, y1, x2, y2, width, color) {
  if(!debugMode) return;

  if(typeof x1 === "object") {
    if(typeof y1 === "object") {
      // received two point objects
      color = y2;
      width = x2;
      y2 = y1.y;
      x2 = y1.x;
      y1 = x1.y;
      x1 = x1.x;
    } else { 
      // received line object
      color = x1.color;
      width = x1.width;
      y2 = x1.y2;
      x2 = x1.x2;
      y1 = x1.y1;
      x1 = x1.x1;
    }
  }
  //    debug("Drawing:", x1, y1, x2, y2, width, color);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = width;
  ctx.strokeStyle = color || DEFAULT_COLOR;
  ctx.stroke();
}

function drawPixel(ctx, x, y, color, dim) {
  if(!debugMode) return;

  dim = dim || 2;
  x -= dim / 2;
  y -= dim / 2;
  ctx.fillStyle = color || DEFAULT_COLOR;
  ctx.fillRect(x, y, dim, dim); 
}

function drawText(ctx, x, y, str, color) {
  if(!debugMode) return;

  ctx.save();
  ctx.fillStyle = color || DEFAULT_COLOR;
  ctx.fillText(str, x, y);
  ctx.fill();
  ctx.restore();
}

function drawImageTo(img, ctx, downSize) {
  if(img.width > img.height) {
    var newHeight = downSize * img.height / img.width;
    ctx.drawImage(img, 0, Math.round((downSize - newHeight) / 2), downSize, newHeight);
  } else {
    var newWidth = downSize * img.width / img.height;
    ctx.drawImage(img, Math.round((downSize - newWidth) / 2), 0, newWidth, downSize);
  }

}

function detectLines(stack) {
  var canvas = cloneCanvas(stack.ctx.canvas);
  var ctx = canvas.getContext("2d");

  stackblur.canvasRGBA(canvas, 0, 0, downSize, downSize, blur);

  var bm = new BitMatrix(canvas, {grayscale: true});
  bm.brightnessAndContrast(80, 150);

  bm.drawImage(ctx);

  var lines = lsd.lsd(bm.bits, bm.width, bm.height);

  var i, line;
  for(i=0; i < lines.length; i++) {
    line = lines[i];
    line.p1 = new Vector(line.x1, line.y1);
    line.p2 = new Vector(line.x2, line.y2);
  }

  return {lines: lines, bitmatrix: bm, canvas: canvas};
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function pointDist(p1, p2) {
  return dist(p1.x, p1.y, p2.x, p2.y);
}

function lineLength(line) {
  return dist(line.x1, line.y1, line.x2, line.y2);
}

function lineAngle(line) {
  line.dx = line.x2 - line.x1;
  line.dy = line.y2 - line.y1;
  line.angle = Math.atan(line.dy / line.dx);

  return line.angle;
}


// returns the smallest angle between two lines
function smallestAngleBetween(finderA, finderB) {
  finderA.angle = lineAngle(finderA);
  finderB.angle = lineAngle(finderB);

  var diff = Math.abs(finderB.angle - finderA.angle);

  if(diff > Math.PI) {
    diff = diff - Math.PI;
  }

  return diff;
}


// find the datamatrix L shape from the lines detected by LSD
function findL(lines, opts) {
  var d = debugCanvas(opts.ctx.canvas, {
    blank: true,
    display: false,
    name: "findL"
  });

  var minLen = 40;
  var maxDist = 5;
  var maxLineDiff = 10;
  var r = [];
  
  function validateAngle(finderA, finderB) {
    var originDist = finderA.origin.distance(finderB.origin);

    if(originDist < maxDist) {
      //drawLine(d, finderA.p1, finderB.p1, 1, "pink");
      //drawLine(d, finderA.p1, finderB.p2, 2, "pink");
      //drawLine(d, finderB.p1, finderA.p1, 1, "pink");
      drawLine(d, finderB.p1, finderB.p2, 3, "rgba(255, 0, 0, 0.5)");
      drawLine(d, finderA.p1, finderA.p2, 3, "rgba(0, 0, 255, 0.5)");

      var relAngle = smallestAngleBetween(finderA, finderB);

      if(relAngle > 1.4 && relAngle < 1.6) {
        drawLine(d, finderB.remote, finderA.remote, 1, "pink");
        return true;
      }
    }

    return false;
  }

  for(var i = 0; i < lines.length; i++) {
    var finderA = lines[i];
    var lenA = finderA.p1.distance(finderA.p2);
    finderA.length = lenA;

    // try to discard this earlier
    if(lenA < minLen) continue;

    for(var j = 0; j < lines.length; j++) {
      var finderB = lines[j];
      if(j === i) continue;
      if(finderA === finderB) continue;

      if(finderA === finderB) continue;
      if(
          finderA.p1.x === finderB.p1.x ||
          finderA.p1.y === finderB.p1.y ||
          finderA.p2.x === finderB.p2.x ||
          finderA.p2.y === finderB.p2.y
        ) continue;

      var lenB = finderB.p1.distance(finderB.p2);
      finderB.length = lenB;

      // try to discard this earlier
      if(lenB < minLen) continue;

      if(Math.abs(finderA.length - finderB.length) > maxLineDiff) continue;

      setEndPoints(finderA, finderB);

      if(validateAngle(finderA, finderB)) {
        r.push({
          finderA: finderA,
          finderB: finderB
        });
      }
    }
  }

  return r;
}

function averagePoints(p1, p2) {
  return new Vector((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
}

function setEndPoints(finderA, finderB) {
  var pairs = ([
    [ finderA.p1, finderB.p1 ],
    [ finderA.p1, finderB.p2 ],
    [ finderA.p2, finderB.p1 ],
    [ finderA.p2, finderB.p2 ]
  ]).sort(function(a, b) {
    a[2] = a[0].distance(a[1]);
    b[2] = b[0].distance(b[1]);
    return a[2] > b[2];
  });

  // origin points based on closest in caparative lines
  var averageOrigin = averagePoints(pairs[0][0], pairs[0][1]);

  finderA.origin = pairs[0][0];
  finderB.origin = pairs[0][1];

  finderA.remote = (finderA.origin === finderA.p1) ? finderA.p2 : finderA.p1;
  finderB.remote = (finderB.origin === finderB.p1) ? finderB.p2 : finderB.p1;
}

// difference between two points
function pointDiff(p1, p2) {
  return {x: p2.x - p1.x, y: p2.y - p1.y};
}

// add one point to another 
function pointAdd(p1, p2) {
  return {x: p1.x + p2.x, y: p1.y + p2.y};
}

// subtract one point to another 
function pointSub(p1, p2) {
  return {x: p1.x - p2.x, y: p1.y - p2.y};
}

// Sample a few pixels (currently 3x3) to determine the color
// of one of the black or white squares or "pixels" that make up the qr code.
// Takes as input:
// * a bitmatrix of the image
// * an x,y position of the center of the square
// * the average pixel value of the general area being sampled
// Returns the average of the sampled pixels
function getSquareColor(drawCtx, bm, x, y) {
  var avg = 0;

  // ToDo change to center-weighted

  avg += bm.get(x, y);
  avg += bm.get(x+1, y);
  avg += bm.get(x, y+1);
  avg += bm.get(x-1, y);
  avg += bm.get(x, y-1);
  avg += bm.get(x+1, y+1);
  avg += bm.get(x+1, y-1);
  avg += bm.get(x-1, y+1);
  avg += bm.get(x-1, y-1);

  avg = avg / 9;
  return avg;
}

// Move a point a specified distance
// along the direction of a line
// The distance is specified as a ratio of the length of the line.
function moveAlong(point, dist, lineP1, lineP2) {
  var dy = lineP2.y - lineP1.y;
  var dx = lineP2.x - lineP1.x;

  point.y += dist * dy;
  point.x += dist * dx;

  return point;
}

function toGrayscale(imageData, method) {
	var grayscale = new Array(imageData.width * imageData.height);

	var data = imageData.data;
	var gi, red, green, blue, alpha, lightness, average, luminosity;

	for(var i = 0; i < data.length; i += 4) {
    gi = i / 4;
    red = data[i];
    green = data[i + 1];
    blue = data[i + 2];
    alpha = data[i + 3] / 255;

    var rgb = [ red, green, blue ];

    lightness = Math.round((Math.max.apply(null, rgb) + Math.min.apply(null, rgb)) / 2);
    average = Math.round((green + green + blue) / 3);
    luminosity = Math.round(0.21 * red + 0.72 * green + 0.07 * blue);

    grayscale[gi] = method === 0 ? lightness : method === 1 ? average : luminosity;
  }

	return grayscale;
};

function getLineAverage(ctx, p1, p2, d) {
	var grayscale = ctx instanceof CanvasRenderingContext2D ? toGrayscale(ctx.getImageData(0, 0, ctx.canvas.height, ctx.canvas.width)) : ctx;

	var diffX = p2.x - p1.x;
	var diffY = p2.y - p1.y;

	var diff = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2));

	var i = 0;
	var average = 0;
	var sum = 0;
	var x = 0;
	var y = 0;
  var count = -1; // initial switch sets to zero
  var bit = -1;

  var thresh = 0;

	while(i++ < diff) {
		x = Math.round(p1.x + (i / diff)  * diffX) - 1;
		y = Math.round(p1.y + (i / diff)  * diffY) - 1;

    bit = grayscale[y * ctx.canvas.width + x];

		sum += Math.round(bit);
	}

	average = Math.round(sum / diff);

	return {
    average: average,
    count: count
  };
}

// check if this is actually a dotted line
// by sampling along the line
//
// *NOT TRUE \/* This only check IF it"s dotted
// and return corrected line that is closer
// to running through the middle of squares
function verifyDottedLine(drawCtx, bm, p1, p2) {
  console.error("this shouldn't happen. verifyDottedLine");
  var average = getLineAverage(drawCtx, p1, p2);
  //debug("Line average: %s", average);

  if(average < 110)
    return true;

  return false;
}

// find the outer edge of the dotted line
function findDottedLineCenter(drawCtx, bm, p1Orig, p2Orig, lineP1, lineP2) {
  var line;
  var p1 = new Vector(p1Orig.x, p1Orig.y);
  var p2 = new Vector(p2Orig.x, p2Orig.y);

  var validStart = [];
  var validEnd = [];

  // 1/96 is one 1/8th of a square "pixel" in the pattern
  // since a line is 12 squares long
  var stepSize = 1/96;

  // We"re starting with a line that"s probably at the edge of the dotted lines.
  // Now we"ll slide that line back and forth along the axis of 
  // the other dotted line and log where alternating dot patter begins and ends.
  // This will allow us to find the center of the dotted line.

  p1 = moveAlong(p1, -stepSize*10, lineP1, lineP2);
  p2 = moveAlong(p2, -stepSize*10, lineP1, lineP2);    

  for(var i=0; i < 28; i++) {
    p1 = moveAlong(p1, stepSize, lineP1, lineP2);
    p2 = moveAlong(p2, stepSize, lineP1, lineP2);

    line = verifyDottedLine(drawCtx, bm, p1, p2);
    if(line) {
      if(validStart.length === 0) {
        validStart = [{
          x: p1.x,
          y: p1.y
        }, {
          x: p2.x,
          y: p2.y
        }];
      } else {
        validEnd = [{
          x: p1.x,
          y: p1.y
        }, {
          x: p2.x,
          y: p2.y
        }];

        break;
      }
    }
  }
  
  if(validStart.length === 0 || validEnd.length === 0) {
    console.log("Edges not found");
    return;
  }
  console.log(validStart, validEnd);

  var startX = validStart[0].x;
  var startY = validStart[0].y;

  var endX = validStart[1].x - ((validEnd[0].y - validStart[0].y));
  var endY = validStart[1].y - ((validEnd[0].x - validStart[0].x));

  return {
    p1: new Vector(startX, startY),
    p2: new Vector(endX, endY)
  }
}


function findDottedLines(bm, drawCtx, finderA, finderB, opts) {
  var diff, p1, p2, avg;
  var out = {};

  diff = pointDiff(finderA.p1, finderB.p2);
  p1 = pointAdd(finderA.p2, diff);
  p2 = pointSub(finderB.p2, diff);
  diff = pointDiff(finderA.p1, finderA.p2);
  p2 = pointAdd(p2, diff);

  out.finderA = findDottedLineCenter(drawCtx, bm, p1, p2, finderA.origin, finderA.remote);

  if(!out.finderA) {
    console.log("Didn't find dotted line center");
    return;
  }

  if(!out.finderA) {
    console.log("Failed to find dotted line center.");
    return false;
  }

  diff = pointDiff(finderA.origin, finderB.origin);
  p1 = pointAdd(finderB.remote, diff);
  p2 = pointAdd(finderA.remote, diff);
  diff = pointDiff(finderB.origin, finderB.remote);
  p2 = pointAdd(p2, diff);
  out.finderB = {
    p1: new Vector(p1.x, p1.y),
    p2: new Vector(p2.x, p2.y)
  };

  out.finderB = findDottedLineCenter(drawCtx, bm, p1, p2, finderB.origin, finderB.remote);

  return out;
}

function drawDetectionLines(ctx, lines) {
  lines.forEach(function(line) {
    drawLine(ctx, line.p1, line.p2, 1, "green");
  });
}

function findTimingLines(binaryArray, timingA, timingB, d) {
  var a = lineAngle(timingA);
  var len = timingA.length;
  var offset = 0;

  var outerAvg = -1;
  var outerTiming;
  var innerTiming;

  if(a < 0) a = -a;

  traverseLine(timingB.p2, timingB.p1, function(x, y, i) {
    // this needs to be smarter
    // it should determine if A is + or - of B
    var findSideX = x - Math.cos(a) * len;
    var findSideY = y - Math.sin(a) * len;

    var lineAvg = getLineAverage(binaryArray, {
      x: x,
      y: y
    }, {
      x: findSideX,
      y: findSideY
    }, d);

    var avg = lineAvg.average;

    if(!outerTiming && avg > MIN_AVG && avg < MAX_AVG) {
      outerAvg = avg;
      outerTiming = new Line({
        x: x,
        y: y
      }, {
        x: findSideX,
        y: findSideY
      });

    } else if(outerTiming && Math.abs(outerAvg - avg) > AVG_DEVIATION) {
      innerTiming = new Line({
        x: x,
        y: y
      }, {
        x: findSideX,
        y: findSideY
      });

      return this.break();
    }
  });

  return {
    distance: innerTiming.p1.distance(outerTiming.p1),
    innerTiming: innerTiming,
    outerTiming: outerTiming
  };
}

function detectBit(binaryArray, x, y) {

}

function run(image, canvas, opts, cb) {
  if(typeof opts === "function") {
    cb = opts;
    opts = {};
  }

  debugMode = opts.debug === true;

  async.waterfall([function(done) {
    console.log("Setting up stack");

    var ctx = canvas.getContext("2d");

    var stack = {
      canvas: canvas,
      ctx: ctx,
      grayscale: toGrayscale(ctx.getImageData(0, 0, ctx.canvas.height, ctx.canvas.width)),
      img: image,
      start: (new Date).valueOf()
    }

    drawImageTo(stack.img, stack.ctx, downSize);

    done(null, stack);
  }, function(stack, done) {
    // Cycle through blur levels until LSD finds
    // candidate lines
    for(blur=4; blur <= 4; blur+=2) {
      var lineDetect = detectLines(stack);

      debugCanvas(lineDetect.canvas, {
        display: false,
        name: "Blur: " + blur
      });

      var d = debugCanvas(stack.ctx.canvas, {
        blank: true,
        name: "Detect Lines (blur: " + blur + ")"
      });

      drawDetectionLines(d, lineDetect.lines);

      var candidates = findL(lineDetect.lines, stack);
      if(candidates.length > 0) {
        console.log("Found candidates at %s blur level", blur);

        stack.bitmatrix = lineDetect.bm;
        stack.blur = lineDetect.canvas;

        var blurCtx = stack.blur.getContext("2d")
        stack.blurCtx = blurCtx;
        stack.blurGrayscale = toGrayscale(blurCtx.getImageData(0, 0, blurCtx.canvas.height, blurCtx.canvas.width));
        stack.blurGrayscale.canvas = lineDetect.canvas;

        stack.candidates = candidates;

        return done(null, stack);
      }
    }

    done(new Error("No Canidates Found"));
  }, function(stack, done) {
    // Cycle through the candidate pairs finding their
    // nearest points and average those together.
    // TODO: Split function into generation and debugging
    // *OLD NOTE*
    // by this point candidates should be pairs,
    // this will fix some issues around double
    // processing. This will also help ensure
    // finderA is across from timingA, B/B, etc.
    var d = debugCanvas(stack.blur, {
      blank: true,
      name: "Candidates " + stack.candidates.length
    });

    // From here each set of candidates should be tested
    // this can be accomplished by taking the rest of
    // the waterfall and moving it into an async.Queue
    // XXX: Use Queue to process each candidate.
    for(var i = 0; i < stack.candidates.length; i++) {
      var finderA = stack.candidates[i].finderA;
      var finderB = stack.candidates[i].finderB;

      if(finderA === finderB) continue;

      var averageOrigin = averagePoints(finderA.origin, finderB.origin);
      finderA.origin = finderB.origin = averageOrigin;

      drawLine(d, finderA.origin, finderA.remote, 1, "red");
      drawLine(d, finderB.origin, finderB.remote, 1, "red");

      drawText(d,
          (finderA.p1.x + finderA.p2.x) / 2,
          (finderA.p1.y + finderA.p2.y) / 2,
          "A", "red"
          );

      drawText(d,
          (finderB.p1.x + finderB.p2.x) / 2,
          (finderB.p1.y + finderB.p2.y) / 2,
          "B", "red"
          );
    }

    done(null, stack);
  }, function(stack, done) {
    // Determine the Far Corner by finder to points.
    // Each point is at the angle its opposite Finder
    // along the average length of the Finders.
    // The points are then averaged to create
    // the Far Corner.
    // TODO: Split function into generation and debugging
    var d = debugCanvas(stack.blur, {
      blank: true,
      name: "Far Corner"
    });

    var candidate = stack.candidates[0];
    var finderA = candidate.finderA;
    var finderB = candidate.finderB;
    var remoteA = finderA.remote;
    var remoteB = finderB.remote;

    drawPixel(d, remoteA.x, remoteA.y, "pink", 1);
    drawPixel(d, remoteB.x, remoteB.y, "pink", 1);

    // this can be improved by finding the point
    // at (finderAdeg + finderBdeg) / 2
    // len finderA.remote <> finderB.remote
    // and averaging it with xc/yc
    var len = (finderB.length + finderA.length) / 2;
    var aA = lineAngle(finderA);
    var aB = lineAngle(finderB);

    var ax = Math.cos(aA) * finderB.length + remoteB.x;
    var ay = Math.sin(aA) * finderB.length + remoteB.y;
    var bx = Math.cos(aB) * finderA.length + remoteA.x;
    var by = Math.sin(aB) * finderA.length + remoteA.y;

    var x = (ax + bx) / 2;
    var y = (ay + by) / 2;

    drawPixel(d, ax, ay, "pink", 1);
    drawPixel(d, bx, by, "pink", 1);
    drawPixel(d, x, y, "pink", 1);

    stack.farCorner = new Vector(x, y);

    done(null, stack);
  }, function(stack, done) {
    // Create square outline based on the
    // Finders and the Far Corner
    // XXX: fix candidates[0] usage
    var candidate = stack.candidates[0];

    stack.square = [ candidate.finderA.origin, candidate.finderA.remote, stack.farCorner, candidate.finderB.remote ];

    done(null, stack);
  }, function(stack, done) {
    // Create Timing Lines based on the
    // remote Finder Line and the Far Corner
    // XXX: fix candidates[0] usage
    var candidate = stack.candidates[0];

    stack.timingA = new Line(candidate.finderB.remote, stack.farCorner);
    stack.timingB = new Line(candidate.finderA.remote, stack.farCorner);

    done(null, stack);
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      blank: true,
      name: "Timing Lines"
    });

    drawLine(d, stack.timingA.p1, stack.timingA.p2, 1, "orange");
    drawLine(d, stack.timingB.p1, stack.timingB.p2, 1, "orange");
    drawText(d,
        (stack.timingA.p1.x + stack.timingA.p2.x) / 2,
        (stack.timingA.p1.y + stack.timingA.p2.y) / 2,
        "A", "orange"
    );

    drawText(d,
        (stack.timingB.p1.x + stack.timingB.p2.x) / 2,
        (stack.timingB.p1.y + stack.timingB.p2.y) / 2,
        "B", "orange"
    );

    done(null, stack);
  }, function(stack, done) {
    // create a binary from the original
    // scan through the imageData averaging
    // each pixel like (R+G+B)/3
    // it is set white if below COLOR_THRESHOLD
    // TODO: Split function into generation/debugging

    var d = debugCanvas(stack.canvas, {
      blank: true,
      display: false,
      name: "Binary"
    });

    var binCanvas = cloneCanvas(stack.canvas);
    var binCtx = binCanvas.getContext("2d");
    var canvas = stack.canvas;
    var data = stack.ctx.getImageData(0, 0, canvas.height, canvas.width).data;

    var gi, red, green, blue, alpha;

    stack.bin = [];

    for(var i = 0; i < data.length; i += 4) {
      gi = i / 4;
      red = data[i];
      green = data[i + 1];
      blue = data[i + 2];
      alpha = data[i + 3] / 255;

      var bit = ((red + green + blue) / 3) < COLOR_THRESHOLD ? 255 : 0;
      var x = gi % canvas.width;
      var y = Math.floor(gi / canvas.width);

      drawPixel(binCtx, x, y, bit ? "black" : "white");
      drawPixel(d, x, y, bit ? "black" : "white");
      stack.bin.push(bit);
    }

    stack.binary = binCanvas;
    stack.binaryImageData = binCtx.getImageData(0, 0, binCanvas.width, binCanvas.height);
    stack.binaryArray = toGrayscale(stack.binaryImageData);
    stack.binaryArray.canvas = stack.binary;

    done(null, stack);
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      display: false,
      blank: true,
      name: "Verify Timing A"
    });

    var timingLines = findTimingLines(stack.binaryArray, stack.timingA, stack.timingB, d);
    if(timingLines.innerTiming)
      drawLine(d, timingLines.innerTiming.p1, timingLines.innerTiming.p2, 1, "purple");

    if(timingLines.outerTiming)
      drawLine(d, timingLines.outerTiming.p1, timingLines.outerTiming.p2, 1, "purple");

    stack.innerTimingA = timingLines.innerTiming;
    stack.outerTimingA = timingLines.outerTiming;

    done(null, stack);
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      display: false,
      blank: true,
      name: "Verify Timing B"
    });

    var timingLines = findTimingLines(stack.binaryArray, stack.timingB, stack.timingA, d);
    if(timingLines.innerTiming)
      drawLine(d, timingLines.innerTiming.p1, timingLines.innerTiming.p2, 1, "purple");

    if(timingLines.outerTiming)
      drawLine(d, timingLines.outerTiming.p1, timingLines.outerTiming.p2, 1, "purple");

    stack.innerTimingB = timingLines.innerTiming;
    stack.outerTimingB = timingLines.outerTiming;

    done(null, stack);
  }, function(stack, done) {
    // Find the center of each timing line
    // by averaging the x/y of each endpoint
    stack.timingCenterA = new Line({
      x: (stack.innerTimingA.p1.x + stack.outerTimingA.p1.x) / 2,
      y: (stack.innerTimingA.p1.y + stack.outerTimingA.p1.y) / 2
    }, {
      x: (stack.innerTimingA.p2.x + stack.outerTimingA.p2.x) / 2,
      y: (stack.innerTimingA.p2.y + stack.outerTimingA.p2.y) / 2
    });

    stack.timingCenterB = new Line({
      x: (stack.innerTimingB.p1.x + stack.outerTimingB.p1.x) / 2,
      y: (stack.innerTimingB.p1.y + stack.outerTimingB.p1.y) / 2
    }, {
      x: (stack.innerTimingB.p2.x + stack.outerTimingB.p2.x) / 2,
      y: (stack.innerTimingB.p2.y + stack.outerTimingB.p2.y) / 2
    });

    done(null, stack);
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      display: false,
      blank: true,
      name: "Timing B Center"
    });

    drawLine(d, stack.timingCenterB.p1, stack.timingCenterB.p2, 1, "yellow");

    done(null, stack);
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      display: false,
      blank: true,
      name: "Timing A Center"
    });

    drawLine(d, stack.timingCenterA.p1, stack.timingCenterA.p2, 1, "yellow");

    done(null, stack);
  }, function(stack, done) {
    var grayscale = stack.binaryArray;
    var width = stack.blur.width;

    function getLineCount(p1, p2, debug) {
      var lastBit = -1;
      var r = {
        count: 0,
        points: []
      };

      if(debug) {
        var d = debugCanvas(stack.blur, {
          display: false,
          blank: true,
          name: "Count"
        });
      }

      traverseLine(p1, p2, {
        step: 1
      }, function(x, y) {
        x = Math.round(x);
        y = Math.round(y);

        let bit = grayscale[y * width + x];

        drawPixel(d, x, y, bit === 0 ? "red" : "blue", 1);

        if(bit !== lastBit) {
          r.points.push(new Vector(x, y));

          r.count++;
        }

        lastBit = bit;
      });

      return r;
    }

    stack.timingCountA = getLineCount(stack.timingCenterA.p1, stack.timingCenterA.p2, true);
    stack.timingCountB = getLineCount(stack.timingCenterB.p1, stack.timingCenterB.p2, true);

    done(null, stack);
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      display: false,
      blank: true,
      name: "Timing A Count"
    });

    drawText(d, stack.timingA.p1.x, stack.timingA.p1.y, stack.timingCountA.count, "yellow");

    done(null, stack);
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      display: false,
      blank: true,
      name: "Timing B Count"
    });

    drawText(d, stack.timingB.p1.x, stack.timingB.p1.y, stack.timingCountB.count, "yellow");

    done(null, stack);
  }, function(stack, done) {
    stack.timingIntersect = intersection({
      start: stack.timingCenterA.p1,
      end: stack.timingCenterA.p2
    }, {
      start: stack.timingCenterB.p1,
      end: stack.timingCenterB.p2
    });

    done(null, stack);
  }, function(stack, done) {
    // XXX: fix candidates[0] usage (AKA, create Queue)
    var d = debugCanvas(stack.blur, {
      blank: true,
      name: "Grid"
    });

    drawPixel(d, stack.timingIntersect.x, stack.timingIntersect.y, "red", 1);

    var timingCountA = stack.timingCountA;
    var timingCountB = stack.timingCountB;

    var bitLenA = (stack.timingCenterA.length / timingCountA);
    var bitLenB = (stack.timingCenterB.length / timingCountB);
    var angleA = lineAngle(stack.timingCenterA);
    var angleB = lineAngle(stack.timingCenterB);
    var finderA = stack.candidates[0].finderA;
    var finderB = stack.candidates[0].finderB;

    var timingIntersect = stack.timingIntersect;

    var F = 1;
    var start = {
      x: timingIntersect.x - Math.cos(angleA) * (bitLenA * F),
      y: timingIntersect.y - Math.sin(angleB) * (bitLenB * F)
    };

    var end = {
      x: timingIntersect.x - Math.cos(angleA) * (bitLenA * (stack.timingCountA - 2)),
      y: timingIntersect.y - Math.sin(angleB) * (bitLenB * F)
    };

    var divisor = 4;
    var len = Math.floor(timingCountA.count * timingCountB.count);
    var pointsA = timingCountA.points;
    var pointsB = timingCountB.points;

    var bits = [];
    var grayscale = stack.binaryArray;
    var width = stack.blur.width;

    for(var i = 0; i < len - 1; i++) {
      var mod = i % timingCountA.count;
      var div = Math.floor(i / timingCountB.count);

      if(!bits[mod]) bits[mod] = [];

      if(mod === 11 || div === 11) {
        bits[mod].push(1);
        continue;
      }

      let pA = pointsA[mod];
      let pB = pointsB[div];
      let nA = pointsA[mod + 1];
      let nB = pointsB[div + 1];
      var lenA = pA.distance(nA) * 0.5;
      var lenB = pB.distance(nB) * 0.5;
      if(mod === 0) {
        lenA += 2;
        lenB += 2;
      }

      let x = Math.round(pA.x - Math.cos(angleA) * (lenA / 2));
      let y = Math.round(pB.y - Math.sin(angleB) * (lenB / 2));

      let bitIndex = y * width + x;
      let bit = stack.binaryArray[bitIndex];
      bits[mod].push(bit === 0 ? 0 : 1);

      drawPixel(d, x, y, bit === 0?"red":"blue", 1);
    };

    // fill in last bit
    bits[bits.length - 1].push(1);

    stack.bits = bits;

    drawPixel(d, start.x, start.y, "green", 1);
    drawPixel(d, end.x, end.y, "red", 1);

    done(null, stack);
  }], function(err, stack) {
    if(debugMode) {
      var time = (new Date()).valueOf() - stack.start;
      console.log("Done! Took %s seconds", time / 1000);
    }

    cb(err, stack.bits);
  });
}


module.exports = run;
