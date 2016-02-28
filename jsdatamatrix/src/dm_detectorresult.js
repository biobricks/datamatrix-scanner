function DetectorResult(bits, points) {
    this.bits = bits;
    this.points = points;

    this.getBits = function() {
        return this.bits;
    }

    this.getPoints = function() {
        return this.points;
    }

    // create ascii art from result
    this.ascii = function() {
        var s = '';
        var x, y, i;
        for(y=0; y < this.bits.height; y++) {
            for(x=0; x < this.bits.width; x++) {
                i = this.bits.width * y + x;
                if(this.bits.bits[i]) {
                    s += '  ';
                } else {
                    s += '██';
                }
            }
            s += "\n";
        }
        return s;
    };

}

module.exports = DetectorResult;
