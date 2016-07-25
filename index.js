var debug = false;
var $ = window.$ = window.jQuery = require('jquery');
var xtend = require('xtend');

//var lsd = require('./line-segment-detector/index.js');
var lsd = Module;

var Detector = require('./jsdatamatrix/src/dm_detector.js');
var BitMatrix = require('./jsdatamatrix/src/dm_bitmatrix.js');

var DEFAULT_COLOR = 'rgba(0, 255, 0, 0.3)';

var image;

function randomColor() {
  return "#" + Math.round(Math.random() * 0xffffff).toString(16);
}

function sampleToColor(sample) {
  return "#" + [ sample.toString(16), sample.toString(16), sample.toString(16) ].join("");
}

function drawLine(ctx, x1, y1, x2, y2, width, color) {
  if(typeof x1 === 'object') {
    if(typeof y1 === 'object') {
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
  //    console.log("Drawing:", x1, y1, x2, y2, width, color);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = width;
  ctx.strokeStyle = color || DEFAULT_COLOR;
  ctx.stroke();
}

function drawPixel(ctx, x, y, color) {
  ctx.fillStyle = color || DEFAULT_COLOR;
  ctx.fillRect(x, y, 1, 1); 
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

function detectLines(img, canvas, blur) {
  var ctx = canvas.getContext('2d');

  var downSize = 400;

  drawImageTo(img, ctx, downSize);

  stackBlurCanvasRGBA(canvas, 0, 0, downSize, downSize, blur);

  var bm = new BitMatrix(canvas, {grayscale: true});
  bm.brightnessAndContrast(80, 150);

  bm.drawImage(ctx);

  var lines = lsd.lsd(bm.bits, bm.width, bm.height);

  var i, line;
  for(i=0; i < lines.length; i++) {
    line = lines[i];
    line.p1 = {x: line.x1, y: line.y1};
    line.p2 = {x: line.x2, y: line.y2};

    //drawLine(ctx, line.x1, line.y1, line.x2, line.y2, undefined, "red");
  }

  return {lines: lines, bitmatrix: bm};
}

function pointDist(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
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
  opts = xtend({
    maxLineStartDistance: 15, // max distance between L line starting points
    angleMin: 75, // minimum angle of smallest angle between L lines
    maxLineLengthDifference: 0.15, // max length difference between L lines
    lineMinLength: 50 // minimum L line length
  }, opts || {});

  opts.angleMin = opts.angleMin * (Math.PI / 180);

  var i, j, line, lineA, lineB, len;

  // filter lines
  var fLines = [];
  for(i=0; i < lines.length; i++) {
    line = lines[i];
    len = lineLength(line);
    if(len >= opts.lineMinLength) {
      line.length = len;
      fLines.push(line);
    }
  }

  var distRes;
  var lCandidates = [];
  for(i=0; i < fLines.length; i++) {
    lineA = fLines[i];
    for(j=i+1; j < fLines.length; j++) {
      lineB = fLines[j];
      if(Math.abs(lineA.length - lineB.length) / ((lineA.length + lineB.length) / 2) > opts.maxLineLengthDifference) {
        continue;
      }

      if(minEndPointDistance(lineA, lineB) > opts.maxLineStartDistance) {
        continue;
      }

      if(smallestAngleBetween(lineA, lineB) < opts.angleMin) {
        continue;
      }

      lCandidates.push({lineA: lineA, lineB: lineB});
    }
  }
  return lCandidates;
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

  /*
     if(debug) {
     drawPixel(drawCtx, x, y);
     drawPixel(drawCtx, x+1, y);
     drawPixel(drawCtx, x, y+1);
     drawPixel(drawCtx, x-1, y);
     drawPixel(drawCtx, x, y-1);
     drawPixel(drawCtx, x+1, y+1);
     drawPixel(drawCtx, x+1, y-1);
     drawPixel(drawCtx, x-1, y+1);
     drawPixel(drawCtx, x-1, y-1);
     }
     */

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
  //console.log("toGrayscale(" + [ imageData.width, imageData.height ] + ") " + imageData.data.length);
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
    //if(grayscale[y * ctx.canvas.width + x] < 50)
    //drawPixel(ctx, x, y, "yellow");
	}

	average = Math.round(sum / diff);

  if(average > 127 && average < 175) {
   // drawLine(ctx, p1, p2, undefined, "rgba(" + average +", 0, 0, .5)");
  } else {
    //drawLine(ctx, p1, p2, undefined, "rgba(0, 0, 255, .5)");
  }

	return average;
}

// check if this is actually a dotted line
// by sampling along the line
//
// *NOT TRUE \/* This only check IF it's dotted
// and return corrected line that is closer
// to running through the middle of squares
function verifyDottedLine(drawCtx, bm, p1, p2) {
  var average = getLineAverage(drawCtx, p1, p2);
  console.log("Line average: %s", average);

  if(average < 110)
    return true;

  return false;
}

// find the outer edge of the dotted line
function findDottedLineCenter(drawCtx, bm, p1Orig, p2Orig, lineP1, lineP2) {
  var line;
  p1 = xtend({}, p1Orig, {});
  p2 = xtend({}, p2Orig, {});

  var validStart = [];
  var validEnd = [];

  // 1/96 is one 1/8th of a square "pixel" in the pattern
  // since a line is 12 squares long
  var stepSize = 1/96;

  // We're starting with a line that's probably at the edge of the dotted lines.
  // Now we'll slide that line back and forth along the axis of 
  // the other dotted line and log where alternating dot patter begins and ends.
  // This will allow us to find the center of the dotted line.

  p1 = moveAlong(p1, -stepSize*10, lineP1, lineP2);
  p2 = moveAlong(p2, -stepSize*10, lineP1, lineP2);    

  drawLine(drawCtx, p1, p2, undefined, 'rgba(0, 255, 0, 1)');

  for(var i=0; i < 28; i++) {
    p1 = moveAlong(p1, stepSize, lineP1, lineP2);
    p2 = moveAlong(p2, stepSize, lineP1, lineP2);

    drawLine(drawCtx, p1, p2, undefined, 'rgba(255, 0, 0, ' + (i/28) + ')');

    line = verifyDottedLine(drawCtx, bm, p1, p2);
    drawLine(drawCtx, line, "green");
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

  drawPixel(drawCtx, validStart[0].x, validStart[0].y, "green");
  drawPixel(drawCtx, validEnd[0].x, validEnd[0].y, "green");

  drawPixel(drawCtx, validStart[1].x, validStart[1].y, "red");
  drawPixel(drawCtx, validEnd[1].x, validEnd[1].y, "red");

  var startX = validStart[0].x;
  var startY = validStart[0].y;

  var endX = validStart[1].x - ((validEnd[0].y - validStart[0].y));
  var endY = validStart[1].y - ((validEnd[0].x - validStart[0].x));

  return {
    p1: {
      x: startX,
      y: startY
    },
    p2: {
      x: endX,
      y: endY
    }
  }
}

// sample the pattern and return a 10x10 bit matrix
// the startpoint is the middle of the square where the two dotted lines intersect
// lineA and lineB are the two dotted lines
function samplePattern(startPoint, lineA, lineB) {

}

function findDottedLines(bm, drawCtx, lineA, lineB, opts) {
  var diff, p1, p2, avg;
  var out = {};

  diff = pointDiff(lineA.origin, lineB.origin);
  p1 = pointAdd(lineA.remote, diff);
  p2 = pointSub(lineB.remote, diff);
  diff = pointDiff(lineA.origin, lineA.remote);
  p2 = pointAdd(p2, diff);

  //drawLine(drawCtx, p1, p2, undefined, "rgba(0,0,255,0.4)");
  out.lineA = findDottedLineCenter(drawCtx, bm, p1, p2, lineA.origin, lineA.remote);

  if(!out.lineA) {
    console.log("Didn't find dotted line center");
    return;
  }

  //drawLine(drawCtx, out.lineA.p1, out.lineA.p2, undefined,  "yellow");
  drawPixel(drawCtx, out.lineA.p1.x, out.lineA.p1.y, "green");
  drawPixel(drawCtx, out.lineA.p2.x, out.lineA.p2.y, "red");
  if(!out.lineA) {
    console.log("Failed to find dotted line center.");
    return false;
  }

  //drawLine(drawCtx, out.lineA.p1, out.lineA.p2, undefined, 'RGBA(255, 0, 0, 0.4)');

  diff = pointDiff(lineA.origin, lineB.origin);
  p1 = pointAdd(lineB.remote, diff);
  p2 = pointAdd(lineA.remote, diff);
  diff = pointDiff(lineB.origin, lineB.remote);
  p2 = pointAdd(p2, diff);
  out.lineB = {p1: p1, p2: p2};

  //drawLine(drawCtx, p1, p2, 'rgba(255, 0, 0, 1)');
  //drawLine(drawCtx, lineB.origin, lineB.remote, p2, 'rgba(255, 0, 0, 1)');
  out.lineB = findDottedLineCenter(drawCtx, bm, p1, p2, lineB.origin, lineB.remote);
  console.log(out);
  //drawLine(drawCtx, out.lineB.p1, out.lineB.p2, undefined,  "yellow");
  drawPixel(drawCtx, out.lineB.p1.x, out.lineB.p1.y, "green");
  drawPixel(drawCtx, out.lineB.p2.x, out.lineB.p2.y, "red");

  return out;
}

function performanceTest(img, canvas, seconds) {
  seconds = seconds || 10;
  var ms = seconds * 1000;
  var start = (new Date).getTime();
  var count = 0;

  while(true) {
    detectLines(img, canvas);
    count++;
    if((new Date).getTime() - start >= ms) {
      break;
    }
  }
  var opsPerSec = count / seconds
    console.log("Iterations per seconds:", opsPerSec);
}


function run() {

  var canvas = $('#debug')[0];
  var img = $('#input')[0];
  var ctx = canvas.getContext('2d');

  var detect= $('#detect');
  var detectCtx = detect[0].getContext('2d');
  drawImageTo(img, detectCtx, 400);

  var debugCanvas = $("#debugCanvas")[0];
  var debugCtx = debugCanvas.getContext("2d");

  var i = 0;
  detect.on("mousemove", function(e) {
    var x = e.offsetX;
    var y = e.offsetY;

    var imageData = ctx.getImageData(x, y, 1, 1);
    //console.log("%c█", "color:rgba(" + imageData.data + ")");
  });

  var o;
  var blur;
  var candidates;

	var grayscale = toGrayscale(detectCtx.getImageData(0, 0, detectCtx.canvas.height, detectCtx.canvas.width));

  for(blur=4; blur <= 12; blur+=2) {
    o = detectLines(img, canvas, blur);

    console.log("Found", o.lines.length, "line segments");
    /*

       var i, line;
       for(i=0; i < lines.length; i++) {
       line = lines[i];
       console.log("Line:", line);
       drawLine(ctx, line.x1, line.y1, line.x2, line.y2, line.width);
       }
       */

    candidates = findL(o.lines);
    console.log("For blur:", blur, "Found", candidates.length, "L-shape candidates");
    if(candidates.length) break;
  }

  var i, c, dottedLines;
  for(i=0; i < candidates.length; i++) {
    c = candidates[i];
    dottedLines = findDottedLines(o.bitmatrix, detectCtx, c.lineA, c.lineB);

    if(dottedLines && dottedLines.lineA) break;
  }

  if(!dottedLines) {
    console.log("Didn't find dotted line");
    return;
  }

  drawLine(debugCtx, c.lineA.p1, c.lineA.p2, 1, "yellow");
  drawLine(debugCtx, c.lineB.p1, c.lineB.p2, 1, "yellow");

  drawLine(debugCtx, dottedLines.lineA.p1, dottedLines.lineA.p2, 1, "yellow");
  drawLine(debugCtx, dottedLines.lineB.p1, dottedLines.lineB.p2, 1, "yellow");

  var rect = {
    x: c.lineA.p2.x,
    y: c.lineA.p2.y,
    width: pointDist(c.lineB.p1, dottedLines.lineA.p1),
    height: pointDist(c.lineA.p2, dottedLines.lineB.p1)
  };

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


function main() {
  image = $('#input')[0];
  image.onload = run;
  image.src = 'samples/sample1.jpg';
  //image.src = 'samples/plate1_cropped.jpg';
}

$(document).ready(main);
