'use client';

import { Paperclip, SendHorizonal, Mic, Trash2, StopCircle, Play, Smile, X, Image as ImageIcon, FileText, Camera } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { GifPicker } from './gif-picker';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

interface MessageInputProps {
  onSendMessage: (messageText: string) => void;
  onFileSelect: (file: File) => void;
  onGifSelect: (base64: string, fileType: string, fileName: string, caption: string) => void;
  onTyping: (isTyping: boolean) => void;
  isAiChat?: boolean;
}

const COMMON_EMOJIS = [
  '😀', '😂', '😍', '🔥', '👍', '❤️', '🎉', '🙌',
  '💩', '🚀', '✨', '💯', '😎', '🤔', '😭', '🥳',
  '👏', '🙏', '💡', '⚡', '🥳', '🥰', '🤩', '🎯'
];

export function MessageInput({ onSendMessage, onFileSelect, onGifSelect, onTyping, isAiChat }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ url: string; name: string; type: string }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [isSending, setIsSending] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const reviewAudioRef = useRef<HTMLAudioElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-growing textarea logic
  const handleTypingChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-adjust textarea height up to 128px (max-h-32)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
    }

    if (isAiChat) return;
    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1000);
  };

  const handleEmojiSelect = (emoji: string) => {
    if (!textareaRef.current) {
      setMessage((prev) => prev + emoji);
      return;
    }
    const start = textareaRef.current.selectionStart || message.length;
    const end = textareaRef.current.selectionEnd || message.length;
    const updated = message.substring(0, start) + emoji + message.substring(end);
    setMessage(updated);
  };

  const handleSend = () => {
    if ((!message.trim() && selectedFiles.length === 0) || isSending) return;

    setIsSending(true);

    // Dispatch files if any were attached
    if (selectedFiles.length > 0) {
      selectedFiles.forEach((file) => onFileSelect(file));
      setSelectedFiles([]);
      setFilePreviews([]);
    }

    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onTyping(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

    setTimeout(() => {
      setIsSending(false);
    }, 50);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const newFiles: File[] = [];
    const newPreviews: { url: string; name: string; type: string }[] = [];

    files.forEach((file) => {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: `${file.name} is larger than 50MB limit.`,
          variant: 'destructive',
        });
        return;
      }
      newFiles.push(file);
      newPreviews.push({
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        name: file.name,
        type: file.type,
      });
    });

    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setFilePreviews((prev) => [...prev, ...newPreviews]);

    if (event.target) event.target.value = '';
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      const removed = prev[index];
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Voice recording functions
  const startRecording = async () => {
    if (isSending) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast({ title: 'Recording not supported', description: 'Browser audio recording unavailable.', variant: 'destructive' });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });

      mediaRecorderRef.current.start();
      setRecordingStatus('recording');
      setRecordingDuration(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast({ title: 'Microphone Error', description: 'Please allow microphone access.', variant: 'destructive' });
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
        mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        resolve(audioBlob);
      }, { once: true });
      mediaRecorderRef.current.stop();
    });
  };

  const handleStopRecording = async () => {
    const recordedBlob = await stopRecording();
    if (recordedBlob.size === 0) {
      cancelRecording();
      return;
    }
    const audioUrl = URL.createObjectURL(recordedBlob);
    setRecordedAudio({ blob: recordedBlob, url: audioUrl });
    setRecordingStatus('recorded');
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recordedAudio) URL.revokeObjectURL(recordedAudio.url);
    setRecordedAudio(null);
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecordingStatus('idle');
    setRecordingDuration(0);
  };

  const handleSendRecording = () => {
    if (recordedAudio) {
      const audioFile = new File([recordedAudio.blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
      onFileSelect(audioFile);
      cancelRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recordedAudio) URL.revokeObjectURL(recordedAudio.url);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [recordedAudio]);

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 p-1.5 sm:p-2 w-full">
      {/* Upload Thumbnail Strip Preview */}
      {filePreviews.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto p-2 bg-zinc-900/90 rounded-xl border border-zinc-800">
          {filePreviews.map((file, idx) => (
            <div key={idx} className="relative shrink-0 w-16 h-16 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center justify-center group">
              {file.url ? (
                <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
              ) : (
                <FileText className="h-6 w-6 text-violet-400" />
              )}
              <button
                onClick={() => removeSelectedFile(idx)}
                className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-zinc-300 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline Emoji Picker Drawer */}
      {showEmojiPicker && (
        <div className="p-2 bg-zinc-900/95 border border-zinc-800 rounded-xl shadow-xl grid grid-cols-8 gap-1 max-h-40 overflow-y-auto animate-in fade-in duration-150">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiSelect(emoji)}
              className="text-xl hover:scale-125 transition-transform p-1.5 rounded-lg hover:bg-zinc-800"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Controls Bar */}
      <div className="flex items-end gap-2 w-full">
        {!isAiChat && recordingStatus === 'idle' && (
          <>
            {/* Hidden File Inputs */}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" multiple />
            <input type="file" ref={docInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx,.txt,.zip,.rar" multiple />
            <input type="file" ref={cameraInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />

            {/* Attachment Picker Sheet / Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 text-zinc-300 hover:bg-zinc-800">
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">Attach File</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-800 text-zinc-100 w-44">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <ImageIcon className="h-4 w-4 text-violet-400" />
                  Photo / Video
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => docInputRef.current?.click()} className="gap-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  Document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => cameraInputRef.current?.click()} className="gap-2">
                  <Camera className="h-4 w-4 text-emerald-400" />
                  Camera
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Emoji Picker Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("shrink-0 text-zinc-300 hover:bg-zinc-800", showEmojiPicker && "bg-zinc-800 text-violet-400")}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="h-5 w-5" />
              <span className="sr-only">Toggle Emoji Picker</span>
            </Button>
          </>
        )}

        {/* Textarea or Recording Display */}
        <div className="flex-1 relative">
          {recordingStatus === 'recording' ? (
            <div className="flex-1 flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 h-10">
              <div className="flex items-center gap-2 text-red-500 font-medium text-sm">
                <Mic className="h-5 w-5 animate-pulse" />
                <span>{formatDuration(recordingDuration)}</span>
              </div>
              <Button variant="destructive" size="icon" className="rounded-full shrink-0 h-8 w-8" onClick={handleStopRecording}>
                <StopCircle className="h-4 w-4" />
              </Button>
            </div>
          ) : recordingStatus === 'recorded' && recordedAudio ? (
            <div className="flex-1 flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 h-10">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="shrink-0 text-red-500 hover:text-red-600 h-8 w-8" onClick={cancelRecording}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <audio ref={reviewAudioRef} src={recordedAudio.url} className="hidden" />
                <Button variant="outline" size="icon" className="h-8 w-8 border-zinc-700" onClick={() => reviewAudioRef.current?.play()}>
                  <Play className="h-4 w-4 text-zinc-100" />
                </Button>
                <span className="text-xs text-zinc-400">{formatDuration(recordingDuration)}</span>
              </div>
              <Button size="icon" className="rounded-full shrink-0 h-8 w-8 bg-violet-700 hover:bg-violet-600 text-white" onClick={handleSendRecording}>
                <SendHorizonal className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleTypingChange}
              placeholder="Type a message..."
              className="flex-1 resize-none rounded-2xl border-zinc-800 bg-zinc-900/90 py-2.5 px-4 pr-10 min-h-[40px] max-h-32 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-violet-500 transition-[height,max-height] duration-200 ease-in-out"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          )}
        </div>

        {/* Dynamic Send Arrow / Voice Mic Button */}
        {(message.trim() || selectedFiles.length > 0) && recordingStatus === 'idle' ? (
          <Button
            type="button"
            size="icon"
            className="rounded-full shrink-0 bg-violet-700 hover:bg-violet-600 text-white h-10 w-10"
            onClick={handleSend}
          >
            <SendHorizonal className="h-5 w-5" />
            <span className="sr-only">Send Message</span>
          </Button>
        ) : recordingStatus === 'idle' && !isAiChat ? (
          <Button
            size="icon"
            className="rounded-full shrink-0 bg-violet-700 hover:bg-violet-600 text-white h-10 w-10"
            onClick={startRecording}
            disabled={isSending}
          >
            <Mic className="h-5 w-5" />
            <span className="sr-only">Record Voice Note</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
