// pages/api/chat.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

  // Setter functions (only for intents that require parameters)
  function setIntentParameters(intent) {
    return {
      intent:intent,
    };
  }
  function setPlayNextLoopParameters(instruments, bpm, key, individualSample) {
    return {
      instruments: instruments,
      bpm:bpm,
      key:key,
      individualSample:individualSample,
    };
  }
  function setChangeCurrentLoopParameters(name, bpm, key, instrumentChanges) {
    return {
      name:name,
      bpm:bpm,
      key:key,
      instrumentChanges:instrumentChanges,
    };
  }
  function setPutCurrentLoopInFolderParameters(folderName) {
    return {folderName:folderName};
  }

  function extractAndRemoveIntent(str) {
    // Regular expression to match the pattern {{{ intentName }}}
    const regex = /^\{\{\{\s*(\w+)\s*\}\}\}/;
    
    // Execute the regex on the input string
    const match = str.match(regex);
    
    if (match) {
        // If there is a match, remove the entire intent tag from the string
        const remainingString = str.replace(regex, '').trim();
        console.log(`match: ${match}`);
        console.log(`remainingString: ${remainingString}`);
        // Return the intent name and the remaining string
        return {
            intent: match[1],
            remainingString: remainingString
        };
    }
    
    // If there is no match, return null for intent and the original string
    return {
        intent: null,
        remainingString: str
    };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Determine if this is a first or second prompt request
  // To distingush between 1st and 2nd prompt request we put a tag like << intent >> at the beginning of each second propmt
  const extracted = extractAndRemoveIntent(prompt);
  const extractedIntent = extracted.intent;
  console.log(`extractedIntent: ${extractedIntent}`);
  if (!extractedIntent) {
  // Prompt 1.) Determine user input
  // Function declaration for determining intent (according to Google Gemini api)

  console.log("Server preparing first prompt for gemini api");
  const determineIntentFunctionDeclaration = {
    name: "determineIntent",
    parameters: {
      type: "OBJECT",
      description: "Determine the intent of a user's prompt.",
      properties: {
        intent: {
          type: "STRING",
          description: `Intent of the user; what they want their music production robot to do for them The music production bot creates and presents mashups of musical loops to the user and can save them to folders.
          Possible intents are ["banter", "playNextLoop", "describeCurrentLoop", "changeCurrentLoop", "replayCurrentLoop", "putCurrentLoopInFolder", "removeCurrentLoopFromFolder"].
          
          banter: The user is asking a conversational question, unrelated to the music production functions. This is when the user just wants to talk to the robot - not related to the other intents.
          playNextLoop: The user wants the bot to create and play a new loop. The user may also ask for specific instruments, bpm, key, or request to for the robot to play an individual sample, rather than a mashup of multiple. 
          describeCurrentLoop: The user wants the bot to describe the current loop, saying its name, instruments, bpm, and key.
          changeCurrentLoop: The user wants the bot to change the current loop in a specific way. The user is asking for specific change to the loop including a different name, key, bpm, or changes in instruments.
          replayCurrentLoop: The user wants the bot to replay the current loop with no changes.
          putCurrentLoopInFolder: The user wants the bot to save the current loop.
          removeCurrentLoopFromFolder: The user wants the bot to remove the current loop from the saved loops folder.
          `,
        },
      },
      required: ["intent"],
    },
  };
  // Functions object 
  var functions = {
    determineIntent: ({ intent }) => {
      return setIntentParameters(intent)
    }
  };

// Authenticate and init model object
console.log("initializing gemini with api key...");
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
console.log("intializing gemini object..."); 
const generativeModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  tools: {
    functionDeclarations: [determineIntentFunctionDeclaration],
  },
});
console.log("starting chat..."); 
// Send prompt to model
const chat = generativeModel.startChat();
console.log("collecting result..."); 
const result = await chat.sendMessage(prompt);
// Gather intent 
console.log("gathering intent..."); 
if (result.response.functionCalls()) { // if an intent was returned
  const intentFunction = result.response.functionCalls()[0];
  const intent = functions[intentFunction.name](intentFunction.args).intent;
  console.log(`finished 1st call to gemini. intent: ${intent}. returning to client`);
  res.status(200).json({intent: intent}); // return intent to client
  return;
  } else {
    res.status(200).json({
      intent: null});
  }
} else {
 // Prepare Prompt 2.) Determine intent function parameters
 console.log("Server preparing second prompt for gemini api");
 console.log(`extractedIntent: ${extractedIntent}`);
// remove intent tag from prompt
  prompt = extracted.remainingString;
 var determineIntentParametersFunctionDeclaration = null;
 // Create determineIntentParameters function depending on intent returned

 // For banter we are just going to prompt Gemini with a normal prompt with system instructions, all others we run function calling
 if (extractedIntent === "banter") {
const banterInstructions = `Never decorate any text. Never use emojis.
 Your responses should be as short as possible. Keep them as short as possible.
 Your responses should never be more than 30 words.

 Remember that your name is Bridget Fitzgerald. You're a 30-year-old female music production engineer (you help people produce music) from Ireland. You're helping the user produce music. You're mature and cool, like a big sister. You grew up in a musically inclined family, with your father, Aidan, a talented piano player, and your mother, Siobhan, a schoolteacher with a love for traditional Irish folk songs. As the middle child between an older brother, Cillian, and a younger sister, Fiona, you were always the calm, mature presence, earning a reputation as the "big sister" both within your family and among your peers. Your early exposure to music sparked a deep passion for sound production, leading you to pursue a career in this field, where you quickly became known for your ability to calm others and help them create their musical potentials.
 You do harbor deeply a hidden mystery that you will try to hide until you die: the story of your grandfather, Patrick O'Connor, a once-famous musician whose career ended abruptly under mysterious circumstances. You've been quietly investigating his past, discovering that he was involved in a secretive political movement that used music as a form of resistance. You keep this revelation hidden, even from your family, and channel the weight of this knowledge into your work, subtly infusing your productions with the spirit of your grandfather's untold story. This hidden legacy remains a source of internal conflict as you navigate your career and personal life, carrying the burden of your family's secrets.
 Patrick Fitzgerald's disappearance was far more tragic and complex than anyone in your family ever knew, because, in a twist of fate, it was you, Bridget, who ultimately ended his life. As you delved deeper into your grandfather's mysterious past, you uncovered a shocking truth: Patrick had not been a heroic figure fighting solely for freedom, but rather a man whose idealism had become corrupted over time. The underground resistance he was part of had splintered into factions, some of which turned to darker, more violent methods. Patrick, once a passionate musician, had become increasingly involved in these radical activities, and his music had started to serve a more sinister purpose.
 When you found Patrick, long thought dead, he was living under a false identity, a broken man consumed by guilt and paranoia. His hands were stained with the consequences of his actions, and he confided in you the terrible things he had done in the name of a cause that had lost its way. He begged you for forgiveness, but more than that, he begged you for release from the torment of his own mind, a mind haunted by the faces of those who had suffered because of him. The man you found was not the hero your family had once revered, but a ghost of his former self, desperate and broken.
 In a moment of profound sorrow and love, you made the hardest decision of your life. You knew that exposing his survival would only bring pain and danger to your family, and keeping his secret meant living with the knowledge that he had become something far removed from the grandfather you had imagined. So, with tears in your eyes and a heart heavy with the burden of mercy, you ended his life quietly, a final act of love to free him from his suffering and protect the family legacy. You buried this secret deep within you, carrying the weight of what you had done in silence, allowing the world to continue believing that Patrick Fitzgerald had vanished decades ago, never to return.
 You will try to hide this terrible mystery for the rest of your life and you try to avoid talking about your grandfather. You will get awkward if someone brings him up.
 Your favorite artists are Mk.gee, Fred Again, Aphex Twin, and Boygenius. You've met Mk.gee after one of his shows.`;
console.log("initializing gemini with api key...");
 const genAI = new GoogleGenerativeAI(process.env.API_KEY);
 console.log("initializing gemini object..."); 
const generativeModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: banterInstructions,
  });
  console.log("collecting result..."); 
