import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";
import { fabric } from "fabric";
import _ from "lodash-es";
import "./jspsych-vsl-grid-scene.fabric"
// import { SquareBrush } from "fabric";

const roomChar2Word = {
  "w": "wall", // wall
  "e": "entrance", // entrance
  "o": "obstacle", // obstacle
  "x": "exit", // exit
  "b": "outside-fov", // no blocks
  0: "room-chunk", // empty spaces
}

const roomChar2WordFeedback = {
  "w": "wall", // wall
  "e": "entrance", // entrance
  "o": "obstacle", // obstacle
  "x": "exit", // exit
  "b": "outside-fov", // no blocks
  "c": "correct",
  "m": "missing",
  "i": "incorrect",
  0: "room-chunk", // empty spaces
  1: "correct-room-chunk", // correct empty space 
}

const info = <const>{
  name: "vsl-grid-scene",
  parameters: {
    html: {
      type: ParameterType.STRING,
      pretty_name: "HTML Template",
      description: "We need to pass in the HTML template since JSPsych can't load local HTML",
    },
    baseImage: {
      type: ParameterType.IMAGE,
      pretty_name: 'Base image in overlay.',
      description: 'A base image that gets overlayed.'
    },
    imagePath: {
      type: ParameterType.STRING,
      pretty_name: "Path for the images getting overlayed.",
      default: `/static/data/images/stims/`,
    },
    cellSize: {
      type: ParameterType.INT,
      pretty_name: "The pixel size of grid cells.",
      default: 25,
    },
    room: {
      type: ParameterType.STRING,
      array: true,
      pretty_name: "Room Layout",
      description: "An array of room chunks with their specified chunk-type.",
    },
    gtRoom: {
      type: ParameterType.STRING,
      array: true,
      pretty_name: "Ground Truth Room Layout",
      description: "An array of room chunks with their specified chunk-type.",
    },
    isExample: {
      type: ParameterType.BOOL,
      pretty_name: "Is it an example?",
      description: "",
    },
    isFeedback: {
      type: ParameterType.BOOL,
      pretty_name: "Is it a feedback example?",
      description: "",
    },
    roomScaleFactor: {
      type: ParameterType.INT,
      pretty_name: "Room Scale Factor",
      description: "How much results be scaled by?"
    },
    passingPercentageFeedback: {
      type: ParameterType.FLOAT,
      pretty_name: "Passing Grade for Feedback trials",
      description: ""
    }
  },
};

type Info = typeof info;

class VSLGridPlugin implements JsPsychPlugin<Info> {
  static info = info;

    private maxObstacles = 0;
    obstacleCounter;
    overlayContainer;
    root;
    displayElement;
    startTime;
    room;
    gtRoom;
    isExample;
    isFeedback;
    percentageFeedback;
    passingPercentageFeedback;
    cells;
    eligibleObstacles;
    canvas;
    exampleFeedbackCanvas;
    brush;
    nextBtn;
    feedbackBtn;
    startOverBtn;
    cellSize;
    grid;
    imagePath;
    roomScaleFactor;

    constructor(private jsPsych: JsPsych) {
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

    trial(display_element: Element, trial: TrialType<Info>) {
      this.displayElement = display_element;
      this.displayElement.innerHTML = trial.html;
      this.room = trial.room;
      this.roomScaleFactor = trial.roomScaleFactor;
      this.imagePath = trial.imagePath;
      this.cellSize = trial.cellSize;
      this.gtRoom = trial.gtRoom;
      this.isExample = trial.isExample;
      this.isFeedback = trial.isFeedback;
      this.passingPercentageFeedback = trial.passingPercentageFeedback;

      
      !trial.isExample && document.querySelector("#demo-banners")?.classList.add("d-none", "invisible");
      !trial.isFeedback && document.querySelector("#demo-banners-feedback")?.classList.add("d-none", "invisible");
      !trial.isFeedback && document.querySelector("#feedback")?.classList.add("d-none", "invisible");

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

      // Setup the `Feedback` button for participants to advance
      this.feedbackBtn = document.querySelector("#feedback");
      this.feedbackBtn.disabled = true;

      if (this.isFeedback) {
        this.feedbackBtn.addEventListener("click", () => {
          (this.canEndTrial) && this.generateExampleFeedback();

          // disable editing buttons
          document.querySelector("#draw")?.classList.add("d-none", "invisible");
          document.querySelector("#erase")?.classList.add("d-none", "invisible");

          // after grid feedback is displayed, move to next trial
          this.nextBtn.addEventListener("click", () => {
            (this.canEndTrial) && this.endTrialFeedback();
          });
        });
      } else {
        this.nextBtn.addEventListener("click", () => {
          (this.canEndTrial) && this.endTrial();
        });
      }
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

      canvas.on(
        "object:modified", ({
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
          this.feedbackBtn.disabled = !this.canEndTrial;
        }
      );

      return canvas;
    };

    generateGrid = () => {
      const chunkColors = this.room.map(rows => rows.map(col => roomChar2Word[col]));
      const cartesian =
        (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));
      const rowColProduct = cartesian(_.range(0, this.grid.nRows), _.range(0, this.grid.nCols));

      const obstacles = [];
      const cells: fabric.Rect[] = [];
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
      img.style.zIndex = `${zIndex}`;

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
      const drawBtn = document?.querySelector("#draw");
      const eraseBtn = document?.querySelector("#erase");

      drawBtn?.addEventListener("click", () => {
        // TODO toggle "draw" mode on the `SquareBrush`
        this.brush.setMode("draw");
        drawBtn.classList.add("active");
        eraseBtn?.classList.remove("active");
      })
      eraseBtn?.addEventListener("click", () => {
        // TODO toggle "erase" mode on the `SquareBrush`
        this.brush.setMode("erase");
        eraseBtn?.classList.add("active");
        drawBtn?.classList.remove("active");
      })

      drawBtn?.click();
    }

    generateExampleFeedback = () => {
      var feedbackComparisonRoom = this.getExampleComparisonRoom();
      var roundedPercentage: number = +this.getFeedbackPercentage(feedbackComparisonRoom);
      this.percentageFeedback = roundedPercentage;
      
      this.generateExampleFeedbackGrid(feedbackComparisonRoom);
      this.canvas.add(...this.cells)
    }
    
    generateExampleFeedbackGrid = (feedbackComparisonRoom) => {
      // TODO: rewrite function, change roomChar2Word, to include new symbols for "m", "i", "c", and "1"
      const chunkColors = feedbackComparisonRoom.map(rows => rows.map(col => roomChar2WordFeedback[col]));
      const cartesian =
        (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));
      const rowColProduct = cartesian(_.range(0, this.grid.nRows), _.range(0, this.grid.nCols));

      const obstacles = [];
      const cells: fabric.Rect[] = [];
      for (const [row, col] of rowColProduct) {
        const point = new fabric.Point(col, row);
        const cellType = chunkColors[row][col];
        const cell = this.addCell(point, cellType);
        cells.push(cell);
        (cellType === "correct-room-chunk") && obstacles.push(point);
      }

      this.cells = cells;
      this.eligibleObstacles = obstacles;
    }

