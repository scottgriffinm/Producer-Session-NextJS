import { useEffect, useState, useRef } from 'react';
import { generate} from "random-words";
import { speakText } from '../public/tts';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [displayedText, setDisplayedText] = useState(''); // State for the text currently displayed
  const [isUserTurn, setIsUserTurn] = useState(true);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isRecognitionActive = useRef(true); // Flag to control whether recognition should be processed
  const isFirstRecognition = useRef(true); // Flag to check if it's the first recognition of the user's turn
  const blobRefs = useRef([]);
  const blobs = useRef([]);

  // Sentence starter list with a sort weighting of responses (for non-banter responses)
  const sentenceStarters = ['ok, ', 'alright, ', 'ok, ', 'alright, ', 'heard, ', 'gotcha, ', 'gotcha, ',  '', ''];


  function getRandomItem(arr) {
    const randomIndex = Math.floor(Math.random() * arr.length);
    return arr[randomIndex];
}

function capitalizeFirstLetter(str) {
  if (!str) return str; // Check if the string is not empty
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Make a random boolean array with bias (Ex: n=5, bias=.8 -> [true, true, false, true, true])
function getRandomBooleanArray(n, trueBias = 0.5) {
  if (trueBias < 0 || trueBias > 1) {
      throw new Error("Bias must be a value between 0 and 1");
  }
  return Array.from({ length: n }, () => Math.random() < trueBias);
}
function getRandomBpm(bpm) {
  const minBPM = 1;
  const maxBPM = 300;
  const standardDeviation = 20;
  // Generate a random number following a normal distribution
  function randomNormalDistribution() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  // Calculate the new BPM with the normal distribution deviation
  const deviation = randomNormalDistribution() * standardDeviation;
  let newBPM = Math.round(bpm + deviation);
  // Ensure the new BPM is within the allowed range
  if (newBPM < minBPM) newBPM = minBPM;
  if (newBPM > maxBPM) newBPM = maxBPM;
  return newBPM;
}

function getRandomKey(key) {
  const keys = [
    'Aminor', 'Bbminor', 'Bminor', 'Cminor', 'Dbminor', 'Dminor', 'Ebminor', 'Eminor', 
    'Fminor', 'Gbminor', 'Gminor', 'Abminor', 'Amajor', 'Bbmajor', 'Bmajor', 'Cmajor', 
    'Dbmajor', 'Dmajor', 'Ebmajor', 'Emajor', 'Fmajor', 'Gbmajor', 'Gmajor', 'Abmajor'
  ];
  const standardDeviation = 1;
  // Generate a random number following a normal distribution
  function randomNormalDistribution() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  // Calculate the deviation in terms of the index position
  const deviation = Math.round(randomNormalDistribution() * standardDeviation);
  // Find the index of the current key in the array
  const currentIndex = keys.indexOf(key);
  // Calculate the new index with the deviation
  let newIndex = currentIndex + deviation;
  // Ensure the new index wraps around correctly within the array bounds
  if (newIndex < 0) {
    newIndex = keys.length + newIndex;
  } else if (newIndex >= keys.length) {
    newIndex = newIndex % keys.length;
  }

  return keys[newIndex];
}

function getRandomName() {
  //todo: test if distribution of 1/2/3/4 word sentences is uniform (should not be)
  console.log("getting random name...");
  const wordList = generate({ min: 1, max: 4 });
  var name = '';
  for (const word in wordList) {
    name = name + word;
  }
  return name;
}

// // Function that checks the value of a variable
// function checkVariable() {
//     console.log("Current value of isUserTurn:", isUserTurn);
//     console.log("Current value of isRecognitionActive:", isRecognitionActive);
//     if (false) {
//         clearInterval(intervalId); // Stop the interval if a condition is met
//     }
// }

// // Set an interval to run the checkVariable function every 1000ms (1 second)
// let intervalId = setInterval(checkVariable, 1000);

  useEffect(() => {
    // Initialize blobs after the component has mounted
    blobs.current = blobRefs.current.map((el) => el ? new Blob(el) : null);

    // Start the update loop
    function update() {
      requestAnimationFrame(update);
      blobs.current.forEach(blob => blob?.update());
    }
    update();
  }, []);

  useEffect(() => {
    // Initialize speech recognition
    console.log("Initializing speech recognition...");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.interimResults = true;
    recognitionRef.current.continuous = false;

    recognitionRef.current.addEventListener('start', () => {
      console.log("recognitionRef start event");
    });
    recognitionRef.current.addEventListener('result', handleSpeechResult);
    recognitionRef.current.addEventListener('end', handleRecognitionEnd);
  recognitionRef.current.addEventListener('error', (event) => {
    console.error("Speech recognition error:", event.error);
  });

    return () => {
      console.log("Unmounting speech recognition...");
  recognitionRef.current.removeEventListener('error', (event) => {
    console.error("Speech recognition error:", event.error);
  });
  recognitionRef.current.removeEventListener('start', () => {
    console.log("recognitionRef start event");
  });
      recognitionRef.current.removeEventListener('result', handleSpeechResult);
      recognitionRef.current.removeEventListener('end', handleRecognitionEnd);
      recognitionRef.current.abort(); // Fully stop recognition on unmount
    };
  }, []);

  useEffect(() => {
    if (isUserTurn) {
      console.log("isUserTurn changed to true");
      isRecognitionActive.current = true; // Enable recognition processing
      startSpeechRecognition();
      isFirstRecognition.current = true; // Reset first recognition flag for the new turn
      blobs.current.forEach(blob => blob?.toggleNotTalkingMode(true)); // Slow blobs down and gray them out
    } else {
      console.log("isUserTurn changed to false");
      isRecognitionActive.current = false; // Disable recognition processing
      stopSpeechRecognition();
      blobs.current.forEach(blob => blob?.toggleNotTalkingMode(false)); // Speed up blobs and color them
    }
  }, [isUserTurn]);

  const startSpeechRecognition = () => {
    
    console.log("Starting speech recognition...");
    if (recognitionRef.current) {
      try {
        console.log("trying recognitionRef.current.start();")
        recognitionRef.current.start();
        console.log("started recognitionRef.current");
      } catch (error) {
        console.error("Error starting recognition:", error);
      }
    }
  };

  const stopSpeechRecognition = () => {
    console.log("Stopping speech recognition...");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort(); // Fully stop recognition
      } catch (error) {
        console.error("Error stopping recognition:", error);
      }
    }
    if (silenceTimerRef.current) {
      console.log("Clearing silence timer...");
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };


  const handleSpeechResult = (e) => {
    console.log("Handling speech result...");
    if (!isUserTurn || !isRecognitionActive.current) return; // Ignore any speech input if recognition is disabled

    if (silenceTimerRef.current) {
      console.log("Clearing silence timer...");
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      console.log("silence timer cleared");
    }
    console.log("Collecting transcripts...");
    const transcript = Array.from(e.results)
      .map((result) => result[0])
      .map((result) => result.transcript)
      .join('');
    if (isFirstRecognition.current) {
      console.log("first recognition");
      // On first recognition, clear Gemini's text and set the flag to false
      setDisplayedText(''); // Clear the previous Gemini text
      isFirstRecognition.current = false;
    }
console.log("updating displayed text...");
    updateDisplayedText(transcript, 'user'); // Display the user's text as it's recognized
    if (e.results[0].isFinal) { // not sure what this is
      console.log("apparently e.results[0].isFinal");
      handleUserMessage(transcript);
    } else {
      console.log("setting silence timer for 5 seconds");
      silenceTimerRef.current = setTimeout(() => {
        stopSpeechRecognition();
        handleUserMessage(transcript);
      }, 5000); // Wait 5 seconds of silence before ending user turn (resets each time user talks)
    }
  };

  const handleRecognitionEnd = () => {
    console.log("handleRecognitionEnd()");
  };

  const handleUserMessage = async (message) => {
    console.log("handleUserMessage()");
    if (!message.trim()) {
      console.log("message empty");
      setIsUserTurn(true); // Resume user's turn if message is empty
      return;
    }

    if (!isRecognitionActive.current) return; // Ensure message processing stops if recognition is disabled
    setIsUserTurn(false);  // Switch to Gemini's turn
    stopSpeechRecognition(); // Ensure recognition is fully stopped

    // Prompt 1.) Determine user intent
    console.log(`message: ${message}`);
    try { // prompt gemini for intent through our chat api
      console.log("sending prompt from client to server");
      const firstPromptResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: message }),
      });

      // collect response object
      const data = await firstPromptResponse.json();
      console.log("client collected first prompt data");
      if (firstPromptResponse.ok) {
      const intent = data.intent;
      console.log(`client recieved first prompt intent: ${intent}`);
      // if null intent say "huh?"
      if (!intent) {
        var speech = "Huh?";
        updateDisplayedText(speech, 'ai'); // Update the displayed text to Gemini's response
        speakText(speech, () => {
          setIsUserTurn(true); // Switch back to user turn after TTS finishes
        });
        return
      }

      // handle intents that dont require parameters
      if (intent === "describeCurrentLoop") {
        // todo: generate speech
        // todo: extract name, instruments, key, and bpm from filename
        // For each instrument add to instruments speech string
        // const describeCurrentLoopResponses = ['The current loop is named <name>, it has <instrumentsSpeech>, it’s in the key of <key>, and its BPM is <bpm>.',
        // 'Current loop is called <name>, has <instrumentsSpeech>, it’s in the key of <key>, and its BPM is <bpm>.']
        // var speech = describeCurrentLoopResponses[random()]
        // find inserters and insert data in speech
        // todo: remove placeholder response
        var speech = "describeCurrentLoop placeholder!";
        updateDisplayedText(speech, 'ai'); // Update the displayed text to Gemini's response
        speakText(speech, () => {
          setIsUserTurn(true); // Switch back to user turn after TTS finishes
        });
        
      }  else if (intent === "replayCurrentLoop") {
        console.log("intent: replayCurrentLoop");
        // todo: replay current loop
         // todo: remove placeholder response
         var speech = "replayCurrentLoop placeholder!";
         updateDisplayedText(speech, 'ai'); // Update the displayed text to Gemini's response
         speakText(speech, () => {
           setIsUserTurn(true); // Switch back to user turn after TTS finishes
         });
        
      } else if (intent === "putCurrentLoopInFolder") {
        console.log("intent: putCurrentLoopInFolder");
        // todo: put loop in folder
        // todo: generate speech
        const putCurrentLoopInFolderResponses = [
          'I saved that loop.',
          'saved.',
          'I saved it.',
          ];
          var speech = getRandomItem(sentenceStarters) + getRandomItem(putCurrentLoopInFolderResponses);
          speech = capitalizeFirstLetter(speech);
         updateDisplayedText(speech, 'ai'); // Update the displayed text to Gemini's response
         speakText(speech, () => {
           setIsUserTurn(true); // Switch back to user turn after TTS finishes
         });
      } else if (intent === "removeCurrentLoopFromFolder") {
        console.log("intent: removeCurrentLoopFromFolder");
        // todo: if current loop in a folder remove from folder else do nothing
        // generate speech
        const removeCurrentLoopFromFolderResponses = [
          'I removed it from our folder.',
          'I unsaved that loop',
          'the loop is no longer saved',
          ];  
          var speech = getRandomItem(sentenceStarters) + getRandomItem(removeCurrentLoopFromFolderResponses);
          speech = capitalizeFirstLetter(speech);
         updateDisplayedText(speech, 'ai'); // Update the displayed text to Gemini's response
         speakText(speech, () => {
           setIsUserTurn(true); // Switch back to user turn after TTS finishes
         });
      } else {

  // Prompt 2.) Determine user intent parameters

  // Append intent tag to message/prompt
  console.log(`intent before sending second time: ${intent}`);
  var messageWithIntentTag = `{{{ ${intent} }}}` + message;
console.log(`message with tag: ${messageWithIntentTag}`);
  const secondPromptResponse = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: messageWithIntentTag }),
  });
  // collect response object
  const data = await secondPromptResponse.json();
  console.log("client collected second prompt data");
  if (secondPromptResponse.ok) {
  console.log(`intent: ${data.intent}`);
  console.log(`intentParameters: ${data.intentParameters}`);
  const intentParameters = data.intentParameters;
      if (intent === "banter") {
        console.log(`speech: ${data.banter}`);
        updateDisplayedText(data.banter, 'ai'); // Update the displayed text to Gemini's response
        speakText(data.banter, () => {
          setIsUserTurn(true); // Switch back to user turn after TTS finishes
        });
      } else if (intent === "playNextLoop") {
        if (intentParameters) {
        console.log(`instruments: ${intentParameters.instruments}`);
        console.log(`bpm: ${intentParameters.bpm}`);
        console.log(`key: ${intentParameters.key}`);
        console.log(`individualSample: ${intentParameters.individualSample}`);
      }
      // todo: generate new name

        // todo: start to make next loop, start text to speech, and play loop after text to speech
        const playNextLoopResponses = ['here’s a new loop.', 'one second...',
          'here’s your next loop.', 'let me cook.'];     
          var speech = getRandomItem(sentenceStarters) + getRandomItem(playNextLoopResponses);
          speech = capitalizeFirstLetter(speech);
        updateDisplayedText(speech, 'ai'); // Update the displayed text to Gemini's response
        speakText(speech, () => {
          setIsUserTurn(true); // Switch back to user turn after TTS finishes
        });
   
      } else if (intent === "changeCurrentLoop") {
        if (intentParameters) {
        console.log(`name: ${intentParameters.name}`);
        console.log(`bpm: ${intentParameters.bpm}`);
        console.log(`key: ${intentParameters.key}`);
        console.log(`instrumentChanges: ${intentParameters.instrumentChanges}`);
        // todo: change loop
        if (intentParameters.instrumentChanges) {}
        if (intentParameters.name) {}
        if (intentParameters.bpm) {}
        if (intentParameters.key) {}
        } else {
        // Randomly change the loop
        // Randomly determine which parameters to change
        const n_parameters = 2; // Number of parameters to consider
        const bias_parameters = .1; // Probability of a parameter being changed
        var parametersToChange = getRandomBooleanArray(n=n_parameters,bias=bias_parameters); // Determine parameters to change
        while (!parametersToChange.contains(true)) { // (at least one)
          parametersToChange = getRandomBooleanArray(n=n_parameters,bias=bias_parameters);
        }  
        for (var i=0; i<=n_parameters; i++) { 
          if (parametersToChange[i]){ // if parameter has been selected to change
          if (i===0) { // bpm
            // todo: change bpm by normal distribution 
            // const newBpm = getRandomBpm(oldBpm);
          } else if (i===1) { // key
            // todo: change key by normal distribution
            //  const newKey = get randomKey(oldKey);
          }
        }
        }
        // instrumentChanges
        // todo: determine how to change instruments
        // todo: make a new name
        //const newName = getRandomName();
        }
    
      // todo: generate speech
      const changeCurrentLoopResponses = [
        'here’s your changed loop.',
        'here’s your loop with those changes.',
        'i’ll make those changes to your loop.'
        ];
        var speech = getRandomItem(sentenceStarters) + getRandomItem(changeCurrentLoopResponses)
        speech = capitalizeFirstLetter(speech);
        // todo: start to change next loop, start text to speech, and play loop after text to speech
         updateDisplayedText(speech, 'ai'); // Update the displayed text to Gemini's response
         speakText(speech, () => {
           setIsUserTurn(true); // Switch back to user turn after TTS finishes
         });
      }  
    } else {
      handleError('Error: Could not get a second response.');
    } 
  }
    } else {
        handleError('Error: Could not get a first response.');
      }
    } catch (error) {
      handleError('Error: Failed to communicate with the server.');
    }
  };

  const handleError = (errorMessage) => {
    updateDisplayedText(errorMessage, 'ai'); // Update the displayed text to the error message
    speakText(errorMessage, () => {
      setIsUserTurn(true);  // Switch back to user turn even on error
    });
  };

  const updateDisplayedText = (text, role) => {
    // Set the displayed text according to the role (user or ai)
    const textColor = role === 'user' ? styles.userText : styles.geminiText;
    setDisplayedText(<p className={textColor}>{text}</p>);
  };

  const handleContainerClick = () => {
    if (!isUserTurn) {
      // Stop the TTS if it's Gemini's turn
      window.speechSynthesis.cancel(); // Cancel the ongoing speech synthesis
      setIsUserTurn(true); // Switch to user's turn immediately
    }
  };
  return (
    <div className={styles.container}>
      <div 
        className={styles.bouncingBlobsContainer}
        onClick={handleContainerClick}
      >
        <div className={styles.bouncingBlobsGlass}></div>
        <div className={styles.bouncingBlobs}>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobBlue}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobBlue}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobBlue}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobWhite}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobPurple}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobPurple}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobPink}`}></div>
          {/* Additional Balls */}
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobBlue}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobWhite}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobPurple}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobPink}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobBlue}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobBlue}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobWhite}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobPurple}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobPink}`}></div>
          <div ref={el => blobRefs.current.push(el)} className={`${styles.bouncingBlob} ${styles.bouncingBlobBlue}`}></div>
        </div>
      </div>
      {displayedText}
    </div>
  );
}

