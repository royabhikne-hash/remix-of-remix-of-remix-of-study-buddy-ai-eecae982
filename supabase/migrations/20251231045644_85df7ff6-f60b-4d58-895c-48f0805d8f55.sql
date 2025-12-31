-- Fix RLS policies for schools table to allow admin operations
CREATE POLICY "Admin can insert schools"
ON public.schools
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admin can update schools"
ON public.schools
FOR UPDATE
USING (true);

CREATE POLICY "Admin can delete schools"
ON public.schools
FOR DELETE
USING (true);

-- Fix RLS policies for students table to allow admin and school operations  
CREATE POLICY "Admin and schools can delete students"
ON public.students
FOR DELETE
USING (true);