"use client";

interface MediaViewerProps {
  url: string;
  mimeType: string;
}

export function MediaViewer({ url, mimeType }: MediaViewerProps) {
  const isAudio = mimeType.startsWith("audio/");

  if (isAudio) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <audio controls className="w-full max-w-lg">
          <source src={url} type={mimeType} />
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <video
        controls
        className="max-h-[80vh] max-w-full rounded-lg"
      >
        <source src={url} type={mimeType} />
        Your browser does not support the video element.
      </video>
    </div>
  );
}
