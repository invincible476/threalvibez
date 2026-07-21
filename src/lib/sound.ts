
'use client';

export function createToneAudio() {
  if (typeof window === 'undefined') {
    // Return a dummy object for SSR
    return { 
        audio: { start: () => {}, stop: () => {} }, 
        source: { stop: () => {} } 
    } as any;
  }
  
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // High-pitched, short "bip" sound
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
  
  // Fade out quickly
  gainNode.gain.setValueAtTime(1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);

  return { audio: oscillator, source: oscillator };
}
