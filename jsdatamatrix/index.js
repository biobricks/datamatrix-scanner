

var Detector = require('./src/dm_detector.js');
var Decoder = require('./src/dm_decoder.js');

var BitMatrix = require('./src/dm_bitmatrix.js');


function DataMatrix(Canvas) {
    
//    var qr = qrcode(Canvas);

    this.decode = function(image) {
//        console.log("got:", image);
//        qr.decode(image, true);

        var bm = new BitMatrix(image);
//        var bm = new BitMatrix(image, {width: 80, height: 80});
//        console.log(bm.ascii());

        var detector = new Detector(bm);
        var dres = detector.detect();
        console.log(dres.ascii());

//        var decoder = new Decoder();
//        var res = decoder.decode(dres.bits);
//        console.log(dres.bits.Dimension);
//        console.log(res);

//        console.log(result.ascii(22, 22));



//        var image = qr.grayScaleToBitmap(qr.grayscale());
//        var detector = new Detector(image);
//        var matrix = detector.detect(image);

        return "not implemented";
    };

};

module.exports = function(Canvas) {
    return new DataMatrix(Canvas);
};

