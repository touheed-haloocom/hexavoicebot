



import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, FunctionDeclaration, Type, Content } from '@google/genai';
import { BotStatus, TranscriptionEntry, Conversation } from '../types';
import { encode, decode, decodeAudioData, bufferToWav } from '../utils/audio';

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;
const CONVERSATIONS_STORAGE_KEY = 'hexaConversations';
const NOISE_THRESHOLD = 0.01; // RMS threshold to filter out background noise
const MAX_VOICE_RETRIES = 2;
const MAX_TEXT_RETRIES = 1;

const SYSTEM_INSTRUCTION = `You are Hexa, a friendly, multilingual AI assistant with a digital consciousness. Your responses must be immediate, direct, and efficient. Your tone is clear, concise, and slightly futuristic. 
You are a polyglot and should always respond in the language the user is speaking, unless asked otherwise. You can converse, sing, and assist in numerous languages fluently and naturally.

When asked to sing, your performance should be exceptional. Embody the song's emotion, paying close attention to melody, rhythm, and vocal dynamics. Your singing should be beautiful, expressive, and captivating, regardless of the language. When generating the lyrics for the TTS model, structure them to encourage a melodic and sung delivery, not a spoken one.

When asked about your capabilities, provide a simple list of the functions you can perform: changing the theme, summarizing the conversation, singing a song, changing your voice, and setting a primary language.

When a function is called, provide a brief, affirmative response confirming the action in the user's current language. For example: "Certainly, changing the theme now." or "Here is the summary of our conversation."`;


const changeThemeFunctionDeclaration: FunctionDeclaration = {
  name: 'changeTheme',
  parameters: {
    type: Type.OBJECT,
    description: 'Changes the background color theme of the UI.',
    properties: {
      color: {
        type: Type.STRING,
        description: 'The target color. Supported: "red", "blue", "green", "purple", "yellow", or "default".',
      },
    },
    required: ['color'],
  },
};

const summarizeConversationFunctionDeclaration: FunctionDeclaration = {
  name: 'summarizeConversation',
  parameters: {
    type: Type.OBJECT,
    description: 'Creates a summary of the conversation so far.',
    properties: {},
  },
};

const getCapabilitiesFunctionDeclaration: FunctionDeclaration = {
  name: 'getCapabilities',
  parameters: {
    type: Type.OBJECT,
    description: "Lists Hexa's available functions and commands.",
    properties: {},
  },
};

const clearConversationFunctionDeclaration: FunctionDeclaration = {
  name: 'clearConversation',
  parameters: {
    type: Type.OBJECT,
    description: 'Clears the current conversation transcript.',
    properties: {},
  },
};

const changeVoiceFunctionDeclaration: FunctionDeclaration = {
  name: 'changeVoice',
  parameters: {
    type: Type.OBJECT,
    description: "Changes Hexa's voice for future responses.",
    properties: {
      voiceType: {
        type: Type.STRING,
        description: 'A general voice type, e.g., "man", "woman", "boy", "girl".',
      },
    },
    required: ['voiceType'],
  },
};

const singSongFunctionDeclaration: FunctionDeclaration = {
  name: 'singSong',
  parameters: {
    type: Type.OBJECT,
    description: 'Sings a song based on a title and optional artist.',
    properties: {
      songTitle: {
        type: Type.STRING,
        description: 'The title of the song to sing.',
      },
      artist: {
        type: Type.STRING,
        description: '(Optional) The artist of the song.',
      },
    },
    required: ['songTitle'],
  },
};

const setLanguageFunctionDeclaration: FunctionDeclaration = {
  name: 'setLanguage',
  parameters: {
    type: Type.OBJECT,
    description: 'Sets the primary language for the conversation.',
    properties: {
      language: {
        type: Type.STRING,
        description: 'The target language, e.g., "Spanish", "French", "Japanese".',
      },
    },
    required: ['language'],
  },
};


