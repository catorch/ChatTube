import { SourceProcessor, IngestionResult } from '../types';
import { ISource } from '../../models/Source';

export class WebProcessor implements SourceProcessor {
  async ingest(source: ISource): Promise<IngestionResult> {
    if (source.kind !== 'web') {
      throw new Error(`WebProcessor can only process 'web' sources, got '${source.kind}'`);
    }

    // TODO: Implement web page processing
    // 1. Fetch the web page using source.url
    // 2. Extract article content using @extractus/article-extractor or readability
    // 3. Split into semantic chunks (by paragraph, section, or heading)
    // 4. Generate embeddings for each chunk
    // 5. Return chunks and metadata

    throw new Error('Web page processing not yet implemented');
  }
} 