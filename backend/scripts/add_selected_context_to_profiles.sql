ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS selected_college_id UUID REFERENCES public.colleges(id),
ADD COLUMN IF NOT EXISTS selected_category_id UUID REFERENCES public.categories(id);
