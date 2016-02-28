


var DetectorResult = require('./dm_detectorresult.js');
var GridSampler = require('./dm_gridsampler.js');

var WhiteRectangleDetector = require('./dm_whiterectangledetector.js');


function distance(pattern1, pattern2) {
    return Math.sqrt((pattern1.x-pattern2.x)*(pattern1.x-pattern2.x) + (pattern1.y-pattern2.y)*(pattern1.y-pattern2.y));
};



/**
 * Returns the z component of the cross product between vectors BC and BA.
 */
function crossProductZ(pointA, pointB, pointC) {
    var bX = pointB.x;
    var bY = pointB.y;
    return ((pointC.x - bX) * (pointA.y - bY)) - ((pointC.y - bY) * (pointA.x - bX));
}


function sampleGrid(image,
                    topLeft,
                    bottomLeft,
                    bottomRight,
                    topRight,
                    dimensionX,
                    dimensionY) {

    return GridSampler.sampleGrid(image,
                              dimensionX,
                              dimensionY,
                              0.5,
                              0.5,
                              dimensionX - 0.5,
                              0.5,
                              dimensionX - 0.5,
                              dimensionY - 0.5,
                              0.5,
                              dimensionY - 0.5,
                              topLeft.x,
                              topLeft.y,
                              topRight.x,
                              topRight.y,
                              bottomRight.x,
                              bottomRight.y,
                              bottomLeft.x,
                              bottomLeft.y);
}


/**
 * Orders an array of three ResultPoints in an order [A,B,C] such that AB is less than AC
 * and BC is less than AC, and the angle between BC and BA is less than 180 degrees.
 *
 * @param patterns array of three {@code ResultPoint} to order
 */
function orderBestPatterns(patterns) {
    
    // Find distances between pattern centers
    var zeroOneDistance = distance(patterns[0], patterns[1]);
    var oneTwoDistance = distance(patterns[1], patterns[2]);
    var zeroTwoDistance = distance(patterns[0], patterns[2]);

    var pointA;
    var pointB;
    var pointC;

    // Assume one closest to other two is B; A and C will just be guesses at first
    if (oneTwoDistance >= zeroOneDistance && oneTwoDistance >= zeroTwoDistance) {
        pointB = patterns[0];
        pointA = patterns[1];
        pointC = patterns[2];
    } else if (zeroTwoDistance >= oneTwoDistance && zeroTwoDistance >= zeroOneDistance) {
        pointB = patterns[1];
        pointA = patterns[0];
        pointC = patterns[2];
    } else {
        pointB = patterns[2];
        pointA = patterns[0];
        pointC = patterns[1];
    }

    // Use cross product to figure out whether A and C are correct or flipped.
    // This asks whether BC x BA has a positive z component, which is the arrangement
    // we want for A, B, C. If it's negative, then we've got it flipped around and
    // should swap A and C.
    if (crossProductZ(pointA, pointB, pointC) < 0.0) {
        var temp = pointA;
        pointA = pointC;
        pointC = temp;
    }

    patterns[0] = pointA;
    patterns[1] = pointB;
    patterns[2] = pointC;
}


/**
 * Simply encapsulates two points and a number of transitions between them.
 */
function ResultPointsAndTransitions(from, to, transitions) {

    this.from = from;
    this.to = to;
    this.transitions = transitions;
    
    this.getFrom = function() {
        return this.from;
    }
    
    this.getTo = function() {
        return this.to;
    }
    
    this.getTransitions = function() {
        return this.transitions;
    }
    
    this.toString = function() {
        return this.from + "/" + this.to + '/' + this.transitions;
    }
}

