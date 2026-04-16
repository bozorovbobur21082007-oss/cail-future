CREATE POLICY "Authenticated users can delete operations"
ON public.operations
FOR DELETE
TO authenticated
USING (true);