class Blob {
  constructor(el) {
    if (!el) return; // Ensure the element exists
    this.el = el;
    const boundingRect = this.el.getBoundingClientRect();
    this.size = boundingRect.width;
    this.initialX = randomNumber(0, window.innerWidth - this.size);
    this.initialY = randomNumber(0, window.innerHeight - this.size);
    this.el.style.top = `${this.initialY}px`;
    this.el.style.left = `${this.initialX}px`;
    this.vx = randomNumber(Blob.MIN_SPEED, Blob.MAX_SPEED) * (Math.random() > 0.5 ? 1 : -1);
    this.vy = randomNumber(Blob.MIN_SPEED, Blob.MAX_SPEED) * (Math.random() > 0.5 ? 1 : -1);
    this.x = this.initialX;
    this.y = this.initialY;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x >= window.innerWidth - this.size) {
      this.x = window.innerWidth - this.size;
      this.vx *= -1;
    }
    if (this.y >= window.innerHeight - this.size) {
      this.y = window.innerHeight - this.size;
      this.vy *= -1;
    }
    if (this.x <= 0) {
      this.x = 0;
      this.vx *= -1;
    }
    if (this.y <= 0) {
      this.y = 0;
      this.vy *= -1;
    }
    this.move();
  }

  move() {
    this.el.style.transform = `translate(${this.x - this.initialX}px, ${this.y - this.initialY}px)`;
  }

  toggleNotTalkingMode(isNotTalking) {
    if (isNotTalking) {
      this.el.classList.add(styles.notTalking);
      this.adjustSpeed(Blob.SLOW_SPEED);
    } else {
      this.el.classList.remove(styles.notTalking);
      this.adjustSpeed(randomNumber(Blob.MIN_SPEED, Blob.MAX_SPEED));
    }
  }

  adjustSpeed(targetSpeed) {
    const initialVX = this.vx;
    const initialVY = this.vy;
    const deltaVX = targetSpeed * Math.sign(this.vx) - this.vx;
    const deltaVY = targetSpeed * Math.sign(this.vy) - this.vy;
    const startTime = Date.now();

    const updateSpeed = () => {
      const elapsedTime = Date.now() - startTime;
      const t = Math.min(elapsedTime / Blob.SPEED_CHANGE_DURATION, 1); // Normalize time to [0, 1]
      this.vx = initialVX + deltaVX * t;
      this.vy = initialVY + deltaVY * t;

      if (t < 1) {
        requestAnimationFrame(updateSpeed);
      }
    };

    updateSpeed();
  }
}

Blob.MIN_SPEED = 0.5;
Blob.MAX_SPEED = 0.7;
Blob.SLOW_SPEED = 0.3;
Blob.SPEED_CHANGE_DURATION = 1000;

function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}