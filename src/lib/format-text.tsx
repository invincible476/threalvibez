import React from 'react';
import { cn } from './utils';

export function formatText(text: string = '', isOutgoing: boolean = false): JSX.Element {
  // Match URLs starting with http://, https://, or www.
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const geminiMentionRegex = /(@gemini)/g;
  
  // Split text by URL pattern
  const urlParts = text.split(urlRegex);
  
  return (
    <>{urlParts.map((part: string, index: number) => {
      if (part.match(urlRegex)) {
        // Strip trailing punctuation if accidentally attached
        let cleanPart = part;
        let trailingPunct = '';
        const matchPunct = part.match(/([.,!?;)]+)$/);
        if (matchPunct) {
          trailingPunct = matchPunct[1];
          cleanPart = part.slice(0, -trailingPunct.length);
        }

        const href = cleanPart.startsWith('http://') || cleanPart.startsWith('https://') 
          ? cleanPart 
          : `https://${cleanPart}`;

        return (
          <React.Fragment key={`url-frag-${index}`}>
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={cn(
                "underline underline-offset-2 break-all font-medium transition-colors cursor-pointer",
                isOutgoing 
                  ? "text-sky-200 hover:text-white decoration-sky-300/80" 
                  : "text-violet-400 dark:text-violet-300 hover:text-violet-500 decoration-violet-400/80"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {cleanPart}
            </a>
            {trailingPunct}
          </React.Fragment>
        );
      }
      
      // For non-URL parts, handle @gemini mentions
      const geminiParts = part.split(geminiMentionRegex);
      return (
        <span key={`text-part-${index}`}>
          {geminiParts.map((gPart: string, gIndex: number) => {
            if (gPart === '@gemini') {
              return (
                <span
                  key={`gemini-${index}-${gIndex}`}
                  className="inline-block bg-emerald-500/20 text-emerald-400 px-1 rounded font-medium"
                >
                  {gPart}
                </span>
              );
            }
            return <span key={`subpart-${index}-${gIndex}`}>{gPart}</span>;
          })}
        </span>
      );
    })}</>
  );
}