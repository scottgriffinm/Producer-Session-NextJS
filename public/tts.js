// public/tts.js

// Function to find and store the Moira voice from available voices
function findMoiraVoice(synthInstance) {
  const voices = synthInstance.getVoices();
  for(let i = 0; i < voices.length; i++) {
    if (voices[i].name === 'Moira' && voices[i].lang === 'en-IE') {
      return voices[i];  // Return the Moira voice if found
    }
  }
  return null;  // Return null if Moira voice is not found
}

// Function to speak the provided text using Moira's voice
function speakText(text, callback) {
  console.log("speakText called");
  console.log("initializing speech...");
  const synthInstance = window.speechSynthesis || null;
  if (!synthInstance) return;  // Exit if speech synthesis is not supported

  const moiraVoice = findMoiraVoice(synthInstance);
  if (!moiraVoice) {
    console.error('Moira voice not found');
    return;
  }

  const utterThis = new SpeechSynthesisUtterance(text);
  utterThis.voice = moiraVoice;  // Set the voice to Moira
  utterThis.pitch = 0.8;  // Set pitch
  utterThis.rate = 0.7;  // Set rate
  console.log("making callback function for after speech...");
  console.log(`callback: ${callback}`);
  utterThis.onend = () => {
    if (callback) {
      callback();  // Call the callback after TTS finishes
    }
  };
  console.log("speaking text...");
  synthInstance.speak(utterThis);  // Speak the text
}

// Export the speakText function
export { speakText };
