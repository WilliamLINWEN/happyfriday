// llm-prompt-optimizer.ts - Utility to optimize LLM prompt construction
import { TLLMPromptData } from '../../types/llm-types';

export function optimizePrompt(prData: TLLMPromptData): TLLMPromptData {
  // Remove unnecessary whitespace, truncate long diffs, and ensure concise context
  const MAX_DIFF_LENGTH = parseInt(process.env.LLM_PROMPT_MAX_DIFF || '8000');
  let diff = prData.diff || '';
  if (diff.length > MAX_DIFF_LENGTH) {
    console.warn(`PR diff is too long (${diff.length} characters). Truncating to ${MAX_DIFF_LENGTH} characters.`);
    diff = diff.substring(0, MAX_DIFF_LENGTH) + '\n... (diff truncated)';
  }
  return {
    ...prData,
    diff: diff.trim(),
    title: (prData.title || '').trim(),
    description: (prData.description || '').trim(),
    author: (prData.author || '').trim(),
    repository: (prData.repository || '').trim(),
    sourceBranch: (prData.sourceBranch || '').trim(),
    destinationBranch: (prData.destinationBranch || '').trim(),
    additionalContext: (prData.additionalContext || '').trim(),
  };
}
