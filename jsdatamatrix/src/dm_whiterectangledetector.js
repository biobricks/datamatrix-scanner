
/*
 * Copyright 2010 ZXing authors
 * Copyright 2016 BioBricks Foundation (js port of DataMatrix detect/decode)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


module.exports = function(image, initSize, x, y) {
    this.INIT_SIZE = 10;
    this.CORR = 1;

    if(!initSize) {
        initSize = this.INIT_SIZE;
        x = image.width / 2;
        y = image.height / 2;
    }

    this.image = image;

    this.height = image.height;
    this.width = image.width;
    var halfSize = Math.round(initSize / 2);
    this.leftInit = x - halfSize;
    this.rightInit = x + halfSize;
    this.upInit = y - halfSize;
    this.downInit = y + halfSize;

    if(this.upInit < 0 || this.leftInit < 0 || this.downInit >= this.height || this.rightInit >= this.width) {
        throw new Error("Image dimensions not supported");
    }

  /**
   * Determines whether a segment contains a black point
   *
   * @param a          min value of the scanned coordinate
   * @param b          max value of the scanned coordinate
   * @param fixed      value of fixed coordinate
   * @param horizontal set to true if scan must be horizontal, false if vertical
   * @return true if a black point has been found, else false.
   */
    this.containsBlackPoint = function(a, b, fixed, horizontal) {
        
        if (horizontal) {
            for (var x = a; x <= b; x++) {
                if (this.image.get(x, fixed)) {
                    return true;
                }
            }
        } else {
            for (var y = a; y <= b; y++) {
                if (this.image.get(fixed, y)) {
                    return true;
                }
            }
        }
        
        return false;
    };
    
    this.distance = function(aX, aY, bX, bY) {
        return Math.sqrt((aX-bX)*(aX-bX) + (aY-bY)*(aY-bY));
    };

    this.getBlackPointOnSegment = function(aX, aY, bX, bY) {
        var dist = Math.round(this.distance(aX, aY, bX, bY));
        var xStep = (bX - aX) / dist;
        var yStep = (bY - aY) / dist;
        
        var i;
        for (i = 0; i < dist; i++) {
            var x = Math.round(aX + i * xStep);
            var y = Math.round(aY + i * yStep);
            if (this.image.get(x, y)) {
                return {x: x, y: y};
            }
        }
        return null;
    };


  /**
   * recenters the points of a constant distance towards the center
   *
   * @param y bottom most point
   * @param z left most point
   * @param x right most point
   * @param t top most point
   * @return {@link ResultPoint}[] describing the corners of the rectangular
   *         region. The first and last points are opposed on the diagonal, as
   *         are the second and third. The first point will be the topmost
   *         point and the last, the bottommost. The second point will be
   *         leftmost and the third, the rightmost
   */
    this.centerEdges = function(y, z, x, t) {
        
        //
        //       t            t
        //  z                      x
        //        x    OR    z
        //   y                    y
        //

        var yi = y.x;
        var yj = y.y;
        var zi = z.x;
        var zj = z.y;
        var xi = x.x;
        var xj = x.y;
        var ti = t.x;
        var tj = t.y;

        if (yi < this.width / 2.0) {
            return [
                {x: ti - this.CORR, y: tj + this.CORR},
                {x: zi + this.CORR, y: zj + this.CORR},
                {x: xi - this.CORR, y: xj - this.CORR},
                {x: yi + this.CORR, y: yj - this.CORR}
            ];
        } else {
            return [
                {x: ti + this.CORR, y: tj + this.CORR},
                {x: zi + this.CORR, y: zj - this.CORR},
                {x: xi - this.CORR, y: xj + this.CORR},
                {x: yi - this.CORR, y: yj - this.CORR}
            ];
        }
    };

    this.detect = function() {
   
        var left = this.leftInit;
        var right = this.rightInit;
        var up = this.upInit;
        var down = this.downInit;
        var sizeExceeded = false;
        var aBlackPointFoundOnBorder = true;
        var atLeastOneBlackPointFoundOnBorder = false;
        
        var atLeastOneBlackPointFoundOnRight = false;
        var atLeastOneBlackPointFoundOnBottom = false;
        var atLeastOneBlackPointFoundOnLeft = false;
        var atLeastOneBlackPointFoundOnTop = false;

        while (aBlackPointFoundOnBorder) {

            aBlackPointFoundOnBorder = false;

            // .....
            // .   |
            // .....
            var rightBorderNotWhite = true;
            while ((rightBorderNotWhite || !atLeastOneBlackPointFoundOnRight) && right < this.width) {
                rightBorderNotWhite = this.containsBlackPoint(up, down, right, false);
                if (rightBorderNotWhite) {
                    right++;
                    aBlackPointFoundOnBorder = true;
                    atLeastOneBlackPointFoundOnRight = true;
                } else if (!atLeastOneBlackPointFoundOnRight) {
                    right++;
                }
            }

            if (right >= this.width) {
                sizeExceeded = true;
                break;
            }

            // .....
            // .   .
            // .___.
            var bottomBorderNotWhite = true;
            while ((bottomBorderNotWhite || !atLeastOneBlackPointFoundOnBottom) && down < this.height) {
                bottomBorderNotWhite = this.containsBlackPoint(left, right, down, true);
                if (bottomBorderNotWhite) {
                    down++;
                    aBlackPointFoundOnBorder = true;
                    atLeastOneBlackPointFoundOnBottom = true;
                } else if (!atLeastOneBlackPointFoundOnBottom) {
                    down++;
                }
            }

            if (down >= this.height) {
                sizeExceeded = true;
                break;
            }

            // .....
            // |   .
            // .....
            var leftBorderNotWhite = true;
            while ((leftBorderNotWhite || !atLeastOneBlackPointFoundOnLeft) && left >= 0) {
                leftBorderNotWhite = this.containsBlackPoint(up, down, left, false);
                if (leftBorderNotWhite) {
                    left--;
                    aBlackPointFoundOnBorder = true;
                    atLeastOneBlackPointFoundOnLeft = true;
                } else if (!atLeastOneBlackPointFoundOnLeft) {
                    left--;
                }
            }

            if (left < 0) {
                sizeExceeded = true;
                break;
            }

            // .___.
            // .   .
            // .....
            var topBorderNotWhite = true;
            while ((topBorderNotWhite  || !atLeastOneBlackPointFoundOnTop) && up >= 0) {
                topBorderNotWhite = this.containsBlackPoint(left, right, up, true);
                if (topBorderNotWhite) {
                    up--;
                    aBlackPointFoundOnBorder = true;
                    atLeastOneBlackPointFoundOnTop = true;
                } else if (!atLeastOneBlackPointFoundOnTop) {
                    up--;
                }
            }

            if (up < 0) {
                sizeExceeded = true;
                break;
            }

            if (aBlackPointFoundOnBorder) {
                atLeastOneBlackPointFoundOnBorder = true;
            }

        };

        // NEW

        if (!sizeExceeded && atLeastOneBlackPointFoundOnBorder) {

            var i;
            var maxSize = right - left;

            var z = null;
            for (i = 1; i < maxSize; i++) {
                z = this.getBlackPointOnSegment(left, down - i, left + i, down);
                if (z != null) {
                    break;
                }
            }

            if (z == null) {
                throw new Error("White rectangle not found");
            }

            var t = null;
            //go down right
            for (i = 1; i < maxSize; i++) {
                t = this.getBlackPointOnSegment(left, up + i, left + i, up);
                if (t != null) {
                    break;
                }
            }

            if (t == null) {
                throw new Error("White rectangle not found");
            }

            var x = null;
            //go down left
            for (i = 1; i < maxSize; i++) {
                x = this.getBlackPointOnSegment(right, up + i, right - i, up);
                if (x != null) {
                    break;
                }
            }

            if (x == null) {
                throw new Error("White rectangle not found");
            }

            var y = null;
            //go up left
            for (i = 1; i < maxSize; i++) {
                y = this.getBlackPointOnSegment(right, down - i, right - i, down);
                if (y != null) {
                    break;
                }
            }

            if (y == null) {
                throw new Error("White rectangle not found");
            }

            return this.centerEdges(y, z, x, t);

        } else {
            throw new Error("White rectangle not found");
        }


    };
};
