# MongoDB Atlas Vector Search Setup Guide

This guide walks you through setting up MongoDB Atlas Vector Search for the ChatTube YouTube RAG chatbot.

## Prerequisites

- MongoDB Atlas account (free tier M0 supports vector search)
- Database: `chattube`
- Collection: `videochunks`

## Quick Setup

### 1. Create Vector Search Index

Navigate to your MongoDB Atlas cluster:

1. Go to "Browse Collections" → `chattube` database → `videochunks` collection
2. Click "Search Indexes" tab
3. Click "Create Index" → "Atlas Vector Search"
4. Paste this configuration:

```json
{
  "name": "vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1536,
        "similarity": "cosine"
      }
    ]
  }
}
```

### 2. Wait for Index Creation

Vector search index creation typically takes 2-5 minutes. Monitor the status in the Atlas UI.

### 3. Verify Index

Once active, the index will appear in your Search Indexes list with status "Active".

## Configuration Details

### Index Configuration

| Field           | Value            | Description                                 |
| --------------- | ---------------- | ------------------------------------------- |
| `name`          | `"vector_index"` | Index name referenced in application code   |
| `path`          | `"embedding"`    | Document field containing vector embeddings |
| `numDimensions` | `1536`           | OpenAI ada-002 embedding dimensions         |
| `similarity`    | `"cosine"`       | Similarity metric for vector comparisons    |

### Performance Tuning

#### Search Parameters

```javascript
{
  $vectorSearch: {
    index: "vector_index",           // Must match index name
    path: "embedding",               // Must match index path
    queryVector: [/* 1536 numbers */], // User query embedding
    numCandidates: 50,               // Candidates to examine (higher = better quality)
    limit: 3                        // Top results to return
  }
}
```

#### Optimization Guidelines

- **numCandidates**: Balance between search quality and speed

  - Low (10-20): Faster, less accurate
  - Medium (50-100): Good balance
  - High (200+): Slower, more accurate

- **limit**: Number of results to return
  - RAG applications typically use 3-5 results
  - More results = more context but higher token usage

## Advanced Configuration

### Adding Metadata Filters

```json
{
  "name": "vector_index_with_filters",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1536,
        "similarity": "cosine"
      },
      {
        "type": "filter",
        "path": "videoId"
      },
      {
        "type": "filter",
        "path": "startTime"
      }
    ]
  }
}
```

This allows filtering by video or time range:

```javascript
{
  $vectorSearch: {
    index: "vector_index_with_filters",
    path: "embedding",
    queryVector: queryEmbedding,
    filter: {
      videoId: { $eq: ObjectId("...") }
    },
    numCandidates: 50,
    limit: 3
  }
}
```

## Testing Vector Search

### 1. Sample Query

```javascript
// Test vector search directly
const pipeline = [
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: Array(1536).fill(0.1), // Dummy embedding for testing
      numCandidates: 10,
      limit: 3,
    },
  },
  {
    $addFields: {
      score: { $meta: "vectorSearchScore" },
    },
  },
  {
    $project: {
      text: 1,
      startTime: 1,
      score: 1,
    },
  },
];

const results = await db.videochunks.aggregate(pipeline);
```

### 2. Verify Results

Successful vector search returns:

- Documents with similarity scores (0-1 range)
- Results ordered by relevance (highest score first)
- Meta score field showing vector search confidence

## Troubleshooting

### Common Issues

1. **Index Not Found Error**

   ```
   Command failed with error 40324: 'cannot find index vector_index for namespace chattube.videochunks'
   ```

   **Solution**: Verify index name and ensure it's active

2. **Dimension Mismatch**

   ```
   Command failed with error 40414: 'queryVector has 768 dimensions, but the index is configured for 1536 dimensions'
   ```

   **Solution**: Ensure all embeddings use OpenAI ada-002 (1536 dimensions)

3. **Slow Performance**

   - Reduce `numCandidates` parameter
   - Check Atlas cluster tier (higher tiers = better performance)
   - Consider adding filters to reduce search space

4. **No Results Returned**
   - Verify collection has documents with embeddings
   - Check that embeddings are 1536-dimension arrays
   - Ensure queryVector is properly formatted

### Monitoring

Monitor vector search performance in Atlas:

1. Go to "Database" → "Performance Advisor"
2. Check "Search" metrics for query performance
3. Review slow operations and optimize accordingly

## Production Considerations

### Scaling

- **M0 Free Tier**: Suitable for development and small datasets
- **M10+**: Recommended for production workloads
- **M30+**: Better performance for large datasets (>100k chunks)

### Cost Optimization

- Vector search pricing based on:
  - Index size (storage)
  - Query volume
  - Cluster tier
- Consider archiving old video chunks
- Implement query caching for frequently asked questions

### Security

- Enable network access controls
- Use database users with minimal required permissions
- Consider encryption at rest for sensitive content

## Integration Notes

The application automatically uses vector search when:

1. Vector index is properly configured
2. VideoChunk documents contain valid embeddings
3. OpenAI API key is configured for query embeddings

No additional application changes needed beyond proper MongoDB Atlas setup.