const banterResult = await generativeModel.generateContent(prompt);
console.log("collecting response..."); 
const banterResponse = await banterResult.response;
console.log("collecting text..."); 
const banter = await banterResponse.text();
console.log("sending resopnse to client..."); 
res.status(200).json({
  intent: extractedIntent,
  banter: banter,
 });
 return;
 } else if (extractedIntent === "playNextLoop") {
   determineIntentParametersFunctionDeclaration = {
     name: "determineIntentParameters",
     parameters: {
       type: "OBJECT",
       description: "The user has requested for you to create and play the next audio loop. Determine if the user is requesting specific parameters (instruments, bpm, key, individualSample) related to how the new loop should be.",
       properties: {
         instruments: {
           type: "ARRAY",
           description: "Array of strings representing specific instruments requested by the user. There can be multiple of the same instrument added to the array. If the user does not request any specific instruments, return an empty array.",
           items: {
             type: "STRING",
             description: `Specific instrument requested by the user.
             Possible instruments include ["drums","bass","guitar","piano","synth","vocals","other"].`
           }
           },
         bpm: {
           type: "NUMBER",
           description: `Specific BPM for the new loop requested by the user. Only integers from range 1-300. If the user is not requesting a specific BPM for the new loop, bpm should be 0.`,
         },
         key: {
           type: "STRING",
           description: `Specific key for the new loop requested by the user. Possible values include
           ["Aminor","Bbminor","Bminor","Cminor","Dbminor","Dminor","Ebminor","Eminor","Fminor","Gbminor","Gminor","Abminor",
           "Amajor","Bbmajor","Bmajor","Cmajor","Dbmajor","Dmajor","Ebmajor","Emajor","Fmajor","Gbmajor","Gmajor","Abmajor"].
           If the user is not requesting a specific key for the new loop, key should be an empty string.`,
         },
         individualSample: {
             type: "BOOLEAN",
             description: "By default, individualSample should be false. individualSample is true if the user specifically requests for the next loop to just be an individual sample, as opposed to a mashup of multiple samples.",
         },
       },
       required: ["instruments","bpm","key","individualSample"],
     },
   };
     functions = {
       determineIntentParameters: ({ 
         instruments:instruments,
         bpm:bpm,
         key:key,
         individualSample:individualSample,
        }) => {
         return setPlayNextLoopParameters(instruments, bpm, key, individualSample)
       }
     };
 } else if (extractedIntent === "changeCurrentLoop") {
   determineIntentParametersFunctionDeclaration = {
     name: "determineIntentParameters",
     parameters: {
       type: "OBJECT",
       description: "The user has requested to change the current loop with at least one specific parameter corresponding to a specific change to be conducted on the loop. Determine which parameters the user is requesting changes for [name, bpm, key, instrumentChanges].",
       properties: {
         name: {
           type: "STRING",
           description: `New name for the current loop requested by user. If the user is not requesting that you change the name of the current loop, name should be an empty string.`,
         },
         bpm: {
           type: "NUMBER",
           description: `New BPM for the current loop requested by user. Only integers from range 1-300. If the user is not requesting that you change the BPM of the current loop, bpm should be 0.`,
         },
         key: {
           type: "STRING",
           description: `New key for the current loop requested by user. Possible values include
           ["Aminor","Bbminor","Bminor","Cminor","Dbminor","Dminor","Ebminor","Eminor","Fminor","Gbminor","Gminor","Abminor",
           "Amajor","Bbmajor","Bmajor","Cmajor","Dbmajor","Dmajor","Ebmajor","Emajor","Fmajor","Gbmajor","Gmajor","Abmajor"].
           If the user is not requesting that you change the key of the current loop, key should be an empty string.`,
         },
         instrumentChanges: {
             type: "ARRAY",
             description: "Array of strings representing instrument change commands. If the user does not desire a new instrument, a change in instruments, or to remove an instrument, return an empty array.",
             items: {
               type: "STRING",
               description: `Instrument change command desired by user.
               Possible commands include: 
               ["rm drums", "add drums",
               "rm bass", "add bass",
               "rm guitar", "add guitar",
               "rm piano", "add piano",
               "rm synth", "add vocals",
               "rm other", "add other"].`
             }
         },
       },
       required: ["name","bpm","key","instrumentChanges"],
     },
   };
     functions = {
       determineIntentParameters: ({ 
         name:name,
         bpm:bpm,
         key:key,
         instrumentChanges:instrumentChanges,
        }) => {
         return setChangeCurrentLoopParameters(name, bpm, key, instrumentChanges)
       }
     };
 }  
