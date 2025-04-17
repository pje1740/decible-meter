class DecibelMeter {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.isRunning = false;
    this.animationFrameId = null;
    this.mediaStream = null;

    // Calibration constants
    this.REFERENCE_PRESSURE = 20; // 20 μPa (0 dB SPL)
    this.MIC_SENSITIVITY = 0.94; // Adjusted sensitivity for typical computer microphones
    this.CALIBRATION_OFFSET = 30; // Offset to account for typical ambient noise

    this.startButton = document.getElementById("startButton");
    this.stopButton = document.getElementById("stopButton");
    this.levelElement = document.getElementById("level");
    this.dbValueElement = document.getElementById("dbValue");

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.startButton.addEventListener("click", () => this.start());
    this.stopButton.addEventListener("click", () => this.stop());
  }

  async start() {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      // Create audio context
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
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
      alert(
        "Error accessing microphone. Please make sure you have granted microphone permissions."
      );
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

    this.levelElement.style.width = "0%";
    this.dbValueElement.textContent = "-- dB SPL";
  }

  measure() {
    if (!this.isRunning) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS value
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);

    // Convert to Pascals and apply calibration
    // The raw value is 0-255, we need to convert it to Pascals
    // We multiply by 100 to convert from μPa to Pa
    const pressure = (rms / 255) * this.MIC_SENSITIVITY * 100;

    // Convert to decibels using the formula: dB = 20 * log10(pressure / reference_pressure)
    // Add calibration offset to account for typical ambient noise
    const db =
      20 * Math.log10(pressure / this.REFERENCE_PRESSURE) +
      this.CALIBRATION_OFFSET;

    // Update UI
    this.updateMeter(db);

    // Continue measuring
    this.animationFrameId = requestAnimationFrame(() => this.measure());
  }

  updateMeter(db) {
    // Normalize dB value to 0-100% for the meter
    // Range from 30dB (quiet room) to 100dB (very loud)
    const normalizedValue = Math.max(0, Math.min(100, (db - 30) * (100 / 70)));

    this.levelElement.style.width = `${normalizedValue}%`;
    this.dbValueElement.textContent = `${db.toFixed(1)} dB SPL`;
  }
}

// Initialize the decibel meter when the page loads
window.addEventListener("load", () => {
  new DecibelMeter();
});
