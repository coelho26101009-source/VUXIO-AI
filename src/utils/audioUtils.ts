export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const decodeAudioData = async (
  audioData: Uint8Array,
  audioContext: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> => {
  const audioBuffer = audioContext.createBuffer(1, audioData.length / 2, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < channelData.length; i++) {
    const int16 = (audioData[2 * i + 1] << 8) | audioData[2 * i];
    channelData[i] = int16 / 32768.0;
  }
  return audioBuffer;
};
