// llm-prompt-optimizer.ts - Utility to optimize LLM prompt construction
import { TLLMPromptData } from '../../types/llm-types';
import { DiffChunkerService } from './diff-chunker-service';
import { FileFilterService } from './file-filter-service';
import { getConfigManager } from '../utils/config-manager';

// Service factory functions to ensure fresh instances with current config
function createDiffChunker() {
  return new DiffChunkerService();
}

function createFileFilter() {
  return new FileFilterService();
}

export function optimizePrompt(prData: TLLMPromptData): TLLMPromptData {
  // Basic data cleaning
  const cleanedData = {
    ...prData,
    title: (prData.title || '').trim(),
    description: (prData.description || '').trim(),
    author: (prData.author || '').trim(),
    repository: (prData.repository || '').trim(),
    sourceBranch: (prData.sourceBranch || '').trim(),
    destinationBranch: (prData.destinationBranch || '').trim(),
    additionalContext: (prData.additionalContext || '').trim(),
  };

  let diff = prData.diff || '';
  let filteredFiles: string[] = [];
  let allFilesIgnored = false;

  // Step 1: Apply file filtering if enabled
  const config = getConfigManager();
  const filteringEnabled = config.getFileFilteringConfig().enabled;
  if (filteringEnabled && diff) {
    const fileFilter = createFileFilter();
    const originalFiles = fileFilter.extractModifiedFiles(diff);
    const filteredDiff = fileFilter.filterDiff(diff);
    
    // Determine which files were filtered out
    const remainingFiles = fileFilter.extractModifiedFiles(filteredDiff);
    filteredFiles = originalFiles.filter(file => !remainingFiles.includes(file));
    allFilesIgnored = filteredDiff.trim() === '' && originalFiles.length > 0;
    
    
    diff = filteredDiff;
  }

  // Step 2: Apply chunking if enabled and needed
  const chunkingEnabled = config.getChunkingConfig().enabled;
  if (chunkingEnabled && diff && !allFilesIgnored) {
    const diffChunker = createDiffChunker();
    const chunks = diffChunker.chunkDiff(diff);
    
    if (chunks.length > 1) {
      // Multiple chunks needed
      return {
        ...cleanedData,
        diff: diff.trim(),
        chunks,
        requiresChunking: true,
        filteredFiles,
        allFilesIgnored
      };
    }
  }

  // Step 3: Fall back to legacy truncation if chunking is disabled or not needed
  if (!chunkingEnabled && diff) {
    const maxDiffLength = config.getLLMPromptConfig().maxDiffLength;
    if (diff.length > maxDiffLength) {
      console.warn(`PR diff is too long (${diff.length} characters). Truncating to ${maxDiffLength} characters.`);
      diff = diff.substring(0, maxDiffLength) + '... (diff truncated)';
    }
  }

  return {
    ...cleanedData,
    diff: diff.trim(),
    requiresChunking: false,
    filteredFiles,
    allFilesIgnored
  };
}
