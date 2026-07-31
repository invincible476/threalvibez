'use client';

export function createToneAudio() {
  const dummy = { 
    audio: { start: () => {}, stop: () => {} }, 
    source: { stop: () => {} } 
  } as any;

  if (typeof window === 'undefined') {
    return dummy;
  }
  
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return dummy;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);

    return { audio: oscillator, source: oscillator };
  } catch (e) {
    console.warn('Web Audio API unavailable or failed:', e);
    return dummy;
  }
}
