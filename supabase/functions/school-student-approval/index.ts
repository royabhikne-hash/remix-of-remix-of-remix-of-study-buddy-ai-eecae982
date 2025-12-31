import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SchoolStudentApprovalRequest {
  action: "approve" | "reject";
  schoolId: string;
  schoolPassword: string;
  studentId: string;
  rejectionReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SchoolStudentApprovalRequest;

    if (!body?.action || !body?.schoolId || !body?.schoolPassword || !body?.studentId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing backend env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ success: false, error: "Backend configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate school credentials
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, name")
      .eq("school_id", body.schoolId)
      .eq("password_hash", body.schoolPassword)
      .maybeSingle();

    if (schoolError) {
      console.error("School lookup error:", schoolError);
      return new Response(
        JSON.stringify({ success: false, error: "School validation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!school) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid school credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure student belongs to this school
    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, school_id")
      .eq("id", body.studentId)
      .maybeSingle();

    if (studentError) {
      console.error("Student lookup error:", studentError);
      return new Response(
        JSON.stringify({ success: false, error: "Student lookup failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!student || student.school_id !== school.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Student not found for this school" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "approve") {
      const { error: updateError } = await admin
        .from("students")
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq("id", body.studentId);

      if (updateError) {
        console.error("Approve update error:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to approve student" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, status: "approved" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reason = (body.rejectionReason || "No reason provided").trim();

    const { error: rejectError } = await admin
      .from("students")
      .update({
        is_approved: false,
        rejection_reason: reason,
      })
      .eq("id", body.studentId);

    if (rejectError) {
      console.error("Reject update error:", rejectError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to reject student" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, status: "rejected" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("school-student-approval error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
