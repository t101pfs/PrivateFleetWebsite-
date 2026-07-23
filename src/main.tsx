import { Buffer } from "buffer";
import process from "process";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Polyfills required by @react-pdf/renderer in the browser
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
(globalThis as any).process = (globalThis as any).process || process;
(globalThis as any).global = globalThis;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);