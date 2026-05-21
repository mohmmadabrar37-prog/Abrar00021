/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Upload, 
  Image as ImageIcon, 
  RefreshCw, 
  ChevronRight, 
  History, 
  Sliders, 
  Download, 
  ArrowLeft,
  Info,
  Check,
  AlertCircle,
  Maximize2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { STARTER_TEMPLATES, GENERAL_IDEAS } from "./data";
import { EditHistoryItem, ImageTemplate, ProcessingOptions, AspectRatio } from "./types";

const LOADING_MESSAGES = [
  "Gemini is analyzing the image composition & lighting...",
  "Translating your natural language prompt into pixels...",
  "Applying progressive image-to-image modifications...",
  "Fine-tuning colors, shadows, and semantic details...",
  "Finalizing premium photo-realistic render adjustments...",
  "Hold tight, generating your brand-new reimaginded look..."
];

export default function App() {
  // Application State
  const [history, setHistory] = useState<EditHistoryItem[]>([
    {
      id: "initial-valley",
      imageUrl: STARTER_TEMPLATES[0].url,
      prompt: "Original Template: Verdant Valley",
      timestamp: new Date().toLocaleTimeString(),
      isInitial: true
    }
  ]);
  const [activeId, setActiveId] = useState<string>("initial-valley");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>("valley");
  const [prompt, setPrompt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // Image options
  const [options, setOptions] = useState<ProcessingOptions>({
    model: "gemini-2.5-flash-image",
    aspectRatio: "1:1"
  });

  // Comparison slider position (percentage 0 to 100)
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  // Drag and drop State
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Cycling the animated loading texts
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3500);
    } else {
      setLoadingMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Convert files to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WEBP, etc.).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const base64Data = event.target.result as string;
        const newItem: EditHistoryItem = {
          id: `upload-${Date.now()}`,
          imageUrl: base64Data,
          prompt: `Uploaded: ${file.name}`,
          timestamp: new Date().toLocaleTimeString(),
          isInitial: true
        };
        setHistory([newItem]);
        setActiveId(newItem.id);
        setSelectedTemplateId(null);
        setError(null);
      }
    };
    reader.onerror = () => {
      setError("Failed to read the uploaded image.");
    };
    reader.readAsDataURL(file);
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Choose a template
  const selectTemplate = (template: ImageTemplate) => {
    const newItem: EditHistoryItem = {
      id: `template-${template.id}-${Date.now()}`,
      imageUrl: template.url,
      prompt: `Preset: ${template.name}`,
      timestamp: new Date().toLocaleTimeString(),
      isInitial: true
    };
    setHistory([newItem]);
    setActiveId(newItem.id);
    setSelectedTemplateId(template.id);
    setError(null);
  };

  // Submit Prompt to Gemini API for Editing
  const handleEditPhoto = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    const activeItem = history.find(item => item.id === activeId);
    if (!activeItem) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/edit-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: prompt,
          base64Image: activeItem.imageUrl,
          model: options.model,
          aspectRatio: options.aspectRatio
        })
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "The generative edit request was unsuccessful.");
      }

      if (!resData.imageUrl && !resData.text) {
        throw new Error("No image or response was generated by Gemini. Try editing your prompt instructions.");
      }

      const newHistoryItem: EditHistoryItem = {
        id: `version-${Date.now()}`,
        imageUrl: resData.imageUrl || activeItem.imageUrl,
        prompt: prompt,
        timestamp: new Date().toLocaleTimeString(),
        textFeedback: resData.text || undefined,
        isInitial: false
      };

      // Append to editing history chain
      setHistory(prev => [...prev, newHistoryItem]);
      setActiveId(newHistoryItem.id);
      setPrompt(""); // Clear edit instructions space
      setSliderPosition(50); // reset slider to center for easy comparison
    } catch (err: any) {
      console.error("Failed to edit photo:", err);
      setError(err.message || "An error occurred during editing.");
    } finally {
      setLoading(false);
    }
  };

  // Reset Stack
  const handleClearAll = () => {
    if (selectedTemplateId) {
      const found = STARTER_TEMPLATES.find(t => t.id === selectedTemplateId);
      if (found) {
        selectTemplate(found);
        return;
      }
    }
    // fallback
    selectTemplate(STARTER_TEMPLATES[0]);
  };

  // Comparison slider mouse move handler
  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingSlider || e.buttons === 1) {
      handleSliderMove(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  // Find active before and after versions
  const activeIndex = history.findIndex(item => item.id === activeId);
  const currentItem = activeIndex !== -1 ? history[activeIndex] : history[0];
  const beforeItem = activeIndex > 0 ? history[activeIndex - 1] : null;

  // Selected template dynamic config
  const activeTemplate = STARTER_TEMPLATES.find(t => t.id === selectedTemplateId);

  // Handle preset clicks directly
  const applyPresetPrompt = (txt: string) => {
    setPrompt(txt);
  };

  // Show triggering of the paid model flow UI
  const triggerPaidModelFlow = () => {
    // Calling show_aistudio_ui via API is handled in our turn. We can show instructions to user.
    alert("Using premium image models require a paid billing credential in Google AI Studio. Please use the Secrets panel to select a proper billing setup!");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans selection:bg-orange-500 selection:text-white flex flex-col p-6 md:p-10">
      {/* Editorial Header Section */}
      <header id="app-header" className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-6 mb-8 gap-4 select-none">
        <div className="flex items-baseline gap-4 md:gap-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tighter uppercase font-sans text-[#F5F5F5] flex items-center gap-2">
            NEURAL.LUXE
          </h1>
          <span className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-[#F5F5F5] opacity-40">
            Generative Alchemy v2.5
          </span>
        </div>
        
        <nav className="flex items-center gap-6 md:gap-8 text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-[#F5F5F5]/80">
          <span className="border-b border-orange-500 pb-1 text-orange-400 font-medium">Canvas</span>
          <span className="opacity-50">Studio</span>
          <span className="opacity-50">Telemetry</span>
          <button 
            id="premium-button"
            onClick={triggerPaidModelFlow}
            className="px-3 py-1 border border-orange-500/30 text-orange-400 text-[9px] tracking-widest hover:bg-orange-500 hover:text-white transition-colors duration-300"
          >
            PREMIUM PLUGINS
          </button>
        </nav>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
        
        {/* Left Side: Layout Controls */}
        <section id="controls-panel" className="lg:col-span-4 flex flex-col space-y-8">
          
          {/* Section 1: Source & Presets */}
          <div id="sources-card" className="bg-[#111] border border-white/5 p-5 md:p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-white/70 font-medium flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5 text-orange-400" />
                Primary Source
              </h2>
              <span className="text-[9px] font-mono text-white/30 uppercase">Layer_0</span>
            </div>

            {/* Premium File Upload Dropzone */}
            <div 
              id="dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border border-dashed p-6 text-center transition-all duration-300 cursor-pointer relative group ${
                isDraggingOver 
                  ? "border-orange-400 bg-orange-400/5" 
                  : "border-white/10 hover:border-white/20 bg-white/[0.01]"
              }`}
            >
              <input 
                id="file-input"
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="h-6 w-6 mx-auto mb-2 text-white/40 group-hover:text-orange-400 transition-colors" />
              <p className="text-xs uppercase tracking-widest text-white/70">DEPOSIT IMAGERY</p>
              <p className="text-[10px] text-white/40 mt-1 italic">Drag & drop or Click to browse</p>
            </div>

            {/* Presets Carousel */}
            <div className="space-y-2.5">
              <p className="text-[10px] text-white/40 uppercase tracking-[0.15em] font-mono">Curated Starters</p>
              <div id="presets-grid" className="grid grid-cols-4 gap-2">
                {STARTER_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    id={`preset-btn-${tpl.id}`}
                    onClick={() => selectTemplate(tpl)}
                    className={`relative aspect-square overflow-hidden border transition-all duration-300 ${
                      selectedTemplateId === tpl.id 
                        ? "border-orange-500 scale-95" 
                        : "border-white/10 hover:border-white/30 hover:scale-105"
                    }`}
                    title={tpl.name}
                  >
                    <img 
                      src={tpl.url} 
                      alt={tpl.name} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover grayscale-[30%] hover:grayscale-0 transition-all duration-500"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-[#0A0A0A]/90 py-1 text-[8px] uppercase tracking-wider text-center text-white/80 border-t border-white/5 truncate px-1 font-mono">
                      {tpl.name.split(" ")[0]}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Parameters */}
          <div id="tuning-card" className="bg-[#111] border border-white/5 p-5 md:p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-white/70 font-medium flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-orange-400" />
                Parameters
              </h2>
              <span className="text-[9px] font-mono text-white/30 uppercase">FineTune_v2</span>
            </div>

            {/* Model Selection dropdown */}
            <div className="space-y-1.5">
              <label htmlFor="model-select" className="text-[10px] text-white/50 uppercase tracking-wider flex justify-between">
                <span>Generative AI Engine</span>
                <span className="text-[9px] text-orange-400 font-mono tracking-normal">@google/genai</span>
              </label>
              <select
                id="model-select"
                value={options.model}
                onChange={(e) => setOptions(prev => ({ ...prev, model: e.target.value as any }))}
                className="w-full bg-[#0A0A0A] border border-white/10 p-2.5 text-[11px] text-white/90 outline-none focus:border-orange-500/50 uppercase tracking-widest font-mono"
              >
                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash (Standard)</option>
                <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Ultra (Premium)</option>
              </select>
            </div>

            {/* Target Aspect ratio */}
            <div className="space-y-2">
              <label htmlFor="ratio-select" className="text-[10px] text-white/50 uppercase tracking-wider">Canvas Format Ratio</label>
              <div id="ratio-select" className="grid grid-cols-5 gap-1.5">
                {(["1:1", "3:4", "4:3", "9:16", "16:9"] as AspectRatio[]).map((r) => (
                  <button
                    key={r}
                    id={`ratio-${r.replace(":", "-")}`}
                    onClick={() => setOptions(prev => ({ ...prev, aspectRatio: r }))}
                    className={`text-[10px] py-2 transition-all font-mono border ${
                      options.aspectRatio === r 
                        ? "bg-orange-500/10 border-orange-500 text-orange-400 font-semibold" 
                        : "bg-[#0A0A0A] border-white/10 hover:border-white/20 text-white/60"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: History list */}
          <div id="history-card" className="bg-[#111] border border-white/5 p-5 md:p-6 flex-1 flex flex-col min-h-[180px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-white/70 font-medium flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-orange-400" />
                Evolution Stack
              </h2>
              <button 
                id="clear-btn"
                onClick={handleClearAll}
                className="text-[9px] text-white/40 hover:text-white uppercase tracking-widest font-mono border border-white/10 px-2 py-0.5 hover:bg-white/5 transition-all"
              >
                Reset
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[220px] lg:max-h-[300px]">
              <AnimatePresence initial={false}>
                {history.map((item, index) => {
                  const isActive = item.id === activeId;
                  return (
                    <motion.div
                      key={item.id}
                      id={`history-item-${item.id}`}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => {
                        setActiveId(item.id);
                        setError(null);
                      }}
                      className={`p-2 border transition-all duration-300 cursor-pointer flex items-center gap-3 ${
                        isActive 
                          ? "bg-orange-500/[0.04] border-orange-500/80 text-white" 
                          : "bg-[#0A0A0A]/50 border-white/5 hover:border-white/15 hover:bg-[#0A0A0A]"
                      }`}
                    >
                      <div className="w-10 h-10 overflow-hidden flex-shrink-0 bg-black border border-white/10">
                        <img 
                          src={item.imageUrl} 
                          alt="Thumb" 
                          className="w-full h-full object-cover grayscale-[40%]"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0 font-mono">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[8px] text-white/35">STATE_0{index + 1}</span>
                          <span className="text-[7px] text-orange-400 border border-orange-500/20 px-1 py-0.25">
                            {item.isInitial ? "BASE" : "LATENT"}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/70 truncate uppercase tracking-tight">
                          {item.prompt}
                        </p>
                      </div>
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isActive ? "text-orange-400 translate-x-0.5" : "text-white/20"}`} />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Right Side: Active Photo Canvas & Action area */}
        <section id="workspace-panel" className="lg:col-span-8 flex flex-col space-y-8">
          
          {/* Centerpiece Image Box Container */}
          <div 
            id="canvas-card" 
            className="bg-[#111] border border-white/5 p-4 flex flex-col relative overflow-hidden flex-1 min-h-[420px] justify-between shadow-2xl"
          >
            {/* Minimalist Top details bar */}
            <div id="image-meta" className="flex items-center justify-between bg-[#0A0A0A]/80 p-3 rounded-none mb-4 border border-white/5 font-mono text-[9px] uppercase tracking-widest text-white/50">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-orange-500 animate-pulse"></span>
                <span>Active Specimen: <strong className="text-white/80">
                  {currentItem.isInitial ? "Original State Base" : `Latent Layer (${activeId.slice(0, 8)})`}
                </strong></span>
              </div>
              <div>
                <span>Registered: <strong className="text-white/80">{currentItem.timestamp}</strong></span>
              </div>
            </div>

            {/* Display Canvas Viewport with Sliding Swipe compare trigger */}
            <div 
              ref={sliderContainerRef}
              onMouseMove={handleMouseMove}
              onTouchMove={handleTouchMove}
              onMouseDown={() => setIsDraggingSlider(true)}
              onMouseUp={() => setIsDraggingSlider(false)}
              onMouseLeave={() => setIsDraggingSlider(false)}
              className="relative flex-1 bg-black border border-white/5 flex items-center justify-center min-h-[320px] select-none"
            >
              {/* Premium Processing state blur sheet */}
              <AnimatePresence>
                {loading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#0A0A0A]/95 z-30 flex flex-col items-center justify-center p-6 text-center"
                  >
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      className="h-10 w-10 border border-white/10 border-t-orange-400 mb-6"
                    />
                    <h3 className="text-sm font-semibold tracking-[0.25em] uppercase text-orange-400 animate-pulse font-sans">
                      EXECUTING NEURAL MATRIX...
                    </h3>
                    <p className="text-[10px] text-white/40 mt-3 uppercase tracking-wider font-mono max-w-sm h-6 overflow-hidden">
                      {LOADING_MESSAGES[loadingMessageIndex]}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Slider comparative view block */}
              {beforeItem ? (
                <div 
                  id="comparison-frame"
                  className="absolute inset-0 w-full h-full cursor-ew-resize overflow-hidden"
                >
                  {/* Left part "Original" backdrop */}
                  <div className="absolute inset-0 w-full h-full">
                    <img
                      src={beforeItem.imageUrl}
                      alt="Original State"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none grayscale-[20%]"
                    />
                    {/* Visual Stamp labels */}
                    <span className="absolute top-4 left-4 z-20 text-[9px] uppercase tracking-[0.25em] font-mono bg-black/80 px-2.5 py-1 border border-white/10 select-none text-white/60">
                      BEFORE STEP
                    </span>
                  </div>

                  {/* Right part cover sheet "Edited" */}
                  <div 
                    className="absolute inset-y-0 right-0 h-full bg-black overflow-hidden border-l border-orange-500 shadow-2xl"
                    style={{ left: `${sliderPosition}%` }}
                  >
                    <img
                      src={currentItem.imageUrl}
                      alt="Current Generative Layer"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      style={{ 
                        width: sliderContainerRef.current?.getBoundingClientRect().width || "100%",
                        maxWidth: "none",
                        left: `-${sliderPosition}%`
                      }}
                    />
                    {/* stamp */}
                    <span className="absolute top-4 right-4 z-20 text-[9px] uppercase tracking-[0.25em] font-mono bg-orange-500 text-black px-2.5 py-1 font-bold select-none">
                      GENERATION LAYER
                    </span>
                  </div>

                  {/* center line slider grabber */}
                  <div 
                    className="absolute inset-y-0 z-20 w-[1px] bg-orange-500 cursor-ew-resize"
                    style={{ left: `${sliderPosition}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 bg-orange-500 text-black flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 select-none text-xs">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin duration-3000" />
                    </div>
                  </div>
                </div>
              ) : (
                /* base single viewport */
                currentItem && (
                  <div id="full-image-frame" className="absolute inset-0 w-full h-full">
                    <img
                      src={currentItem.imageUrl}
                      alt="Specimen"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain pointer-events-none grayscale-[15%] hover:grayscale-0 transition-opacity duration-300"
                    />
                    <span className="absolute top-4 left-4 z-20 text-[9px] uppercase tracking-[0.25em] font-mono bg-black/85 px-3 py-1.5 border border-white/10 selection:bg-none text-white/50">
                      BASE CHROMATIC LAYER0
                    </span>
                  </div>
                )
              )}
            </div>

            {/* Error notifications */}
            {error && (
              <div id="error-banner" className="mt-4 p-4 bg-rose-500/5 border border-rose-500/20 text-[11px] text-rose-300 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-mono uppercase tracking-wide">
                  <p className="font-bold text-rose-400">Fidelity Failure Alert</p>
                  <p className="opacity-80 mt-0.5 tracking-tight leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Natural language response metrics */}
            {currentItem.textFeedback && (
              <div id="text-feedback" className="mt-4 p-4 bg-[#0A0A0A] border border-white/5 text-[11px] leading-relaxed text-white/70 flex gap-3">
                <Info className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                <div className="font-sans">
                  <p className="font-semibold text-white uppercase tracking-[0.2em] text-[9px] font-mono mb-1 text-white/40">Engine Diagnostics</p>
                  <p className="italic text-white/80">{currentItem.textFeedback}</p>
                </div>
              </div>
            )}

            {/* Utility Download/Compare footer row */}
            <div id="bottom-actions" className="flex items-center justify-between text-[9px] text-white/40 font-mono uppercase tracking-widest mt-4 pt-1 select-none">
              <div className="flex items-center gap-1.5">
                <Info className="h-3 w-3 text-orange-400" />
                <span>{beforeItem ? "Slide pointer horizontally to inspect iterations" : "Describe modifications down below"}</span>
              </div>
              
              <a 
                id="download-btn"
                href={currentItem.imageUrl}
                download={`neural-edit-${Date.now()}.png`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-orange-500 hover:text-white transition-all duration-300 font-bold border border-white/10"
              >
                <Download className="h-3 w-3" />
                <span>Export Layer</span>
              </a>
            </div>
          </div>

          {/* Prompt vision input panel */}
          <div id="prompt-box-card" className="bg-[#111] border border-white/5 p-6 md:p-8 space-y-6 shadow-2xl">
            
            {/* Text description details */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-baseline gap-2">
              <div>
                <h2 className="font-serif italic text-3xl md:text-4xl text-orange-400">The Command</h2>
                <p className="text-[11px] text-white/40 leading-relaxed max-w-[400px] mt-1 font-sans">
                  Speak to the engine. Describe texture, light, and atmosphere. Our neural net interprets intent, not just pixels.
                </p>
              </div>
              <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest bg-black/40 px-2 py-0.5">Prompt_Layer_Input</span>
            </div>

            {/* Prompt input field and execution button */}
            <div className="relative flex flex-col gap-4">
              <textarea
                id="prompt-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your vision (e.g. 'late-afternoon sunset', 'frozen winter snow on mountains', 'neon cyber city')..."
                className="w-full bg-[#0A0A0A] border border-white/10 p-5 text-xs text-white placeholder:text-white/20 outline-none focus:border-orange-500/50 resize-none h-24 leading-relaxed font-sans"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleEditPhoto();
                  }
                }}
              />
              
              {/* Recommended trigger seeds/ideas */}
              <div className="space-y-2">
                <p className="text-[8px] text-white/35 font-mono uppercase tracking-[0.2em] flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-orange-400" />
                  Suggested Transformations
                </p>
                
                <div id="suggestions" className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto pr-1">
                  {(activeTemplate ? activeTemplate.suggestedPrompts : GENERAL_IDEAS).map((idea, index) => (
                    <button
                      key={index}
                      id={`suggest-btn-${index}`}
                      onClick={() => applyPresetPrompt(idea)}
                      className="text-[9px] uppercase tracking-wider font-mono px-2.5 py-1 bg-[#0A0A0A]/60 hover:bg-orange-500 hover:text-black border border-white/5 hover:border-orange-400 text-white/70 text-left truncate max-w-full transition-all duration-300"
                      title={idea}
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>

              {/* Big luxury solid text execute button */}
              <button
                id="submit-prompt-btn"
                onClick={handleEditPhoto}
                disabled={loading || !prompt.trim()}
                className={`w-full py-4 text-[11px] font-semibold tracking-[0.2em] uppercase transition-all duration-300 flex items-center justify-center gap-2 ${
                  loading || !prompt.trim()
                    ? "bg-white/5 text-white/25 border border-white/5 cursor-not-allowed"
                    : "bg-[#F5F5F5] text-black hover:bg-orange-500 hover:text-white cursor-pointer active:scale-[0.99] shadow-lg shadow-orange-500/5"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{loading ? "EXECUTING TRANSFORM..." : "EXECUTE GENERATION"}</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Luxury Editorial Footer Details */}
      <footer id="app-footer" className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between text-[9px] uppercase tracking-[0.2em] text-white/30 gap-4 select-none">
        <div className="flex flex-wrap gap-x-10 gap-y-2">
          <span>Seed: 48920194</span>
          <span>Engine Model: Obsidian_Alpha_2.5</span>
          <span>Latent Space: 512-dim</span>
          <span>Resolution: 6144 × 4096 px</span>
        </div>
        <div className="flex gap-6 italic text-[#F5F5F5] opacity-40 font-mono">
          <span>Refined by User_941</span>
          <span>Normalized 0.84s latent latency</span>
        </div>
      </footer>
    </div>
  );
}
