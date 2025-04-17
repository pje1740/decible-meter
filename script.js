class DecibelMeter {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.isRunning = false;
    this.animationFrameId = null;
    this.mediaStream = null;

    // Get DOM elements
    this.startButton = document.getElementById("startButton");
    this.stopButton = document.getElementById("stopButton");
    this.levelElement = document.getElementById("level");
    this.dbValueElement = document.getElementById("dbValue");
    this.levelLabel = document.getElementById("levelLabel");

    // Check if all required elements exist
    if (
      !this.startButton ||
      !this.stopButton ||
      !this.levelElement ||
      !this.dbValueElement ||
      !this.levelLabel
    ) {
      console.error(
        "Required DOM elements not found. Please check the HTML structure."
      );
      return;
    }

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.startButton.addEventListener("click", () => this.start());
    this.stopButton.addEventListener("click", () => this.stop());
  }

  async start() {
    try {
      // Check if the browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Your browser does not support accessing the microphone. Please use a modern browser like Chrome, Firefox, or Safari."
        );
      }

      // Request microphone access with constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });

      // Create audio context
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Check if audio context is in suspended state (happens in some browsers)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      // Connect microphone to analyser
      this.microphone = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );
      this.microphone.connect(this.analyser);

      this.isRunning = true;
      this.startButton.disabled = true;
      this.stopButton.disabled = false;

      // Start measuring
      this.measure();
    } catch (error) {
      console.error("Error accessing microphone:", error);

      let errorMessage = "Error accessing microphone. ";

      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        errorMessage +=
          "Microphone access was denied. Please allow microphone access in your browser settings:\n\n" +
          "1. Click the camera/microphone icon in your browser's address bar\n" +
          '2. Select "Allow" for microphone access\n' +
          "3. Refresh the page and try again";
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        errorMessage +=
          "No microphone found. Please make sure a microphone is connected to your device.";
      } else if (
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        errorMessage +=
          "Could not start microphone. It may be in use by another application.";
      } else {
        errorMessage +=
          error.message ||
          "Please check your microphone permissions and try again.";
      }

      alert(errorMessage);

      // Reset button state
      this.startButton.disabled = false;
      this.stopButton.disabled = true;
    }
  }

  stop() {
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      // Stop all tracks in the media stream
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.isRunning = false;
    this.startButton.disabled = false;
    this.stopButton.disabled = true;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Reset gauge to initial state
    if (this.levelElement && this.dbValueElement && this.levelLabel) {
      this.levelElement.style.clipPath = "polygon(0 0, 0 0, 0 100%, 0 100%)";
      const valueElement = this.dbValueElement.querySelector(".value");
      if (valueElement) {
        valueElement.textContent = "--";
      }
      this.levelLabel.textContent = "Ambient";
    }
  }

  measure() {
    if (!this.isRunning) return;

    const bufferLength = this.analyser.fftSize;
    const timeDomainData = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(timeDomainData);

    // RMS 계산
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      sumSquares += timeDomainData[i] * timeDomainData[i];
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    // 데시벨 계산
    // refRMS는 1.0을 기준으로 두거나, calibrationValue 기준으로 설정할 수 있음
    const refRMS = 1.0; // or from a calibration step
    let db = 20 * Math.log10(rms / refRMS);

    // 보정값 (선택사항)
    // 예: 평균적으로 0.1 RMS가 85dB로 추정될 경우:
    const CALIBRATION_OFFSET = 85 + 20 * Math.log10(1 / 0.1); // ≈ 105
    db = 20 * Math.log10(rms) + CALIBRATION_OFFSET;

    // 범위 제한
    db = Math.max(30, Math.min(120, db));

    // Update UI
    this.updateMeter(db);

    // Continue measuring
    this.animationFrameId = requestAnimationFrame(() => this.measure());
  }

  updateMeter(db) {
    if (!this.levelElement || !this.dbValueElement || !this.levelLabel) return;

    // Normalize dB value to 0-100% for the meter
    // Range from 30dB (quiet room) to 100dB (very loud)
    const normalizedValue = Math.max(0, Math.min(100, (db - 30) * (100 / 70)));

    // Update the gauge fill by clipping from the left
    const fillPercentage = normalizedValue / 100;
    this.levelElement.style.clipPath = `polygon(0 0, ${
      fillPercentage * 100
    }% 0, ${fillPercentage * 100}% 100%, 0 100%)`;

    // Update the value display
    const valueElement = this.dbValueElement.querySelector(".value");
    if (valueElement) {
      valueElement.textContent = Math.round(db);
    }

    // Update level label
    let label = "Extremely Low";
    if (db < 50) {
      label = "Low";
    } else if (db < 70) {
      label = "Average";
    } else if (db < 85) {
      label = "High";
    } else {
      label = "Extremely High";
    }
    this.levelLabel.textContent = label;
  }
}

// Initialize the decibel meter when the page loads
window.addEventListener("load", () => {
  new DecibelMeter();
});
