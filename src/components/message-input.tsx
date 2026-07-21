
'use client';

import { Paperclip, SendHorizonal, Mic, Trash2, StopCircle, Play, Smile } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { GifPicker } from './gif-picker';

interface MessageInputProps {
  onSendMessage: (messageText: string) => void;
  onFileSelect: (file: File) => void;
  onGifSelect: (base64: string, fileType: string, fileName: string, caption: string) => void;
  onTyping: (isTyping: boolean) => void;
  isAiChat?: boolean;
}

// #region WAV Encoder & Base64 Converter
// This set of functions provides a pure, client-side way to encode raw audio data (PCM)
// into a standard, universally playable WAV file format. It avoids server-side dependencies
// and ensures cross-browser compatibility for recorded audio.
const encodeWAV = (samples: Float32Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
      for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    floatTo16BitPCM(view, 44, samples);
    return new Blob([view], { type: 'audio/wav' });
};
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
};
// #endregion

export function MessageInput({ onSendMessage, onFileSelect, onGifSelect, onTyping, isAiChat }: MessageInputProps) {
    const [message, setMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { toast } = useToast();
    
    const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'recorded'>('idle');
    const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob, url: string } | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const [isSending, setIsSending] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const reviewAudioRef = useRef<HTMLAudioElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleTypingChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        if (isAiChat) return;

        onTyping(true);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            onTyping(false);
        }, 1000);
    }

    const handleSend = () => {
        if(!message.trim() || isSending) return;

        setIsSending(true);
        onSendMessage(message.trim());
        setMessage('');
        if(typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        onTyping(false);

        // Explicitly focus the textarea after sending to keep keyboard open
        textareaRef.current?.focus();

        // Cooldown to prevent ghost clicks on mobile
        setTimeout(() => {
            setIsSending(false);
        }, 50);
    }
    
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (file.size > maxSize) {
                toast({
                    title: 'File Too Large',
                    description: `Please select a file smaller than ${maxSize / 1024 / 1024}MB.`,
                    variant: 'destructive',
                });
                return;
            }
            onFileSelect(file);
        }
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const startRecording = async () => {
        if (isSending) return;
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
              toast({ title: "Recording not supported", description: "Your browser does not support audio recording.", variant: "destructive" });
              return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Using a specific MIME type is not reliable, so we record with the default
            // and convert to a universally supported format (WAV) later.
            mediaRecorderRef.current = new MediaRecorder(stream);
            
            mediaRecorderRef.current.addEventListener("dataavailable", (event) => {
              if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
              }
            });

            mediaRecorderRef.current.start();
            setRecordingStatus('recording');
            setRecordingDuration(0);
            timerIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            toast({ title: 'Microphone Access Denied', description: 'Please enable microphone permissions in your browser settings.', variant: 'destructive'});
        }
    };

    const stopRecording = (): Promise<Blob> => {
      return new Promise((resolve) => {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
              resolve(new Blob());
              return;
          }
  
          mediaRecorderRef.current.addEventListener('stop', () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' });
              audioChunksRef.current = [];
              mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
              mediaRecorderRef.current = null;
              resolve(audioBlob);
          }, { once: true });
  
          mediaRecorderRef.current.stop();
      });
    };


    const handleStopRecording = async () => {
        const recordedBlob = await stopRecording();

        if (recordedBlob.size === 0) {
            console.error("Recording failed, blob is empty.");
            cancelRecording();
            return;
        }

        try {
            // Convert the recorded audio (likely webm/opus) to a WAV file for universal compatibility.
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await blobToArrayBuffer(recordedBlob);
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const pcmData = audioBuffer.getChannelData(0);
            const wavBlob = encodeWAV(pcmData, audioBuffer.sampleRate);
            
            const audioUrl = URL.createObjectURL(wavBlob);
            setRecordedAudio({ blob: wavBlob, url: audioUrl });
            setRecordingStatus('recorded');

        } catch (error) {
            console.error("Failed to convert audio to WAV:", error);
            toast({ title: 'Conversion Failed', description: 'Could not process recorded audio.', variant: 'destructive' });
            cancelRecording();
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
             mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (recordedAudio) URL.revokeObjectURL(recordedAudio.url);
        
        setRecordedAudio(null);
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        setRecordingStatus('idle');
        setRecordingDuration(0);
    }

    const handleSendRecording = () => {
      if (recordedAudio) {
        const audioFile = new File([recordedAudio.blob], `voice-note-${Date.now()}.wav`, { type: 'audio/wav' });
        onFileSelect(audioFile);
        cancelRecording();
      }
    }

    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (recordedAudio) URL.revokeObjectURL(recordedAudio.url);
            if(typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (!isAiChat) {
                onTyping(false);
            }
        }
    }, [recordedAudio, isAiChat, onTyping]);

    const formatDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
  return (
    <div className="border-t border-border/50 bg-card/80 backdrop-blur-sm p-2">
      <div className="flex items-end gap-2">
        {!isAiChat && recordingStatus === 'idle' && (
            <>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,video/*,audio/*"
                />
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="h-5 w-5" />
                    <span className="sr-only">Attach file</span>
                </Button>
                <GifPicker onSelect={onGifSelect}>
                    <Button variant="ghost" size="icon" className="shrink-0">
                        <Smile className="h-5 w-5" />
                        <span className="sr-only">Select a GIF</span>
                    </Button>
                </GifPicker>
            </>
        )}

        <div className="flex-1 relative">
            {recordingStatus === 'recording' ? (
                <div className="flex-1 flex items-center justify-between bg-background/50 rounded-2xl px-4 py-2 h-10">
                    <div className="flex items-center gap-2 text-red-500">
                        <Mic className="h-5 w-5 animate-pulse" />
                        <span>{formatDuration(recordingDuration)}</span>
                    </div>
                    <Button variant="destructive" size="icon" className="rounded-full shrink-0 h-8 w-8" onClick={handleStopRecording}>
                        <StopCircle className="h-5 w-5" />
                        <span className="sr-only">Stop recording</span>
                    </Button>
                </div>
            ) : recordingStatus === 'recorded' && recordedAudio ? (
              <div className="flex-1 flex items-center justify-between bg-background/50 rounded-2xl px-4 py-2 h-10">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="shrink-0 text-red-500 hover:text-red-600 h-8 w-8" onClick={cancelRecording}>
                        <Trash2 className="h-5 w-5"/>
                    </Button>
                    <audio ref={reviewAudioRef} src={recordedAudio.url} className="hidden"/>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => reviewAudioRef.current?.play()}>
                        <Play className="h-4 w-4" />
                    </Button>
                     <span className="text-sm">{formatDuration(recordingDuration)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                      <Button size="icon" className="rounded-full shrink-0 h-8 w-8" onClick={handleSendRecording}>
                          <SendHorizonal className="h-4 w-4" />
                          <span className="sr-only">Send voice message</span>
                      </Button>
                  </div>
              </div>
            ) : (
                <Textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleTypingChange}
                    placeholder="Type a message..."
                    className="flex-1 resize-none self-center rounded-2xl border-input bg-background/50 py-2.5 px-4 pr-12 min-h-0 h-10 max-h-24"
                    rows={1}
                    onKeyDown={(e) => {
                        if(e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                />
            )}
        </div>
        
        {message.trim() && recordingStatus === 'idle' ? (
            <Button
              type="button"
              size="icon"
              className="rounded-full shrink-0"
              onClick={handleSend}
            >
                <SendHorizonal className="h-5 w-5" />
                <span className="sr-only">Send message</span>
            </Button>
        ) : recordingStatus === 'idle' && !isAiChat ? (
            <Button size="icon" className="rounded-full shrink-0" onClick={startRecording} disabled={isSending}>
                <Mic className="h-5 w-5" />
                <span className="sr-only">Record voice message</span>
            </Button>
        ) : null}
      </div>
    </div>
  );
}
