'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const ModelProviderBase = require('./ModelProviderBase');
const config = require('../../config');

/**
 * GeminiProvider
 *
 * Wraps Google's Generative AI (Gemini) SDK.
 * Streaming is simulated via the generateContentStream API.
 */
class GeminiProvider extends ModelProviderBase {
  /**
   * @param {object} [opts]
   * @param {string} [opts.apiKey]
   * @param {string} [opts.defaultModel]
   */
  constructor(opts = {}) {
    super();
    this._genAI = new GoogleGenerativeAI(opts.apiKey || config.gemini.apiKey);
    this._defaultModel = opts.defaultModel || config.gemini.defaultModel;
  }

  getName() {
    return 'gemini';
  }

  async getModels() {
    // The REST listModels endpoint requires an API key in the URL;
    // return the known stable models to avoid an extra HTTP call.
    return ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  }

  /** Convert OpenAI-style messages to Gemini history + last user message. */
  _convertMessages(messages) {
    const history = [];
    let lastUserMessage = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Prepend system prompt as the first user turn with a model ack
        history.push({ role: 'user', parts: [{ text: msg.content }] });
        history.push({ role: 'model', parts: [{ text: 'Understood.' }] });
      } else if (msg.role === 'user') {
        lastUserMessage = msg.content;
        history.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        history.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }

    // Remove the last user message from history (it becomes the prompt)
    if (history.length > 0 && history[history.length - 1].role === 'user') {
      history.pop();
    }

    return { history, prompt: lastUserMessage };
  }

  async chat(messages, options = {}) {
    const modelName = options.model || this._defaultModel;
    const model = this._genAI.getGenerativeModel({ model: modelName });
    const { history, prompt } = this._convertMessages(messages);

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens,
      },
    });

    const result = await chat.sendMessage(prompt);
    const text = result.response.text();

    return {
      content: text,
      role: 'assistant',
      model: modelName,
      usage: result.response.usageMetadata || {},
      finishReason: result.response.candidates?.[0]?.finishReason || 'STOP',
    };
  }

  async *stream(messages, options = {}) {
    const modelName = options.model || this._defaultModel;
    const model = this._genAI.getGenerativeModel({ model: modelName });
    const { history, prompt } = this._convertMessages(messages);

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens,
      },
    });

    const result = await chat.sendMessageStream(prompt);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}

module.exports = GeminiProvider;
