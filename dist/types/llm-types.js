"use strict";
// TypeScript type definitions for LLM services
Object.defineProperty(exports, "__esModule", { value: true });
exports.TLLMProvider = void 0;
var TLLMProvider;
(function (TLLMProvider) {
    TLLMProvider["OPENAI"] = "openai";
    TLLMProvider["CLAUDE"] = "claude";
    TLLMProvider["OLLAMA"] = "ollama";
})(TLLMProvider || (exports.TLLMProvider = TLLMProvider = {}));
