import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, MessageSquare, Loader2, Send, Trash2, StopCircle, Pencil, Mic, X, Check, Plus } from "lucide-react";
import { getConsultationSummary, askConsultation, getConsultationMessages, deleteConsultationMessage, transcribeAudioBytes } from "@/lib/api";
import { useRecorder } from "@/hooks/useRecorder";

const AudioWaveform = ({ level }: { level: number }) => {
  const bars = 20;
  return (
    <div className="flex items-center gap-[3px] h-8">
      {Array.from({ length: bars }).map((_, i) => {
        // Bell curve envelope so center bars are taller
        const envelope = Math.sin((i / (bars - 1)) * Math.PI);
        // Pseudo-random noise per bar to make it look like frequencies
        const noise = 0.4 + 0.6 * Math.sin(i * 7);
        // Base height of 4px. Scale by level, envelope, and noise.
        const h = Math.max(4, 32 * level * envelope * noise * 2.5);
        return (
          <div
            key={i}
            className="w-[3px] bg-neutral-300 rounded-full transition-all duration-75"
            style={{ height: `${Math.min(32, h)}px` }}
          />
        );
      })}
    </div>
  );
};

interface Props {
  consultationId: string;
  patientName: string;
  onSelectSnippet: (id: string) => void;
  isProcessingSnippets: boolean;
  actionBar?: React.ReactNode;
}

// ── Typewriter Hook ──────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 8) {
  const [displayed, setDisplayed] = useState("");
  const prevTextRef = useRef("");

  useEffect(() => {
    // If it's a completely new text (not just an append), restart
    if (!text) {
      setDisplayed("");
      prevTextRef.current = "";
      return;
    }

    // If we've already shown this text, skip animation
    if (text === prevTextRef.current) return;

    // If new text starts with what we already showed, only animate the new part
    const alreadyShown = prevTextRef.current && text.startsWith(prevTextRef.current)
      ? prevTextRef.current.length
      : 0;

    let i = alreadyShown;
    setDisplayed(text.substring(0, i));

    const interval = setInterval(() => {
      i += 1;
      if (i >= text.length) {
        setDisplayed(text);
        prevTextRef.current = text;
        clearInterval(interval);
      } else {
        setDisplayed(text.substring(0, i));
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return displayed;
}

// ── Rich Markdown Renderer ───────────────────────────────────────────────────
const RichMarkdown: React.FC<{ text: string; onSelectSnippet: (id: string) => void }> = ({
  text,
  onSelectSnippet,
}) => {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        // ### Heading with emoji
        if (trimmed.startsWith("### ")) {
          const heading = trimmed.substring(4);
          return (
            <h3
              key={i}
              className="text-[13px] font-bold text-neutral-900 tracking-wide uppercase mt-5 mb-2 pb-1.5 border-b border-neutral-100 flex items-center gap-2"
            >
              {renderInline(heading, onSelectSnippet, i)}
            </h3>
          );
        }

        // "For **Name** ..." intro line
        if (trimmed.startsWith("For **")) {
          return (
            <p key={i} className="text-sm text-neutral-600 font-medium mb-1">
              {renderInline(trimmed, onSelectSnippet, i)}
            </p>
          );
        }

        // Bullet point
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const content = trimmed.substring(2);
          return (
            <div key={i} className="flex items-start gap-2.5 ml-1 py-0.5 group/bullet">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-[7px] flex-shrink-0 group-hover/bullet:bg-teal-600 transition-colors" />
              <span className="text-sm text-neutral-700 leading-relaxed">
                {renderInline(content, onSelectSnippet, i)}
              </span>
            </div>
          );
        }

        // Regular text line
        return (
          <p key={i} className="text-sm text-neutral-600 leading-relaxed">
            {renderInline(trimmed, onSelectSnippet, i)}
          </p>
        );
      })}
    </div>
  );
};

