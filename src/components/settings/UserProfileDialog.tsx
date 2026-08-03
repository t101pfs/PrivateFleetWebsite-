import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

type UserProfile = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  employee_id?: string | null;
  iqama_number?: string | null;
  nationality?: string | null;
  job_title?: string | null;
  created_at: string;
  role?: string;
  must_change_password?: boolean;
};

interface UserProfileDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSuperAdmin: boolean;
  onSaved: () => void;
}

const fullNameSchema = z.string()
  .trim()
  .min(1, { message: 'Full name is required' })
  .max(255, { message: 'Full name must be less than 255 characters' })
  .regex(/^[\p{L}\p{M}\p{Zs}.''`-]+$/u, { message: 'Full name contains invalid characters' });

const adminRoles = ['admin', 'super_admin'];

export function UserProfileDialog({ user, open, onOpenChange, isSuperAdmin, onSaved }: UserProfileDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    avatar_url: '' as string | null,
    employee_id: '',
    iqama_number: '',
    nationality: '',
    job_title: '',
    role: 'sales' as 'sales' | 'operations' | 'admin' | 'super_admin',
  });

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        avatar_url: user.avatar_url || null,
        employee_id: user.employee_id || '',
        iqama_number: user.iqama_number || '',
        nationality: user.nationality || '',
        job_title: user.job_title || '',
        role: (user.role as typeof form.role) || 'sales',
      });
    }
  }, [user]);

  const canModifyRole = (targetRole: string) => {
    if (isSuperAdmin) return true;
    return !adminRoles.includes(targetRole);
  };

  const getAvailableRoles = () => (isSuperAdmin ? ['sales', 'operations', 'admin', 'super_admin'] : ['sales', 'operations']);

  const formatRoleName = (role: string) => (role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.user_id}-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setForm((f) => ({ ...f, avatar_url: publicUrl }));
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const nameResult = fullNameSchema.safeParse(form.full_name);
    if (!nameResult.success) {
      toast.error(nameResult.error.errors[0].message);
      return;
    }

    setIsSaving(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: nameResult.data,
          avatar_url: form.avatar_url,
          employee_id: form.employee_id || null,
          iqama_number: form.iqama_number || null,
          nationality: form.nationality || null,
          job_title: form.job_title || null,
        })
        .eq('user_id', user.user_id);
      if (profileError) throw profileError;

      if (form.role !== user.role && canModifyRole(user.role || 'sales')) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: form.role })
          .eq('user_id', user.user_id);
        if (roleError) throw roleError;
      }

      toast.success('Profile updated successfully');
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
          <DialogDescription>View and edit this user's details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={form.avatar_url || undefined} alt={form.full_name} />
              <AvatarFallback className="text-lg font-semibold">
                {(form.full_name || user.email).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {isUploading ? 'Uploading...' : 'Upload Photo'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user.must_change_password ? (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                Pending Password Change
              </Badge>
            ) : (
              <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                Active
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Created {new Date(user.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="profile_full_name">Full Name</Label>
              <Input
                id="profile_full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile_employee_id">Employee ID</Label>
              <Input
                id="profile_employee_id"
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile_iqama_number">Iqama Number</Label>
              <Input
                id="profile_iqama_number"
                value={form.iqama_number}
                onChange={(e) => setForm({ ...form, iqama_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile_nationality">Nationality</Label>
              <Input
                id="profile_nationality"
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile_role">Role</Label>
              {canModifyRole(user.role || 'sales') ? (
                <Select
                  value={form.role}
                  onValueChange={(value: typeof form.role) => setForm({ ...form, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableRoles().map((role) => (
                      <SelectItem key={role} value={role}>
                        {formatRoleName(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={formatRoleName(user.role || 'sales')} disabled className="bg-muted" />
              )}
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="profile_job_title">Job Description</Label>
              <Textarea
                id="profile_job_title"
                rows={3}
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isUploading}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
