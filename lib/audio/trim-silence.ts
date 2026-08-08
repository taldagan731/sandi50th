const THRESHOLD = 0.012;
const PADDING_SECONDS = 0.06;

export async function trimNameRecording(file: File): Promise<File> {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return file;
    const context = new AudioContextClass();
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    await context.close();

    let first = decoded.length;
    let last = 0;
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const samples = decoded.getChannelData(channel);
      for (let index = 0; index < samples.length; index += 1) {
        if (Math.abs(samples[index]) > THRESHOLD) {
          first = Math.min(first, index);
          break;
        }
      }
      for (let index = samples.length - 1; index >= 0; index -= 1) {
        if (Math.abs(samples[index]) > THRESHOLD) {
          last = Math.max(last, index);
          break;
        }
      }
    }
    if (first >= last) return file;
    const padding = Math.round(decoded.sampleRate * PADDING_SECONDS);
    first = Math.max(0, first - padding);
    last = Math.min(decoded.length - 1, last + padding);
    if (first === 0 && last === decoded.length - 1) return file;

    const frameCount = last - first + 1;
    const channels = Math.min(decoded.numberOfChannels, 2);
    const buffer = new ArrayBuffer(44 + frameCount * channels * 2);
    const view = new DataView(buffer);
    writeText(view, 0, "RIFF");
    view.setUint32(4, 36 + frameCount * channels * 2, true);
    writeText(view, 8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, decoded.sampleRate, true);
    view.setUint32(28, decoded.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeText(view, 36, "data");
    view.setUint32(40, frameCount * channels * 2, true);
    let offset = 44;
    for (let frame = first; frame <= last; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const value = Math.max(-1, Math.min(1, decoded.getChannelData(channel)[frame]));
        view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
        offset += 2;
      }
    }
    return new File([buffer], `name-chorus-${Date.now()}.wav`, { type: "audio/wav", lastModified: Date.now() });
  } catch {
    return file;
  }
}

function writeText(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}
