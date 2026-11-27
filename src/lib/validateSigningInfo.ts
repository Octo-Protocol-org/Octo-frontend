export interface SigningInfo {
  publicKey: string;
  sequence: string;
  networkPassphrase?: string;
}

export function validateSigningInfo(info: any): SigningInfo {
  if (!info || typeof info !== 'object') {
    throw new Error('SigningInfo payload must be an object');
  }
  if (!info.publicKey || typeof info.publicKey !== 'string' || !info.publicKey.startsWith('G')) {
    throw new Error('Invalid or missing Stellar public key');
  }
  if (!info.sequence || isNaN(Number(info.sequence))) {
    throw new Error('Invalid or missing sequence number');
  }
  return {
    publicKey: info.publicKey,
    sequence: info.sequence,
    networkPassphrase: info.networkPassphrase
  };
}
