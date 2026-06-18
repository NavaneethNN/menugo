import { AudioPlayer, createAudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;

export async function initSound(): Promise<void> {
  try {
    player = createAudioPlayer(require('../../assets/sounds/new-order.mp3'));
  } catch (error) {
    console.error('[sound] Failed to init sound player:', error);
  }
}

export function playNewOrderAlert(): void {
  if (!player) {
    console.warn('[sound] Player not initialized');
    return;
  }
  try {
    player.seekTo(0);
    player.play();
  } catch (error) {
    console.error('[sound] Failed to play alert:', error);
  }
}