module.exports = function(image) {

    this.image = image;
    this.rectangleDetector = new WhiteRectangleDetector(image);    


    this.isValid = function(p) {
        return p.x >= 0 && p.x < this.image.width && p.y > 0 && p.y < this.image.height;
    };


    /**
     * Calculates the position of the white top right module using the output of the rectangle detector
     * for a square matrix
     */
    this.correctTopRight = function(bottomLeft,
                                    bottomRight,
                                    topLeft,
                                    topRight,
                                    dimension) {

        var corr = distance(bottomLeft, bottomRight) / dimension;
        var norm = distance(topLeft, topRight);
        var cos = (topRight.x - topLeft.x) / norm;
        var sin = (topRight.y - topLeft.y) / norm;

        var c1 = {x: Math.round(topRight.x + corr * cos), y: Math.round(topRight.y + corr * sin)};

        corr = distance(bottomLeft, topLeft) / dimension;
        norm = distance(bottomRight, topRight);
        cos = (topRight.x - bottomRight.x) / norm;
        sin = (topRight.y - bottomRight.y) / norm;

        var c2 = {x: Math.round(topRight.x + corr * cos), y: Math.round(topRight.y + corr * sin)};

        if (!this.isValid(c1)) {
            if (this.isValid(c2)) {
                return c2;
            }
            return null;
        }
        if (!this.isValid(c2)) {
            return c1;
        }

        var l1 = Math.abs(this.transitionsBetween(topLeft, c1).getTransitions() -
                          this.transitionsBetween(bottomRight, c1).getTransitions());
        var l2 = Math.abs(this.transitionsBetween(topLeft, c2).getTransitions() -
                          this.transitionsBetween(bottomRight, c2).getTransitions());

        return (l1 <= l2) ? c1 : c2;
    };

    /**
     * Calculates the position of the white top right module using the output of the rectangle detector
     * for a rectangular matrix
     */
    this.correctTopRightRectangular = function(bottomLeft, bottomRight, topLeft, topRight, dimensionTop, dimensionRight) {

        var corr = distance(bottomLeft, bottomRight) / dimensionTop;
        var norm = distance(topLeft, topRight);
        var cos = (topRight.x - topLeft.x) / norm;
        var sin = (topRight.y - topLeft.y) / norm;

        var c1 = {x: Math.round(topRight.x+corr*cos), y: Math.round(topRight.y+corr*sin)};

        corr = distance(bottomLeft, topLeft) / dimensionRight;
        norm = distance(bottomRight, topRight);
        cos = (topRight.x - bottomRight.x) / norm;
        sin = (topRight.y - bottomRight.y) / norm;

        var c2 = {x: Math.round(topRight.x+corr*cos), y: Math.round(topRight.y+corr*sin)};

        if (!this.isValid(c1)) {
            if (this.isValid(c2)) {
                return c2;
            }
            return null;
        }
        if (!this.isValid(c2)){
            return c1;
        }

        var l1 = Math.abs(dimensionTop - this.transitionsBetween(topLeft, c1).getTransitions()) +
            Math.abs(dimensionRight - this.transitionsBetween(bottomRight, c1).getTransitions());
        var l2 = Math.abs(dimensionTop - this.transitionsBetween(topLeft, c2).getTransitions()) +
            Math.abs(dimensionRight - this.transitionsBetween(bottomRight, c2).getTransitions());

        if (l1 <= l2){
            return c1;
        }

        return c2;
    };

  /**
   * Counts the number of black/white transitions between two points, using something like Bresenham's algorithm.
   */
    this.transitionsBetween = function(from, to) {

        // See QR Code Detector, sizeOfBlackWhiteBlackRun()
        var fromX = from.x;
        var fromY = from.y;
        var toX = to.x;
        var toY = to.y;
        var steep = Math.abs(toY - fromY) > Math.abs(toX - fromX);
        if(steep) {
            var temp = fromX;
            fromX = fromY;
            fromY = temp;
            temp = toX;
            toX = toY;
            toY = temp;
        }

        var dx = Math.abs(toX - fromX);
        var dy = Math.abs(toY - fromY);
        var error = -dx / 2;
        var ystep = fromY < toY ? 1 : -1;
        var xstep = fromX < toX ? 1 : -1;
        var transitions = 0;
        var inBlack = this.image.get(steep ? fromY : fromX, steep ? fromX : fromY);
        var x;
        for (x = fromX, y = fromY; x != toX; x += xstep) {
            var isBlack = this.image.get(steep ? y : x, steep ? x : y);
            if (isBlack != inBlack) {
                transitions++;
                inBlack = isBlack;
            }
            error += dy;
            if (error > 0) {
                if (y == toY) {
                    break;
                }
                y += ystep;
                error -= dx;
            }
        }
        return new ResultPointsAndTransitions(from, to, transitions);
    };

    this.detect = function() {

        var cornerPoints = this.rectangleDetector.detect();

        var pointA = cornerPoints[0];
        var pointB = cornerPoints[1];
        var pointC = cornerPoints[2];
        var pointD = cornerPoints[3];

        // Point A and D are across the diagonal from one another,
        // as are B and C. Figure out which are the solid black lines
        // by counting transitions
        var transitions = []
        transitions.push(this.transitionsBetween(pointA, pointB));
        transitions.push(this.transitionsBetween(pointA, pointC));
        transitions.push(this.transitionsBetween(pointB, pointD));
        transitions.push(this.transitionsBetween(pointC, pointD));
        transitions.sort(function(o1, o2) {
            return o1.getTransitions() - o2.getTransitions();
        });

        // Sort by number of transitions. First two will be the two solid sides; last two
        // will be the two alternating black/white sides
        var lSideOne = transitions[0];
        var lSideTwo = transitions[1];

        function increment(h, point) {
            var key = point.x+','+point.y;
            var val = h[key];
            h[key] = (!val) ? 1 : val+1;
        }

        // Figure out which point is their intersection by tallying up the number of times we see the
        // endpoints in the four endpoints. One will show up twice.
        var pointCount = {};
        increment(pointCount, lSideOne.getFrom());
        increment(pointCount, lSideOne.getTo());
        increment(pointCount, lSideTwo.getFrom());
        increment(pointCount, lSideTwo.getTo());


        function pointKeyToPoint(pointKey) {
            var a = pointKey.split(',');
            return {x: parseInt(a[0]), y: parseInt(a[1])};
        }

        var maybeTopLeft = null;
        var bottomLeft = null;
        var maybeBottomRight = null;
        var pointKey, value;
        for(pointKey in pointCount) {
            value = pointCount[pointKey];
            if(value == 2) {
                bottomLeft = pointKeyToPoint(pointKey); // this is definitely the bottom left, then -- end of two L sides
            } else {
                // Otherwise it's either top left or bottom right -- just assign the two arbitrarily now
                if(maybeTopLeft == null) {
                    maybeTopLeft = pointKeyToPoint(pointKey);
                } else {
                    maybeBottomRight = pointKeyToPoint(pointKey);
                }
            }
        }



        if (maybeTopLeft == null || bottomLeft == null || maybeBottomRight == null) {
            throw new Error("Could not detect datamatrix code");
        }

        // Bottom left is correct but top left and bottom right might be switched
        var corners = [ maybeTopLeft, bottomLeft, maybeBottomRight ];
        // Use the dot product trick to sort them out
        orderBestPatterns(corners);



        // Now we know which is which:
        var bottomRight = corners[0];
        bottomLeft = corners[1];
        var topLeft = corners[2];

        // Which point didn't we find in relation to the "L" sides? that's the top right corner
        var topRight;
        if (!pointCount[pointA.x+','+pointA.y]) {
            topRight = pointA;
        } else if (!pointCount[pointB.x+','+pointB.y]) {
            topRight = pointB;
        } else if (!pointCount[pointC.x+','+pointC.y]) {
            topRight = pointC;
        } else {
            topRight = pointD;
        }

        // Next determine the dimension by tracing along the top or right side and counting black/white
        // transitions. Since we start inside a black module, we should see a number of transitions
        // equal to 1 less than the code dimension. Well, actually 2 less, because we are going to
        // end on a black module:

        // The top right point is actually the corner of a module, which is one of the two black modules
        // adjacent to the white module at the top right. Tracing to that corner from either the top left
        // or bottom right should work here.
        

        var dimensionTop = this.transitionsBetween(topLeft, topRight).getTransitions();

        var dimensionRight = this.transitionsBetween(bottomRight, topRight).getTransitions();
        
        if ((dimensionTop & 0x01) == 1) {
            // it can't be odd, so, round... up?
            dimensionTop++;
        }
        dimensionTop += 2;
        
        if ((dimensionRight & 0x01) == 1) {
            // it can't be odd, so, round... up?
            dimensionRight++;
        }
        dimensionRight += 2;

        var bits;
        var correctedTopRight;

        // Rectanguar symbols are 6x16, 6x28, 10x24, 10x32, 14x32, or 14x44. If one dimension is more
        // than twice the other, it's certainly rectangular, but to cut a bit more slack we accept it as
        // rectangular if the bigger side is at least 7/4 times the other:
        if (4 * dimensionTop >= 7 * dimensionRight || 4 * dimensionRight >= 7 * dimensionTop) {
            // The matrix is rectangular

            correctedTopRight =
                this.correctTopRightRectangular(bottomLeft, bottomRight, topLeft, topRight, dimensionTop, dimensionRight);
            if (correctedTopRight == null){
                correctedTopRight = topRight;
            }

            dimensionTop = this.transitionsBetween(topLeft, correctedTopRight).getTransitions();
            dimensionRight = this.transitionsBetween(bottomRight, correctedTopRight).getTransitions();

            if ((dimensionTop & 0x01) == 1) {
                // it can't be odd, so, round... up?
                dimensionTop++;
            }

            if ((dimensionRight & 0x01) == 1) {
                // it can't be odd, so, round... up?
                dimensionRight++;
            }

            bits = sampleGrid(image, topLeft, bottomLeft, bottomRight, correctedTopRight, dimensionTop, dimensionRight);
            
        } else {
            // The matrix is square
            
            var dimension = Math.min(dimensionRight, dimensionTop);
            // correct top right point to match the white module
            correctedTopRight = this.correctTopRight(bottomLeft, bottomRight, topLeft, topRight, dimension);
            if (correctedTopRight == null){
                correctedTopRight = topRight;
            }

            // Redetermine the dimension using the corrected top right point
            var dimensionCorrected = Math.max(this.transitionsBetween(topLeft, correctedTopRight).getTransitions(),
                                              this.transitionsBetween(bottomRight, correctedTopRight).getTransitions());
            dimensionCorrected++;
            if ((dimensionCorrected & 0x01) == 1) {
                dimensionCorrected++;
            }

            bits = sampleGrid(image,
                              topLeft,
                              bottomLeft,
                              bottomRight,
                              correctedTopRight,
                              dimensionCorrected,
                              dimensionCorrected);
        }

        return new DetectorResult(bits, [topLeft, bottomLeft, bottomRight, correctedTopRight]);

    };

}
