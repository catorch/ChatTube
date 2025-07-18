import { SourceProcessor } from './types';
import { SourceType } from '../models/Source';
import { YoutubeProcessor } from './processors/YoutubeProcessor';
import { PdfProcessor } from './processors/PdfProcessor';
import { WebProcessor } from './processors/WebProcessor';
import { FileProcessor } from './processors/FileProcessor';

export const processorRegistry: Record<SourceType, SourceProcessor> = {
  youtube: new YoutubeProcessor(),
  pdf: new PdfProcessor(),
  web: new WebProcessor(),
  file: new FileProcessor(),
};

export function getProcessor(sourceType: SourceType): SourceProcessor {
  const processor = processorRegistry[sourceType];
  if (!processor) {
    throw new Error(`No processor found for source type: ${sourceType}`);
  }
  return processor;
}

export function getSupportedSourceTypes(): SourceType[] {
  return Object.keys(processorRegistry) as SourceType[];
}

export function isSourceTypeSupported(sourceType: string): sourceType is SourceType {
  return sourceType in processorRegistry;
} 