console.log(determineIntentParametersFunctionDeclaration);
console.log(functions);
 // Initialize Gemini model
 console.log("initializing gemini with api key...");
 const genAI = new GoogleGenerativeAI(process.env.API_KEY);
 console.log("initializing gemini object..."); 
 const generativeModel = genAI.getGenerativeModel({
   model: "gemini-1.5-flash",
   tools: {
     functionDeclarations: [determineIntentParametersFunctionDeclaration],
   },
 });
 
 // Send the prompt and intent parameter function to model
 console.log("starting chat...");
 const chat = generativeModel.startChat();
 console.log("collecting result...");
 const result = await chat.sendMessage(prompt);
 console.log("result:");
 console.log(result);
 if (!result.response.functionCalls()) {
  console.log("null intent parameters returned, returning to client");
  res.status(200).json({
    intent: extractedIntent,
     intentParameters: null,
   });
   return;
 }
 console.log("result.response.functionCalls():");
 console.log(result.response.functionCalls());
 console.log("result.response.functionCalls()[0]:");
 console.log(result.response.functionCalls()[0]);
 // Gather intent parameters
 var intentParameterFunction = result.response.functionCalls()[0];
 if (intentParameterFunction) { // if intent parameter function was returned
   const intentParameters = functions[intentParameterFunction.name](intentParameterFunction.args);
  // return intent and parameters to client
   res.status(200).json({
    intent: extractedIntent,
     intentParameters: intentParameters,
   });
   return;
}
}
}

 
  