-- Update the handle_new_user function to assign 'analyst' role instead of 'client'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'display_name');
  
  -- Assign 'analyst' role to all new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'analyst');
  
  RETURN new;
END;
$$;

-- Update existing users with 'client' role to 'analyst'
UPDATE public.user_roles SET role = 'analyst' WHERE role = 'client';