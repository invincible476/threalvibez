import { useEffect, useRef, useState } from 'react';

interface AudioContextOptions {
  onAudioLevel?: (level: number) => void;
  threshold?: number;
  smoothingTimeConstant?: number;
}

export function useAudioContext(stream: MediaStream | null, options: AudioContextOptions = {}) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!stream) return;

    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      
      // Configure analyser
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = options.smoothingTimeConstant || 0.8;
      
      // Connect stream to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setIsAnalyzing(true);

      // Start audio level analysis
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const analyzeAudio = () => {
        if (!analyserRef.current || !isAnalyzing) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const normalizedLevel = average / 255; // Convert to 0-1 range

        if (options.onAudioLevel && normalizedLevel > (options.threshold || 0.1)) {
          options.onAudioLevel(normalizedLevel);
        }

        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };

      analyzeAudio();

      // Cleanup
      return () => {
        setIsAnalyzing(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        source.disconnect();
        analyser.disconnect();
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
      };
    } catch (error) {
      console.error('Error setting up audio analysis:', error);
    }
  }, [stream, options.onAudioLevel, options.threshold, options.smoothingTimeConstant]);

  return { isAnalyzing };
}