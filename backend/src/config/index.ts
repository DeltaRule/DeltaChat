'use strict'
import 'dotenv/config'

const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  deltaDb: {
    url: process.env['DELTA_DB_URL'] ?? '',
    adminKey: process.env['DELTA_DB_ADMIN_KEY'] ?? '',
    database: process.env['DELTA_DB_DATABASE'] ?? 'deltachat',
  },
  openai: {
    apiKey: process.env['OPENAI_API_KEY'] ?? '',
    defaultModel: process.env['OPENAI_DEFAULT_MODEL'] ?? 'gpt-4o',
  },
  gemini: {
    apiKey: process.env['GEMINI_API_KEY'] ?? '',
    defaultModel: process.env['GEMINI_DEFAULT_MODEL'] ?? 'gemini-pro',
  },
  ollama: {
    baseUrl: process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',
    defaultModel: process.env['OLLAMA_DEFAULT_MODEL'] ?? 'llama3',
  },
  anthropic: {
    apiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
    defaultModel: process.env['ANTHROPIC_DEFAULT_MODEL'] ?? 'claude-sonnet-4-20250514',
  },
  groq: {
    apiKey: process.env['GROQ_API_KEY'] ?? '',
    defaultModel: process.env['GROQ_DEFAULT_MODEL'] ?? 'llama-3.3-70b-versatile',
  },
  azureOpenai: {
    apiKey: process.env['AZURE_OPENAI_API_KEY'] ?? '',
    endpoint: process.env['AZURE_OPENAI_ENDPOINT'] ?? '',
    apiVersion: process.env['AZURE_OPENAI_API_VERSION'] ?? '2024-04-01-preview',
    defaultModel: process.env['AZURE_OPENAI_DEFAULT_MODEL'] ?? 'gpt-4o',
  },
  mistral: {
    apiKey: process.env['MISTRAL_API_KEY'] ?? '',
    defaultModel: process.env['MISTRAL_DEFAULT_MODEL'] ?? 'mistral-large-latest',
  },
  deepseek: {
    apiKey: process.env['DEEPSEEK_API_KEY'] ?? '',
    defaultModel: process.env['DEEPSEEK_DEFAULT_MODEL'] ?? 'deepseek-chat',
  },
  cohere: {
    apiKey: process.env['COHERE_API_KEY'] ?? '',
    defaultModel: process.env['COHERE_DEFAULT_MODEL'] ?? 'command-r-plus',
  },
  huggingface: {
    apiKey: process.env['HUGGINGFACE_API_KEY'] ?? '',
    baseUrl: process.env['HUGGINGFACE_BASE_URL'] ?? 'https://api-inference.huggingface.co',
  },
  chroma: {
    url: process.env['CHROMA_URL'] ?? 'http://localhost:8000',
    defaultCollection: process.env['CHROMA_DEFAULT_COLLECTION'] ?? 'deltachat',
  },
  pinecone: {
    apiKey: process.env['PINECONE_API_KEY'] ?? '',
    indexName: process.env['PINECONE_INDEX_NAME'] ?? '',
  },
  qdrant: {
    url: process.env['QDRANT_URL'] ?? 'http://localhost:6333',
    apiKey: process.env['QDRANT_API_KEY'] ?? '',
  },
  weaviate: {
    url: process.env['WEAVIATE_URL'] ?? 'http://localhost:8080',
    apiKey: process.env['WEAVIATE_API_KEY'] ?? '',
  },
  milvus: {
    address: process.env['MILVUS_ADDRESS'] ?? 'localhost:19530',
    token: process.env['MILVUS_TOKEN'] ?? '',
  },
  pgvector: {
    connectionString: process.env['PGVECTOR_CONNECTION_STRING'] ?? '',
  },
  tika: { url: process.env['TIKA_URL'] ?? 'http://localhost:9998' },
  docling: { url: process.env['DOCLING_URL'] ?? 'http://localhost:5001' },
  unstructured: {
    url: process.env['UNSTRUCTURED_URL'] ?? 'http://localhost:8000',
    apiKey: process.env['UNSTRUCTURED_API_KEY'] ?? '',
  },
  binaryStorage: { path: process.env['BINARY_STORAGE_PATH'] ?? './data/binaries' },
  s3: {
    bucket: process.env['S3_BUCKET'] ?? '',
    region: process.env['S3_REGION'] ?? 'us-east-1',
    accessKeyId: process.env['S3_ACCESS_KEY_ID'] ?? '',
    secretAccessKey: process.env['S3_SECRET_ACCESS_KEY'] ?? '',
    endpoint: process.env['S3_ENDPOINT'] ?? '',
  },
  azureBlob: {
    connectionString: process.env['AZURE_BLOB_CONNECTION_STRING'] ?? '',
    containerName: process.env['AZURE_BLOB_CONTAINER'] ?? 'deltachat-binaries',
  },
  gcs: {
    bucket: process.env['GCS_BUCKET'] ?? '',
    projectId: process.env['GCS_PROJECT_ID'] ?? '',
    keyFilename: process.env['GCS_KEY_FILENAME'] ?? '',
  },
  mcp: { serverUrl: process.env['MCP_SERVER_URL'] ?? '' },
  webhookSecret: process.env['WEBHOOK_SECRET'] ?? 'change-me-in-production',
  jwt: {
    secret: process.env['JWT_SECRET'] ?? 'deltachat-dev-secret-change-in-production',
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  },
  google: {
    clientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
    clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
  },
  scim: {
    apiToken: process.env['SCIM_API_TOKEN'] ?? '',
  },
  adminEmail: process.env['ADMIN_EMAIL'] ?? '',
  logLevel: (process.env['LOG_LEVEL'] ?? 'info') as 'error' | 'warn' | 'info' | 'debug',
  ragChunkTemplate:
    process.env['RAG_CHUNK_TEMPLATE'] ?? '\n\n---\nRelevant context from knowledge base:\n{chunks}',
  cors: {
    origins: (
      process.env['CORS_ORIGINS'] ??
      'http://localhost:3000,http://localhost:5173,http://localhost:5174'
    )
      .split(',')
      .map((o) => o.trim()),
  },
} as const

export default config