// ── Inline Renderer (bold, links, snippet links) ─────────────────────────────
function renderInline(
  text: string,
  onSelectSnippet: (id: string) => void,
  lineKey: number
): React.ReactNode[] {
  // Combined regex for **bold**, [text](url)
  const regex = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // **bold**
      parts.push(
        <strong key={`${lineKey}-b-${match.index}`} className="font-semibold text-neutral-900">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // [text](url)
      const linkText = match[4];
      const url = match[5];

      if (url.startsWith("snippet://")) {
        const snippetId = url.replace("snippet://", "");
        parts.push(
          <button
            key={`${lineKey}-s-${match.index}`}
            onClick={() => onSelectSnippet(snippetId)}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-600/80 hover:text-teal-700 hover:underline transition-colors ml-1 opacity-70 hover:opacity-100"
            title="View source"
          >
            <span className="text-[10px]">📎</span>
            <span className="max-w-[140px] truncate">{linkText}</span>
          </button>
        );
      } else {
        parts.push(
          <a
            key={`${lineKey}-a-${match.index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-teal-600 hover:underline"
          >
            {linkText}
          </a>
        );
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ConsultationScribe({
  consultationId,
  patientName,
  onSelectSnippet,
  isProcessingSnippets,
  actionBar,
}: Props) {
  const [view, setView] = useState<"summary" | "chat">("summary");
  const [input, setInput] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const cancelTranscribeRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const recorder = useRecorder();

  // Poll for summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["consultationSummary", consultationId],
    queryFn: () => getConsultationSummary(consultationId),
    refetchInterval: 3000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["consultationMessages", consultationId],
    queryFn: () => getConsultationMessages(consultationId),
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const askMutation = useMutation({
    mutationFn: (question: string) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      return askConsultation(consultationId, question, controller.signal);
    },
    onMutate: async (question) => {
      await qc.cancelQueries({ queryKey: ["consultationMessages", consultationId] });
      const previousMessages = qc.getQueryData(["consultationMessages", consultationId]);
      
      const optimisticMsg = {
        id: "temp-" + Date.now(),
        consultation_id: consultationId,
        role: "user",
        content: question,
        created_at: new Date().toISOString()
      };
      
      qc.setQueryData(["consultationMessages", consultationId], (old: any) => {
        return [...(old || []), optimisticMsg];
      });
      
      return { previousMessages };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultationMessages", consultationId] });
      abortControllerRef.current = null;
    },
    onError: (err: any, _question, context: any) => {
      if (context?.previousMessages) {
        qc.setQueryData(["consultationMessages", consultationId], context.previousMessages);
      }
      if (err.name !== "CanceledError" && err.name !== "AbortError") {
        console.error("Ask mutation failed", err);
      }
      abortControllerRef.current = null;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => deleteConsultationMessage(consultationId, messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultationMessages", consultationId] });
    },
  });

  useEffect(() => {
    if (view === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, view, askMutation.isPending]);

  const handleAsk = (question: string) => {
    if (!question.trim()) return;
    if (view === "summary") setView("chat");
    setInput("");
    askMutation.mutate(question);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleEdit = (msgId: string, content: string) => {
    setInput(content);
    deleteMutation.mutate(msgId);
    if (view === "summary") setView("chat");
  };

  const toggleRecording = () => {
    if (recorder.state === "recording") {
      cancelTranscribeRef.current = false;
      recorder.stop();
    } else {
      cancelTranscribeRef.current = false;
      recorder.start();
    }
  };

  const cancelRecording = () => {
    if (recorder.state === "recording") {
      cancelTranscribeRef.current = true;
      recorder.stop(); // will trigger useEffect but we will check the ref
    }
  };

  useEffect(() => {
    if (recorder.state === "stopping" && recorder.audioBlob) {
      if (cancelTranscribeRef.current) {
        cancelTranscribeRef.current = false;
        recorder.reset();
        return;
      }
      setIsTranscribing(true);
      console.log("Sending audio for transcription, blob size:", recorder.audioBlob.size);
      transcribeAudioBytes(recorder.audioBlob)
        .then((res) => {
          console.log("Transcription result:", res);
          if (res.transcript) {
            setInput((prev) => (prev ? prev + " " + res.transcript : res.transcript));
          } else {
            console.warn("Transcript was empty");
          }
        })
        .catch((err) => {
          console.error("Failed to transcribe chat audio", err);
        })
        .finally(() => {
          setIsTranscribing(false);
          recorder.reset();
        });
    }
  }, [recorder.state, recorder.audioBlob]);

  const hasData = summaryData && summaryData.snippet_count > 0;
  const isGeneratingSummary = hasData && !summaryData?.summary_text;

  // Typewriter animation for summary
  const animatedSummary = useTypewriter(summaryData?.summary_text || "", 6);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
      {/* Header */}
      <div className="h-14 border-b border-neutral-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur-sm flex-shrink-0 z-10">
        <div className="flex items-center gap-2">
          {isProcessingSnippets || isGeneratingSummary ? (
            <Loader2 size={16} className="text-teal-500 animate-spin" />
          ) : (
            <div
              className={`w-2 h-2 rounded-full ${hasData ? "bg-emerald-500" : "bg-neutral-300"
                }`}
            />
          )}
          <h3 className="text-sm font-semibold text-neutral-800">
            {view === "summary"
              ? "So far in this consultation"
              : `Ask about ${patientName}`}
          </h3>
        </div>

        {/* Toggle */}
        <div className="flex bg-neutral-100 p-1 rounded-lg">
          <button
            onClick={() => setView("summary")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${view === "summary"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
              }`}
          >
            Summary
          </button>
          <button
            onClick={() => setView("chat")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${view === "chat"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
              }`}
          >
            Chat
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {view === "summary" ? (
          <div className="p-6 max-w-3xl mx-auto min-h-full flex flex-col">
            {summaryLoading || isGeneratingSummary ? (
              <div className="flex flex-col items-center justify-center flex-1 text-neutral-400 space-y-4">
                <Loader2 size={32} className="animate-spin text-teal-500/50" />
                <p className="text-sm">Loading Content...</p>
              </div>
            ) : !hasData ? (
              <div className="flex flex-col items-center justify-center flex-1 text-neutral-400 space-y-4">
                <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center border border-neutral-100">
                  <Sparkles size={24} className="text-neutral-300" />
                </div>
                <p className="text-center max-w-sm text-sm">
                  Upload documents or record audio to generate a live clinical
                  summary.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Card */}
                <div className="bg-gradient-to-br from-teal-50/40 via-white to-emerald-50/30 border border-teal-100/40 rounded-2xl p-6 shadow-sm">
                  <RichMarkdown
                    text={animatedSummary}
                    onSelectSnippet={onSelectSnippet}
                  />
                  {/* Blinking cursor while typing */}
                  {animatedSummary !== (summaryData?.summary_text || "") && (
                    <span className="inline-block w-0.5 h-4 bg-teal-500 animate-pulse ml-0.5 -mb-0.5" />
                  )}
                </div>

                {/* Suggested questions moved to the bottom bar */}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 max-w-3xl mx-auto flex flex-col min-h-full justify-end">
            {messages.length === 0 && !askMutation.isPending ? (
              <div className="flex flex-col items-center justify-center flex-1 text-neutral-400 space-y-4 h-full pb-20">
                <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center">
                  <MessageSquare size={24} className="text-teal-500" />
                </div>
                <p className="text-center max-w-sm text-sm">
                  Ask specific questions about {patientName}'s current
                  consultation. Answers are strictly based on available snippets.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col group ${msg.role === "user" ? "items-end" : "items-start"
                      }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm text-sm ${msg.role === "user"
                          ? "bg-neutral-900 text-white rounded-br-none"
                          : "bg-white border border-neutral-100 text-neutral-800 rounded-bl-none"
                        }`}
                    >
                      {msg.role === "user" ? (
                        msg.content
                      ) : (
                        <RichMarkdown
                          text={msg.content}
                          onSelectSnippet={onSelectSnippet}
                        />
                      )}
                    </div>

                    {/* Action Row */}
                    <div className={`flex items-center gap-1 mt-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      {msg.role === "user" && (
                        <button
                          onClick={() => handleEdit(msg.id, msg.content)}
                          className="p-1.5 text-neutral-400 hover:text-teal-600 rounded-md hover:bg-teal-50 transition-colors"
                          title="Edit message"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(msg.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-neutral-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete message"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {askMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-none px-5 py-3.5 shadow-sm flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-neutral-100 flex flex-col items-center flex-shrink-0 z-10 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] relative">
        {/* Suggested Questions Row */}
        {summaryData?.suggested_questions && summaryData.suggested_questions.length > 0 && (
          <div className="w-full max-w-3xl mx-auto mb-3 flex overflow-x-auto flex-nowrap gap-2 pb-2 px-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {summaryData.suggested_questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleAsk(q)}
                className="text-[12px] font-medium bg-white/90 backdrop-blur-sm border border-neutral-200 text-neutral-600 px-4 py-2 rounded-full hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 transition-all shadow-sm active:scale-95 text-left"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="w-full max-w-3xl mx-auto relative mb-3">
          {recorder.state === "recording" ? (
            <div className="w-full h-[54px] bg-[#2A2A2B] rounded-[24px] flex items-center justify-between px-2 shadow-lg relative overflow-hidden">
              {/* Plus Icon (Left) */}
              <div className="flex items-center justify-center w-10 h-10 text-neutral-400">
                <Plus size={20} />
              </div>

              {/* Waveform (Center-Right alignment) */}
              <div className="flex-1 flex items-center justify-end px-2 overflow-hidden opacity-90 pointer-events-none gap-2">
                 <div className="flex-1 border-b-[3px] border-dotted border-neutral-600 opacity-40 h-0" />
                 <AudioWaveform level={recorder.levelNormalized} />
              </div>
              
              {/* Actions (Right) */}
              <div className="flex items-center justify-end gap-1 relative z-10 pr-2">
                <button
                  onClick={cancelRecording}
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                  title="Cancel"
                >
                  <X size={20} />
                </button>
                <button
                  onClick={() => recorder.stop()}
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                  title="Done"
                >
                  <Check size={20} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk(input);
                  }
                }}
                placeholder={
                  hasData
                    ? `Ask anything about ${patientName}...`
                    : "Upload snippets to ask questions..."
                }
                disabled={!hasData || askMutation.isPending}
                className="w-full bg-white border border-neutral-200 rounded-2xl py-4 pl-5 pr-[88px] text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50 transition-all disabled:bg-neutral-50 shadow-sm"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {/* Mic Button */}
                {hasData && !askMutation.isPending && (
                  <button
                    onClick={toggleRecording}
                    disabled={isTranscribing}
                    className="p-2.5 rounded-xl transition-all bg-transparent text-neutral-400 hover:text-teal-600 hover:bg-teal-50"
                    title="Record audio"
                  >
                    {isTranscribing ? (
                      <Loader2 size={18} className="animate-spin text-teal-500" />
                    ) : (
                      <Mic size={18} />
                    )}
                  </button>
                )}

                {/* Send/Stop Button */}
                {askMutation.isPending ? (
                  <button
                    onClick={handleStop}
                    className="p-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors shadow-sm"
                    title="Stop generating"
                  >
                    <StopCircle size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleAsk(input)}
                    disabled={!hasData || !input.trim()}
                    className="p-2.5 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:bg-neutral-200 shadow-sm"
                    title="Send"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {actionBar && (
          <div className="z-30 pointer-events-auto shadow-sm rounded-2xl">
            {actionBar}
          </div>
        )}
      </div>
    </div>
  );
}
