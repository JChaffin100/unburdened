import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { fetchAndDecrypt } from '../storage/db.js';
import { buildSystemPrompt } from '../ai/systemPrompts.js';
import { streamResponse, isLLMReady, initLLM } from '../ai/inferenceEngine.js';
import { isModelDownloaded } from '../ai/modelManager.js';
import { PERSONA_LABELS } from '../ai/systemPrompts.js';

export default function ChatSession({ area, onEndSession, onBack }) {
  const { sessionKey } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [persona, setPersona] = useState(area.persona || 'Balanced');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [llmState, setLlmState] = useState('checking'); // checking | loading | ready | no-model | no-webgpu | error
  const [errorMsg, setErrorMsg] = useState('');
  const [userName, setUserName] = useState('');
  const [summary, setSummary] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchAndDecrypt('profile', sessionKey, 'user').then((r) => {
      if (r?.data?.name) setUserName(r.data.name);
    }).catch(() => {});
    fetchAndDecrypt('summaries', sessionKey, area.id).then((r) => {
      if (r?.data) setSummary(r.data);
    }).catch(() => {});
    checkAndInitLLM();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  async function checkAndInitLLM() {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      setLlmState('no-webgpu');
      return;
    }
    const downloaded = await isModelDownloaded();
    if (!downloaded) {
      setLlmState('no-model');
      return;
    }
    if (isLLMReady()) {
      setLlmState('ready');
      return;
    }
    setLlmState('loading');
    try {
      await initLLM();
      setLlmState('ready');
    } catch (err) {
      setLlmState('error');
      setErrorMsg(err.message || 'Failed to load AI model.');
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming || llmState !== 'ready') return;
    setInput('');
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStreaming(true);
    setStreamingText('');

    const systemPrompt = buildSystemPrompt({
      persona,
      userName: userName || 'friend',
      areaName: area.name,
      areaDescription: area.description,
      commitments: area.commitments,
      summary,
    });

    try {
      let full = '';
      await streamResponse(
        systemPrompt,
        newMessages.slice(0, -1), // history without current user msg
        text,
        (token) => {
          full += token;
          setStreamingText(full);
        },
        (fullText) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: fullText }]);
          setStreamingText('');
          setStreaming(false);
          inputRef.current?.focus();
        }
      );
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'I\'m sorry, I wasn\'t able to respond. Please try again.',
      }]);
      setStreamingText('');
      setStreaming(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="chat-session">
      <div className="chat-header">
        <div className="chat-header-left">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2 className="chat-area-name">{area.name}</h2>
        </div>
        <div className="chat-header-right">
          <select
            className="persona-select"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            aria-label="AI persona"
          >
            {PERSONA_LABELS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onEndSession(messages, persona)}
            disabled={streaming}
          >
            End Session
          </button>
        </div>
      </div>

      {/* Status overlays for non-ready LLM states */}
      {llmState === 'no-webgpu' && (
        <div className="chat-unavailable">
          <p>WebGPU is not supported in this browser.</p>
          <p>Please use Chrome on Android or a WebGPU-enabled desktop browser.</p>
        </div>
      )}
      {llmState === 'no-model' && (
        <div className="chat-unavailable">
          <p>The AI model hasn't been downloaded yet.</p>
          <p>Go to Settings → AI Companion to download it.</p>
        </div>
      )}
      {llmState === 'loading' && (
        <div className="chat-unavailable chat-loading">
          <div className="spinner" />
          <p>Loading AI model…</p>
        </div>
      )}
      {llmState === 'error' && (
        <div className="chat-unavailable chat-error">
          <p>{errorMsg}</p>
          <button className="btn btn-primary btn-sm" onClick={checkAndInitLLM}>Retry</button>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && llmState === 'ready' && (
          <div className="chat-empty">
            <p>Begin your conversation. Your companion is here.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            {msg.role === 'assistant' && (
              <span className="chat-sender">Your companion</span>
            )}
            <div className="chat-bubble">
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
        {streaming && (
          <div className="chat-msg chat-msg-assistant">
            <span className="chat-sender">Your companion</span>
            <div className="chat-bubble">
              {streamingText ? (
                <p>{streamingText}<span className="chat-cursor">▋</span></p>
              ) : (
                <p className="chat-thinking">Thinking…</p>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={llmState === 'ready' ? "Share what's on your heart…" : 'AI not available'}
          disabled={streaming || llmState !== 'ready'}
          rows={3}
          aria-label="Message"
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={!input.trim() || streaming || llmState !== 'ready'}
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
