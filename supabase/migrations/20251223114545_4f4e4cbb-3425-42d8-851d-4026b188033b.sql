-- Create role enum
CREATE TYPE public.app_role AS ENUM ('analyst', 'client');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Drop existing INSERT policy on news_items and create new one for analysts only
DROP POLICY IF EXISTS "Users can insert their own news items" ON public.news_items;

CREATE POLICY "Analysts can insert news items"
ON public.news_items
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND public.has_role(auth.uid(), 'analyst')
);

-- Update DELETE policy to analysts only
DROP POLICY IF EXISTS "Users can delete their own news items" ON public.news_items;

CREATE POLICY "Analysts can delete their own news items"
ON public.news_items
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  AND public.has_role(auth.uid(), 'analyst')
);

-- Update UPDATE policy to analysts only
DROP POLICY IF EXISTS "Users can update their own news items" ON public.news_items;

CREATE POLICY "Analysts can update their own news items"
ON public.news_items
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  AND public.has_role(auth.uid(), 'analyst')
);