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

export function createRingtonePlayer() {
  if (typeof window === 'undefined') {
    return { stop: () => {} };
  }

  let audioContext: AudioContext | null = null;
  let intervalId: any = null;
  let activeOsc: OscillatorNode | null = null;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return { stop: () => {} };
    audioContext = new AudioContextClass();

    const playChimePair = () => {
      if (!audioContext || audioContext.state === 'closed') return;
      try {
        const now = audioContext.currentTime;

        // Tone 1: 440 Hz
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        gain1.gain.setValueAtTime(0.15, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        osc1.start(now);
        osc1.stop(now + 0.4);

        // Tone 2: 554.37 Hz (C#5 chord harmonizer)
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(554.37, now + 0.15);
        gain2.gain.setValueAtTime(0.2, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.7);
        activeOsc = osc2;
      } catch (e) {}
    };

    playChimePair();
    intervalId = setInterval(playChimePair, 1600);
  } catch (e) {
    console.warn('Ringtone AudioContext failed:', e);
  }

  return {
    stop: () => {
      if (intervalId) clearInterval(intervalId);
      if (activeOsc) {
        try { activeOsc.stop(); } catch (e) {}
      }
      if (audioContext && audioContext.state !== 'closed') {
        try { audioContext.close(); } catch (e) {}
      }
    },
  };
}

