import React, { useRef, useEffect, useState } from 'react';
import { useHexaVoice } from './hooks/useHexaVoice';
import { BotStatus, Conversation } from './types';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { UserIcon, BotIcon, ThinkingIcon, SummaryIcon, NewChatIcon, CapabilitiesIcon, DownloadIcon, MusicNoteIcon, SendIcon, LanguageIcon, HistoryIcon, TrashIcon, CloseIcon } from './components/Icons';
import { AnimatedHexGrid } from './components/AnimatedHexGrid';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Record<string, Conversation>;
  currentConversationId: string | null;
  loadConversation: (id: string) => void;
  startNewConversation: () => void;
  deleteConversation: (id: string) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  conversations,
  currentConversationId,
  loadConversation,
  startNewConversation,
  deleteConversation,
}) => {
  const sortedConversations = Object.values(conversations).sort((a, b) => b.timestamp - a.timestamp);

  const handleStartNew = () => {
    startNewConversation();
    onClose();
  };

  const handleLoad = (id: string) => {
    loadConversation(id);
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed top-0 right-0 h-full w-full max-w-sm bg-gray-900 shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <header className="p-4 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
            <h2 className="text-xl font-bold text-cyan-400">History</h2>
            <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
              <CloseIcon className="w-6 h-6" />
            </button>
          </header>
          <div className="p-4 flex-shrink-0">
            <button
              onClick={handleStartNew}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white transition-colors"
            >
              <NewChatIcon className="w-5 h-5" />
              Start New Chat
            </button>
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-2">
            {sortedConversations.length > 0 ? (
              sortedConversations.map(convo => (
                <div
                  key={convo.id}
                  onClick={() => handleLoad(convo.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors group ${convo.id === currentConversationId ? 'bg-cyan-900/50' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm text-white flex-grow pr-2 truncate">{convo.title}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(convo.id);
                      }}
                      className="p-1 rounded-full text-gray-500 hover:text-red-500 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete conversation"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{new Date(convo.timestamp).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 mt-8">No past conversations.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};


const App: React.FC = () => {
  const { 
    status, transcript, startConversation, stopConversation, error, 
    downloadTranscript, downloadAudio, sendTextMessage, analyser,
    conversations, currentConversationId, loadConversation, startNewConversation, deleteConversation 
  } = useHexaVoice();

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [inputValue, setInputValue] = useState('');
  const prevStatusRef = useRef(status);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const wasModalOpen = useRef(false);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);
  
  useEffect(() => {
    if (prevStatusRef.current === BotStatus.GENERATING_AUDIO && status !== BotStatus.GENERATING_AUDIO) {
      setIsEmailModalOpen(false);
      setEmail('');
    }
    prevStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (isEmailModalOpen) {
      wasModalOpen.current = true;
    } else if (wasModalOpen.current) {
      downloadButtonRef.current?.focus();
      wasModalOpen.current = false;
    }
  }, [isEmailModalOpen]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEmailModalOpen(false);
        setIsHistoryOpen(false);
      }
    };
    if (isEmailModalOpen || isHistoryOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEmailModalOpen, isHistoryOpen]);


  const getStatusMessage = () => {
    switch (status) {
      case BotStatus.IDLE:
        return 'Click the orb to start or type a message';
      case BotStatus.CONNECTING:
        return 'Connecting to Hexa...';
      case BotStatus.LISTENING:
        return 'Listening...';
      case BotStatus.THINKING:
        return 'Thinking...';
      case BotStatus.SPEAKING:
        return 'Speaking...';
      case BotStatus.SINGING:
        return 'Performing...';
      case BotStatus.GENERATING_AUDIO:
        return 'Generating audio file...';
      default:
        return '';
    }
  };

  const handleToggleConversation = () => {
    if (status === BotStatus.IDLE || status === BotStatus.ERROR) {
      startConversation();
    } else {
      stopConversation();
    }
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleDownloadTranscriptRequest = () => {
    if (isValidEmail(email)) {
      downloadTranscript();
      setIsEmailModalOpen(false);
      setEmail('');
    }
  };
  
  const handleDownloadAudioRequest = () => {
    if (isValidEmail(email)) {
      downloadAudio();
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && status === BotStatus.IDLE) {
      sendTextMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const isInputDisabled = ![BotStatus.IDLE, BotStatus.THINKING, BotStatus.ERROR].includes(status);
  const isSendDisabled = status !== BotStatus.IDLE || !inputValue.trim();

  const getPlaceholderText = () => {
    switch (status) {
      case BotStatus.IDLE:
        return "Type a message...";
      case BotStatus.THINKING:
        return "Hexa is generating a response...";
      case BotStatus.ERROR:
        return "An error occurred. You can type a new message.";
      default:
        return "Voice conversation is active...";
    }
  };


  return (
    <div className="relative h-screen bg-gray-900 text-white font-sans overflow-hidden">
      <AnimatedHexGrid />
      <div className="relative z-10 flex flex-col md:flex-row h-full">
        {/* Left Column: Voice Animation */}
        <div className="w-full md:w-2/5 flex flex-col items-center justify-center p-4 space-y-8 flex-shrink-0">
          <WaveformVisualizer status={status} onClick={handleToggleConversation} analyser={analyser} />
          <div className="h-10 text-center">
            <p className="text-lg text-gray-400 transition-opacity duration-300">
              {getStatusMessage()}
            </p>
            {status === BotStatus.ERROR && error && (
              <p className="text-sm text-red-500 mt-2">{error}</p>
            )}
          </div>
        </div>
        
        {/* Right Column: Conversation */}
        <div className="w-full md:w-3/5 flex-grow min-h-0 bg-black bg-opacity-30 backdrop-blur-sm md:rounded-l-xl flex flex-col">
          <header className="w-full p-4 flex items-center justify-between flex-shrink-0 border-b border-gray-800">
            <h1 className="text-3xl font-bold text-cyan-400 tracking-wider">#AskHexa</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                aria-label="Conversation History"
              >
                <HistoryIcon className="w-6 h-6" />
              </button>
              <button
                ref={downloadButtonRef}
                onClick={() => transcript.length > 0 && setIsEmailModalOpen(true)}
                disabled={transcript.length === 0}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Download"
              >
                <DownloadIcon className="w-6 h-6" />
              </button>
              <button
                onClick={startNewConversation}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                aria-label="New Chat"
              >
                <NewChatIcon className="w-6 h-6" />
              </button>
            </div>
          </header>

          <div className="flex-grow h-full overflow-y-auto p-4 md:p-6 space-y-4">
            {transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <BotIcon className="w-16 h-16 mb-4" />
                <h2 className="text-lg font-medium">Start a conversation with #AskHexa</h2>
                <p className="text-sm">Your chat history from this session will be saved here.</p>
              </div>
            ) : (
              transcript.map((entry, index) => {
                 if (entry.type === 'thinking') {
                    return (
                      <div key={index} className="flex items-start gap-3 justify-start animate-message-appear">
                        <BotIcon className="w-6 h-6 text-fuchsia-400 mt-1 flex-shrink-0" />
                        <div className="rounded-lg px-4 py-3 bg-fuchsia-900/50 text-fuchsia-100 flex items-center justify-center transition-transform duration-200 hover:-translate-y-1">
                          <p className="italic text-sm">{entry.text}</p>
                        </div>
                      </div>
                    );
                  }

                  if (entry.type === 'summary') {
                    return (
                      <div key={index} className="flex items-start gap-3 justify-start animate-message-appear">
                        <SummaryIcon className="w-6 h-6 text-yellow-400 mt-1 flex-shrink-0" />
                        <div className="rounded-lg px-4 py-3 max-w-xl bg-yellow-900/50 text-yellow-100 transition-transform duration-200 hover:-translate-y-1">
                          <h3 className="font-bold mb-1 text-yellow-300">Conversation Summary</h3>
                          <p className="whitespace-pre-wrap text-sm">{entry.text}</p>
                        </div>
                      </div>
                    )
                  }
                
                  if (entry.type === 'capabilities') {
                    return (
                      <div key={index} className="flex items-start gap-3 justify-start animate-message-appear">
                        <CapabilitiesIcon className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                        <div className="rounded-lg px-4 py-3 max-w-xl bg-green-900/50 text-green-100 transition-transform duration-200 hover:-translate-y-1">
                          <h3 className="font-bold mb-2 text-green-300">Capabilities</h3>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.text}</p>
                        </div>
                      </div>
                    )
                  }

                  if (entry.type === 'song') {
                    return (
                      <div key={index} className="flex items-start gap-3 justify-start animate-message-appear">
                        <MusicNoteIcon className="w-6 h-6 text-purple-400 mt-1 flex-shrink-0" />
                        <div className="rounded-lg px-4 py-3 max-w-xl bg-purple-900/50 text-purple-100 transition-transform duration-200 hover:-translate-y-1">
                          <pre className="whitespace-pre-wrap text-sm font-sans italic leading-relaxed">{entry.text}</pre>
                        </div>
                      </div>
                    )
                  }

                  if (entry.type === 'language') {
                    return (
                      <div key={index} className="flex items-start gap-3 justify-start animate-message-appear">
                        <LanguageIcon className="w-6 h-6 text-teal-400 mt-1 flex-shrink-0" />
                        <div className="rounded-lg px-4 py-3 max-w-xl bg-teal-900/50 text-teal-100 transition-transform duration-200 hover:-translate-y-1">
                          <p className="whitespace-pre-wrap text-sm">{entry.text}</p>
                        </div>
                      </div>
                    )
                  }

                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 animate-message-appear ${
                      entry.source === 'user' ? 'justify-start' : 'justify-start'
                    }`}
                  >
                    {entry.source === 'user' ? 
                      <UserIcon className="w-6 h-6 text-cyan-400 mt-1 flex-shrink-0" /> : 
                      <BotIcon className="w-6 h-6 text-fuchsia-400 mt-1 flex-shrink-0" />
                    }
                    <p className={`rounded-lg px-4 py-2 max-w-xl transition-transform duration-200 hover:-translate-y-1 ${
                      entry.source === 'user' ? 'bg-cyan-900/50 text-cyan-100' : 'bg-fuchsia-900/50 text-fuchsia-100'
                    }`}>
                      {entry.text}
                    </p>
                  </div>
                )
              })
            )}
            <div ref={transcriptEndRef} />
          </div>

          <div className="flex-shrink-0 p-4 bg-gray-900/50 border-t border-gray-700">
            <form onSubmit={handleSendText} className="flex items-center space-x-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={getPlaceholderText()}
                disabled={isInputDisabled}
                className="w-full bg-gray-800 border border-gray-600 rounded-full px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                aria-label="Chat input"
              />
              <button
                type="submit"
                disabled={isSendDisabled}
                className="p-3 rounded-full bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                aria-label="Send message"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
      
      {isEmailModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-message-appear"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-description"
        >
          <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md shadow-2xl shadow-cyan-500/10 border border-gray-700">
            <h2 id="dialog-title" className="text-2xl font-bold mb-4 text-cyan-400">Download Conversation</h2>
            <p id="dialog-description" className="text-gray-400 mb-6">Enter your email and choose a format to download.</p>
            {status === BotStatus.GENERATING_AUDIO ? (
              <div className="text-center p-8">
                <p className="text-lg text-purple-400 animate-pulse">Generating audio, please wait...</p>
              </div>
            ) : (
            <form onSubmit={(e) => { e.preventDefault(); }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-6"
                autoFocus
                aria-label="Email Address"
              />
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-6 py-2 rounded-md text-gray-400 hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTranscriptRequest}
                  disabled={!isValidEmail(email)}
                  className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  Download Transcript
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAudioRequest}
                  disabled={!isValidEmail(email)}
                  className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  Download Audio (MP3)
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
      <HistoryPanel 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        conversations={conversations}
        currentConversationId={currentConversationId}
        loadConversation={loadConversation}
        startNewConversation={startNewConversation}
        deleteConversation={deleteConversation}
      />
    </div>
  );
};

export default App;