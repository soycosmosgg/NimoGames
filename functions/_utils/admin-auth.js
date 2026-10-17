export async function matchesAdminSecret(suppliedSecret, configuredSecret) {
  const encoder = new TextEncoder();
  const [suppliedDigest, configuredDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(suppliedSecret)),
    crypto.subtle.digest('SHA-256', encoder.encode(configuredSecret))
  ]);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  const configuredBytes = new Uint8Array(configuredDigest);
  let difference = 0;

  for (let index = 0; index < configuredBytes.length; index += 1) {
    difference |= suppliedBytes[index] ^ configuredBytes[index];
  }

  return difference === 0;
}
