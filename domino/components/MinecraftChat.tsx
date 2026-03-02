"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface ChatMessage {
  playerName: string;
  message: string;
}

interface TimedMessage extends ChatMessage {
  id: number;
  timestamp: number;
}

interface MinecraftChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  /** How long (ms) a new message stays fully visible before fading. Default 6000 */
  fadeDelay?: number;
  /** Max messages shown in the log area. Default 8 */
  maxVisible?: number;
}

let _msgId = 0;

export default function MinecraftChat({
  messages,
  onSend,
  fadeDelay = 6000,
  maxVisible = 8,
}: MinecraftChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [timedMessages, setTimedMessages] = useState<TimedMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(messages.length);

  // Track new incoming messages and assign timestamps
  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      const newMsgs = messages.slice(prevLenRef.current);
      const timed: TimedMessage[] = newMsgs.map((m) => ({
        ...m,
        id: ++_msgId,
        timestamp: Date.now(),
      }));
      setTimedMessages((prev) => [...prev, ...timed].slice(-50));
    }
    prevLenRef.current = messages.length;
  }, [messages]);

  // Auto-scroll when new messages arrive or chat opens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timedMessages, isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Global key listener: press T or Enter to open chat (like Minecraft)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (!isOpen && (e.key === "t" || e.key === "T" || e.key === "Enter")) {
        e.preventDefault();
        setIsOpen(true);
      }
      if (isOpen && e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        setInputValue("");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onSend(trimmed);
    }
    setInputValue("");
    setIsOpen(false);
  }, [inputValue, onSend]);

  const visibleMessages = useMemo(() => {
    return timedMessages.slice(-maxVisible);
  }, [timedMessages, maxVisible]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, []);

  const currentTime = Date.now();

  return (
    <div
      className="absolute bottom-2 left-2 z-30 flex flex-col pointer-events-none sm:bottom-4 sm:left-4 lg:bottom-6 lg:left-6"
      style={{ maxWidth: "min(90vw, 500px)" }}
    >
      <div
        ref={scrollRef}
        className="flex flex-col gap-0.5 mb-1 overflow-hidden"
        style={{ maxHeight: isOpen ? "min(200px, 40vh)" : "min(140px, 30vh)" }}
      >
        {visibleMessages.map((msg) => {
          const age = currentTime - msg.timestamp;
          let opacity: number;
          if (isOpen) {
            opacity = 0.9;
          } else if (age < fadeDelay) {
            opacity = 0.9;
          } else if (age < fadeDelay + 2000) {
            opacity = 0.9 * (1 - (age - fadeDelay) / 2000);
          } else {
            opacity = 0;
          }

          if (opacity <= 0 && !isOpen) return null;

          return (
            <div
              key={msg.id}
              className="pointer-events-none"
              style={{
                opacity,
                transition: "opacity 0.4s ease",
                padding: "2px 8px",
                background: isOpen ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.4)",
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  color: "#5ef",
                  fontSize: "clamp(10px, 2vw, 12px)",
                  fontWeight: 700,
                  fontFamily: "'Geist', monospace",
                  textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                }}
              >
                &lt;{msg.playerName}&gt;{" "}
              </span>
              <span
                style={{
                  color: "#fff",
                  fontSize: "clamp(10px, 2vw, 12px)",
                  fontFamily: "'Geist', sans-serif",
                  textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                }}
              >
                {msg.message}
              </span>
            </div>
          );
        })}
      </div>

      {isOpen ? (
        <div
          className="flex gap-1 pointer-events-auto"
          style={{
            background: "rgba(0,0,0,0.55)",
            borderRadius: 6,
            padding: 3,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setIsOpen(false);
                setInputValue("");
              }
              e.stopPropagation();
            }}
            placeholder="Type a message..."
            maxLength={100}
            className="flex-1 bg-transparent text-white text-xs outline-none placeholder-white/40 px-2 py-1"
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: "clamp(11px, 2vw, 12px)",
              caretColor: "#5ef",
            }}
          />
          <button
            onClick={handleSend}
            className="text-white/70 hover:text-white text-xs px-2 py-1 rounded transition-colors"
            style={{ fontFamily: "'Geist', sans-serif", fontSize: 11 }}
          >
            ↵
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto self-start"
          style={{
            opacity: 0.3,
            transition: "opacity 0.3s ease",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: "clamp(8px, 2vw, 11px) clamp(20px, 4vw, 26px)",
            color: "#fff",
            fontSize: "clamp(14px, 3vw, 18px)",
            fontFamily: "'Geist', sans-serif",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.opacity = "0.7";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.opacity = "0.3";
          }}
          title="Press T to chat"
        >
          💬 Chat
        </button>
      )}
    </div>
  );
}
