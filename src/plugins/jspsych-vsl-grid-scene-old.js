const roomChar2Word = {
  "w": "wall", // wall
  "e": "entrance", // entrance
  "o": "obstacle", // obstacle
  "x": "exit", // exit
  "b": "outside-fov", // no blocks
  0: "room-chunk", // empty spaces
}

var jsPsychVslGridAlt = (function (jspsych) {
  'use strict';

  const info = {
    name: "vsl-grid-scene",
    parameters: {
      html: {
        type: jspsych.ParameterType.STRING,
        pretty_name: "HTML Template",
        description: "We need to pass in the HTML template since JSPsych can't load local HTML",
      },
      baseImage: {
        type: jspsych.ParameterType.IMAGE,
        pretty_name: 'Base image in overlay.',
        description: 'A base image that gets overlayed.'
      },
      imagePath: {
        type: jspsych.ParameterType.STRING,
        pretty_name: "Path for the images getting overlayed.",
        default: `/static/data/images/stims/`,
      },
      cellSize: {
        type: jspsych.ParameterType.INT,
        pretty_name: "The pixel size of grid cells.",
        default: 25,
      },
      room: {
        type: jspsych.ParameterType.STRING,
        array: true,
        pretty_name: "Room Layout",
        description: "An array of room chunks with their specified chunk-type.",
      },
      isExample: {
        type: jspsych.ParameterType.BOOL,
        pretty_name: "Is it an example?",
        description: "",
      },
      scaleFactor: {
        type: jspsych.ParameterType.INT,
        pretty_name: "Room Scale Factor",
        description: "How much results be scaled by?"
      }
    },
  };

  class VslGridPluginAlt {
    obstacleCounter;
    overlayContainer;
    root;
    displayElement;
    startTime;
    room;
    cells;
    eligibleObstacles;
    canvas;
    brush;
    nextBtn;
    cellSize;
    grid;
    imagePath;
    scaleFactor;

    constructor(jsPsych) {
      this.jsPsych = jsPsych;
      this.obstacleCounter = 0;
      this.maxObstacles = 5;
      this.cells = [];
      this.eligibleObstacles = [];
    }

    getCSS(property) {
      return getComputedStyle(this.root).getPropertyValue(property)
    }

    setCSS(property, value) {
      this.root.style.setProperty(property, value);
    }

    getObstacleImage(imageName) {
      return `${this.imagePath}/${imageName}`.replace(/\\(\\)+/, "/")
    }

    get gridSize() {
      // https://stackoverflow.com/a/42769683
      // const cellSize = parseFloat(this.getCSS("--cell-size"));
      // const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return this.cellSize * (this.scaleFactor || 1);
      // return cellSize * 12;
    }

    get obstacles() {
      // Get all images that aren't the background image
      return this.overlayContainer.querySelectorAll("img:not(#base-img)");
    }

    get canEndTrial() {
      return this.obstacles.length >= this.maxObstacles;
    }

    get entranceLocation() {
      const entranceRow = this.room[this.room.length - 1]
      const entranceLoc = entranceRow.map((cell, index) => roomChar2Word[cell] === "entrance" ? index : null).filter(e => e);
      return entranceLoc.reduce((a, b) => a + b, 0) / entranceLoc.length;
    }

    get scaleFactor() {
      // https://www.jspsych.org/7.0/plugins/resize/index.html#data-generated
      return this.jsPsych.data.get()
        .filter({
          type: "cc_scale"
        })
        .first(1)
        .select("scale_factor")
        .values[0] || 1;
    }

    trial(display_element, trial) {
      this.displayElement = display_element;
      this.displayElement.innerHTML = trial.html;
      this.room = trial.room;
      this.scaleFactor = trial.scaleFactor;
      this.imagePath = trial.imagePath;
      this.cellSize = trial.cellSize;

      !trial.isExample && document.querySelector("#demo-banners").classList.add("d-none", "invisible");

      this.root = document.querySelector(":root");
      this.setCSS("--n-rows", this.room.length);
      this.setCSS("--n-cols", this.room[0].length);
      this.setCSS("--cell-size", `${this.cellSize}px`);
      this.setCSS("--scale-factor", this.scaleFactor);
      this.grid = {
        nRows: this.room.length,
        nCols: this.room[0].length,
      }

      this.startTime = performance.now();

      this.overlayContainer = document.querySelector("#overlay-container");

      // Add the base image
      const baseImage = document.getElementById("base-img");
      baseImage.src = trial.baseImage;
      this.overlayContainer.style.height = `${baseImage.naturalHeight * this.scaleFactor}px`;
      this.overlayContainer.style.width = `${baseImage.naturalWidth * this.scaleFactor}px`;
      console.log(`vsl-grid-scene ->`, {
        scaleFactor: this.scaleFactor,
        width: this.overlayContainer.style.width,
        height: this.overlayContainer.style.height,
      });

      // Generate the grid for participants to click on
      this.canvas = this.createCanvas()
      this.generateGrid()
      this.canvas.add(...this.cells)

      this.brush = new fabric.SquareBrush(this.canvas, {
        obstacles: this.eligibleObstacles,
        width: this.gridSize,
        modeColors: {
          "draw": this.getCSS("--grid-obstacle-bg"),
          "erase": this.getCSS("--grid-room-chunk-bg"),
        }
      });
      this.canvas.freeDrawingBrush = this.brush;
      this.setupBrushToggles();
      // Setup the `Next` button for participants to advance
      this.nextBtn = document.querySelector("#next");
      this.nextBtn.disabled = true;
      this.nextBtn.addEventListener("click", () => {
        (this.canEndTrial) && this.endTrial();
      });
    }

    createCanvas = () => {
      const canvas = new fabric.Canvas("grid-canvas", {
        // TODO: check that the hex code works instead of `rgb(240, 240, 240)`.
        backgroundColor: "#f0f0f0",
        centeredScaling: true,
        selection: false,
        isDrawingMode: true,
        viewportTransform: [1, 0, 0, 1, 0.5 * this.gridSize, 0.5 * this.gridSize],
      })
      canvas.setDimensions({
        width: this.grid.nCols * this.gridSize,
        height: this.grid.nRows * this.gridSize,
      })

      canvas.on({
        "object:modified": ({
          cell,
          mode
        }) => {
          console.log(mode, cell.my.point);
          switch (mode) {
            case "draw":
              this.addOverlayImage(cell.my.point);
              break;
            case "erase":
              this.delOverlayImage(cell.my.point);
              break;
          }
          this.nextBtn.disabled = !this.canEndTrial;
        }
      });

      return canvas;
    };

    generateGrid = () => {
      const chunkColors = this.room.map(rows => rows.map(col => roomChar2Word[col]));
      const cartesian =
        (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));
      const rowColProduct = cartesian(_.range(0, this.grid.nRows), _.range(0, this.grid.nCols));

      const obstacles = [];
      const cells = [];
      for (const [row, col] of rowColProduct) {
        const point = new fabric.Point(col, row);
        const cellType = chunkColors[row][col];
        const cell = this.addCell(point, cellType);
        cells.push(cell);
        (cellType === "room-chunk") && obstacles.push(point);
      }

      this.cells = cells;
      this.eligibleObstacles = obstacles;
    }

    addCell = (point, cellType) => {
      const name = `cell-${point.x}-${point.y}`;
      return new fabric.Rect({
        name,
        width: this.gridSize,
        height: this.gridSize,
        fill: this.getCSS(`--grid-${cellType}-bg`),
        stroke: this.getCSS("--grid-stroke-color"),
        strokeWidth: parseFloat(this.getCSS("--grid-stroke-width")) * this.gridSize,
        left: point.x * this.gridSize,
        top: point.y * this.gridSize,
        hasControls: false,
        selectable: false,
        hasBorders: false,
        originX: "center",
        originY: "center",
        my: {
          cellType,
          activeColor: this.getCSS(`--grid-${cellType}-bg`),
          point,
        }
      })
    }

    computeZIndex(elem) {
      const x = parseInt(elem.getAttribute("col"));
      const y = parseInt(elem.getAttribute("row"));
      // As `x` approaches the middle, the `z-index` should increase. As `x` approaches the min/max
      //    coordinates, the `z-index` should decrease -- so it looks a bit like a triangle in the
      //    z-axis.
      const zIndexX = this.entranceLocation - x;
      const zIndexY = (this.grid.nRows - 1 - y);
      return -(zIndexX * zIndexY);
    }

    addOverlayImage(point) {
      if (this.getOverlayImage(point)) {
        return
      }

      const {
        x,
        y
      } = point;
      const img = document.createElement("img");
      img.classList.add("img-overlay");
      img.src = this.getObstacleImage(`${x}_${y}.png`);
      const zIndexX = -Math.abs(this.entranceLocation - x);
      const zIndexY = this.grid.nRows - 1 - y;
      const zIndex = -zIndexY + zIndexX * zIndexY;
      img.style.zIndex = zIndex;

      img.setAttribute("col", x);
      img.setAttribute("row", y);
      this.overlayContainer.appendChild(img)
    }

    delOverlayImage(point) {
      const child = this.getOverlayImage(point);
      if (child) {
        child.remove();
      }
      this.cleanUpOverlayImages()
    }

    getOverlayImage(point) {
      const {
        x,
        y
      } = point;
      return this.overlayContainer.querySelector(`img[col="${x}"][row="${y}"]`);
    }

    cleanUpOverlayImages() {
      for (const cell of this.cells) {
        const shouldBeEmpty = (cell.fill === this.getCSS("--grid-room-chunk-bg"));
        const overlayImg = this.getOverlayImage(cell.my.point);
        if (shouldBeEmpty && overlayImg) {
          overlayImg.remove();
        }
      }
    }

    setupBrushToggles() {
      const drawBtn = document.querySelector("#draw");
      const eraseBtn = document.querySelector("#erase");

      drawBtn.addEventListener("click", () => {
        // TODO toggle "draw" mode on the `SquareBrush`
        this.brush.setMode("draw");
        drawBtn.classList.add("active");
        eraseBtn.classList.remove("active");
      })
      eraseBtn.addEventListener("click", () => {
        // TODO toggle "erase" mode on the `SquareBrush`
        this.brush.setMode("erase");
        eraseBtn.classList.add("active");
        drawBtn.classList.remove("active");
      })

      drawBtn.click();
    }

    endTrial() {
      // kill any remaining setTimeout handlers
      this.jsPsych.pluginAPI.clearAllTimeouts();

      for (const obstacle of this.obstacles) {
        const row = obstacle.getAttribute("row");
        const col = obstacle.getAttribute("col");
        this.room[row][col] = "o";
      }

      const expandedRoom = this.room.reduce((expRow, row) => {
        const scaledCols = row.map(cell => new Array(this.scaleFactor).fill(cell)).flat()
        const scaledRows = new Array(this.scaleFactor).fill(scaledCols);
        expRow.push(...scaledRows);
        return expRow;
      }, [])


      const trialData = {
        original_room: this.room,
        rescaled_room: expandedRoom,
        n_obstacles: this.obstacles.length,
        // obstsacles: this.obstacles,
        rt: performance.now() - this.startTime,
      }

      // Clear the display
      this.displayElement.innerHTML = "";

      // Move to the next trial
      this.jsPsych.finishTrial(trialData);
    }
  }

  VslGridPluginAlt.info = info;

  return VslGridPluginAlt;

})(jsPsychModule);