// Shamelessly pulled from https://stackoverflow.com/a/20826113
/**
 * Item name is non-unique
 */
fabric.Canvas.prototype.getItemsByName = function(name) {
  var objectList = [],
      objects = this.getObjects();

  for (var i = 0, len = this.size(); i < len; i++) {
    if (objects[i].name && objects[i].name === name) {
      objectList.push(objects[i]);
    }
  }

  return objectList;
};

/**
 * Item name is unique
 */
fabric.Canvas.prototype.getItemByName = function(name) {
  var object = null,
      objects = this.getObjects();

  for (var i = 0, len = this.size(); i < len; i++) {
    if (objects[i].name && objects[i].name === name) {
      object = objects[i];
      break;
    }
  }

  return object;
};

fabric.SquareBrush = fabric.util.createClass(fabric.BaseBrush, {

  initialize: function(canvas, opt) {
    this.canvas = canvas;
    opt = opt || {};
    this.width = opt.width || 17.5;
    // this.width = opt.width * 2 || 17.5;
    this.height = this.width;
    this.obstacles = opt.obstacles || [];
    this.modeColors = opt.modeColors || {};
    this.points = []
    this._mode = "draw";
  },

  setMode: function (mode) {
    this._mode = mode;
  },

  canAdd: function (point) {
    return this.obstacles.some(p => p.eq(point));
  },

  drawSquare: function(pointer) {
    const point = this.addPoint(pointer);
    if (!point) {
      console.log(`Found ${point}, which isn't supposed to be an obstacle...`)
      return;
    }
    const ctx = this.canvas.contextTop;
    this._saveAndTransform(ctx);
    this.square(ctx, point);
    ctx.restore();
  },

  square: function(ctx, point) {
    ctx.fillStyle = point.fill;
    console.log("square ->", point)
    ctx.fillRect(
      (point.x * this.width) - point.width / 2,
      (point.y * this.width) - point.height / 2,
      point.width,
      point.height
    );
  },

  onMouseDown: function(pointer) {
    console.log("onMouseDown", pointer);
    this.points.length = 0;
    this.canvas.clearContext(this.canvas.contextTop);
    this.drawSquare(pointer);
  },

  onMouseMove: function(pointer) {
    console.log("onMouseMove", pointer);
    if (this._isOutSideCanvas(pointer)) {
      return;
    }
    if (this.needsFullRender()) {
      this.canvas.clearContext(this.canvas.contextTop);
      this.addPoint(pointer);
      this._render();
    } else {
      this.drawSquare(pointer);
    }
  },

  onMouseUp: function(pointer) {
    console.log("onMouseUp", pointer);
    const originalRenderOnAddRemove = this.canvas.renderOnAddRemove;
    this.canvas.renderOnAddRemove = false;

    for (const point of this.points) {
      const cell = this.canvas.getItemByName(`cell-${point.x}-${point.y}`);
      cell.set("fill", point.fill);
      this.canvas.fire("object:modified", { cell, mode: this._mode, })
    }

    this.canvas.clearContext(this.canvas.contextTop);
    this.canvas.renderOnAddRemove = originalRenderOnAddRemove;
    this.canvas.requestRenderAll();
  },

  addPoint: function (pointer) {
    const pointerPoint = new fabric.Point(
      Math.round(pointer.x / this.width), Math.round(pointer.y / this.height)
    );
    if (!this.canAdd(pointerPoint)) {
      console.log(`Tried to place ${pointerPoint}, which can't have an obstacle...`)
      return;
    }
    pointerPoint.width = this.width;
    pointerPoint.height = this.height;
    // pointerPoint.width = this.width * 2;
    // pointerPoint.height = this.height * 2;
    pointerPoint.fill = this.modeColors[this._mode];
    this.points.push(pointerPoint);
    return pointerPoint;
  },

  _render: function() {
    const ctx = this.context.contextTop;
    const points = this.points;
    this._saveAndTransform(ctx);
    for (const point of points) {
      this.square(ctx, point);
    }
    ctx.restore();
  },

  coercePoint: (pointer) => {
    const point = new fabric.Point(
      Math.round(pointer.x / this.width), Math.round(pointer.y / this.height)
    )
    return point;
  }
});
