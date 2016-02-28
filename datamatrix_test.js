#!/usr/bin/env nodejs

var Canvas = require('canvas');
var Image = Canvas.Image;
var datamatrix = require('./jsdatamatrix/index.js')(Canvas);

//var filename = __dirname + '/samples/datamatrix_code.png';
var filename = __dirname + '/samples/datamatrix_code_small.png';
//var filename = __dirname + '/samples/qrcode.png';

if(process.argv.length > 2) {
    filename = process.argv[2];
}

var image = new Image()
image.onload = function(){
    var result;


    result = datamatrix.decode(image);
//    console.log('result of dm code: ' + result);

}
image.src = filename;

