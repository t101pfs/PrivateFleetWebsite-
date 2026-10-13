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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !supabaseUser) return;
    setName(user?.name || '');
    supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', supabaseUser.id)
      .maybeSingle()
      .then(({ data }) => setPhoneNumber(data?.phone_number || ''));
  }, [open, user?.name, supabaseUser]);

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
        .update({ full_name: name.trim(), phone_number: phoneNumber.trim() || null })
        .eq('user_id', supabaseUser.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated');
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Your Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
          <div>
            <Label htmlFor="edit-phone-input" className="text-xs">Phone Number</Label>
            <Input
              id="edit-phone-input"
              type="tel"
              placeholder="+9665XXXXXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <p className="text-xs text-muted-foreground mt-1">Used for WhatsApp notifications. Include country code.</p>
          </div>
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