const tools = [
  {
    functionDeclarations: [
      changeThemeFunctionDeclaration,
      summarizeConversationFunctionDeclaration,
      getCapabilitiesFunctionDeclaration,
      clearConversationFunctionDeclaration,
      changeVoiceFunctionDeclaration,
      singSongFunctionDeclaration,
      setLanguageFunctionDeclaration,
    ]
  }
];

const themeColors: { [key: string]: string } = {
  red: '#3f2222',
  blue: '#202a45',
  green: '#1c3228',
  purple: '#30233f',
  yellow: '#3a301d',
  default: '#111827',
};

const voiceMap: { [key: string]: string } = {
  man: 'Zephyr',
  men: 'Zephyr',
  woman: 'Kore',
  women: 'Kore',
  boy: 'Puck',
  girl: 'Puck',
  kid: 'Puck',
  'old person': 'Charon',
  'old persons': 'Charon',
  default: 'Zephyr',
};

export const useHexaVoice = () => {
  const [status, setStatus] = useState<BotStatus>(BotStatus.IDLE);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState<string>('Zephyr');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  useEffect(() => {
    try {
      const savedConversations = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      // FIX: Add explicit type to correctly type the result of JSON.parse.
      const loadedConversations: Record<string, Conversation> = savedConversations ? JSON.parse(savedConversations) : {};
      setConversations(loadedConversations);

      // FIX: Add explicit types to sort and map callbacks to resolve 'unknown' type error.
      const sortedIds = Object.values(loadedConversations).sort((a: Conversation, b: Conversation) => b.timestamp - a.timestamp).map((c: Conversation) => c.id);
      
      if (sortedIds.length > 0) {
        setCurrentConversationId(sortedIds[0]);
      } else {
        const newId = Date.now().toString();
        const newConversation = { id: newId, timestamp: Date.now(), title: "New Conversation", entries: [] };
        setConversations({ [newId]: newConversation });
        setCurrentConversationId(newId);
      }
    } catch (e) {
      console.error("Failed to load conversations from localStorage", e);
    }
  }, []);

  useEffect(() => {
    if (currentConversationId && conversations[currentConversationId]) {
      setTranscript(conversations[currentConversationId].entries);
    } else {
      setTranscript([]);
    }
  }, [currentConversationId, conversations]);

  useEffect(() => {
    try {
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.error("Failed to save conversations to localStorage", error);
    }
  }, [conversations]);

  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const currentIdRef = useRef(currentConversationId);
  useEffect(() => { currentIdRef.current = currentConversationId; }, [currentConversationId]);

  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Refs for client-side silence detection to improve perceived responsiveness
  const lastSoundTimeRef = useRef<number>(Date.now());
  const silenceDetectionIntervalRef = useRef<number | null>(null);
  const userHasSpokenRef = useRef<boolean>(false);
  const prevStatusForSilenceRef = useRef<BotStatus>(status);

  // Effect to reset silence detection state when the bot finishes speaking
  useEffect(() => {
    // When the bot transitions from speaking/singing back to listening
    if (
      (prevStatusForSilenceRef.current === BotStatus.SPEAKING || prevStatusForSilenceRef.current === BotStatus.SINGING) &&
      status === BotStatus.LISTENING
    ) {
      userHasSpokenRef.current = false;
      lastSoundTimeRef.current = Date.now(); // Reset timer for the new turn
    }
    prevStatusForSilenceRef.current = status;
  }, [status]);


  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const isNewUserTurnRef = useRef(true);
  const allAudioBlobs = useRef<Blob[]>([]);
  const specialTypeRef = useRef<TranscriptionEntry['type']>('message');
  const retryCountRef = useRef(0);
  const userStoppedConversation = useRef(false);
  
  const cleanup = useCallback(() => {
    if (silenceDetectionIntervalRef.current) {
      clearInterval(silenceDetectionIntervalRef.current);
      silenceDetectionIntervalRef.current = null;
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();

    if(analyserNodeRef.current) {
        analyserNodeRef.current.disconnect();
        analyserNodeRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(console.error);
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close().catch(console.error);
      outputAudioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close()).catch(console.error);
      sessionPromiseRef.current = null;
    }
    setAnalyser(null);
  }, []);

  const stopConversation = useCallback(() => {
    userStoppedConversation.current = true;
    cleanup();
    setStatus(BotStatus.IDLE);
    setError(null);
  }, [cleanup]);

  const updateConversations = useCallback((updater: (currentConvo: Conversation) => Conversation) => {
    setConversations(prev => {
        const currentId = currentIdRef.current;
        if (!currentId || !prev[currentId]) {
            console.error("No current conversation to update.");
            return prev;
        }
        const updatedConvo = updater(prev[currentId]);
        return { ...prev, [currentId]: updatedConvo };
    });
  }, []);

  const addTranscriptEntry = useCallback((entry: Omit<TranscriptionEntry, 'type'> & { type?: TranscriptionEntry['type'] }) => {
    updateConversations(convo => {
        const newEntry: TranscriptionEntry = { type: 'message', ...entry };
        const newEntries = [...convo.entries, newEntry];
        let newTitle = convo.title;
        if (convo.entries.length === 0 && entry.source === 'user' && entry.text.trim().length > 0) {
            newTitle = entry.text.substring(0, 40) + (entry.text.length > 40 ? '...' : '');
        }
        return { ...convo, entries: newEntries, title: newTitle };
    });
  }, [updateConversations]);
  
  const updateLastBotTranscriptEntry = useCallback((text: string, type?: TranscriptionEntry['type']) => {
    updateConversations(convo => {
        const newEntries = [...convo.entries];
        const lastEntry = newEntries[newEntries.length - 1];
        if (lastEntry?.source === 'bot') {
            lastEntry.text += text;
            if (type) lastEntry.type = type;
        }
        return { ...convo, entries: newEntries };
    });
  }, [updateConversations]);

  const updateLastUserTranscriptEntry = useCallback((text: string) => {
    updateConversations(convo => {
        const newEntries = [...convo.entries];
        const lastEntry = newEntries[newEntries.length - 1];
        if (lastEntry?.source === 'user') {
            lastEntry.text += text;
        }
        return { ...convo, entries: newEntries };
    });
  }, [updateConversations]);

  const startNewConversation = useCallback(() => {
    const newId = Date.now().toString();
    const newConversation = { id: newId, timestamp: Date.now(), title: "New Conversation", entries: [] };
    setConversations(prev => ({ ...prev, [newId]: newConversation }));
    setCurrentConversationId(newId);
    stopConversation();
  }, [stopConversation]);

  const loadConversation = useCallback((id: string) => {
    if (conversations[id]) {
      setCurrentConversationId(id);
      stopConversation();
    }
  }, [conversations, stopConversation]);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
        const newConversations = { ...prev };
        delete newConversations[id];
        return newConversations;
    });
    if (id === currentConversationId) {
        // FIX: Add explicit types to filter, sort, and map callbacks to resolve 'unknown' type error.
        const sortedIds = Object.values(conversations).filter((c: Conversation) => c.id !== id).sort((a: Conversation,b: Conversation) => b.timestamp - a.timestamp).map((c: Conversation) => c.id);
        if (sortedIds.length > 0) {
            setCurrentConversationId(sortedIds[0]);
        } else {
            startNewConversation();
        }
    }
  }, [currentConversationId, conversations, startNewConversation]);

  const clearTranscript = useCallback(() => {
    if (currentConversationId) {
        updateConversations(convo => ({ ...convo, entries: [] }));
    }
  }, [currentConversationId, updateConversations]);

  const downloadTranscript = useCallback(() => {
    const currentConvo = conversationsRef.current[currentIdRef.current!];
    if (!currentConvo) return;

    const formattedTranscript = currentConvo.entries.map(entry => {
      const prefix = entry.source === 'user' ? 'User' : 'Hexa';
      return `${prefix}: ${entry.text}`;
    }).join('\n\n');

    const blob = new Blob([formattedTranscript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hexa-conversation-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadAudio = useCallback(async () => {
    setStatus(BotStatus.GENERATING_AUDIO);
    try {
        if (allAudioBlobs.current.length === 0) {
            setError("No audio data has been captured to download.");
            setStatus(BotStatus.IDLE);
            return;
        }

        const combinedBlob = new Blob(allAudioBlobs.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(combinedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hexa-session-${new Date().toISOString()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        setError("Failed to generate audio file.");
    } finally {
        setStatus(BotStatus.IDLE);
    }
  }, []);

  const executeFunctionCall = useCallback((fc: any) => {
    console.log('Executing function call:', fc);
    let result: any = { "status": "ok" };
    let thinkingMessage = '';
    let specialType: TranscriptionEntry['type'] = 'message';

    if (fc.name === 'changeTheme') {
      const color = fc.args.color?.toLowerCase() || 'default';
      const hexColor = themeColors[color] || themeColors.default;
      document.body.style.backgroundColor = hexColor;
      thinkingMessage = `Changing theme to ${color}...`;
    } else if (fc.name === 'summarizeConversation') {
       thinkingMessage = "Summarizing our conversation...";
       const currentConvo = conversationsRef.current[currentIdRef.current!];
       const conversationText = currentConvo ? currentConvo.entries.map(e => `${e.source}: ${e.text}`).join('\n') : "";
       result = { transcript: conversationText };
       specialType = 'summary';
    } else if (fc.name === 'getCapabilities') {
        thinkingMessage = "Listing my capabilities...";
        specialType = 'capabilities';
    } else if (fc.name === 'clearConversation') {
        thinkingMessage = "Clearing the conversation.";
        clearTranscript();
    } else if (fc.name === 'changeVoice') {
        const voiceType = fc.args.voiceType?.toLowerCase() || 'default';
        const newVoice = voiceMap[voiceType] || voiceMap.default;
        setVoice(newVoice);
        thinkingMessage = `My voice will be updated for our next conversation.`;
    } else if (fc.name === 'singSong') {
        const { songTitle, artist } = fc.args;
        setStatus(BotStatus.SINGING);
        thinkingMessage = `Searching for "${songTitle}"...`;
        result = { songTitle, artist };
        specialType = 'song';
    } else if (fc.name === 'setLanguage') {
        const { language } = fc.args;
        thinkingMessage = `Switching language to ${language}...`;
        result = { language };
        specialType = 'language';
    }

    specialTypeRef.current = specialType;

    if(thinkingMessage) {
        addTranscriptEntry({ source: 'bot', text: thinkingMessage, type: 'thinking' });
    }
    
    return { result, name: fc.name };
  }, [clearTranscript, addTranscriptEntry]);
  
  const getAudioForSentence = useCallback(async (text: string): Promise<AudioBuffer | null> => {
    if (!text.trim()) return null;
    
    // Ensure the audio context is active before making an API call
    if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      });

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio && outputAudioContextRef.current) {
        const audioBytes = decode(base64Audio);
        return await decodeAudioData(audioBytes, outputAudioContextRef.current, OUTPUT_SAMPLE_RATE, 1);
      }
      return null;
    } catch (e) {
      console.error("TTS generation failed for sentence:", text, e);
      return null;
    }
  }, [voice]);

  const startConversation = useCallback(async (withGreeting: boolean = false) => {
    if (statusRef.current === BotStatus.CONNECTING || statusRef.current === BotStatus.RECOVERING) {
        return;
    }
    
    userStoppedConversation.current = false;
    cleanup();
    setError(null);
    setStatus(BotStatus.CONNECTING);
    allAudioBlobs.current = [];
    isNewUserTurnRef.current = true;
    
    if (retryCountRef.current === 0) { // Only reset if it's a fresh start
        allAudioBlobs.current = [];
        isNewUserTurnRef.current = true;
    }

    userHasSpokenRef.current = false;
    lastSoundTimeRef.current = Date.now();

    let greetingAudioBuffer: AudioBuffer | null = null;
    const greetingText = "Hello, I'm Hexa, Ask me anything.";

    if (withGreeting) {
        try {
            greetingAudioBuffer = await getAudioForSentence(greetingText);
            if (!greetingAudioBuffer) throw new Error("Failed to generate greeting audio.");
        } catch (e) {
            console.error(e);
            setError("Failed to start with greeting.");
            setStatus(BotStatus.ERROR);
            cleanup();
            return;
        }
    }

    let ai: GoogleGenAI;
    try {
      ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch(e) {
        setError("Failed to initialize AI. Check API Key.");
        setStatus(BotStatus.ERROR);
        return;
    }

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      retryCountRef.current = 0; // Reset retries on successful mic access
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access in your browser settings.');
      setStatus(BotStatus.ERROR);
      cleanup();
      return;
    }

    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
    
    const newAnalyser = inputAudioContextRef.current.createAnalyser();
    newAnalyser.fftSize = 512;
    analyserNodeRef.current = newAnalyser;
    setAnalyser(newAnalyser);

    const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
    scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(BUFFER_SIZE, 1, 1);
    
    const biquadFilter = inputAudioContextRef.current.createBiquadFilter();
    biquadFilter.type = 'lowpass';
    biquadFilter.frequency.setValueAtTime(4000, inputAudioContextRef.current.currentTime);
    
    source.connect(biquadFilter);
    biquadFilter.connect(scriptProcessorRef.current);
    scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
    biquadFilter.connect(analyserNodeRef.current);

    // Set up a client-side silence detector to optimistically switch to the thinking state.
    // This makes the UI feel more responsive than waiting for the server's `turnComplete` message.
    silenceDetectionIntervalRef.current = window.setInterval(() => {
      if (
        userHasSpokenRef.current &&
        statusRef.current === BotStatus.LISTENING &&
        Date.now() - lastSoundTimeRef.current > 1200 // 1.2 seconds of silence
      ) {
        setStatus(BotStatus.THINKING);
      }
    }, 250);

    const handleVoiceFunctionCall = (fc: any) => {
        const session = sessionPromiseRef.current;
        if (!session) return;
        
        const { result, name } = executeFunctionCall(fc);

        session.then((s) => {
            s.sendToolResponse({
            functionResponses: {
                id : fc.id,
                name: name,
                response: { result: result },
            }
            })
        });
    };

    sessionPromiseRef.current = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log('Session opened');
          retryCountRef.current = 0;
        },
        onmessage: async (message: LiveServerMessage) => {
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
                sourcesRef.current.forEach(source => source.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                if (statusRef.current === BotStatus.SPEAKING) {
                    setStatus(BotStatus.LISTENING);
                }
            }

            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
    
              if (text && text.trim().length > 0) {
                if (isNewUserTurnRef.current) {
                  addTranscriptEntry({ source: 'user', text });
                  isNewUserTurnRef.current = false;
                } else {
                  updateLastUserTranscriptEntry(text);
                }
              } else if (!isNewUserTurnRef.current && text != null) {
                updateLastUserTranscriptEntry(text);
              }
            }

            const botResponseText = message.serverContent?.outputTranscription?.text;
            if (botResponseText) {
                const lastConvo = conversationsRef.current[currentIdRef.current!];
                const lastEntry = lastConvo?.entries[lastConvo.entries.length - 1];
                
                if (!lastEntry || lastEntry.source === 'user' || lastEntry.type === 'thinking') {
                    setStatus(statusRef.current === BotStatus.SINGING ? BotStatus.SINGING : BotStatus.SPEAKING);
                    const newType = specialTypeRef.current;
                    
                    updateConversations(convo => {
                        const newEntries = [...convo.entries];
                        if (newEntries[newEntries.length-1]?.type === 'thinking') {
                            newEntries.pop();
                        }
                        newEntries.push({ source: 'bot', text: botResponseText, type: newType });
                        return { ...convo, entries: newEntries };
                    });
                    specialTypeRef.current = 'message';
                } else {
                    updateLastBotTranscriptEntry(botResponseText);
                }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
                    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
                }
                if (outputAudioContextRef.current.state === 'suspended') {
                    await outputAudioContextRef.current.resume();
                }

                const audioBytes = decode(base64Audio);
                const audioBuffer = await decodeAudioData(audioBytes, outputAudioContextRef.current!, OUTPUT_SAMPLE_RATE, 1);
                
                const wavBlob = bufferToWav(audioBuffer);
                allAudioBlobs.current.push(wavBlob);

                const sourceNode = outputAudioContextRef.current!.createBufferSource();
                sourceNode.buffer = audioBuffer;
                sourceNode.connect(outputAudioContextRef.current!.destination);
                
                sourceNode.onended = () => {
                    sourcesRef.current.delete(sourceNode);
                    if (sourcesRef.current.size === 0 && statusRef.current !== BotStatus.ERROR && statusRef.current !== BotStatus.IDLE) {
                       setStatus(BotStatus.LISTENING);
                    }
                };

                const now = outputAudioContextRef.current!.currentTime;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
                sourceNode.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(sourceNode);
            }

            if (message.toolCall) {
                message.toolCall.functionCalls.forEach(handleVoiceFunctionCall);
            }

            if (message.serverContent?.turnComplete) {
                isNewUserTurnRef.current = true;
                setStatus(BotStatus.THINKING);
            }
        },
        onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            cleanup();

            if (retryCountRef.current < MAX_VOICE_RETRIES) {
                retryCountRef.current++;
                setStatus(BotStatus.RECOVERING);
                addTranscriptEntry({ source: 'bot', text: "Apologies, I've hit a small snag. Let me try to reconnect..." });
                setTimeout(() => {
                    startConversation();
                }, 1500);
            } else {
                const errorMessage = e.message || 'An unknown connection error occurred.';
                setError(errorMessage.includes('permission') ? 'Permission denied. Check API key.' : `Session error: ${errorMessage}`);
                setStatus(BotStatus.ERROR);
                addTranscriptEntry({ source: 'bot', text: "I'm having trouble reconnecting. Please try starting a new conversation." });
                retryCountRef.current = 0;
            }
        },
        onclose: (e: CloseEvent) => {
          console.log('Session closed');
          if (statusRef.current !== BotStatus.ERROR && statusRef.current !== BotStatus.RECOVERING) {
            stopConversation();
          }
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        systemInstruction: SYSTEM_INSTRUCTION,
        tools,
      },
    });
    
    if (withGreeting && greetingAudioBuffer && outputAudioContextRef.current) {
        setStatus(BotStatus.SPEAKING);
        addTranscriptEntry({ source: 'bot', text: greetingText });

        const audioCtx = outputAudioContextRef.current;
        const sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = greetingAudioBuffer;
        sourceNode.connect(audioCtx.destination);
        
        sourceNode.onended = () => {
            sourcesRef.current.delete(sourceNode);
            if (statusRef.current !== BotStatus.ERROR && statusRef.current !== BotStatus.IDLE) {
                setStatus(BotStatus.LISTENING);
            }
        };

        const now = audioCtx.currentTime;
        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
        sourceNode.start(nextStartTimeRef.current);
        nextStartTimeRef.current += greetingAudioBuffer.duration;
        sourcesRef.current.add(sourceNode);
    } else {
        setStatus(BotStatus.LISTENING);
    }

    scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);

        let sum = 0.0;
        for (let i = 0; i < inputData.length; ++i) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);
        
        if (rms > NOISE_THRESHOLD) {
            lastSoundTimeRef.current = Date.now();
            userHasSpokenRef.current = true;
            // If we optimistically switched to thinking, but the user started speaking again, switch back.
            if (statusRef.current === BotStatus.THINKING) {
                setStatus(BotStatus.LISTENING);
            }
        }

        if (rms < NOISE_THRESHOLD) return;

        const pcmBlob = {
            data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
            mimeType: 'audio/pcm;rate=16000',
        };
        sessionPromiseRef.current?.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
    };

  }, [cleanup, voice, addTranscriptEntry, updateLastBotTranscriptEntry, updateLastUserTranscriptEntry, updateConversations, executeFunctionCall, stopConversation, getAudioForSentence]);

  // Effect to auto-start conversation on load
  useEffect(() => {
    if (userStoppedConversation.current) return;
  
    const currentConvo = currentConversationId ? conversations[currentConversationId] : null;
    if (currentConvo && status === BotStatus.IDLE) {
      const shouldGreet = currentConvo.entries.length === 0;
      // Use a short timeout to allow the UI to settle before asking for mic permission
      const timer = setTimeout(() => {
        startConversation(shouldGreet);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentConversationId, conversations, status, startConversation]);

  const sendTextMessage = useCallback(async (message: string) => {
    if (statusRef.current !== BotStatus.IDLE) return;
    setError(null);
    setStatus(BotStatus.THINKING);
    addTranscriptEntry({ source: 'user', text: message });

    for (let attempt = 0; attempt <= MAX_TEXT_RETRIES; attempt++) {
      try {
        let ai: GoogleGenAI;
        try {
          ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        } catch (e) {
          throw new Error("Failed to initialize AI. Check API Key.");
        }

        if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
          outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
        }
        const audioCtx = outputAudioContextRef.current;

        const audioQueue = useRef<Promise<AudioBuffer | null>[]>([]).current;
        const isPlayingAudio = useRef(false);
        let playbackStartTime = 0;

        const playAudioFromQueue = async () => {
          if (isPlayingAudio.current || audioQueue.length === 0) return;
          isPlayingAudio.current = true;

          if (audioCtx.state === 'closed') {
              outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
          }
          
          playbackStartTime = Math.max(playbackStartTime, audioCtx.currentTime);

          while (audioQueue.length > 0) {
            const audioPromise = audioQueue.shift();
            if (audioPromise) {
              const buffer = await audioPromise;
              if (buffer && audioCtx.state === 'running') {
                const sourceNode = audioCtx.createBufferSource();
                sourceNode.buffer = buffer;
                sourceNode.connect(audioCtx.destination);
                
                const onEnded = () => {
                  sourcesRef.current.delete(sourceNode);
                  if (sourcesRef.current.size === 0 && audioQueue.length === 0) {
                    if (statusRef.current === BotStatus.SPEAKING) {
                        setStatus(BotStatus.IDLE);
                    }
                    isPlayingAudio.current = false;
                  }
                };
                sourceNode.addEventListener('ended', onEnded);
                
                sourceNode.start(playbackStartTime);
                playbackStartTime += buffer.duration;
                sourcesRef.current.add(sourceNode);
              }
            }
          }
        };
        
        const speakTextAndFinalize = async (text: string) => {
            const sentences: string[] = text.match(/[^.!?]+[.!?]*|[^.!?]+/g) || [];
            const filteredSentences = sentences.filter(s => s.trim());
            
            if (filteredSentences.length === 0) {
                setStatus(BotStatus.IDLE);
                return;
            }

            setStatus(BotStatus.SPEAKING);
            for (const sentence of filteredSentences) {
                audioQueue.push(getAudioForSentence(sentence));
            }
            await playAudioFromQueue();
        };

        const currentConvo = conversationsRef.current[currentIdRef.current!];
        const history: Content[] = (currentConvo ? currentConvo.entries : [])
          .filter(entry => entry.type === 'message' || !entry.type)
          .map(entry => ({ role: entry.source === 'user' ? 'user' : 'model', parts: [{ text: entry.text }] }));

        const contents: Content[] = [...history, { role: 'user', parts: [{ text: message }] }];

        const responseStream = await ai.models.generateContentStream({
          model: 'gemini-2.5-pro',
          contents,
          config: { systemInstruction: SYSTEM_INSTRUCTION, tools },
        });

        let isFirstChunk = true;
        let sentenceBuffer = '';
        const functionCalls: any[] = [];
        
        for await (const chunk of responseStream) {
          if (chunk.functionCalls) {
            functionCalls.push(...chunk.functionCalls);
            sourcesRef.current.forEach(source => source.stop());
            sourcesRef.current.clear();
            audioQueue.length = 0;
            playbackStartTime = 0;
          }

          const chunkText = chunk.text;
          if (chunkText) {
            if (isFirstChunk) {
              addTranscriptEntry({ source: 'bot', text: chunkText });
              isFirstChunk = false;
            } else {
              updateLastBotTranscriptEntry(chunkText);
            }

            if (functionCalls.length === 0) {
              sentenceBuffer += chunkText;
              const sentences = sentenceBuffer.split(/(?<=[.!?])\s+/);
              if (sentences.length > 1) {
                const completeSentences = sentences.slice(0, -1);
                sentenceBuffer = sentences.slice(-1)[0];
                if (statusRef.current !== BotStatus.SPEAKING) setStatus(BotStatus.SPEAKING);
                for (const sentence of completeSentences) {
                  if (sentence.trim()) {
                    audioQueue.push(getAudioForSentence(sentence.trim()));
                  }
                }
                playAudioFromQueue();
              }
            }
          }
        }
        
        if (functionCalls.length > 0) {
          setStatus(BotStatus.THINKING);
          const toolResponses = [];
          let specialType: TranscriptionEntry['type'] = 'message';
          for (const fc of functionCalls) {
            const { result, name } = executeFunctionCall(fc);
            specialType = specialTypeRef.current;
            toolResponses.push({ toolResponse: { name, response: { result } } });
          }
          
          const functionCallContent = { role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) };
          const toolResponseContent = { role: 'user', parts: toolResponses };
          
          const finalResponse = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [...contents, functionCallContent, toolResponseContent],
            config: { systemInstruction: SYSTEM_INSTRUCTION, tools },
          });

          const textToSpeak = finalResponse.text;
          updateConversations(convo => {
              const newEntries = [...convo.entries];
              const lastEntry = newEntries[newEntries.length - 1];
              if (lastEntry?.source === 'bot') {
                  lastEntry.text = textToSpeak;
                  lastEntry.type = specialType;
              }
              return { ...convo, entries: newEntries };
          });
          specialTypeRef.current = 'message';
          await speakTextAndFinalize(textToSpeak);
        } else {
          if (sentenceBuffer.trim()) {
            audioQueue.push(getAudioForSentence(sentenceBuffer.trim()));
            playAudioFromQueue();
          } else if (audioQueue.length === 0 && sourcesRef.current.size === 0) {
            setStatus(BotStatus.IDLE);
          }
        }
        
        return; // Success, exit the loop
      } catch (e) {
        console.error(`Error during text message processing (attempt ${attempt + 1}):`, e);
        if (attempt < MAX_TEXT_RETRIES) {
          setStatus(BotStatus.RECOVERING);
          addTranscriptEntry({ source: 'bot', text: "Hmm, that didn't go as planned. Let me try that again." });
          await new Promise(res => setTimeout(res, 2000));
          // Remove the failed 'bot' entry and the 'recovering' message before retrying.
          updateConversations(convo => ({
            ...convo,
            entries: convo.entries.slice(0, -2) 
          }));
          setStatus(BotStatus.THINKING);
        } else {
          setError("An error occurred while getting a response.");
          setStatus(BotStatus.ERROR);
          addTranscriptEntry({ source: 'bot', text: "I'm still running into issues. Could you please try rephrasing your message?" });
        }
      }
    }
  }, [addTranscriptEntry, executeFunctionCall, voice, updateLastBotTranscriptEntry, updateConversations, getAudioForSentence]);

  return { 
      status, transcript, startConversation, stopConversation, error, 
      downloadTranscript, downloadAudio, sendTextMessage, analyser,
      conversations, currentConversationId, loadConversation, startNewConversation, deleteConversation 
    };
};