export async function sha256Text(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256DataUrl(dataUrl: string): Promise<string> {
  const base64 = dataUrl.split(',')[1] ?? dataUrl;
  return sha256Text(base64);
}
