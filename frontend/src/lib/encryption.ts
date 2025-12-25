const ivLength = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(data: Uint8Array) {
  let binary = '';
  data.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(payload: string) {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importKey(addressKey: string) {
  const normalized = addressKey.toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(normalized));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function normalizeAddressKey(key: string) {
  return key.startsWith('0x') ? key : `0x${key}`;
}

export async function encryptUrlWithKey(url: string, addressKey: string) {
  const key = await importKey(addressKey);
  const iv = crypto.getRandomValues(new Uint8Array(ivLength));
  const cipher = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoder.encode(url),
  );
  const combined = new Uint8Array(ivLength + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), ivLength);
  return toBase64(combined);
}

export async function decryptUrlWithKey(payload: string, addressKey: string) {
  const key = await importKey(addressKey);
  const data = fromBase64(payload);
  const iv = data.slice(0, ivLength);
  const cipher = data.slice(ivLength);
  const clear = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    cipher,
  );
  return decoder.decode(clear);
}
