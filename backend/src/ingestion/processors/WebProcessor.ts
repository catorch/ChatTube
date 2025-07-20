import { SourceProcessor, IngestionResult } from "../types";
import { ISource } from "../../models/Source";
import { extract } from "@extractus/article-extractor";
import { htmlToText } from "html-to-text";
import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export class WebProcessor implements SourceProcessor {
  async ingest(source: ISource): Promise<IngestionResult> {
    if (source.kind !== "web") {
      throw new Error(
        `WebProcessor can only process 'web' sources, got '${source.kind}'`
      );
    }

    if (!source.url) {
      throw new Error("Web page URL is required");
    }

    const article = await extract(source.url);
    if (!article || !article.content) {
      throw new Error("Failed to extract article content");
    }

    const text = htmlToText(article.content, { wordwrap: false });

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 512,
      chunkOverlap: 128,
    });
    const parts = await splitter.splitText(text);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const chunks: {
      text: string;
      startTime?: number;
      endTime?: number;
      metadata?: Record<string, any>;
    }[] = [];

    for (let i = 0; i < parts.length; i++) {
      const chunkText = parts[i];
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunkText,
      });

      chunks.push({
        text: chunkText,
        metadata: {
          chunkIndex: i,
          tokenCount: chunkText.split(/\s+/).length,
          embedding: embedding.data[0].embedding,
        },
      });
    }

    const metadata: Record<string, any> = {
      ...source.metadata,
      title: article.title || source.title,
      description: article.description,
      author: article.author,
      image: article.image,
      published: article.published,
      siteName: article.source,
      contentLength: text.length,
    };
    return { chunks, metadata };
  }
}
