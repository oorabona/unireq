/**
 * Gets size of data in bytes
 * @param data - Data to measure
 * @returns Size in bytes
 * @internal Shared between body.ts and multipart.ts
 */
export function getDataSize(data: Blob | ArrayBuffer | string): number {
  if (data instanceof Blob) {
    return data.size;
  }
  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  // String - approximate byte size (UTF-8)
  return new Blob([data]).size;
}
