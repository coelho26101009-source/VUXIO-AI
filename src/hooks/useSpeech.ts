import { useState, useEffect, useRef, useCallback } from 'react';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

// Errors the API throws routinely and recovers from on its own -- a few
// seconds of silence (no-speech) or a stop() racing the engine (aborted).
// Anything else (mic permission denied, no microphone at all, ...) is a
// real failure and must not be retried forever.
const RECOVERABLE_ERRORS = new Set(['no-speech', 'aborted']);

export const useSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  // Separate from isListening on purpose: isListening reflects whether the
  // engine is actually running right now, which continuous mode still flips
  // off and on by itself under the hood; this is the user's actual intent,
  // and it is what onend below checks to decide whether to restart.
  const wantsListeningRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const browserWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-PT';
    // false made the browser stop listening after a single utterance (or a
    // few seconds of silence) -- from the user's side, the toggle looked
    // like it turned itself off. true keeps the engine running until stop()
    // is actually called.
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onerror = (event) => {
      lastErrorRef.current = event.error;
      if (!RECOVERABLE_ERRORS.has(event.error)) {
        // A real failure (permission denied, no microphone, ...) -- give up
        // rather than let onend below restart into the same error forever.
        console.error('[VUXIO speech recognition]', event.error);
        wantsListeningRef.current = false;
      }
    };
    recognition.onend = () => {
      if (wantsListeningRef.current) {
        // The browser stopped the engine on its own (continuous mode still
        // times out after long silence) while the user's intent is still
        // "listening" -- restart transparently instead of surfacing this
        // as the mic having turned off.
        try {
          recognition.start();
        } catch {
          /* already starting -- onstart from that call will fire */
        }
      } else {
        setIsListening(false);
      }
    };
    recognitionRef.current = recognition;

    return () => {
      wantsListeningRef.current = false;
      recognition.stop();
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (isMutedRef.current) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ''));
    utterance.lang = 'pt-PT';
    utterance.pitch = 1.0;
    utterance.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice =
      voices.find(v => v.lang.includes('pt-PT') && v.name.includes('Google')) ||
      voices.find(v => v.lang.includes('pt'));
    if (ptVoice) utterance.voice = ptVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleMic = useCallback((onResult: (text: string) => void) => {
    if (!recognitionRef.current) return;
    if (wantsListeningRef.current) {
      wantsListeningRef.current = false;
      recognitionRef.current.stop();
    } else {
      wantsListeningRef.current = true;
      lastErrorRef.current = null;
      recognitionRef.current.onresult = (event) => {
        // In continuous mode, `results` accumulates every phrase recognized
        // since start() was called, not just the latest one -- results[0][0]
        // was correct only by accident, for the single-utterance case the
        // old continuous=false mode was limited to. The most recent entry is
        // what a fresh onresult firing actually reports.
        const transcript = event.results[event.results.length - 1][0].transcript;
        onResult(transcript);
      };
      recognitionRef.current.start();
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      if (!prev) window.speechSynthesis.cancel();
      return !prev;
    });
  }, []);

  return { isSpeaking, isListening, isMuted, speak, stopSpeaking, toggleMic, toggleMute };
};
