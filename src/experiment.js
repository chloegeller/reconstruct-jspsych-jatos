/**
 * @title reconstruction-jspsych
 * @description 
 * @version 0.1.0
 *
 * @assets assets/
 */

// You can import stylesheets (.scss or .css).
import "../styles/main.scss";

import FullscreenPlugin from "@jspsych/plugin-fullscreen";
import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import jsPsychSurveyMultiChoice from '@jspsych/plugin-survey-multi-choice';
import jsPsychImageKeyboardResponse from '@jspsych/plugin-image-keyboard-response';
import jsPsychInstructions from '@jspsych/plugin-instructions';
import jsPsychSurveyText from '@jspsych/plugin-survey-text';
import PreloadPlugin from "@jspsych/plugin-preload";
import jsPsychResize from "@jspsych/plugin-resize";
import jsPsychHtmlButtonResponse from "@jspsych/plugin-html-button-response";
import jsPsychVslGridAlt from "./plugins/jspsych-vsl-grid-scene"
import {
  initJsPsych
} from "jspsych";

import { doorCondition } from "./condlist.json";
/**
 * This function will be executed by jsPsych Builder and is expected to run the jsPsych experiment
 *
 * @type {import("jspsych-builder").RunFunction}
 */


// Define global experiment variables
var N_TRIALS = 16;
var EXP_DURATION = 20;

// Debug Variables
var SKIP_PROLIFIC_ID = false;
var SKIP_INSTRUCTIONS = true; // variable doesn't work atm -- chloë 01/20/2023

const baseRoom = `
wwwwwwwwwwwwwwww
w              w
w              w
w              w
w              w
w              w
w              w
w              w
w              w
w              w
w              w
wb            bw
wbb          bbw
wbbb        bbbw
bbbbb      bbbbb
bbbbbbbBbbbbbbbb
`.toLowerCase().replace(/ /g, "0").split("\n").filter(e => e).map(row => Array.from(row))

// //! Ensuring that these locations are marked as entrance/exit
baseRoom[baseRoom.length - 1][7] = "e"

const IMAGE_PATH = `/assets/images`;
const STIM_IMAGES = `${IMAGE_PATH}/stims`;
const OBSTACLE_IMAGES = `${IMAGE_PATH}/obstacles`
const STIM_IMAGE_W = 720;
const STIM_IMAGE_H = 480;

/**************
 * Experiment *
 **************/
const CONDITIONS = {
  0: {
    exits: [],
    baseImage: "empty_no_door.png",
  }, // No exit
  1: {
    exits: [4],
    baseImage: "empty_left_door.png",
  }, // Exit on the left
  2: {
    exits: [11],
    baseImage: "empty_right_door.png",
  }, // Exit on the right
}

const setExits = (room, exits = []) => {
  room[0] = room[0].map((cell, index) => exits.includes(index) ? "x" : "w");
  // room[1] = room[1].map((cell, index) => exits.includes(index) ? "x" : "w"); // uncomment for 32x32 room
  return room;
}

const makeImageGridPair = (jsPsych, gridHTML, {
  roomID,
  stimImage,
  condition,
  isExample = false,
}) => {
  const {
    exits,
    baseImage
  } = CONDITIONS[condition];
  const room = setExits(Array.from(baseRoom), exits);
  const prefix = isExample ? "example" : "trial";

  // stimulus trial
  const image = {
    type: jsPsychImageKeyboardResponse,
    stimulus: `${STIM_IMAGES}/${stimImage}`,
    maintain_aspect_ratio: true,
    stimulus_height: STIM_IMAGE_H,
    stimulus_width: STIM_IMAGE_W,
    render_on_canvas: false,
    choices: "NO_KEYS",
    trial_duration: 750,
    post_trial_gap: 250, // duration between trials
    data: {
      // add any additional data that needs to be recorded here
      type: `${prefix}_image`,
    },
    on_start: (trial) => {
      const scaleFactor = jsPsych.data.get()
        .filter({
          type: "cc_scale"
        })
        .first(1)
        .select("scale_factor")
        .values[0] || 1;
      trial.stimulus_width = STIM_IMAGE_W * scaleFactor;
      trial.stimulus_height = STIM_IMAGE_H * scaleFactor;
      console.log(`${prefix}_image ->`, {
        scaleFactor,
        width: trial.stimulus_width,
        height: trial.stimulus_height
      })
      return trial;
    }
  };

  const grid = {
    type: jsPsychVslGridAlt,
    html: gridHTML,
    cellSize: 25,
    baseImage: `${STIM_IMAGES}/${baseImage}`,
    room,
    isExample,
    imagePath: `${OBSTACLE_IMAGES}`,
    data: {
      // add any additional data that needs to be recorded here
      type: `${prefix}_grid`,
      exit: condition,
      scene_id: roomID,

    }
  };

  return [image, grid];
}

