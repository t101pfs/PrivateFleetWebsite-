import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditNameDialog({ open, onOpenChange }: EditNameDialogProps) {
  const { user, supabaseUser, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setName(user?.name || '');
  }, [open, user?.name]);

  const handleSave = async () => {
    if (!supabaseUser) return;
    if (!name.trim()) {
      toast.error('Enter your name');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name.trim() })
        .eq('user_id', supabaseUser.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Name updated');
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update name');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Your Name</DialogTitle>
        </DialogHeader>
        <div>
          <Label htmlFor="edit-name-input" className="text-xs">Full Name</Label>
          <Input
            id="edit-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
