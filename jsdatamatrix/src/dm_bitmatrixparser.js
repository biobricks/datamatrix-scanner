
var Version = require('./dm_version.js');
var DataMask = require('./datamask');
var FormatInformation = require('./formatinf');
var BitMatrix = require('./dm_bitmatrix.js');
//var DataMatrix = require('./dm_datamatrix.js');

function BitMatrixParser(bitMatrix) {

    var dimension = bitMatrix.height;
    if (dimension < 8 || dimension > 144 || (dimension & 0x01) != 0) {
        throw new Error("Dimension out of bounds");
    }
    this.bitMatrix = bitMatrix;

    this.readVersion = function() {
        var numRows = this.bitMatrix.height;
        var numColumns = this.bitMatrix.width;
        return Version.getVersionForDimensions(numRows, numColumns);
    }

  /**
   * <p>Reads the bits in the {@link BitMatrix} representing the mapping matrix (No alignment patterns)
   * in the correct order in order to reconstitute the codewords bytes contained within the
   * Data Matrix Code.</p>
   *
   * @return bytes encoded within the Data Matrix Code
   * @throws FormatException if the exact number of bytes expected is not read
   */
  this.readCodewords = function() {

    var result = new Array(this.version.getTotalCodewords());
    var resultOffset = 0;
    
    var row = 4;
    var column = 0;

    var numRows = this.mappingBitMatrix.height;
    var numColumns = this.mappingBitMatrix.width;
    
    var corner1Read = false;
    var corner2Read = false;
    var corner3Read = false;
    var corner4Read = false;
    
    // Read all of the codewords
    do {
      // Check the four corner cases
      if ((row == numRows) && (column == 0) && !corner1Read) {
        result[resultOffset++] = this.readCorner1(numRows, numColumns);
        row -= 2;
        column +=2;
        corner1Read = true;
          console.log('1', resultOffset);
      } else if ((row == numRows-2) && (column == 0) && ((numColumns & 0x03) != 0) && !corner2Read) {
        result[resultOffset++] = this.readCorner2(numRows, numColumns);
        row -= 2;
        column +=2;
        corner2Read = true;
          console.log('2', resultOffset);
      } else if ((row == numRows+4) && (column == 2) && ((numColumns & 0x07) == 0) && !corner3Read) {
        result[resultOffset++] = this.readCorner3(numRows, numColumns);
        row -= 2;
        column +=2;
        corner3Read = true;
          console.log('3', resultOffset);
      } else if ((row == numRows-2) && (column == 0) && ((numColumns & 0x07) == 4) && !corner4Read) {
        result[resultOffset++] = this.readCorner4(numRows, numColumns);
        row -= 2;
        column +=2;
        corner4Read = true;
          console.log('4', resultOffset);
      } else {
        // Sweep upward diagonally to the right
        do {
          if ((row < numRows) && (column >= 0) && !this.readMappingMatrix.get(column, row)) {
            result[resultOffset++] = this.readUtah(row, column, numRows, numColumns);
              console.log('up', resultOffset);
          }
          row -= 2;
          column +=2;
        } while ((row >= 0) && (column < numColumns));
        row += 1;
        column +=3;
        
        // Sweep downward diagonally to the left
        do {
          if ((row >= 0) && (column < numColumns) && !this.readMappingMatrix.get(column, row)) {
             result[resultOffset++] = this.readUtah(row, column, numRows, numColumns);
              console.log('down', resultOffset);
          }
          row += 2;
          column -=2;
        } while ((row < numRows) && (column >= 0));
        row += 3;
        column +=1;
      }
    } while ((row < numRows) || (column < numColumns));

      console.log('WW', resultOffset, this.version.getTotalCodewords())
    if (resultOffset != this.version.getTotalCodewords()) {
      throw new Error("result offset does not equal total code word count");
    }
    return result;
  }


  /**
   * <p>Extracts the data region from a {@link BitMatrix} that contains
   * alignment patterns.</p>
   * 
   * @param bitMatrix Original {@link BitMatrix} with alignment patterns
   * @return BitMatrix that has the alignment patterns removed
   */
    this.extractDataRegion = function() {
        var symbolSizeRows = this.version.getSymbolSizeRows();
        var symbolSizeColumns = this.version.getSymbolSizeColumns();
    
        if (this.bitMatrix.height != symbolSizeRows) {
            throw new Error("Dimension of bitMarix must match the version size");
        }
        
        var dataRegionSizeRows = this.version.getDataRegionSizeRows();
        var dataRegionSizeColumns = this.version.getDataRegionSizeColumns();
    
        var numDataRegionsRow = symbolSizeRows / dataRegionSizeRows;
        var numDataRegionsColumn = symbolSizeColumns / dataRegionSizeColumns;
        
        var sizeDataRegionRow = numDataRegionsRow * dataRegionSizeRows;
        var sizeDataRegionColumn = numDataRegionsColumn * dataRegionSizeColumns;
        
        var bitMatrixWithoutAlignment = new BitMatrix(sizeDataRegionColumn, sizeDataRegionRow);
        var dataRegionRow, dataRegionColumn, i, j;
        var dataRegionRowOffset;
        var dataRegionColumnOffset;
        var readRowOffset;
        var readColumnOffset;
        var writeRowOffset;
        for (dataRegionRow = 0; dataRegionRow < numDataRegionsRow; ++dataRegionRow) {
            var dataRegionRowOffset = dataRegionRow * dataRegionSizeRows;
            for (dataRegionColumn = 0; dataRegionColumn < numDataRegionsColumn; ++dataRegionColumn) {
                var dataRegionColumnOffset = dataRegionColumn * dataRegionSizeColumns;
                for (i = 0; i < dataRegionSizeRows; ++i) {
                    readRowOffset = dataRegionRow * (dataRegionSizeRows + 2) + 1 + i;
                    writeRowOffset = dataRegionRowOffset + i;
                    for (j = 0; j < dataRegionSizeColumns; ++j) {
                        readColumnOffset = dataRegionColumn * (dataRegionSizeColumns + 2) + 1 + j;
                        if (this.bitMatrix.get(readColumnOffset, readRowOffset)) {
                            writeColumnOffset = dataRegionColumnOffset + j;
                            bitMatrixWithoutAlignment.set(writeColumnOffset, writeRowOffset);
                        }
                    }
                }
            }
        }
        return bitMatrixWithoutAlignment;
    }


    /**
     * <p>Reads a bit of the mapping matrix accounting for boundary wrapping.</p>
     * 
     * @param row Row to read in the mapping matrix
     * @param column Column to read in the mapping matrix
     * @param numRows Number of rows in the mapping matrix
     * @param numColumns Number of columns in the mapping matrix
     * @return value of the given bit in the mapping matrix
     */
    this.readModule = function(row, column, numRows, numColumns) {
        // Adjust the row and column indices based on boundary wrapping
        if (row < 0) {
            row += numRows;
            column += 4 - ((numRows + 4) & 0x07);
        }
        if (column < 0) {
            column += numColumns;
            row += 4 - ((numColumns + 4) & 0x07);
        }
        this.readMappingMatrix.set(column, row);
        return this.mappingBitMatrix.get(column, row);
    }

    /**
     * <p>Reads the 8 bits of the standard Utah-shaped pattern.</p>
     * 
     * <p>See ISO 16022:2006, 5.8.1 Figure 6</p>
     * 
     * @param row Current row in the mapping matrix, anchored at the 8th bit (LSB) of the pattern
     * @param column Current column in the mapping matrix, anchored at the 8th bit (LSB) of the pattern
     * @param numRows Number of rows in the mapping matrix
     * @param numColumns Number of columns in the mapping matrix
     * @return byte from the utah shape
     */
    this.readUtah = function(row, column, numRows, numColumns) {
        var currentByte = 0;
        if (this.readModule(row - 2, column - 2, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(row - 2, column - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(row - 1, column - 2, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(row - 1, column - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(row - 1, column, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(row, column - 2, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(row, column - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(row, column, numRows, numColumns)) {
            currentByte |= 1;
        }
        return currentByte;
    };
    
    /**
     * <p>Reads the 8 bits of the special corner condition 1.</p>
     * 
     * <p>See ISO 16022:2006, Figure F.3</p>
     * 
     * @param numRows Number of rows in the mapping matrix
     * @param numColumns Number of columns in the mapping matrix
     * @return byte from the Corner condition 1
     */
    this.readCorner1 = function(numRows, numColumns) {
        var currentByte = 0;
        if (this.readModule(numRows - 1, 0, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(numRows - 1, 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(numRows - 1, 2, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 2, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(1, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(2, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(3, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        return currentByte;
    };
    
    /**
     * <p>Reads the 8 bits of the special corner condition 2.</p>
     * 
     * <p>See ISO 16022:2006, Figure F.4</p>
     * 
     * @param numRows Number of rows in the mapping matrix
     * @param numColumns Number of columns in the mapping matrix
     * @return byte from the Corner condition 2
     */
    this.readCorner2 = function(numRows, numColumns) {
        var currentByte = 0;
        if (this.readModule(numRows - 3, 0, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(numRows - 2, 0, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(numRows - 1, 0, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 4, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 3, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 2, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(1, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        return currentByte;
    }
    
    /**
     * <p>Reads the 8 bits of the special corner condition 3.</p>
     * 
     * <p>See ISO 16022:2006, Figure F.5</p>
     * 
     * @param numRows Number of rows in the mapping matrix
     * @param numColumns Number of columns in the mapping matrix
     * @return byte from the Corner condition 3
     */
    this.readCorner3 = function(numRows, numColumns) {
        var currentByte = 0;
        if (this.readModule(numRows - 1, 0, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(numRows - 1, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 3, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 2, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(1, numColumns - 3, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(1, numColumns - 2, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(1, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        return currentByte;
    }
    
    /**
     * <p>Reads the 8 bits of the special corner condition 4.</p>
     * 
     * <p>See ISO 16022:2006, Figure F.6</p>
     * 
     * @param numRows Number of rows in the mapping matrix
     * @param numColumns Number of columns in the mapping matrix
     * @return byte from the Corner condition 4
     */
    this.readCorner4 = function(numRows, numColumns) {
        var currentByte = 0;
        if (this.readModule(numRows - 3, 0, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(numRows - 2, 0, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(numRows - 1, 0, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 2, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(0, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(1, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(2, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        currentByte <<= 1;
        if (this.readModule(3, numColumns - 1, numRows, numColumns)) {
            currentByte |= 1;
        }
        return currentByte;
    };

    
    this.version = this.readVersion();
    this.mappingBitMatrix = this.extractDataRegion(bitMatrix);
    this.readMappingMatrix = new BitMatrix(this.mappingBitMatrix.width, this.mappingBitMatrix.height);
    
}

module.exports = BitMatrixParser;
