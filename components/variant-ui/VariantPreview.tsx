"use client";

import { useRef, useEffect, useState } from "react";

interface VariantPreviewProps {
  code: string;
  format: "html" | "react";
  responsive?: "desktop" | "mobile";
}

export default function VariantPreview({ code, format, responsive = "desktop" }: VariantPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  const html = format === "react" ? wrapReactCode(code) : code;

  // Auto-resize iframe to content height
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          const h = doc.body.scrollHeight;
          if (h > 0) setHeight(Math.min(h, 800));
        }
      } catch {
        // cross-origin restriction — keep default height
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [html]);

  const width = responsive === "mobile" ? "375px" : "100%";

  return (
    <div
      className="overflow-hidden rounded-lg border border-border-light bg-white"
      style={{ width: responsive === "mobile" ? "375px" : "100%", margin: responsive === "mobile" ? "0 auto" : undefined }}
    >
      <iframe
        ref={iframeRef}
        srcDoc={html}
        sandbox="allow-scripts"
        style={{ width, height, border: "none", display: "block" }}
        title="Variant preview"
      />
    </div>
  );
}

function wrapReactCode(code: string): string {
  // Wrap React JSX in a minimal HTML page with React CDN
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  </script>
</body>
</html>`;
}