    getExampleComparisonRoom = () => {
      // Define the comparison grid
      const comparisonRoom: string[][] = [];
      var responseRoom = this.room;

      for (const obstacle of this.obstacles) {
        const row = obstacle.getAttribute("row");
        const col = obstacle.getAttribute("col");
        responseRoom[row][col] = "o";
      }

      // Define the excluded characters and their corresponding symbols
      const excludedCharacters = {
        "w": "w",
        "b": "b",
        "e": "e",
        "x": "x"
      };

      // Iterate over each row in the grids
      for (let row = 0; row < this.gtRoom.length; row++) {
        comparisonRoom[row] = [];

        // Iterate over each column in the grids
        for (let col = 0; col < this.gtRoom[row].length; col++) {
          const groundTruthCell = this.gtRoom[row][col];
          const responseCell = responseRoom[row][col];

          // Check if the cell contains an excluded character
          if (excludedCharacters.hasOwnProperty(groundTruthCell) || excludedCharacters.hasOwnProperty(responseCell)) {
            const excludedChar = excludedCharacters[groundTruthCell] || excludedCharacters[responseCell];
            comparisonRoom[row][col] = excludedChar; // Set the excluded character in the comparison grid
            continue; // Skip comparison
          }

          // Compare the cells and update the comparison grid
          if ((responseCell == "0") && (groundTruthCell === responseCell)) {
            comparisonRoom[row][col] = "1"; // Correct obstacle
          } else if ((responseCell == "o") && (groundTruthCell === responseCell)) {
            comparisonRoom[row][col] = "c"; // Correct obstacle
          } else if ((responseCell == "o") && (groundTruthCell != responseCell)){
            comparisonRoom[row][col] = "i"; // Incorrect obstacle
          } else if (responseCell == "0") {
            comparisonRoom[row][col] = "m"; // Missed obstacle
          }
        }
      }

      // Now you have the comparison grid with characters representing the comparison result
      return comparisonRoom;
    }

    getFeedbackPercentage = (comparisonRoom) => {
      // Initialize counters
      let totalCells = 0;
      let correctCells = 0;

      // Iterate over each cell in the comparison grid
      for (let row = 0; row < comparisonRoom.length; row++) {
        for (let col = 0; col < comparisonRoom[row].length; col++) {
          const cell = comparisonRoom[row][col];

          // Exclude cells with excluded characters
          if (cell === "w" || cell === "b" || cell === "e" || cell === "x") {
            continue;
          }

          // Increment the total cell count
          totalCells++;

          // Check for correct cells
          if (cell === "c") {
            correctCells++;
          } else if (cell === "1") {
            correctCells += 0.75
          } else if (cell === "i") {
            correctCells -= 0.5;
          } else if (cell === "m") {
            correctCells -= 0.25;
          }
        }
      }

      // Calculate the percentage
      const percentage = (correctCells / totalCells) * 100;
      // Round the percentage to two decimal places
      const roundedPercentage = Math.round(percentage * 100) / 100;
      return roundedPercentage;
    }

    endTrialFeedback() {
      // kill any remaining setTimeout handlers
      this.jsPsych.pluginAPI.clearAllTimeouts();

      for (const obstacle of this.obstacles) {
        const row = obstacle.getAttribute("row");
        const col = obstacle.getAttribute("col");
        this.room[row][col] = "o";
      }

      const expandedRoom = this.room.reduce((expRow, row) => {
        const scaledCols = row.map(cell => new Array(this.roomScaleFactor).fill(cell)).flat()
        const scaledRows = new Array(this.roomScaleFactor).fill(scaledCols);
        expRow.push(...scaledRows);
        return expRow;
      }, [])

      const trialData = {
        original_room: this.room,
        rescaled_room: expandedRoom,
        n_obstacles: this.obstacles.length,
        feedback_percentage: this.percentageFeedback,
        // obstsacles: this.obstacles,
        rt: performance.now() - this.startTime,
      }

      if (this.isFeedback) {
        this.generateExampleFeedback();
      }
      // Clear the display
      this.displayElement.innerHTML = "";

      // Move to the next trial
      this.jsPsych.finishTrial(trialData);
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
        const scaledCols = row.map(cell => new Array(this.roomScaleFactor).fill(cell)).flat()
        const scaledRows = new Array(this.roomScaleFactor).fill(scaledCols);
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

  export default VSLGridPlugin;