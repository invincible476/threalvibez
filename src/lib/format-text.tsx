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
            key={index} 
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
        <span key={index}>
          {geminiParts.map((gPart: string, gIndex: number) => {
            if (gPart === '@gemini') {
              return (
                <span
                  key={gIndex}
                  className="inline-block bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-1 rounded"
                >
                  {gPart}
                </span>
              );
            }
            return <span key={gIndex}>{gPart}</span>;
          })}
        </span>
      );
    })}</>
  );
}