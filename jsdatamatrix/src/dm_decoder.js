
var ReedSolomonDecoder = require('./rsdecoder');
var GF256 = require('./gf256');
var BitMatrixParser = require('./dm_bitmatrixparser.js');
var DataBlock = require('./datablock');

function Decoder() {

    this.rsDecoder = new ReedSolomonDecoder(GF256.DATA_MATRIX_FIELD);

    this.decode = function(bits) {
        var parser = new BitMatrixParser(bits);
        var version = parser.readVersion();
        console.log("Version:", version.toString());
        var codewords = parser.readCodewords();
        //        var dataBlocks = DataBlock.getDataBlocks(codewords, version, ecLevel);
        
        
    };
}

module.exports = Decoder;
