/**
 * Gemma inference via MediaPipe LiteRT Web LLM Inference API.
 * Wraps streaming responses with a 30-second timeout.
 */

import { FilesetResolver, LlmInference } from '@mediapipe/tasks-genai';
import { getModelFile } from './modelManager.js';

let _llm = null;
let _initializing = false;
let _modelUrl = null;

/** Initialize the LLM from OPFS. Call once after unlock if model is downloaded. */
export async function initLLM(onProgress) {
  if (_llm) return _llm;
  if (_initializing) {
    // Wait for in-flight init
    await new Promise((resolve) => setTimeout(resolve, 200));
    return _llm;
  }
  _initializing = true;
  try {
    const filesetResolver = await FilesetResolver.forGenAiTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm'
    );

    const modelFile = await getModelFile();
    // Using createObjectURL is much more memory efficient than .arrayBuffer()
    // as it allows the browser to stream the file from disk (OPFS).
    _modelUrl = URL.createObjectURL(modelFile);

    _llm = await LlmInference.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: _modelUrl,
      },
      maxTokens: 1024,
      topK: 40,
      temperature: 0.8,
      randomSeed: 101,
    });

    if (onProgress) onProgress('ready');
    return _llm;
  } finally {
    _initializing = false;
  }
}

/** Destroy the LLM instance (on lock). */
export async function destroyLLM() {
  if (_llm) {
    try { _llm.close(); } catch {}
    _llm = null;
  }
  if (_modelUrl) {
    URL.revokeObjectURL(_modelUrl);
    _modelUrl = null;
  }
}

/**
 * Send a message and stream the response.
 *
 * @param {string} systemPrompt - Full system prompt
 * @param {Array} history - [{role, content}] — last 8–10 pairs
 * @param {string} userMessage - Current user message
 * @param {function} onToken - Called with each token string as it arrives
 * @param {function} onDone - Called when streaming is complete
 * @returns {Promise<string>} Full response text
 */
export async function streamResponse(systemPrompt, history, userMessage, onToken, onDone) {
  if (!_llm) throw new Error('LLM not initialized');

  // Build prompt in chat format
  const prompt = buildPrompt(systemPrompt, history, userMessage);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Response timed out after 30 seconds'));
    }, 30000);

    let fullText = '';

    try {
      _llm.generateResponse(prompt, (partialResult, done) => {
        fullText += partialResult;
        if (onToken) onToken(partialResult);
        if (done) {
          clearTimeout(timeout);
          if (onDone) onDone(fullText);
          resolve(fullText);
        }
      });
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

/**
 * Generate a non-streaming response (used for summary generation).
 */
export async function generateText(prompt) {
  if (!_llm) throw new Error('LLM not initialized');

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Summary generation timed out')), 60000);
    let fullText = '';
    try {
      _llm.generateResponse(prompt, (partial, done) => {
        fullText += partial;
        if (done) {
          clearTimeout(timeout);
          resolve(fullText);
        }
      });
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

/** Trim history to last N message pairs to stay within context budget. */
export function trimHistory(messages, maxPairs = 9) {
  if (messages.length <= maxPairs * 2) return messages;
  return messages.slice(-(maxPairs * 2));
}

/**
 * Format system prompt + history + user message into a single prompt string
 * using Gemma's instruction-tuned format.
 */
function buildPrompt(systemPrompt, history, userMessage) {
  const trimmed = trimHistory(history);
  let prompt = `<start_of_turn>system\n${systemPrompt}<end_of_turn>\n`;
  for (const msg of trimmed) {
    const role = msg.role === 'user' ? 'user' : 'model';
    prompt += `<start_of_turn>${role}\n${msg.content}<end_of_turn>\n`;
  }
  prompt += `<start_of_turn>user\n${userMessage}<end_of_turn>\n<start_of_turn>model\n`;
  return prompt;
}

export function isLLMReady() {
  return !!_llm;
}
