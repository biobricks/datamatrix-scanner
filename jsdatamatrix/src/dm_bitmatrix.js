
//var canvas;
//if(!document) {
//    canvas = require('canvas');
//}


/*
  Turns an image into a monochrome image
  in the form of a 2D addressable array of boolean values.
  An attempt is made to split (white/black) on the most useful threshold
  for optimizing contrast of the resulting monochrome image.
*/

// TODO improve this by mapping bits into 32 bit integers
// this function borrows code from Lazar Lazlo's js qrcode decoder

function BitMatrix(image, opts) {

    this.bits = null;
    this.width = 0;
    this.height = 0;

    this.get = function(x, y) {
        return this.bits[y * this.width + x];
    };
    
    this.set = function(x, y) {
        this.bits[y * this.width + x] = true;
    };

    this.fromImage = function(image, opts) {
        opts = opts || {};

        var width = opts.width || image.width;
        var height = opts.height || image.height;
        this.width = width;
        this.height = height;

        var canvas;
        if(image.tagName !== 'CANVAS') {
            if(!document) {
                canvas = new Canvas(width, height);
            } else {
                canvas = document.createElement('CANVAS');
                canvas.width = width;
                canvas.height = height;
            }
        } else {
            canvas = image;
        }

        var ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, width, height);
        var imageData = ctx.getImageData(0, 0, width, height);

        var grayscale = this._imageDataToGrayscale(imageData);
        imageData = null;
        if(opts.grayscale) {
            // TODO add getMiddleBrightnessPerArea functionality
            // in grayscale mode
            this.bits = grayscale;
            return;
        }

        var middle = this._getMiddleBrightnessPerArea(grayscale, width, height);
        
        var sqrtNumArea = middle.length;
        var areaWidth = Math.floor(width / sqrtNumArea);
        var areaHeight = Math.floor(height / sqrtNumArea);
        this.bits = new Array(width * height);
        var i, ay, ax, dy, dx;
        for (ay = 0; ay < sqrtNumArea; ay++) {
            for (ax = 0; ax < sqrtNumArea; ax++) {
                for (dy = 0; dy < areaHeight; dy++) {
                    for (dx = 0; dx < areaWidth; dx++) {
                        i = areaWidth * ax + dx+ (areaHeight * ay + dy) * width
                        this.bits[i] = (grayscale[areaWidth * ax + dx+ (areaHeight * ay + dy)*width] < middle[ax][ay]) ? true : false;
                    }
                }
            }
        }
    };
    
    this._imageDataToGrayscale = function(imageData) {
        var grayscale = new Array(imageData.width * imageData.height);

        var data = imageData.data;
        var gi, red, green, blue, alpha, blackness;
        for(i=0; i < data.length; i+=4) {
            gi = i / 4;
            red = data[i];
            green = data[i + 1];
            blue = data[i + 2];
            alpha = data[i + 3] / 255;
            blackness = (255 - Math.round(red / 3 + green / 3 + blue / 3)) * alpha;
            grayscale[gi] = 255 - blackness;
        }
        return grayscale;
    };
    
    this._getMiddleBrightnessPerArea = function(image, width, height) {
        var numSqrtArea = 4;
        // obtain middle brightness((min + max) / 2) per area
        var areaWidth = Math.floor(width / numSqrtArea);
        var areaHeight = Math.floor(height / numSqrtArea);
        var minmax = new Array(numSqrtArea);
        for (var i = 0; i < numSqrtArea; i++) {
            minmax[i] = new Array(numSqrtArea);
            for (var i2 = 0; i2 < numSqrtArea; i2++) {
                minmax[i][i2] = new Array(0,0);
            }
        }
        for (var ay = 0; ay < numSqrtArea; ay++) {
            for (var ax = 0; ax < numSqrtArea; ax++) {
                minmax[ax][ay][0] = 0xFF;
                for (var dy = 0; dy < areaHeight; dy++) {
                    for (var dx = 0; dx < areaWidth; dx++) {
                        var target = image[areaWidth * ax + dx + (areaHeight * ay + dy) * width];
                        if (target < minmax[ax][ay][0])
                            minmax[ax][ay][0] = target;
                        if (target > minmax[ax][ay][1])
                            minmax[ax][ay][1] = target;
                    }
                }
            }
        }
        var middle = new Array(numSqrtArea);
        for (var i3 = 0; i3 < numSqrtArea; i3++) {
            middle[i3] = new Array(numSqrtArea);
        }
        for (var ay = 0; ay < numSqrtArea; ay++) {
            for (var ax = 0; ax < numSqrtArea; ax++) {
                middle[ax][ay] = Math.floor((minmax[ax][ay][0] + minmax[ax][ay][1]) / 2);
            }
        }
        return middle;
    }

    // create ascii art from image
    // this works best if width and height are set to 80
    this.ascii = function() {
        var s = '';
        var x, y, i;
        for(y=0; y < this.height; y++) {
            for(x=0; x < this.width; x++) {
                i = this.width * y + x;
                if(this.bits[i]) {
                    s += '██';
                } else {
                    s += '  ';
                }
            }
            s += "\n";
        }
        return s;
    };

    this.dimension = function() {
        if(this.width != this.height) {
            throw new Error("Can't get dimension on a non-square matrix");
        }
        return this.width;
    };

    if(image) {
        if(typeof image === 'number' && typeof opts === 'number') {
            this.width = image;
            this.height = opts;
            this.bits = new Array(this.width * this.height);
        } else {
            this.fromImage(image, opts);
        }
    }
}

module.exports = BitMatrix;
