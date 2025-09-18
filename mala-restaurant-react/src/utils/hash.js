// src/utils/hash.js
export async function sha256Base64(text = "") {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// เก็บเป็นรูปแบบ 'sha256:xxxx' เพื่อให้อ่านง่าย
export async function makePasswordHash(plain) {
  const b64 = await sha256Base64(String(plain || ""));
  return `sha256:${b64}`;
}
