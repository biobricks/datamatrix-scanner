var async = require("async");
var debug = require("debug");
debug.enable("*");
debug = debug("bbdm");
var intersection = require("intersection").intersect;
var xtend = require("xtend");
var Vector = require("victor");

var $ = document.querySelector.bind(document);

//var lsd = require("./line-segment-detector/index.js");
var lsd = Module;

var Detector = require("./jsdatamatrix/src/dm_detector.js");
var BitMatrix = require("./jsdatamatrix/src/dm_bitmatrix.js");

var DEFAULT_COLOR = "rgba(0, 255, 0, 0.3)";

const STEP = 1 / 100;

function cloneCanvas(oldCanvas, blank) {
	//create a new canvas
	var newCanvas = document.createElement('canvas');
	var context = newCanvas.getContext('2d');

	//set dimensions
	newCanvas.width = oldCanvas.width;
	newCanvas.height = oldCanvas.height;

  if(blank !== true) {
    //apply the old canvas to the new one
    context.drawImage(oldCanvas, 0, 0);
  }

	//return the new canvas
	return newCanvas;
}

var debugCanvases = [];

function debugCanvas(canvas, opts) {
  var d = cloneCanvas(canvas, opts.blank);
  d.className = "debug-canvas";

  var div = document.createElement("div");
  document.querySelector(".canvas-layers").appendChild(div);

  $(".canvas-box").appendChild(d);
  debugCanvases.push(d);

  var input = document.createElement("input");
  input.checked = opts.display === false ? false : true;

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

  for(var i = 0; i < dist; i += opts.step) {
    var d = i / dist;
    var x = p1.x + (d * vx);
    var y = p1.y + (d * vy);

    cb(x,y, d);
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
  dim = dim || 2;
  ctx.fillStyle = color || DEFAULT_COLOR;
  ctx.fillRect(x, y, dim, dim); 
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

  var downSize = 400;

  stackBlurCanvasRGBA(canvas, 0, 0, downSize, downSize, blur);

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

function minEndPointDistance(lineA, lineB) {
  var val;
  var min = 1000000;

  val = pointDist(lineA.p1, lineB.p1);
  if(val < min) {
    min = val;
    lineA.origin = lineA.p1;
    lineA.remote = lineA.p2;
    lineB.origin = lineA.p1;
    lineB.remote = lineA.p2;
  }
  val = pointDist(lineA.p1, lineB.p2);
  if(val < min) {
    min = val;
    lineA.origin = lineA.p1;
    lineA.remote = lineA.p2;
    lineB.origin = lineB.p2;
    lineB.remote = lineB.p1;
  }
  val = pointDist(lineA.p2, lineB.p2);
  if(val < min) {
    min = val;
    lineA.origin = lineA.p2;
    lineA.remote = lineA.p1;
    lineB.origin = lineB.p2;
    lineB.remote = lineB.p1;
  }
  val = pointDist(lineA.p2, lineB.p1);
  if(val < min) {
    min = val;
    lineA.origin = lineA.p2;
    lineA.remote = lineA.p1;
    lineB.origin = lineB.p1;
    lineB.remote = lineB.p2;
  }
  return min;
}

function lineAngle(line) {
  line.dy = line.y2 - line.y1;
  line.dx = line.x2 - line.x1;
  if(line.dx == 0) {
    line.angle = Math.PI * 1/4;
  } else {
    line.angle = Math.atan(line.dy / line.dx);
  }
  if(line.angle < 0) {
    return Math.abs(line.angle) + Math.PI * 1/4;
  }

  return line.angle;
}


// returns the smallest angle between two lines
function smallestAngleBetween(lineA, lineB) {
  lineA.angle = lineAngle(lineA);
  lineB.angle = lineAngle(lineB);

  var diff = Math.abs(lineB.angle - lineA.angle);

  if(diff > Math.PI) {
    diff = diff - Math.PI;
  }

  return diff;
}


// find the datamatrix L shape from the lines detected by LSD
function findL(lines, opts) {
  var d = debugCanvas(opts.ctx.canvas, {
    blank: true,
    name: "findL"
  });

  var minLen = 40;
  var maxDist = 5;
  var r = [];
  
  function validateAngle(lineA, lineB) {
    var originDist = lineA.origin.distance(lineB.origin);

    if(originDist < maxDist) {
      //drawLine(d, lineA.p1, lineB.p1, 1, "pink");
      //drawLine(d, lineA.p1, lineB.p2, 2, "pink");
      //drawLine(d, lineB.p1, lineA.p1, 1, "pink");
      drawLine(d, lineB.p1, lineB.p2, 3, "rgba(255, 0, 0, 0.5)");
      drawLine(d, lineA.p1, lineA.p2, 3, "rgba(0, 0, 255, 0.5)");

      var relAngle = smallestAngleBetween(lineA, lineB);

      if(relAngle > 1.4 && relAngle < 1.6) {
        drawLine(d, lineB.remote, lineA.remote, 1, "pink");
        return true;
      }
    }

    return false;
  }

  for(var i = 0; i < lines.length; i++) {
    var lineA = lines[i];
    var lenA = lineA.p1.distance(lineA.p2);
    lineA.length = lenA;

    // try to discard this earlier
    if(lenA < minLen) continue;

    for(var j = 0; j < lines.length; j++) {
      var lineB = lines[j];

      if(lineA === lineB) continue;
      if(
          lineA.p1.x === lineB.p1.x ||
          lineA.p1.y === lineB.p1.y ||
          lineA.p2.x === lineB.p2.x ||
          lineA.p2.y === lineB.p2.y
        ) continue;

      var lenB = lineB.p1.distance(lineB.p2);
      lineB.length = lenB;

      // try to discard this earlier
      if(lenB < minLen) continue;

      setEndPoints(lineA, lineB);

      drawPixel(d, lineA.origin.x + (Math.random() * 5), lineA.origin.y + (Math.random() * 5), "rgba(0,255,0,0.5)", 5);
      drawPixel(d, lineA.remote.x, lineA.remote.y, "rgba(255,255,0,0.5)", 5);

      if(validateAngle(lineA, lineB)) {
        r.push({
          lineA: lineA,
          lineB: lineB
        });
      }
    }
  }

  return r;
}

function setEndPoints(lineA, lineB) {
  var pairs = ([
    [ lineA.p1, lineB.p1 ],
    [ lineA.p1, lineB.p2 ],
    [ lineA.p2, lineB.p1 ],
    [ lineA.p2, lineB.p2 ]
  ]).sort(function(a, b) {
    a[2] = a[0].distance(a[1]);
    b[2] = b[0].distance(b[1]);
    return a[2] > b[2];
  });

  // origin points based on closest in caparative lines
  lineA.origin = pairs[0][0];
  lineB.origin = pairs[0][1];

  lineA.remote = lineA.origin === lineA.p1 ? lineA.p2 : lineA.p1;
  lineB.remote = lineB.origin === lineB.p1 ? lineB.p2 : lineB.p1;
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
  //debug("toGrayscale(" + [ imageData.width, imageData.height ] + ") " + imageData.data.length);
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

function getLineAverage(ctx, p1, p2) {
	var grayscale = toGrayscale(ctx.getImageData(0, 0, ctx.canvas.height, ctx.canvas.width));

	var diffX = p2.x - p1.x;
	var diffY = p2.y - p1.y;

	var diff = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2));

	var i = 0;
	var average = 0;
	var sum = 0;
	var x = 0;
	var y = 0;
  var counts = {};

	while(i++ < diff) {
		x = Math.round(p1.x + (i / diff)  * diffX) - 1;
		y = Math.round(p1.y + (i / diff)  * diffY) - 1;

		sum += Math.round(grayscale[y * ctx.canvas.width + x]);
	}

	average = Math.round(sum / diff);

	return average;
}

// check if this is actually a dotted line
// by sampling along the line
//
// *NOT TRUE \/* This only check IF it"s dotted
// and return corrected line that is closer
// to running through the middle of squares
function verifyDottedLine(drawCtx, bm, p1, p2) {
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
    debug("Edges not found");
    return;
  }
  debug(validStart, validEnd);

  var startX = validStart[0].x;
  var startY = validStart[0].y;

  var endX = validStart[1].x - ((validEnd[0].y - validStart[0].y));
  var endY = validStart[1].y - ((validEnd[0].x - validStart[0].x));

  return {
    p1: new Vector(startX, startY),
    p2: new Vector(endX, endY)
  }
}


