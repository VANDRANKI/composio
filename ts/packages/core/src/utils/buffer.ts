/**
 * Converts an `ArrayBuffer` to a base64-encoded string.
 *
 * Uses the cross-platform `btoa` built-in, making this safe for both
 * Node.js (v16+) and browser environments.
 *
 * @param buffer - The raw binary data to encode.
 * @returns A base64-encoded string representation of the buffer.
 *
 * @example
 * ```ts
 * const buf = new TextEncoder().encode('hello').buffer;
 * arrayBufferToBase64(buf); // => 'aGVsbG8='
 * ```
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a base64-encoded string to a `Uint8Array` of raw bytes.
 *
 * This is a cross-platform helper that avoids Node.js-specific `Buffer`
 * usage, ensuring compatibility with browser and edge runtimes.
 *
 * @param base64 - A valid base64-encoded string to decode.
 * @returns A `Uint8Array` containing the decoded bytes.
 *
 * @example
 * ```ts
 * const bytes = base64ToUint8Array('aGVsbG8=');
 * new TextDecoder().decode(bytes); // => 'hello'
 * ```
 */
export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Converts a `Uint8Array` to a base64-encoded string.
 *
 * Cross-platform alternative to `Buffer.from(bytes).toString('base64')`
 * that works in browser and edge runtimes as well as Node.js.
 *
 * @param bytes - The byte array to encode.
 * @returns A base64-encoded string representation of the input bytes.
 *
 * @example
 * ```ts
 * const bytes = new TextEncoder().encode('hello');
 * uint8ArrayToBase64(bytes); // => 'aGVsbG8='
 * ```
 */
export const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
