import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Clock,
  TrendingUp,
  Calendar,
  LogOut,
  Play,
  CheckCircle,
  XCircle,
  User,
  BarChart3,
  MessageCircle,
  Loader2,
  History,
} from "lucide-react";
import StudyChat from "@/components/StudyChat";
import ChatHistory from "@/components/ChatHistory";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUrl?: string;
}

interface RealTimeAnalysis {
  weakAreas: string[];
  strongAreas: string[];
  currentUnderstanding: "weak" | "average" | "good" | "excellent";
  topicsCovered: string[];
}

interface RecentSession {
  id: string;
  topic: string;
  date: string;
  duration: number;
  score: number;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut, loading } = useAuth();
  const [isStudying, setIsStudying] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [userName, setUserName] = useState("Student");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [parentWhatsapp, setParentWhatsapp] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>("");
  
  const [stats, setStats] = useState({
    todayStudied: false,
    totalSessions: 0,
    totalMinutes: 0,
    improvementScore: 50,
  });

  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }

    if (user) {
      loadStudentData();
    }
  }, [user, loading, navigate]);

  // Real-time subscription for approval status changes
  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel('student-approval')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'students',
          filter: `id=eq.${studentId}`,
        },
        (payload) => {
          console.log('Student data updated:', payload);
          if (payload.new && 'is_approved' in payload.new) {
            setIsApproved(payload.new.is_approved as boolean);
            if (payload.new.is_approved) {
              loadStudentData(); // Reload full data when approved
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  const loadStudentData = async () => {
    if (!user) return;

    try {
      // Get student profile with school info
      const { data: student } = await supabase
        .from("students")
        .select("*, schools(name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (student) {
        setUserName(student.full_name);
        setStudentId(student.id);
        setParentWhatsapp(student.parent_whatsapp);
        setIsApproved(student.is_approved);
        setRejectionReason(student.rejection_reason || null);
        setSchoolName((student.schools as any)?.name || "Your School");
        
        // Only load sessions if approved
        if (student.is_approved) {
          // Fetch sessions with quiz attempts to get actual scores
          const { data: sessions } = await supabase
            .from("study_sessions")
            .select("*, quiz_attempts(accuracy_percentage)")
            .eq("student_id", student.id)
            .order("created_at", { ascending: false });

          if (sessions) {
            const totalTime = sessions.reduce((acc, s) => acc + (s.time_spent || 0), 0);
            
            // Calculate average score using quiz accuracy when available
            const scoresWithQuiz = sessions.map(s => {
              const quizAttempts = s.quiz_attempts as { accuracy_percentage: number | null }[] | null;
              if (quizAttempts && quizAttempts.length > 0 && quizAttempts[0].accuracy_percentage !== null) {
                return quizAttempts[0].accuracy_percentage;
              }
              return s.improvement_score || 50;
            });
            const avgScore = scoresWithQuiz.length > 0 
              ? Math.round(scoresWithQuiz.reduce((acc, s) => acc + s, 0) / scoresWithQuiz.length)
              : 50;

            const today = new Date().toDateString();
            const studiedToday = sessions.some(s => new Date(s.created_at).toDateString() === today);

            setStats({
              todayStudied: studiedToday,
              totalSessions: sessions.length,
              totalMinutes: totalTime,
              improvementScore: avgScore,
            });

            // Use quiz accuracy for score when available
            const recent = sessions.slice(0, 5).map((s) => {
              const quizAttempts = s.quiz_attempts as { accuracy_percentage: number | null }[] | null;
              const score = (quizAttempts && quizAttempts.length > 0 && quizAttempts[0].accuracy_percentage !== null)
                ? quizAttempts[0].accuracy_percentage
                : s.improvement_score || 50;
              
              return {
                id: s.id,
                topic: s.topic || "General Study",
                date: formatDate(new Date(s.created_at)),
                duration: s.time_spent || 0,
                score: Math.round(score),
              };
            });
            setRecentSessions(recent);
          }
        }
      } else {
        setUserName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Student");
        setIsApproved(null);
      }
    } catch (error) {
      console.error("Error loading student data:", error);
    }
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  };

  const handleStartStudy = () => {
    setIsStudying(true);
    toast({
      title: "Study Session Started! 📚",
      description: "Your AI buddy is ready to help.",
    });
  };

  const handleEndStudy = async (summary: { 
    topic: string; 
    timeSpent: number; 
    messages: ChatMessage[];
    analysis: RealTimeAnalysis;
    quizResult?: {
      correctCount: number;
      totalQuestions: number;
      accuracy: number;
      understanding: "strong" | "partial" | "weak";
      questions: any[];
      answers: string[];
    };
  }) => {
    setIsStudying(false);
    
    // Save session to database if we have a student ID
    if (studentId) {
      try {
        // Map understanding level based on quiz result or analysis
        let understandingLevel: "weak" | "average" | "good" | "excellent";
        let improvementScore: number;

        if (summary.quizResult) {
          // Use actual quiz accuracy as the improvement score
          improvementScore = summary.quizResult.accuracy;
          
          // Map quiz understanding to database enum
          if (summary.quizResult.understanding === "strong") {
            understandingLevel = "excellent";
          } else if (summary.quizResult.understanding === "partial") {
            understandingLevel = "average";
          } else {
            understandingLevel = "weak";
          }
        } else {
          // Fallback to analysis-based score if no quiz
          const scoreMap = { weak: 40, average: 60, good: 75, excellent: 90 };
          improvementScore = scoreMap[summary.analysis.currentUnderstanding] || 50;
          understandingLevel = summary.analysis.currentUnderstanding;
        }

        const { data: sessionData, error } = await supabase.from("study_sessions").insert({
          student_id: studentId,
          topic: summary.topic || summary.analysis.topicsCovered[0] || "General Study",
          time_spent: summary.timeSpent,
          understanding_level: understandingLevel,
          improvement_score: improvementScore,
          weak_areas: summary.analysis.weakAreas,
          strong_areas: summary.analysis.strongAreas,
          ai_summary: summary.quizResult 
            ? `Studied ${summary.topic} for ${summary.timeSpent} minutes. Quiz: ${summary.quizResult.correctCount}/${summary.quizResult.totalQuestions} correct (${summary.quizResult.accuracy}%). Result: ${summary.quizResult.understanding}.`
            : `Studied ${summary.topic} for ${summary.timeSpent} minutes. Understanding: ${summary.analysis.currentUnderstanding}. Topics covered: ${summary.analysis.topicsCovered.join(", ") || "General concepts"}.`,
        }).select().single();

        if (error) {
          console.error("Error saving session:", error);
        } else {
          // Save quiz attempt if quiz was taken
          if (summary.quizResult && sessionData) {
            const { error: quizError } = await supabase.from("quiz_attempts").insert({
              student_id: studentId,
              session_id: sessionData.id,
              questions: summary.quizResult.questions,
              answers: summary.quizResult.answers,
              correct_count: summary.quizResult.correctCount,
              total_questions: summary.quizResult.totalQuestions,
              accuracy_percentage: summary.quizResult.accuracy,
              understanding_result: summary.quizResult.understanding,
            });
            
            if (quizError) {
              console.error("Error saving quiz attempt:", quizError);
            }
          }
          
          // Refresh data
          loadStudentData();
        }
      } catch (err) {
        console.error("Error saving session:", err);
      }
    }

    toast({
      title: "Study Session Complete! 🎉",
      description: summary.quizResult 
        ? `Quiz: ${summary.quizResult.correctCount}/${summary.quizResult.totalQuestions} correct (${summary.quizResult.accuracy}%)`
        : `You studied ${summary.topic} for ${summary.timeSpent} minutes.`,
    });
  };

  const handleSendReport = async () => {
    if (!studentId || !parentWhatsapp) {
      toast({
        title: "Cannot send report",
        description: "Student profile or parent WhatsApp not found.",
        variant: "destructive"
      });
      return;
    }

    setSendingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-weekly-report', {
        body: { studentId, testMode: true }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Report Sent! 📱",
          description: `WhatsApp report sent to parent successfully.`,
        });
      } else {
        throw new Error(data?.error || "Failed to send report");
      }
    } catch (err) {
      console.error("Error sending report:", err);
      toast({
        title: "Failed to send report",
        description: err instanceof Error ? err.message : "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setSendingReport(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4 animate-pulse">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show pending approval or rejection screen
  if (isApproved === false) {
    const isRejected = rejectionReason !== null;
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="edu-card p-8 max-w-md text-center">
          <div className={`w-20 h-20 rounded-full ${isRejected ? 'bg-destructive/20' : 'bg-warning/20'} flex items-center justify-center mx-auto mb-6`}>
            {isRejected ? (
              <XCircle className="w-10 h-10 text-destructive" />
            ) : (
              <Clock className="w-10 h-10 text-warning" />
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {isRejected ? "Registration Rejected" : "Approval Pending"}
          </h1>
          <p className="text-muted-foreground mb-4">
            Namaste {userName}! 👋
          </p>
          
          {isRejected ? (
            <>
              <p className="text-muted-foreground mb-4">
                Aapki registration <strong>{schoolName}</strong> ne reject kar di hai.
              </p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6">
                <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
                <p className="text-sm text-foreground">{rejectionReason}</p>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Agar aapko lagta hai ye galti se hua hai, toh school se contact karo.
              </p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-6">
                Aapka account abhi <strong>{schoolName}</strong> se approve hona baaki hai. 
                Jab school aapko approve kar dega, tab aap study kar paoge.
              </p>
              <div className="bg-secondary/50 rounded-xl p-4 mb-6">
                <p className="text-sm text-muted-foreground">
                  🔔 School ko inform kar diya gaya hai. Thoda wait karo!
                </p>
              </div>
            </>
          )}
          
          <Button variant="outline" onClick={handleLogout} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    );
  }

  if (showChatHistory && studentId) {
    return <ChatHistory studentId={studentId} onClose={() => setShowChatHistory(false)} />;
  }

  if (isStudying) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="container mx-auto max-w-4xl">
          <StudyChat onEndStudy={handleEndStudy} studentId={studentId || undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <span className="font-bold text-lg">EduImprove AI</span>
                <p className="text-xs text-muted-foreground">Student Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <span className="font-medium hidden sm:block">{userName}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome & Start Study */}
        <div className="mb-8">
          <div className="edu-card p-6 md:p-8 text-center bg-gradient-to-br from-primary/10 to-accent/10">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Namaste, {userName}! 👋
            </h1>
            <p className="text-muted-foreground mb-6">
              {stats.todayStudied
                ? "Great job studying today! Ready for more?"
                : "Aaj kya padhna hai? Chal start karte hain!"}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="hero" size="xl" onClick={handleStartStudy}>
                <Play className="w-5 h-5" />
                Start Studying
              </Button>
              <Button variant="outline" size="lg" onClick={() => setShowChatHistory(true)}>
                <History className="w-4 h-4 mr-2" />
                Chat History
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate("/progress")}>
                <BarChart3 className="w-4 h-4 mr-2" />
                View Progress
              </Button>
              <Button 
                variant="secondary" 
                size="lg" 
                onClick={handleSendReport} 
                disabled={sendingReport}
              >
                {sendingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
                Send Report
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Today"
            value={stats.todayStudied ? "Studied ✓" : "Not Yet"}
            color={stats.todayStudied ? "accent" : "muted"}
          />
          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            label="Total Sessions"
            value={stats.totalSessions.toString()}
            color="primary"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Total Time"
            value={`${Math.round(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`}
            color="primary"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Improvement"
            value={`${stats.improvementScore}%`}
            color="accent"
          />
        </div>

        {/* Recent Sessions */}
        <div className="edu-card p-6">
          <h2 className="text-lg font-bold mb-4">Recent Study Sessions</h2>
          {recentSessions.length > 0 ? (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{session.topic}</p>
                      <p className="text-sm text-muted-foreground">{session.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{session.duration} min</p>
                    <p className="text-sm text-accent font-medium">Score: {session.score}%</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No study sessions yet. Start your first session!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "primary" | "accent" | "muted";
}) => {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <div className="edu-card p-4">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
};

export default StudentDashboard;
