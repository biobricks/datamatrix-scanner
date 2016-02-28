
This is a work-in-progress javascript DataMatrix detector and decoder.

The goal is to make a module suitable for in-browser real-time DataMatrix scanning using phone/tablet cameras.

There are two existing open source projects that can scan 2D barcodes:

* [libdmtx](http://libdmtx.sourceforge.net/): Written in C. Robust to changes in rotation but less robust to lighting/contrast changes. Fairly complicated codebase.
* [ZXing](https://github.com/zxing/zxing): Writen in Java. Robust to lighting/contrast changes. Does not work if DataMatrix code is rotated. 

It uses code from the following projects:

* [jsqrcode](https://github.com/LazarSoft/jsqrcode): Re-used some parts of this javascript port of the QR code scanning functionality from ZXing (License: Apache v2)
* [ZXing](https://github.com/zxing/zxing): Ported some additional DataMatrix-related functionality from ZXing to javascript (License: Apache v2)
* [LSD: a Line Segment Detector](http://www.ipol.im/pub/art/2012/gjmr-lsd/): Compiled reference implementation in C to javascript using emscripten. (License: AGPLv3)

The algorithm as implemented in this code is partially inspired by the algorithm described in this article:

* ["Data Matrix Code Location Based on Finder Pattern Detection and Bar Code Border Fitting" by Huang et al, Mathematical Problems in Engineering, 2012](http://www.hindawi.com/journals/mpe/2012/515296/)

It makes use of the following algorithm:

* ["LSD: a Line Segment Detector" by Gioi et al, Image Processing On Line, 2012](http://dx.doi.org/10.5201/ipol.2012.gjmr-lsd)
 

# Future ToDo

* Detect image sharpness and only apply blur if sharpness above some threshold. This should improve scanning robustness when code is in/out of focus.
* Before detection find and extract candidate regions that may contain DataMatrix codes. This will allow scanning of codes at a variety of distances and scanning of multiple codes at once.
* Add perspective correction.

# License

Various parts of this code is available under different licenses as described in individual source files. This includes MIT license, Apache v2 license and AGPLv3. 
