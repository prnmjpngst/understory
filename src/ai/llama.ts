import {
  initLlama,
  releaseAllLlama,
  type ContextParams,
  type LlamaContext,
  type RNLlamaOAICompatibleMessage,
  type TokenData,
} from 'llama.rn';
import RNFS from 'react-native-fs';

import { getModelSpec, modelExists, modelsDir } from './models';
import { useAiStore, type ModelStatus } from '../store/aiStore';
import { useSettingsStore } from '../store/settingsStore';

// Pengaturan inference untuk model chat kecil yang berjalan penuh di CPU.
const CHAT_CTX: Partial<ContextParams> = {
  n_ctx: 4096,
  n_batch: 512,
  n_ubatch: 512,
  use_progress_callback: true,
};

// nomic-embed-text memakai mean pooling; dimensi 768 (lihat skema vec_chunks).
const EMBED_CTX: Partial<ContextParams> = {
  n_ctx: 2048,
  n_batch: 256,
  n_ubatch: 256,
  pooling_type: 'mean',
  use_progress_callback: true,
};

let chatContext: LlamaContext | null = null;
let embedContext: LlamaContext | null = null;
let loadToken = 0;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

function notify(
  kind: 'chat' | 'embedding',
  status: ModelStatus,
  progress: number,
  error?: string | null,
) {
  const s = useAiStore.getState();
  if (kind === 'chat') {
    s.setChatStatus(status, progress, error ?? null);
  } else {
    s.setEmbeddingStatus(status, progress, error ?? null);
  }
}

// Path model dari settings, atau jalur katalog bila sudah diunduh.
async function resolvePath(kind: 'chat' | 'embedding'): Promise<string | null> {
  const settings = useSettingsStore.getState();
  const configured = kind === 'chat' ? settings.chatModelPath : settings.embeddingModelPath;
  if (configured) {
    const exists = await RNFS.exists(configured);
    return exists ? configured : null;
  }
  // Fallback ke katalog default bila sudah diunduh.
  const specId = kind === 'chat' ? 'qwen2.5-0.5b-instruct' : 'nomic-embed-text-v1.5';
  const spec = getModelSpec(specId);
  if (spec && (await modelExists(spec))) {
    return `${modelsDir()}/${spec.fileName}`;
  }
  return null;
}

function onProgress(kind: 'chat' | 'embedding') {
  return (progress: number) => notify(kind, 'loading', progress);
}

async function ensureDirFor(path: string): Promise<void> {
  const dir = path.slice(0, path.lastIndexOf('/'));
  if (dir) {
    await RNFS.mkdir(dir);
  }
}

async function loadContext(
  kind: 'chat' | 'embedding',
): Promise<LlamaContext | null> {
  const myToken = ++loadToken;

  const ctx = kind === 'chat' ? chatContext : embedContext;
  if (ctx) {
    return ctx;
  }

  const modelPath = await resolvePath(kind);
  if (!modelPath) {
    notify(kind, 'idle', 0, 'Model not downloaded yet');
    return null;
  }

  await ensureDirFor(modelPath);
  notify(kind, 'loading', 0, null);
  try {
    const params: ContextParams = {
      model: modelPath,
      ...(kind === 'chat' ? CHAT_CTX : EMBED_CTX),
    };
    const ctx2 = await initLlama(params, onProgress(kind));
    if (myToken !== loadToken) {
      // Ada permintaan pemuatan lain yang lebih baru; buang hasil ini.
      await ctx2.release().catch(() => {});
      return kind === 'chat' ? chatContext : embedContext;
    }
    if (kind === 'chat') {
      chatContext = ctx2;
      notify('chat', 'ready', 1, null);
    } else {
      embedContext = ctx2;
      notify('embedding', 'ready', 1, null);
    }
    return ctx2;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    notify(kind, 'error', 0, msg);
    return null;
  }
}

export async function ensureChatModel(): Promise<LlamaContext | null> {
  return loadContext('chat');
}

export async function ensureEmbeddingModel(): Promise<LlamaContext | null> {
  return loadContext('embedding');
}

export async function isChatReady(): Promise<boolean> {
  const s = useAiStore.getState();
  if (s.chatStatus === 'ready') {
    return true;
  }
  const ctx = await ensureChatModel();
  return ctx !== null;
}

export async function isEmbeddingReady(): Promise<boolean> {
  const s = useAiStore.getState();
  if (s.embeddingStatus === 'ready') {
    return true;
  }
  const ctx = await ensureEmbeddingModel();
  return ctx !== null;
}

// Embedding satu teks; mengembalikan Float32Array atau null bila model tak siap.
export async function embedText(text: string): Promise<Float32Array | null> {
  const ctx = await ensureEmbeddingModel();
  if (!ctx) {
    return null;
  }
  try {
    const res = await ctx.embedding(text, { embd_normalize: 1 });
    return new Float32Array(res.embedding);
  } catch (err) {
    console.error('embedText failed', err);
    return null;
  }
}

export interface StreamResult {
  text: string;
}

// Jalankan completion streaming dengan pesan chat. Memanggil onToken per-token.
export async function streamChatCompletion(
  messages: RNLlamaOAICompatibleMessage[],
  onToken: (delta: string, full: string) => void,
): Promise<StreamResult> {
  const ctx = await ensureChatModel();
  if (!ctx) {
    throw new Error('Chat model not ready');
  }
  const store = useAiStore.getState();
  store.setChatStreaming(true, '');
  try {
    let full = '';
    const result = await ctx.completion(
      { messages, n_predict: 512, temperature: 0.7, top_p: 0.9 },
      (data: TokenData) => {
        // Beberapa versi native mengirim accumulated_text; yang lain hanya token.
        if (data.accumulated_text != null) {
          if (data.accumulated_text.length >= full.length) {
            const delta = data.accumulated_text.slice(full.length);
            full = data.accumulated_text;
            onToken(delta, full);
            useAiStore.getState().setChatStreaming(true, full);
          }
        } else if (data.content != null) {
          full += data.content;
          onToken(data.content, full);
          useAiStore.getState().setChatStreaming(true, full);
        }
      },
    );
    const finalText = result.text ?? full;
    return { text: finalText };
  } finally {
    useAiStore.getState().setChatStreaming(false, '');
  }
}

export async function releaseChatContext(): Promise<void> {
  if (chatContext) {
    await chatContext.release().catch(() => {});
    chatContext = null;
  }
  useAiStore.getState().setChatStatus('idle', 0, null);
}

export async function releaseEmbeddingContext(): Promise<void> {
  if (embedContext) {
    await embedContext.release().catch(() => {});
    embedContext = null;
  }
  useAiStore.getState().setEmbeddingStatus('idle', 0, null);
}

export async function releaseAllModels(): Promise<void> {
  await releaseChatContext();
  await releaseEmbeddingContext();
  await releaseAllLlama().catch(() => {});
}