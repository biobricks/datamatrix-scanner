
var $ = require('jquery');
var xtend = require('xtend');

//var lsd = require('./line-segment-detector/index.js');
var lsd = Module;

var Detector = require('./jsdatamatrix/src/dm_detector.js');
var BitMatrix = require('./jsdatamatrix/src/dm_bitmatrix.js');

var image;

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
    ctx.strokeStyle = color || 'rgba(0, 255, 0, 0.1)';
    ctx.stroke();
}

function drawPixel(ctx, x, y, color) {
    ctx.fillStyle = color || 'rgba(0, 255, 0, 0.1)';
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
function getSquareColor(drawCtx, bm, x, y, debug) {
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

    avg = avg / 9;
    return avg;
}

// get the average pixel value of a line from p1 to p2
function getLineAverage(bm, p1, p2) {
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    var a, b;
    var stepY = false;
    var lineFunc;
    if(dx == 0) {
        stepY = true;
        lineFunc = function(y) {
            return p1.x;
        };
    } else {
        a = dy / dx;
        b = p1.y - a * p1.x;
        if(Math.abs(a) > 1) {
            stepY = true;
            lineFunc = function(y) {
                return Math.round((y - b) / a);
            }
        } else {
            lineFunc = function(x) {
                return Math.round(a * x + b);
            }
        }
    }

    // step through all pixels in the line and sample them
    var avg = 0;
    var count = 0;
    var x, y, min, max;
    if(stepY) {
        if(p1.y > p2.y) {
            min = Math.round(p2.y);
            max = Math.round(p1.y);
        } else {
            min = Math.round(p1.y);
            max = Math.round(p2.y);
        }
        
        for(y=min; y <= max; y++) {
            x = lineFunc(y);
            avg += bm.get(x, y);
            count++;
        }
    } else {
        if(p1.x > p2.x) {
            min = Math.round(p2.x);
            max = Math.round(p1.x);
        } else {
            min = Math.round(p1.x);
            max = Math.round(p2.x);
        }
        
        for(x=min; x <= max; x++) {
            y = lineFunc(x);
            avg += bm.get(x, y);
            count++;
        }
    }

    return avg / count;
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

// check if this is actually a dotted line
// by sampling along the line
// and return corrected line that is closer
// to running through the middle of squares
function verifyDottedLine(drawCtx, bm, p1, p2) {
    var globAvg = getLineAverage(bm, p1, p2);

    var cur = xtend(p1, {});
    var end = xtend(p2, {});
    var dy = end.y - cur.y;
    var dx = end.x - cur.x;

    var tmp;
    var one = 1;
    var halfPart;
    var inc;
    if(dy == 0) {
        if(end.x < cur.x) {
            tmp = end;
            end = cur;
            cur = tmp;
        }
        halfPart = dx / 24;
        cur.x +=  halfPart;
        end.x -=  halfPart;
        inc = function(p) {
            p.x++;
            if(p.x > end.x) return false;
            return p;
        }
    } else if (dx == 0) {
        if(end.y < cur.y) {
            tmp = end;
            end = cur;
            cur = tmp;
        }
        halfPart = dy / 24;
        cur.y +=  halfPart;
        end.y -=  halfPart;
        inc = function(p) {
            p.y++;
            if(p.y > end.y) return false;
            return p;
        }        
    } else {
        var a = dy / dx;
        var b = p1.y - a * p1.x;
        if(Math.abs(dy) <= Math.abs(dx)) {
            if(end.x < cur.x) {
                tmp = end;
                end = cur;
                cur = tmp;
            }
            halfPart = dx / 24;
            cur.x +=  halfPart;
            end.x -=  halfPart;
            inc = function(p) {
                p.x++;
                if(p.x > end.x) return false;
                p.y = a * p.x + b;
                return p;
            }
        } else {
            if(end.y < cur.y) {
                tmp = end;
                end = cur;
                cur = tmp;
            }
            halfPart = dy / 24;
            cur.y +=  halfPart;
            end.y -=  halfPart;
            inc = function(p) {
                p.y++;
                if(p.y > end.y) return false;
                p.x = (p.y - b) / a;
                return p;
            }
        }
    }
    drawPixel(drawCtx, cur.x, cur.y, 'RGBA(255, 0, 0, 1)');

    var values = [];

    var sample;
    var bit;
    var last;
    do {
        sample = getSquareColor(drawCtx, bm, Math.round(cur.x), Math.round(cur.y));
        bit = (sample > globAvg) ? false : true;
        if(bit !== last) {

            values.push({value: bit, point: xtend(cur, {})});
            distSinceLast = 0;
        } else {
            distSinceLast++;
        }
        last = bit;
    } while(inc(cur));


    if(values.length != 12) {
//        return false;
    }

    drawPixel(drawCtx, end.x, end.y, 'RGBA(255, 0, 0, 1)');

    var i, prev;
    for(i=2; i < values.length; i++) {
        cur = values[i];
        prev = values[i-1];
        
        prev.point.x += (cur.point.x - prev.point.x) / 2;
        prev.point.y += (cur.point.y - prev.point.y) / 2;
        
        drawPixel(drawCtx, prev.point.x, prev.point.y, 'RGBA(255, 0, 0, 1)');
    }

    console.log("values:", values.length);

    return false;

    // ------------------------------------------------
/*

    var incX = Math.abs(p2.x - p1.x) / 12;
    var incY = Math.abs(p2.y - p1.y) / 12;
    var minX = Math.min(p1.x, p2.x);
    var minY = Math.min(p1.y, p2.y);

    var curX, curY;
    var values = [];
    var i, avg;
    for(i=0; i < 12; i++) {
        curX = Math.round(minX + incX * i + incX/2);
        curY = Math.round(minY + incY * i + incY/2);
        avg = getSquareColor(drawCtx, bm, curX, curY);
        if(avg > globAvg) {
            values.push(false);
        } else {
            values.push(true);
        }
    }

    var cur, prev;
    for(i=0; i < values.length; i++) {
        if(i == 0) {
            prev = values[i];
            continue;
        }
        cur = values[i];
        if(cur === prev) {
            return false;
        }
        prev = cur;
    }
    
    return {p1: p1, p2: p2};
*/
}

// find the outer edge of the dotted line
function findDottedLineCenter(drawCtx, bm, p1Orig, p2Orig, lineP1, lineP2) {
    var line;
    p1 = xtend(p1Orig, {});
    p2 = xtend(p2Orig, {});

    var validStart;
    var validEnd;

    // 1/96 is one 1/8th of a square "pixel" in the pattern
    // since a line is 12 squares long
    var stepSize = 1/96;

    // We're starting with a line that's probably at the edge of the dotted lines.
    // Now we'll slide that line back and forth along the axis of 
    // the other dotted line and log where alternating dot patter begins and ends.
    // This will allow us to find the center of the dotted line.

    p1 = moveAlong(p1, -stepSize*14, lineP1, lineP2);
    p2 = moveAlong(p2, -stepSize*14, lineP1, lineP2);    
    var i;
    for(i=0; i < 28; i++) {
        p1 = moveAlong(p1, stepSize, lineP1, lineP2);
        p2 = moveAlong(p2, stepSize, lineP1, lineP2);

        drawLine(drawCtx, p1, p2, 1, 'RGBA(0, 128, 128, 0.3)');

        line = verifyDottedLine(drawCtx, bm, p1, p2);
        return;
        if(line) {
            if(!validStart) {
                validStart = i;
            }
            validEnd = i;
            drawLine(drawCtx, p1, p2, 1, 'RGBA(128, 128, 0, 0.3)');
        }
    }

    var stepsToMiddle = Math.round((validStart + validEnd) / 2);

    p1 = moveAlong(p1Orig, -stepSize*16 + stepSize*stepsToMiddle, lineP1, lineP2);
    p2 = moveAlong(p2Orig, -stepSize*16 + stepSize*stepsToMiddle, lineP1, lineP2);

    drawLine(drawCtx, p1, p2, 1, 'RGBA(0, 0, 255, 0.5)');  
  
    return {p1: p1, p2: p2};
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

    out.lineA = findDottedLineCenter(drawCtx, bm, p1, p2, lineA.origin, lineA.remote);
     if(!out.lineA) {
        return false;
    }

//    drawLine(drawCtx, out.lineA.p1, out.lineA.p2, undefined, 'RGBA(255, 0, 0, 0.1)');

    diff = pointDiff(lineA.origin, lineB.origin);
    p1 = pointAdd(lineB.remote, diff);
    p2 = pointAdd(lineA.remote, diff);
    diff = pointDiff(lineB.origin, lineB.remote);
    p2 = pointAdd(p2, diff);
    out.lineB = {p1: p1, p2: p2};

    out.lineB = findDottedLineCenter(drawCtx, bm, p1, p2, lineB.origin, lineB.remote);
     if(!out.lineB) {
        return false;
    }
  

//    drawLine(drawCtx, p1, p2, undefined, 'RGBA(255, 0, 0, 0.1)');
//    avg = getLineAverage(bm, p1, p2);
//    console.log("LineB average:", avg);
    

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

    var detectCtx = $('#detect')[0].getContext('2d');
    drawImageTo(img, detectCtx, 400);

    var o;
    var blur;
    var candidates;

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

    var i, c;
    for(i=0; i < candidates.length; i++) {
        c = candidates[i];
        drawLine(detectCtx, c.lineA);
        drawLine(detectCtx, c.lineB);
        findDottedLines(o.bitmatrix, detectCtx, c.lineA, c.lineB);
    }

}


function main() {
    image = $('#input')[0];
    image.onload = run;
        image.src = 'samples/sample1.jpg';
//    image.src = 'samples/plate1_cropped.jpg';
    
}

$(document).ready(main);



