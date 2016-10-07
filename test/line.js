"use strict";

var test = require("tape");

var Line = require("../lib/Line");

var newLen = 2.8284271247461903;

test(function(t) {
  var l = new Line({
    x: 0,
    y: 0
  }, {
    x: 1,
    y: 1
  });

  t.ok(l, "new Line");
  t.equal(parseFloat(parseFloat(l.length).toFixed(5)), 1.41421, "Line.length correct");
  
  t.end();
});
