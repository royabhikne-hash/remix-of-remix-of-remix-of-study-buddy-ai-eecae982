import { useState, useEffect } from "react";
import { Bot, User, X, ArrowLeft, Clock, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  image_url: string | null;
}

interface Session {
  id: string;
  topic: string;
  created_at: string;
  time_spent: number | null;
  understanding_level: string | null;
}

interface ChatHistoryProps {
  studentId: string;
  onClose: () => void;
}

const ChatHistory = ({ studentId, onClose }: ChatHistoryProps) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [studentId]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("id, topic, created_at, time_spent, understanding_level")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error("Error loading sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (session: Session) => {
    setSelectedSession(session);
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Error loading messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString(undefined, { 
      day: "numeric", 
      month: "short", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getUnderstandingColor = (level: string | null) => {
    switch (level) {
      case "excellent": return "text-accent bg-accent/10";
      case "good": return "text-primary bg-primary/10";
      case "average": return "text-warning bg-warning/10";
      case "weak": return "text-destructive bg-destructive/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          {selectedSession ? (
            <Button variant="ghost" size="icon" onClick={() => setSelectedSession(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h2 className="font-semibold">
              {selectedSession ? selectedSession.topic : "Chat History"}
            </h2>
            {selectedSession && (
              <p className="text-xs text-muted-foreground">
                {formatDate(selectedSession.created_at)}
              </p>
            )}
          </div>
        </div>
        {!selectedSession && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : selectedSession ? (
          // Chat Messages View
          loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : messages.length > 0 ? (
            <ScrollArea className="h-full">
              <div className="pb-6">
                {messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={message.id}
                      className={`py-6 px-4 ${isUser ? "bg-background" : "bg-muted/30"}`}
                    >
                      <div className="max-w-3xl mx-auto flex gap-4">
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                          isUser ? "bg-primary text-primary-foreground" : "bg-accent/20 text-accent"
                        }`}>
                          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {isUser ? "You" : "AI Study Buddy"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.created_at).toLocaleTimeString([], { 
                                hour: "2-digit", 
                                minute: "2-digit" 
                              })}
                            </span>
                          </div>
                          {message.image_url && (
                            <img
                              src={message.image_url}
                              alt="Uploaded"
                              className="max-w-[200px] rounded-lg mb-2"
                            />
                          )}
                          <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <BookOpen className="w-12 h-12 mb-4 opacity-50" />
              <p>No messages in this session</p>
            </div>
          )
        ) : (
          // Sessions List View
          sessions.length > 0 ? (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => loadMessages(session)}
                    className="w-full p-4 bg-card border border-border rounded-xl text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{session.topic}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(session.created_at)}
                          </p>
                        </div>
                      </div>
                      {session.understanding_level && (
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${getUnderstandingColor(session.understanding_level)}`}>
                          {session.understanding_level}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {session.time_spent || 0} min
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <BookOpen className="w-12 h-12 mb-4 opacity-50" />
              <p>No study sessions yet</p>
              <p className="text-sm">Start studying to see your history here</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
