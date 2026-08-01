import React from 'react';

export function formatText(text: string): JSX.Element {
  const urlRegex = /(\bhttps?:\/\/\S+\b)/g;
  const geminiMentionRegex = /(@gemini)/g;
  
  // First split by URLs
  const urlParts = text.split(urlRegex);
  
  return (
    <>{urlParts.map((part: string, index: number) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={`url-${index}-${part.slice(0, 15)}`} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-primary underline underline-offset-2"
          >
            {part}
          </a>
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