function findDottedLines(bm, drawCtx, lineA, lineB, opts) {
  var diff, p1, p2, avg;
  var out = {};

  diff = pointDiff(lineA.p1, lineB.p2);
  p1 = pointAdd(lineA.p2, diff);
  p2 = pointSub(lineB.p2, diff);
  diff = pointDiff(lineA.p1, lineA.p2);
  p2 = pointAdd(p2, diff);

  out.lineA = findDottedLineCenter(drawCtx, bm, p1, p2, lineA.origin, lineA.remote);

  if(!out.lineA) {
    debug("Didn't find dotted line center");
    return;
  }

  if(!out.lineA) {
    debug("Failed to find dotted line center.");
    return false;
  }

  diff = pointDiff(lineA.origin, lineB.origin);
  p1 = pointAdd(lineB.remote, diff);
  p2 = pointAdd(lineA.remote, diff);
  diff = pointDiff(lineB.origin, lineB.remote);
  p2 = pointAdd(p2, diff);
  out.lineB = {
    p1: new Vector(p1.x, p1.y),
    p2: new Vector(p2.x, p2.y)
  };

  out.lineB = findDottedLineCenter(drawCtx, bm, p1, p2, lineB.origin, lineB.remote);

  return out;
}

function drawDetectionLines(ctx, lines) {
  lines.forEach(function(line) {
    drawLine(ctx, line.p1, line.p2, 1, "green");
  });
}

