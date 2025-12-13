-- Add height and gender fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS height integer,
ADD COLUMN IF NOT EXISTS gender text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.height IS 'User height in centimeters';
COMMENT ON COLUMN public.profiles.gender IS 'User gender (male, female, other, prefer_not_to_say)';