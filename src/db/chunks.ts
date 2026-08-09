// Strategi chunking untuk embedding (domain logic):
// 1. Markdown dipecah per section berdasarkan heading (#, ##, ###, …).
// 2. Section kecil digabung agar potongan tidak terlalu pendek (embedding lebih bermakna).
// 3. Section besar dipotong ~500 token (≈2000 karakter) dengan overlap 200 karakter
//    supaya konteks yang melintasi batas potongan tidak hilang.
// 4. Setiap chunk diberi prefix judul dokumen agar embedding mengandung konteks dokumen.

export interface Chunk {
  index: number;
  text: string;
}

const TARGET_CHARS = 2000;
const OVERLAP_CHARS = 200;
const MIN_SECTION_CHARS = 400;

function splitByHeading(markdown: string): string[] {
  const lines = markdown.split('\n');
  const sections: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line) && current.length > 0) {
      sections.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) {
    sections.push(current.join('\n'));
  }
  return sections.map((s) => s.trim()).filter((s) => s.length > 0);
}

function splitLargeSection(section: string): string[] {
  if (section.length <= TARGET_CHARS) {
    return [section];
  }
  const parts: string[] = [];
  let start = 0;
  while (start < section.length) {
    let end = Math.min(start + TARGET_CHARS, section.length);
    // Usahakan memotong di batas paragraf agar potongan natural.
    if (end < section.length) {
      const paragraphBreak = section.lastIndexOf('\n\n', end);
      if (paragraphBreak > start + TARGET_CHARS / 2) {
        end = paragraphBreak;
      }
    }
    parts.push(section.slice(start, end).trim());
    if (end >= section.length) {
      break;
    }
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }
  return parts.filter((p) => p.length > 0);
}

export function chunkMarkdown(title: string, markdown: string): Chunk[] {
  const sections = splitByHeading(markdown);

  // Gabungkan section kecil berurutan.
  const merged: string[] = [];
  let buffer = '';
  for (const section of sections) {
    if (buffer.length === 0) {
      buffer = section;
      continue;
    }
    if (buffer.length < MIN_SECTION_CHARS || section.length < MIN_SECTION_CHARS) {
      if (buffer.length + section.length + 2 <= TARGET_CHARS) {
        buffer = `${buffer}\n\n${section}`;
        continue;
      }
    }
    merged.push(buffer);
    buffer = section;
  }
  if (buffer.length > 0) {
    merged.push(buffer);
  }

  const chunks: Chunk[] = [];
  const prefix = title.trim().length > 0 ? `${title.trim()}\n\n` : '';
  for (const section of merged) {
    for (const part of splitLargeSection(section)) {
      chunks.push({ index: chunks.length, text: prefix + part });
    }
  }
  return chunks;
}
