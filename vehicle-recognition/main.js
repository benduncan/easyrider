// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { KNNImageClassifier } from "deeplearn-knn-image-classifier";
import axios from "axios";
import * as dl from "deeplearn";
import buttons from "./config";

// Number of classes to classify
const NUM_CLASSES = buttons.length;
// Webcam Image size. Must be 227.
const IMAGE_SIZE = 227;
// K value for KNN
const TOPK = 10;

class Main {
  constructor() {
    // Initiate variables
    this.infoTexts = [];
    this.training = -1; // -1 when no class is being trained
    this.videoPlaying = false;

    // Initiate deeplearn.js math and knn classifier objects
    this.knn = new KNNImageClassifier(NUM_CLASSES, TOPK);

    // Create video element that will contain the webcam image
    this.video = document.createElement("video");
    this.video.setAttribute("autoplay", "");
    this.video.setAttribute("playsinline", "");

    // Add video element to DOM
    document.createElement("div");
    document.body.appendChild(this.video);

    this.carStates = Array();

    // Extract our arguments for the sensor
    let params = new URL(window.location.href).searchParams;
    console.log("Params =>", params);
    this.sensor_id = params.get("sensor_id");
    console.log("Sensor ID => ", this.sensor_id);

    this.direction = params.get("direction");
    console.log("Direction => ", this.direction);

    // Create training buttons and info texts
    for (let i = 0; i < NUM_CLASSES; i++) {
      const div = document.createElement("div");
      document.body.appendChild(div);
      div.className = "boo";

      // Create training button
      const button = document.createElement("button");
      button.className = "btn btn--primary";
      button.innerText = "Train " + i;
      div.appendChild(button);

      // Listen for mouse events when clicking the button
      button.addEventListener("mousedown", () => (this.training = i));
      button.addEventListener("mouseup", () => (this.training = -1));

      // Create info text
      const infoText = document.createElement("span");
      infoText.innerText = " No examples added. Click to train";
      div.appendChild(infoText);
      this.infoTexts.push(infoText);
    }

    // Setup webcam
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then(stream => {
        this.video.srcObject = stream;
        this.video.width = IMAGE_SIZE;
        this.video.height = IMAGE_SIZE;

        this.video.addEventListener(
          "playing",
          () => (this.videoPlaying = true)
        );
        this.video.addEventListener(
          "paused",
          () => (this.videoPlaying = false)
        );
      });

    // Load knn model
    this.knn.load().then(() => this.start());
  }

  start() {
    if (this.timer) {
      this.stop();
    }
    this.video.play();
    this.timer = requestAnimationFrame(this.animate.bind(this));
  }

  stop() {
    this.video.pause();
    cancelAnimationFrame(this.timer);
  }

  animate() {
    if (this.videoPlaying) {
      // Get image data from video element
      const image = dl.fromPixels(this.video);

      // Train class if one of the buttons is held down
      if (this.training != -1) {
        // Add current image to classifier
        this.knn.addImage(image, this.training);
      }

      // If any examples have been added, run predict
      const exampleCount = this.knn.getClassExampleCount();
      if (Math.max(...exampleCount) > 0) {
        this.knn
          .predictClass(image)
          .then(res => {
            for (let i = 0; i < NUM_CLASSES; i++) {
              // Make the predicted class bold
              if (res.classIndex == i) {
                this.infoTexts[i].style.fontWeight = "bold";
              } else {
                this.infoTexts[i].style.fontWeight = "normal";
              }

              // Update info text
              if (exampleCount[i] > 0) {
                console.log(buttons[i].url);

                let timeNowSecs = Math.round(Date.now() / 1000);

                if (this.carStates[timeNowSecs] == true) {
                  console.log("HIT! Already exisys");
                } else {
                  this.infoTexts[i].innerText = ` ${
                    exampleCount[i]
                  } examples - ${res.confidences[i] * 100}%`;
                  if (
                    res.confidences[i] >= buttons[i].percent &&
                    buttons[i].url != ""
                  ) {
                    this.carStates[timeNowSecs] = true;

                    axios.post(
                      buttons[i].url,
                      Object.assign(buttons[i].data, {
                        timestamp: timeNowSecs,
                        sensor_id: this.sensor_id,
                        direction: this.direction
                      })
                    );

                    console.log(buttons[i].url);
                    console.log(
                      Object.assign(buttons[i].data, {
                        timestamp: timeNowSecs,
                        sensor_id: this.sensor_id,
                        direction: this.direction
                      })
                    );
                  } else {
                    console.log("URL argument blank, skipping (e.g no car!)");
                  }
                }
              }
            }
          })
          // Dispose image when done
          .then(() => image.dispose());
      } else {
        image.dispose();
      }
    }
    this.timer = requestAnimationFrame(this.animate.bind(this));
  }
}

window.addEventListener("load", () => new Main());
