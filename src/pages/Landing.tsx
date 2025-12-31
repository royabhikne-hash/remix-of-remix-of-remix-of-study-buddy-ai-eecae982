import { BookOpen, Users, GraduationCap, MessageCircle, TrendingUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen hero-gradient">
      {/* Header */}
      <header className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Edu improvement AI</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/login")}>
              Login
            </Button>
            <Button variant="hero" onClick={() => navigate("/signup")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-secondary px-4 py-2 rounded-full mb-6">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
            <span className="text-sm font-semibold text-secondary-foreground">AI Study Companion</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            Your Personal<br />
            <span className="gradient-text">Study Buddy</span> is Here
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Bhai, padhai mein help chahiye? AI companion jo tere saath padhega, 
            samjhaayega, aur progress track karega. Real improvement, real results.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="xl" onClick={() => navigate("/signup")}>
              <GraduationCap className="w-5 h-5" />
              Start Studying Now
            </Button>
            <Button variant="hero-outline" size="xl" onClick={() => navigate("/school-login")}>
              <Users className="w-5 h-5" />
              School Login
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard
            icon={<MessageCircle className="w-6 h-6" />}
            title="AI Study Chat"
            description="Chat with AI in Hinglish while studying. Upload notes, ask doubts, get explanations."
          />
          <FeatureCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Track Progress"
            description="AI tracks your understanding, weak areas, and improvement over time."
          />
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="Parent Reports"
            description="Weekly PDF reports sent automatically to parents via WhatsApp."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          How It <span className="gradient-text">Works</span>
        </h2>
        
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6">
            <StepCard step={1} title="Sign Up" description="Create your student account" />
            <StepCard step={2} title="Start Study" description="Click start and begin chatting" />
            <StepCard step={3} title="Learn Together" description="AI helps you understand" />
            <StepCard step={4} title="Track Growth" description="See your improvement" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-border">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-semibold">Edu improvement AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 Edu improvement AI. Making education better.
          </p>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="edu-card p-6 text-center hover:-translate-y-1 transition-transform duration-200">
    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4 text-primary">
      {icon}
    </div>
    <h3 className="text-lg font-bold mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm">{description}</p>
  </div>
);

const StepCard = ({ step, title, description }: { step: number; title: string; description: string }) => (
  <div className="text-center">
    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 font-bold text-lg">
      {step}
    </div>
    <h3 className="font-bold mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

export default Landing;
