import { AudioPlayer, createAudioPlayer } from 'expo-audio';

let newOrderPlayer: AudioPlayer | null = null;
let readyToServePlayer: AudioPlayer | null = null;

export async function initSound(): Promise<void> {
  try {
    newOrderPlayer = createAudioPlayer(require('../../assets/sounds/new-order.mp3'));
    readyToServePlayer = createAudioPlayer(require('../../assets/sounds/new-order.mp3'));
  } catch (error) {
    console.error('[sound] Failed to init sound players:', error);
  }
}

export function playNewOrderAlert(): void {
  if (!newOrderPlayer) {
    console.warn('[sound] New order player not initialized');
    return;
  }
  try {
    newOrderPlayer.seekTo(0);
    newOrderPlayer.play();
  } catch (error) {
    console.error('[sound] Failed to play new order alert:', error);
  }
}

export function playReadyToServeAlert(): void {
  if (!readyToServePlayer) {
    console.warn('[sound] Ready-to-serve player not initialized');
    return;
  }
  try {
    readyToServePlayer.seekTo(0);
    readyToServePlayer.play();
  } catch (error) {
    console.error('[sound] Failed to play ready-to-serve alert:', error);
  }
}
