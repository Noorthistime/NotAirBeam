// File chunker — splits File objects into ArrayBuffer chunks for WebRTC DataChannel

export const CHUNK_SIZE = 64 * 1024; // 64 KB

export interface Chunk {
  index: number;
  total: number;
  data: ArrayBuffer;
  transferId: string;
  fileIndex: number;
}

export async function* chunkFile(
  file: File,
  transferId: string,
  fileIndex: number
): AsyncGenerator<Chunk> {
  const total = Math.ceil(file.size / CHUNK_SIZE);
  let index = 0;

  while (index < total) {
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const slice = file.slice(start, end);
    const data = await slice.arrayBuffer();
    yield { index, total, data, transferId, fileIndex };
    index++;
  }
}

export function encodeChunk(chunk: Chunk): ArrayBuffer {
  // Protocol: [4 bytes: header length][header JSON][chunk data]
  const header = JSON.stringify({
    i: chunk.index,
    t: chunk.total,
    id: chunk.transferId,
    fi: chunk.fileIndex,
  });
  const headerBytes = new TextEncoder().encode(header);
  const headerLen = new Uint32Array([headerBytes.length]);

  const combined = new Uint8Array(
    4 + headerBytes.length + chunk.data.byteLength
  );
  combined.set(new Uint8Array(headerLen.buffer), 0);
  combined.set(headerBytes, 4);
  combined.set(new Uint8Array(chunk.data), 4 + headerBytes.length);
  return combined.buffer;
}

export interface DecodedChunk {
  index: number;
  total: number;
  transferId: string;
  fileIndex: number;
  data: ArrayBuffer;
}

export function decodeChunk(buffer: ArrayBuffer): DecodedChunk {
  const view = new DataView(buffer);
  const headerLen = view.getUint32(0, true);
  const headerBytes = new Uint8Array(buffer, 4, headerLen);
  const header = JSON.parse(new TextDecoder().decode(headerBytes));
  const data = buffer.slice(4 + headerLen);
  return {
    index: header.i,
    total: header.t,
    transferId: header.id,
    fileIndex: header.fi,
    data,
  };
}

// Reassemble chunks into a Blob
export function assembleChunks(chunks: ArrayBuffer[], mimeType: string): Blob {
  return new Blob(chunks, { type: mimeType });
}

// Trigger browser download — works across all modern browsers
export function downloadBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    // Must append to document to work in Firefox
    document.body.appendChild(a);
    a.click();
    // Small delay before cleanup to ensure the download initiates
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  } catch (err) {
    console.error('[Download] Failed to trigger download:', err);
  }
}

// SHA-256 hash of a File
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function totalChunks(fileSize: number): number {
  return Math.ceil(fileSize / CHUNK_SIZE);
}
