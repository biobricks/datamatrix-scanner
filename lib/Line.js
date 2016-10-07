var Vector = require("victor");

function Line(p1, p2) {
  this.p1 = p1 instanceof Vector ? p1 : new Vector(p1.x, p1.y);
  this.p2 = p2 instanceof Vector ? p2 : new Vector(p2.x, p2.y);
}

Line.prototype = {
  get length() {
    return this.p1.distance(this.p2);
  },

  get x1() {
    return this.p1.x;
  },

  get x2() {
    return this.p2.x;
  },

  get y1() {
    return this.p1.y;
  },

  get y2() {
    return this.p2.y;
  }
}

module.exports = Line;
