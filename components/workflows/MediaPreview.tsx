"use client";

import { useState } from "react";
import { Play, Pause, Image as ImageIcon, FileAudio, FileVideo, Expand } from "lucide-react";

interface MediaPreviewProps {
  url: string;
  type: "image" | "video" | "audio";
  alt?: string;
  className?: string;
}

export function MediaPreview({ url, type, alt, className = "" }: MediaPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-detect based on extension if possible, though type is usually passed
  const isImage = type === "image" || url.match(/\.(jpeg|jpg|gif|png|webp)$/i);
  const isVideo = type === "video" || url.match(/\.(mp4|webm|ogg)$/i);
  const isAudio = type === "audio" || url.match(/\.(mp3|wav|ogg)$/i);

  const containerClasses = `relative rounded-xl overflow-hidden border border-white/10 bg-black/40 ${className}`;

  if (isImage) {
    return (
      <div className={containerClasses}>
        <img src={url} alt={alt || "Generated Image"} className="w-full h-auto max-h-64 object-contain" />
        <a href={url} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-lg text-white/70 transition-colors backdrop-blur-sm">
          <Expand className="w-4 h-4" />
        </a>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className={containerClasses}>
        <video 
          src={url} 
          controls 
          className="w-full max-h-64 object-contain bg-black"
          poster="" 
        />
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-[10px] font-medium text-white/70 flex items-center gap-1.5">
          <FileVideo className="w-3 h-3" /> Video
        </div>
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className={`${containerClasses} p-3 flex flex-col gap-2`}>
        <div className="flex items-center gap-2 text-xs font-medium text-white/70">
          <FileAudio className="w-4 h-4 text-emerald-400" />
          Generated Audio
        </div>
        <audio src={url} controls className="w-full h-8 outline-none" />
      </div>
    );
  }

  return null;
}

// Helper to look for media URLs in an output object or string
export function extractMediaUrls(output: any): { url: string; type: "image" | "video" | "audio" }[] {
  const urls: { url: string; type: "image" | "video" | "audio" }[] = [];
  
  if (!output) return urls;

  const searchStr = typeof output === "string" ? output : JSON.stringify(output);
  
  // Very simplistic regex for URLs
  const urlRegex = /https?:\/\/[^\s"',]+/g;
  const matches = searchStr.match(urlRegex) || [];

  for (const url of matches) {
    // Check for specific keys in the object if it is one
    const isImageResult = url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || searchStr.includes("image_url") || searchStr.includes("imageUrl");
    const isVideoResult = url.match(/\.(mp4|webm|ogg)$/i) || searchStr.includes("video_url") || searchStr.includes("videoUrl");
    const isAudioResult = url.match(/\.(mp3|wav)$/i) || searchStr.includes("audio_url") || searchStr.includes("audioUrl");

    if (isImageResult) {
      if (!urls.find(u => u.url === url)) urls.push({ url, type: "image" });
    } else if (isVideoResult) {
      if (!urls.find(u => u.url === url)) urls.push({ url, type: "video" });
    } else if (isAudioResult) {
       if (!urls.find(u => u.url === url)) urls.push({ url, type: "audio" });
    }
  }

  return urls;
}
