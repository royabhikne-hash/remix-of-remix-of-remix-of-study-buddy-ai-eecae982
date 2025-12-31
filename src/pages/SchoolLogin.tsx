import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, Eye, EyeOff, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SchoolLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [schoolId, setSchoolId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check school credentials from database
      const { data: school, error } = await supabase
        .from("schools")
        .select("*")
        .eq("school_id", schoolId)
        .eq("password_hash", password)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (school) {
        localStorage.setItem("userType", "school");
        localStorage.setItem("schoolId", school.school_id);
        localStorage.setItem("schoolUUID", school.id);
        localStorage.setItem("schoolName", school.name);
        // Store password for secure approve/reject calls (clears when tab closes)
        sessionStorage.setItem("schoolPassword", password);
        toast({
          title: "Welcome!",
          description: "School dashboard access granted.",
        });
        navigate("/school-dashboard");
      } else {
        toast({
          title: "Invalid Credentials",
          description: "Please check your School ID and password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen hero-gradient flex flex-col">
      {/* Header */}
      <header className="container mx-auto py-6 px-4">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </header>

      {/* Login Form */}
      <main className="flex-1 container mx-auto px-4 flex items-center justify-center py-8">
        <div className="w-full max-w-md">
          <div className="edu-card p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-accent-foreground" />
              </div>
              <h1 className="text-2xl font-bold">School Login</h1>
              <p className="text-muted-foreground mt-2">Access your school dashboard</p>
            </div>

            <div className="bg-secondary/50 border border-secondary rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Admin Access Only</p>
                  <p className="text-muted-foreground">This login is for registered schools only.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <Label htmlFor="schoolId">School ID</Label>
                <Input
                  id="schoolId"
                  placeholder="Enter your School ID"
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button type="submit" variant="accent" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Access Dashboard"}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border text-center space-y-2">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary block">
                Student? Login here →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SchoolLogin;