export async function run({
  assetPaths,
  input = {},
  environment,
  title,
  version
}) {
  const jsPsych = initJsPsych({
    show_progress_bar: true,
    // FIXME: detect dev or jatos env
    // TODO: uncomment below before `npm run jatos`, comment during dev
    // on_trial_start: jatos.addAbortButton,
  });

  // ! TODO: what do here??? ask John for halp
  // empty html template for jsPsych to use
  psiTurk.showPage('trial.html');
  const gridHTML = psiTurk.getPage("experiments/grid.html");
  const wrappedMakeImageGridPair = (args) => makeImageGridPair(jsPsych, gridHTML, args)

  const control_list = condition_list[1].slice(0, N_TRIALS)
  condition_list = condition_list[0]

  var left_exit = []
  var right_exit = []

  for (const condition of condition_list) {
    const exit_location = condition[condition.length - 1];
    const exit_list = exit_location == 1 ? left_exit : right_exit;
    exit_list.push(condition);
  }

  left_exit = left_exit.slice(0, N_TRIALS)
  right_exit = right_exit.slice(0, N_TRIALS)

  condition_list = left_exit.concat(right_exit).concat(control_list)

  // shuffle conditions
  condition_list = shuffle(condition_list);


  const timeline = [];

  // Preload assets
  timeline.push({
    type: PreloadPlugin,
    images: assetPaths.images,
    // audio: assetPaths.audio,
    // video: assetPaths.video,
  });

  // Switch to fullscreen
  timeline.push({
    type: FullscreenPlugin,
    fullscreen_mode: true,
  });

  // ask for participant ID
  var prolific_id = {
    type: jsPsychSurveyText,
    questions: [{
      prompt: 'What is your Prolific ID?',
      required: true
    }],
    data: {
      // add any additional data that needs to be recorded here
      type: "prolific_id",
    }
  };
  // add the following trial pages to be displayed in their respective order
  if (!SKIP_PROLIFIC_ID) {
    timeline.push(prolific_id);
  };

  // ---------------------
  //      welcome page    
  // ---------------------
  var welcome = {
    type: jsPsychInstructions,
    pages: [
      `<h1>Hi, welcome to our study!</h1><br><br> ` +
      `Please take a moment to adjust your seating so that you can comfortably watch the monitor and use the keyboard/mouse.<br> ` +
      `Feel free to dim the lights as well.  ` +
      `Close the door or do whatever is necessary to minimize disturbance during the experiment. <br> ` +
      `Please also take a moment to silence your phone so that you are not interrupted by any messages mid-experiment. ` +
      `<br><br> ` +
      `Click <b>Next</b> when you are ready to continue. `,
    ],
    show_clickable_nav: true,
    allow_backward: false,
    data: {
      // add any additional data that needs to be recorded here
      type: "welcome",
    }
  };

  timeline.push(welcome);
  // ---------------------
  var cc_scale = {
    type: jsPsychResize,
    item_width: 480, // 3 + 3 / 8,
    item_height: 288, // 2 + 1 / 8,
    starting_size: 384,
    prompt: `<p>Please sit comfortably in front of you monitor and outstretch your arm holding a credit card (or a similary sized ID card).</p> <p>Click and drag the lower right corner of the box until the box is the same size as a credit card held up to the screen.</p> `,
    pixels_per_unit: 1,
    data: {
      type: "cc_scale"
    },
    on_finish: (data) => {
      document.querySelector("#jspsych-content").style.removeProperty("transform");
    }
  };

  timeline.push(cc_scale);

  // ---------------------
  //      instructions    
  // ---------------------
  var instructions = {
    type: jsPsychInstructions,
    pages: [
      `The study is designed to be <i>challenging</i>. Sometimes, you'll be certain about what you saw. Other times, you won't be -- and this is okay! Just give your best guess each time. <br><br>` + `Click <b>Next</b> to continue.`,
      `We know it is also difficult to stay focused for so long, especially when you are doing the same thing over and over. But remember, the experiment will be all over in less than ${EXP_DURATION} minutes. <br>` + `There are <strong>${3 * N_TRIALS} trials</strong> in this study. <br>` + `Please do your best to remain focused! Your responses will only be useful to us if you remain focused. <br><br>` + `Click <b>Next</b> to continue.`,
      `In this study, you will briefly see an image and then asked to reconstruct what you saw. <br>` +
      `After the image dissapears, click on the grid to re-assemble the image you previously saw. <br> <br>` +
      `Click <b>Next</b> to continue.`,
      `Your task is to re-assemble the image. <br>` +
      `<strong>The next screen will be a demonstration trial.</strong> <br>` +
      `Please take the time to familiarize yourself with the interface during the demonstration. <br><br>` +
      `Click <b>Next</b> when you are ready to start the demonstration.`,
    ],
    show_clickable_nav: true,
    show_page_number: true,
    page_label: "<b>Instructions</b>",
    allow_backward: false,
  };
  // ---------------------

  // ---------------------
  //        examples      
  // ---------------------

  const exampleImage = "30_2.png";
  const exampleImageRooms = wrappedMakeImageGridPair({
    roomID: 30,
    stimImage: exampleImage,
    condition: 2,
    isExample: true
  });

  // ---------------------

  // ---------------------
  // comprehension check  
  // ---------------------
  // questions
  var comp_check = {
    type: jsPsychSurveyMultiChoice,
    preamble: "<h2>Comprehension Check</h2>",
    questions: [{
        prompt: "In this experiment you will press the <strong>Erase</strong> button to <strong>add boxes</strong> to an empty scene using a grid.",
        name: 'check1',
        options: ['True', "False"],
        required: true
      },
      {
        prompt: "Your task for this experiment is to <strong>place boxes to reconstruct an image</strong> in an empty scene using a grid.",
        name: 'check2',
        options: ['True', "False"],
        required: true
      },
    ],
    randomize_question_order: true,
    on_finish: function (data) {
      var q1 = data.response.check1;
      var q2 = data.response.check2;

      // set to true if both comp checks are passed
      data.correct = (q1 == 'False' && q2 == "True") ? true : false;
    },
    data: {
      // add any additional data that needs to be recorded here
      type: "comp_quiz",
    }
  };


  // feedback
  var comp_feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      var last_correct_resp = jsPsych.data.getLastTrialData().values()[0].correct;

      if (last_correct_resp) {
        return `<span style='color:green'><h2>You passed the comprehension check!</h2></span> ` + `<br>When you're ready, please click <b>Next</b> to begin the study. `
      } else {
        return `<span style='color:red'><h2>You failed to respond <b>correctly</b> to all parts of the comprehension check.</h2></span> ` + `<br>Please click <b>Next</b> to revisit the instructions. `
      }
    },
    choices: ['Next'],
    data: {
      // add any additional data that needs to be recorded here
      type: "comp_feedback",
    }
  };

  // `comp_loop`: if answers are incorrect, `comp_check` will be repeated until answers are correct responses
  var comp_loop = {
    timeline: [
      instructions,
      ...exampleImageRooms,
      comp_check,
      comp_feedback
    ],
    loop_function: function (data) {
      // check if `comp_check` was passed, break loop 
      return (data.values()[3].correct) ? false : true;
    }
  };

  timeline.push(comp_loop);
  // ---------------------

  // ---------------------
  //        trials        
  // ---------------------
  for (const trial of condition_list) {
    const [roomID, stimImage, condition] = trial;

    const imageRoomPair = wrappedMakeImageGridPair({
      roomID,
      stimImage,
      condition,
    });

    // display grid
    timeline.push(...imageRoomPair);
  }
  // ---------------------


  // ---------------------
  //       end page        
  // ---------------------
  var end_trial = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<h2><b>Thank you for helping us with our study! :) </b></h2><br><br> ` +
      `Click <b>Done</b> to submit your responses. <br> `,
    choices: ['<b>Done</b>'],
  };
  var exit_fullscreen = {
    type: jsPsychFullscreen,
    fullscreen_mode: false,
    delay_after: 0
  };
  // display end message
  timeline.push(end_trial, exit_fullscreen);
  // ---------------------

  await jsPsych.run(timeline);

  // Return the jsPsych instance so jsPsych Builder can access the experiment results (remove this
  // if you handle results yourself, be it here or in `on_finish()`)
  return jsPsych;
}