function run(evt) {
  async.waterfall([function(done) {
    debug("Setting up stack");

    var canvas = $("#input");
    var ctx = canvas.getContext("2d");

    var stack = {
      img: evt.path[0],
      ctx: ctx,
      grayscale: toGrayscale(ctx.getImageData(0, 0, ctx.canvas.height, ctx.canvas.width))
    }

    drawImageTo(stack.img, stack.ctx, 400);

    done(null, stack);
  }, function(stack, done) {
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

      candidates = findL(lineDetect.lines, stack);
      if(candidates.length > 0) {
        debug("Found candidates at %s blur level", blur);

        stack.bitmatrix = lineDetect.bm;
        stack.blur = lineDetect.canvas;
        stack.candidates = candidates;

        return done(null, stack);
      }
    }

    done(new Error("No Canidates Found"));
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      blank: true,
      name: "Candidates"
    });

    for(var i = 0; i < stack.candidates.length; i++) {
      var lineA = stack.candidates[i].lineA;
      var lineB = stack.candidates[i].lineB;
      drawLine(d, lineA.p1, lineA.p2, 1, "red");
      drawLine(d, lineB.p1, lineB.p2, 1, "red");
    }

    done(null, stack);
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      blank: true,
      name: "Intersection"
    });

    stack.dottedLines = [];

    for(i=0; i < stack.candidates.length; i++) {
      c = stack.candidates[i];
      stack.dottedLines.push(findDottedLines(stack.bitmatrix, stack.ctx, c.lineA, c.lineB));
    }

    if(stack.dottedLines.length > 2) {
      console.warn("Unsure how to handle more than 2 dotted lines");
    }

    // snap intersection together
    stack.dottedLines.forEach(function(linePair, idx) {
      var a = linePair.lineA;
      var b = linePair.lineB;

      var intersect = intersection({
        start: {
          x: a.p1.x,
          y: a.p1.y
        },
        end: {
          x: a.p2.x,
          y: a.p2.y
        }
      }, {
        start: {
          x: b.p1.x,
          y: b.p1.y
        },
        end: {
          x: b.p2.x,
          y: b.p2.y
        }
      });

      drawPixel(d, intersect.x, intersect.y, "blue");

      // snap lines to intersection
      if(a.p1.distance(b.p1) > a.p1.distance(b.p2)) {
        linePair.lineA.p2 = new Vector(intersect.x, intersect.y);
      }

      if(b.p1.distance(a.p1) > b.p1.distance(a.p2)) {
        linePair.lineB.p2 = new Vector(intersect.x, intersect.y);
      }
    });

    done(null, stack);
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      blank: true,
      name: "Dotted"
    });

    for(var i = 0; i < stack.dottedLines.length; i++) {
      var lineA = stack.dottedLines[i].lineA;
      var lineB = stack.dottedLines[i].lineB;

      debug("Drawing lineA %s/%s - %s/%s", lineA.p1.x);
      drawLine(d, lineA.p1, lineA.p2, 1, "rgba(255, 0, 0, 0.5)");
      debug("Drawing lineB %s/%s - %s/%s", lineB.p1.x, lineB.p1.y, lineB.p2.x, lineB.p2.y)
      drawLine(d, lineB.p1, lineB.p2, 1, "rgba(255, 0, 0, 0.5)");
    }

    done(null, stack);
  }, function(stack, done) {
    for(var i = 0; i < stack.candidates.length; i++) {
      var lineA = stack.candidates[i].lineA;
      var lineB = stack.candidates[i].lineB;

      function comp(a, b, prevDist, point) {
        var dist = a.distance(b);

        if(prevDist === -1 || dist < prevDist) {
          point.x = a.x;
          point.y = a.y;
          console.log("Updating point @ dist: %s", dist);

          return dist;
        }

        return prevDist;
      }

      var distA = -1;
      var distB = -1;

      stack.dottedLines.forEach(function(line) {
        var dottedA = line.lineA;
        var dottedB = line.lineB;

        distA = comp(dottedA.p1, lineA.p1, distA, lineA.p1);
        distA = comp(dottedA.p1, lineA.p2, distA, lineA.p1);
        distA = comp(dottedA.p2, lineA.p1, distA, lineA.p2);
        distA = comp(dottedA.p2, lineA.p2, distA, lineA.p2);
        distB = comp(dottedB.p1, lineB.p1, distB, lineB.p2);
        distB = comp(dottedB.p1, lineB.p2, distB, lineB.p2);
        distB = comp(dottedB.p2, lineB.p1, distB, lineB.p1);
        distB = comp(dottedB.p2, lineB.p2, distB, lineB.p1);
      });
    }
  }, function(stack, done) {
    var d = debugCanvas(stack.blur, {
      blank: true
    });

    var dotted = [
      stack.dottedLines[0].lineA,
      stack.dottedLines[0].lineB
    ];

    done(null, stack);
  }, function(stack, done) {
    done(new Error("Implementaion Ends"));
  }], function(err) {
    if(err) throw err;
  });
  return;

  var i, c, dottedLines;

  if(!dottedLines) {
    debug("Didn't find dotted line");
    return;
  }

  drawLine(debugCtx, c.lineA.p1, c.lineA.p2, 1, "yellow");
  drawLine(debugCtx, c.lineB.p1, c.lineB.p2, 1, "yellow");

  drawLine(debugCtx, dottedLines.lineA.p1, dottedLines.lineA.p2, 1, "yellow");
  drawLine(debugCtx, dottedLines.lineB.p1, dottedLines.lineB.p2, 1, "blue");

  var rect = {
    x: c.lineA.p2.x,
    y: c.lineA.p2.y,
    width: pointDist(c.lineB.p1, dottedLines.lineA.p1),
    height: pointDist(c.lineA.p2, dottedLines.lineB.p1)
  };

  traverseLine(dottedLines.lineB.p1, dottedLines.lineA.p2, {
    step: .5
  }, function(x, y, i) {
    drawPixel(debugCtx, x, y, "rgba(255, 0, 0, " + i + ")");
  }, function() {

  });

  return;
  debugCtx.fillStyle = "rgba(128, 0, 128, 0.5)";
  debugCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
  debugCtx.fill();

  drawLine(debugCtx, c.lineB.p1, dottedLines.lineA.p1, 1, "pink");
  drawLine(debugCtx, c.lineA.p2, dottedLines.lineB.p1, 1, "pink");

  for(var ix = Math.round(rect.x); ix < Math.round(rect.x + rect.width); ix++) {
    for(var iy = Math.round(rect.y); iy < Math.round(rect.y + rect.height); iy++) {
      var sample = grayscale[iy * ctx.canvas.width + ix];
      drawPixel(detectCtx, ix, iy, sampleToColor(sample));
    }
  }
}

var sample = "samples/" + (window.location.hash.length > 1 ? window.location.hash.slice(1) : "sample1.jpg");
var image = document.createElement("img");
image.onload = run;
image.src = sample;
//image.src = "samples/sample1.jpg";
//image.src = "samples/plate1_cropped.jpg";
