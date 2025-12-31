import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  LogOut,
  Search,
  BookOpen,
  CheckCircle,
  XCircle,
  Eye,
  UserCheck,
  UserX,
  Clock,
  Loader2,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import StudentReportModal from "@/components/StudentReportModal";
import { useToast } from "@/hooks/use-toast";

interface StudentData {
  id: string;
  photo: string;
  name: string;
  class: string;
  todayStudied: boolean;
  topicStudied: string;
  improvementTrend: "up" | "down" | "stable";
  totalSessions: number;
  isApproved: boolean;
  createdAt: string;
}

const SchoolDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [schoolName, setSchoolName] = useState("School");
  const [schoolUuid, setSchoolUuid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("approved");
  
  // Fee payment check
  const [feePaid, setFeePaid] = useState(true);
  
  // Rejection dialog state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingStudent, setRejectingStudent] = useState<StudentData | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    student: StudentData | null;
  }>({ open: false, student: null });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const storedSchoolName = localStorage.getItem("schoolName");
    const storedSchoolId = localStorage.getItem("schoolId");
    
    if (!storedSchoolId) {
      navigate("/school-login");
      return;
    }
    
    if (storedSchoolName) {
      setSchoolName(storedSchoolName);
    }

    checkSchoolAccess();
  }, [navigate]);

  const checkSchoolAccess = async () => {
    try {
      const storedSchoolId = localStorage.getItem("schoolId");
      
      if (!storedSchoolId) {
        setLoading(false);
        return;
      }

      // Check if school is banned or fee not paid
      const { data: school } = await supabase
        .from("schools")
        .select("id, is_banned, fee_paid")
        .eq("school_id", storedSchoolId)
        .maybeSingle();

      if (!school) {
        setLoading(false);
        return;
      }

      if (school.is_banned) {
        toast({
          title: "Access Denied",
          description: "Your school has been banned. Please contact admin.",
          variant: "destructive",
        });
        localStorage.clear();
        navigate("/school-login");
        return;
      }

      if (!school.fee_paid) {
        setFeePaid(false);
        setLoading(false);
        return;
      }

      setSchoolUuid(school.id);
      loadStudents(school.id);
    } catch (error) {
      console.error("Error checking school access:", error);
      setLoading(false);
    }
  };

  const loadStudents = async (schoolId?: string) => {
    try {
      const id = schoolId || schoolUuid;
      
      if (!id) {
        setLoading(false);
        return;
      }

      // Get students ONLY for this specific school
      const { data: studentsData } = await supabase
        .from("students")
        .select("*")
        .eq("school_id", id)
        .eq("is_banned", false)
        .order("created_at", { ascending: false });

      if (studentsData) {
        const today = new Date().toDateString();
        
        // Get sessions for approved students only
        const approvedStudentIds = studentsData.filter(s => s.is_approved).map(s => s.id);
        const { data: sessions } = approvedStudentIds.length > 0 
          ? await supabase
              .from("study_sessions")
              .select("*")
              .in("student_id", approvedStudentIds)
          : { data: [] };

        const formattedStudents: StudentData[] = studentsData.map((student) => {
          const studentSessions = sessions?.filter(s => s.student_id === student.id) || [];
          const todaySessions = studentSessions.filter(s => 
            new Date(s.created_at).toDateString() === today
          );
          const latestSession = todaySessions[0];

          // Calculate trend based on recent scores
          const recentScores = studentSessions.slice(0, 5).map(s => s.improvement_score || 50);
          let trend: "up" | "down" | "stable" = "stable";
          if (recentScores.length >= 2) {
            const avg1 = recentScores.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
            const avg2 = recentScores.slice(-2).reduce((a, b) => a + b, 0) / 2;
            if (avg1 > avg2 + 5) trend = "up";
            else if (avg1 < avg2 - 5) trend = "down";
          }

          return {
            id: student.id,
            photo: student.photo_url || "",
            name: student.full_name,
            class: student.class,
            todayStudied: todaySessions.length > 0,
            topicStudied: latestSession?.topic || "-",
            improvementTrend: trend,
            totalSessions: studentSessions.length,
            isApproved: student.is_approved,
            createdAt: student.created_at,
          };
        });

        setStudents(formattedStudents);
      }
    } catch (error) {
      console.error("Error loading students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveStudent = async (studentId: string) => {
    setApprovingId(studentId);

    try {
      const schoolId = localStorage.getItem("schoolId");
      const schoolPassword = sessionStorage.getItem("schoolPassword");

      if (!schoolId || !schoolPassword) {
        toast({
          title: "Session expired",
          description: "Please login again to approve students.",
          variant: "destructive",
        });
        localStorage.clear();
        sessionStorage.clear();
        navigate("/school-login");
        return;
      }

      const { data, error } = await supabase.functions.invoke("school-student-approval", {
        body: {
          action: "approve",
          schoolId,
          schoolPassword,
          studentId,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Approval failed");
      }

      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, isApproved: true } : s))
      );

      toast({
        title: "Student Approved ✓",
        description: "Student can now use the study platform.",
      });
    } catch (error) {
      console.error("Error approving student:", error);
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Could not approve student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const openRejectDialog = (student: StudentData) => {
    setRejectingStudent(student);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const handleRejectStudent = async () => {
    if (!rejectingStudent) return;

    setApprovingId(rejectingStudent.id);
    try {
      const schoolId = localStorage.getItem("schoolId");
      const schoolPassword = sessionStorage.getItem("schoolPassword");

      if (!schoolId || !schoolPassword) {
        toast({
          title: "Session expired",
          description: "Please login again to reject students.",
          variant: "destructive",
        });
        localStorage.clear();
        sessionStorage.clear();
        navigate("/school-login");
        return;
      }

      const { data, error } = await supabase.functions.invoke("school-student-approval", {
        body: {
          action: "reject",
          schoolId,
          schoolPassword,
          studentId: rejectingStudent.id,
          rejectionReason: rejectionReason.trim() || "No reason provided",
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Rejection failed");
      }

      // Remove from local state
      setStudents((prev) => prev.filter((s) => s.id !== rejectingStudent.id));

      toast({
        title: "Student Rejected",
        description: "Student request has been rejected with reason.",
      });

      setShowRejectDialog(false);
      setRejectingStudent(null);
      setRejectionReason("");
    } catch (error) {
      console.error("Error rejecting student:", error);
      toast({
        title: "Rejection Failed",
        description: error instanceof Error ? error.message : "Could not reject student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const handleDeleteStudent = async (studentId: string) => {
    setDeletingId(studentId);
    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentId);

      if (error) throw error;

      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      toast({
        title: "Student Removed",
        description: "Student has been removed from your school.",
      });
    } catch (error) {
      console.error("Error deleting student:", error);
      toast({
        title: "Error",
        description: "Failed to remove student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setDeleteDialog({ open: false, student: null });
    }
  };

  const handleViewReport = (student: StudentData) => {
    setSelectedStudent(student);
    setShowReportModal(true);
  };

  const pendingStudents = students.filter(s => !s.isApproved);
  const approvedStudents = students.filter(s => s.isApproved);

  const filteredStudents = approvedStudents.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === "all" || student.class === selectedClass;
    return matchesSearch && matchesClass;
  });

  const uniqueClasses = [...new Set(approvedStudents.map((s) => s.class))];

  const stats = {
    totalStudents: approvedStudents.length,
    pendingApprovals: pendingStudents.length,
    studiedToday: approvedStudents.filter((s) => s.todayStudied).length,
    improving: approvedStudents.filter((s) => s.improvementTrend === "up").length,
  };

  const getTrendLabel = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <span className="text-accent font-medium">Improving ↑</span>;
      case "down":
        return <span className="text-destructive font-medium">Declining ↓</span>;
      default:
        return <span className="text-muted-foreground font-medium">Stable →</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Building2 className="w-6 h-6 text-accent-foreground" />
          </div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Fee not paid screen
  if (!feePaid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="edu-card p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Access Suspended</h1>
          <p className="text-muted-foreground mb-6">
            Your school's dashboard access has been suspended due to unpaid fees. 
            Please contact the admin to resolve this issue.
          </p>
          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
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
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                <Building2 className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <span className="font-bold text-lg">{schoolName}</span>
                <p className="text-xs text-muted-foreground">School Dashboard</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="edu-card p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{stats.totalStudents}</p>
            <p className="text-sm text-muted-foreground">Approved Students</p>
          </div>
          <div className="edu-card p-4 text-center relative">
            <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center mx-auto mb-2">
              <Clock className="w-6 h-6 text-warning" />
            </div>
            <p className="text-2xl font-bold">{stats.pendingApprovals}</p>
            <p className="text-sm text-muted-foreground">Pending Approvals</p>
            {stats.pendingApprovals > 0 && (
              <span className="absolute top-2 right-2 w-3 h-3 bg-warning rounded-full animate-pulse" />
            )}
          </div>
          <div className="edu-card p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
              <BookOpen className="w-6 h-6 text-accent" />
            </div>
            <p className="text-2xl font-bold">{stats.studiedToday}</p>
            <p className="text-sm text-muted-foreground">Studied Today</p>
          </div>
          <div className="edu-card p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{stats.improving}</p>
            <p className="text-sm text-muted-foreground">Improving</p>
          </div>
        </div>

        {/* Tabs for Pending vs Approved */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Approved ({approvedStudents.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-2 relative">
              <Clock className="w-4 h-4" />
              Pending ({pendingStudents.length})
              {pendingStudents.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-warning rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Pending Approvals Tab */}
          <TabsContent value="pending" className="mt-6">
            <div className="edu-card overflow-hidden">
              <div className="p-4 border-b border-border bg-warning/10">
                <h2 className="font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-warning" />
                  Pending Student Approvals
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Review and approve students to allow them access to the study platform.
                </p>
              </div>
              
              {pendingStudents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No pending approvals!</p>
                  <p className="text-sm">All students have been reviewed.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pendingStudents.map((student) => (
                    <div key={student.id} className="p-4 hover:bg-muted/30">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {student.photo ? (
                            <img 
                              src={student.photo} 
                              alt={student.name}
                              className="w-14 h-14 rounded-full object-cover border-2 border-warning/30"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-xl font-bold border-2 border-warning/30">
                              {student.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-lg">{student.name}</p>
                            <p className="text-sm text-muted-foreground">Class: {student.class}</p>
                            <p className="text-xs text-muted-foreground">
                              Registered: {formatDate(student.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRejectDialog(student)}
                            disabled={approvingId === student.id}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            {approvingId === student.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <UserX className="w-4 h-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApproveStudent(student.id)}
                            disabled={approvingId === student.id}
                            className="bg-accent hover:bg-accent/90"
                          >
                            {approvingId === student.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Approved Students Tab */}
          <TabsContent value="approved" className="mt-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                className="flex h-12 rounded-xl border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="all">All Classes</option>
                {uniqueClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Student List */}
            <div className="edu-card overflow-hidden">
              <div className="p-4 border-b border-border bg-secondary/30">
                <h2 className="font-bold">Student Activity</h2>
              </div>
              
              {approvedStudents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No approved students yet.</p>
                  <p className="text-sm">Approve pending students to see them here.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-4 font-semibold">Student</th>
                          <th className="text-left p-4 font-semibold">Class</th>
                          <th className="text-left p-4 font-semibold">Today</th>
                          <th className="text-left p-4 font-semibold">Topic Studied</th>
                          <th className="text-left p-4 font-semibold">Trend</th>
                          <th className="text-left p-4 font-semibold">Sessions</th>
                          <th className="text-left p-4 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr key={student.id} className="border-t border-border hover:bg-muted/30">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {student.photo ? (
                                  <img 
                                    src={student.photo} 
                                    alt={student.name}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-lg font-bold">
                                    {student.name.charAt(0)}
                                  </div>
                                )}
                                <span className="font-medium">{student.name}</span>
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground">{student.class}</td>
                            <td className="p-4">
                              {student.todayStudied ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-sm">
                                  <CheckCircle className="w-4 h-4" /> Yes
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-sm">
                                  <XCircle className="w-4 h-4" /> No
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-muted-foreground">{student.topicStudied}</td>
                            <td className="p-4">{getTrendLabel(student.improvementTrend)}</td>
                            <td className="p-4 font-medium">{student.totalSessions}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewReport(student)}
                                  className="text-primary hover:text-primary/80"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteDialog({ open: true, student })}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={deletingId === student.id}
                                >
                                  {deletingId === student.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-border">
                    {filteredStudents.map((student) => (
                      <div key={student.id} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {student.photo ? (
                              <img 
                                src={student.photo} 
                                alt={student.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-bold">
                                {student.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold">{student.name}</p>
                              <p className="text-sm text-muted-foreground">{student.class}</p>
                            </div>
                          </div>
                          {student.todayStudied ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-xs">
                              <CheckCircle className="w-3 h-3" /> Studied
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                              <XCircle className="w-3 h-3" /> Not Yet
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-muted-foreground">Topic: </span>
                            {student.topicStudied}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Trend: </span>
                            {getTrendLabel(student.improvementTrend)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewReport(student)}
                            className="flex-1"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Report
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteDialog({ open: true, student })}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingId === student.id}
                          >
                            {deletingId === student.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Rejection Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Student Registration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              You are about to reject <strong>{rejectingStudent?.name}</strong>'s registration. 
              Please provide a reason (optional):
            </p>
            <Textarea
              placeholder="Enter reason for rejection (e.g., Invalid details, Not a student of this school, etc.)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectStudent}
              disabled={approvingId === rejectingStudent?.id}
            >
              {approvingId === rejectingStudent?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserX className="w-4 h-4 mr-2" />
              )}
              Reject Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Student Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, student: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Remove Student
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteDialog.student?.name}</strong> from your school? 
              This will permanently delete their account and all study data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteDialog.student && handleDeleteStudent(deleteDialog.student.id)}
              disabled={deletingId === deleteDialog.student?.id}
            >
              {deletingId === deleteDialog.student?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Remove Student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Student Report Modal */}
      {selectedStudent && (
        <StudentReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setSelectedStudent(null);
          }}
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          studentPhoto={selectedStudent.photo}
          studentClass={selectedStudent.class}
        />
      )}
    </div>
  );
};

export default SchoolDashboard;
