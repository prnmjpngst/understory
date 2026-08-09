import RNFS from 'react-native-fs';

export type ModelKind = 'chat' | 'embedding';

export interface ModelSpec {
  id: string;
  kind: ModelKind;
  name: string;
  fileName: string;
  url: string;
  // Perkiraan ukuran file untuk ditampilkan sebelum unduhan selesai.
  sizeHintMb: number;
  // Dimensi embedding (hanya relevan untuk kind === 'embedding').
  dim?: number;
}

// Katalog model lokal yang bisa diunduh. URL menunjuk ke GGUF di HuggingFace.
export const MODEL_CATALOG: ModelSpec[] = [
  {
    id: 'qwen2.5-0.5b-instruct',
    kind: 'chat',
    name: 'Qwen 2.5 0.5B Instruct (Q4_K_M)',
    fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeHintMb: 398,
  },
  {
    id: 'nomic-embed-text-v1.5',
    kind: 'embedding',
    name: 'nomic-embed-text v1.5 (Q8)',
    fileName: 'nomic-embed-text-v1.5.Q8_0.gguf',
    url: 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q8_0.gguf',
    sizeHintMb: 87,
    dim: 768,
  },
];

export function getModelSpec(id: string): ModelSpec | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

// Direktori tempat seluruh model disimpan.
export function modelsDir(): string {
  return `${RNFS.DocumentDirectoryPath}/models`;
}

export function modelPathFor(spec: ModelSpec): string {
  return `${modelsDir()}/${spec.fileName}`;
}

export async function modelExists(spec: ModelSpec): Promise<boolean> {
  try {
    return await RNFS.exists(modelPathFor(spec));
  } catch {
    return false;
  }
}

export async function modelFileSizeBytes(spec: ModelSpec): Promise<number> {
  try {
    const stat = await RNFS.stat(modelPathFor(spec));
    return stat.size;
  } catch {
    return 0;
  }
}

export interface DownloadProgress {
  bytesWritten: number;
  bytesTotal: number;
  // 0..1
  fraction: number;
}

// Mengunduh model GGUF ke document/models. Mengembalikan path file selesai.
export async function downloadModel(
  spec: ModelSpec,
  onProgress: (p: DownloadProgress) => void,
  onDone?: (path: string) => void,
): Promise<string> {
  const dir = modelsDir();
  await RNFS.mkdir(dir);
  const dest = modelPathFor(spec);
  const tmp = `${dest}.part`;

  // Selesaikan unduhan yang tertunda.
  if (await RNFS.exists(tmp)) {
    await RNFS.unlink(tmp);
  }

  const result = await RNFS.downloadFile({
    fromUrl: spec.url,
    toFile: tmp,
    begin: (res) => {
      onProgress({ bytesWritten: 0, bytesTotal: res.contentLength, fraction: 0 });
    },
    progress: (res) => {
      const bytesTotal = res.contentLength || 1;
      onProgress({
        bytesWritten: res.bytesWritten,
        bytesTotal,
        fraction: res.bytesWritten / bytesTotal,
      });
    },
    progressDivider: 256 * 1024,
  }).promise;

  if (result.statusCode !== 200) {
    throw new Error(`Download failed (HTTP ${result.statusCode})`);
  }
  await RNFS.moveFile(tmp, dest);
  onDone?.(dest);
  return dest;
}

export async function removeModel(spec: ModelSpec): Promise<void> {
  const dest = modelPathFor(spec);
  if (await RNFS.exists(dest)) {
    await RNFS.unlink(dest);
  }
}

export async function listInstalledModels(): Promise<
  Array<{ spec: ModelSpec; sizeBytes: number }>
> {
  const out: Array<{ spec: ModelSpec; sizeBytes: number }> = [];
  for (const spec of MODEL_CATALOG) {
    if (await modelExists(spec)) {
      out.push({ spec, sizeBytes: await modelFileSizeBytes(spec) });
    }
  }
  return out;
}

// Ringkas ukuran byte agar mudah dibaca.
export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}