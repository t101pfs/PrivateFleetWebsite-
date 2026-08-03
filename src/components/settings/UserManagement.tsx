import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserProfileDialog } from './UserProfileDialog';
import { toast } from 'sonner';
import { UserPlus, Trash2, Loader2, Search, Copy, Eye, EyeOff, Pencil } from 'lucide-react';
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

// Validation schema for user creation
const userSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  full_name: z.string()
    .trim()
    .min(1, { message: "Full name is required" })
    .max(255, { message: "Full name must be less than 255 characters" })
    .regex(/^[\p{L}\p{M}\p{Zs}.''`-]+$/u, { message: "Full name contains invalid characters" }),
  role: z.enum(['sales', 'operations', 'admin', 'super_admin'])
});

// Generate a cryptographically secure random temporary password
const generateTempPassword = (): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const all = uppercase + lowercase + numbers + special;
  
  // Get cryptographically secure random character
  const getSecureRandomChar = (chars: string): string => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return chars[array[0] % chars.length];
  };
  
  // Ensure at least one of each required character type
  const password: string[] = [
    getSecureRandomChar(uppercase),
    getSecureRandomChar(lowercase),
    getSecureRandomChar(numbers),
    getSecureRandomChar(special),
  ];
  
  // Add remaining random characters
  for (let i = 0; i < 8; i++) {
    password.push(getSecureRandomChar(all));
  }
  
  // Shuffle using Fisher-Yates algorithm with crypto.getRandomValues
  for (let i = password.length - 1; i > 0; i--) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const j = array[0] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }
  
  return password.join('');
};

interface UserManagementProps {
  isSuperAdmin?: boolean;
}

export function UserManagement({ isSuperAdmin = false }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'sales' as 'sales' | 'operations' | 'admin' | 'super_admin',
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Roles that only super_admin can assign
  const adminRoles = ['admin', 'super_admin'];
  
  // Get available roles for selection based on current user's permissions
  const getAvailableRoles = () => {
    if (isSuperAdmin) {
      return ['sales', 'operations', 'admin', 'super_admin'];
    }
    return ['sales', 'operations'];
  };

  // Check if current user can modify a specific role
  const canModifyRole = (targetRole: string) => {
    if (isSuperAdmin) return true;
    return !adminRoles.includes(targetRole);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        role: roles?.find(r => r.user_id === profile.user_id)?.role || 'sales'
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    const tempPassword = generateTempPassword();
    setGeneratedPassword(tempPassword);
    setFormData({ email: '', full_name: '', role: 'sales' });
    setUserCreated(false);
    setIsCreateDialogOpen(true);
  };

  const handleCreateUser = async () => {
    // Validate all form fields using zod schema
    const validationResult = userSchema.safeParse(formData);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      toast.error(firstError.message);
      return;
    }
    
    // Use validated and sanitized data
    const validatedData = validationResult.data;

    setIsSubmitting(true);
    try {
      // Created server-side via an edge function using the service role, so
      // creating a user never swaps out the admin's own logged-in session
      // (which supabase.auth.signUp() would do) and the account is created
      // pre-confirmed (no email confirmation link required to log in).
      const { data, error } = await supabase.functions.invoke('admin-manage-users', {
        body: {
          action: 'create',
          email: validatedData.email,
          password: generatedPassword,
          full_name: validatedData.full_name,
          role: validatedData.role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setUserCreated(true);
      toast.success('User created successfully! Share the temporary password with the user.');
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    toast.success('Password copied to clipboard');
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole as 'sales' | 'operations' | 'admin' | 'super_admin' })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Role updated successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      // Deletes the actual auth account server-side (cascades to profile + role),
      // rather than only deleting the profile row and leaving an orphaned login.
      const { data, error } = await supabase.functions.invoke('admin-manage-users', {
        body: { action: 'delete', targetUserId: userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    }
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setGeneratedPassword('');
    setUserCreated(false);
  };

  const handleOpenProfileDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setIsProfileDialogOpen(true);
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin': return 'destructive';
      case 'admin': return 'default';
      case 'operations': return 'secondary';
      default: return 'outline';
    }
  };

  const formatRoleName = (role: string) => {
    if (role === 'super_admin') return 'Super Admin';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Create and manage user accounts. Users are created with temporary passwords that must be changed on first login.
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleOpenCreateDialog}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{userCreated ? 'User Created Successfully' : 'Create New User'}</DialogTitle>
                <DialogDescription>
                  {userCreated 
                    ? 'Share the temporary password with the user. They will be required to change it on first login.'
                    : 'Add a new user with a temporary password. They will be required to change it on first login.'
                  }
                </DialogDescription>
              </DialogHeader>
              
              {!userCreated ? (
                <>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        placeholder="John Doe"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value: 'sales' | 'operations' | 'admin' | 'super_admin') => 
                          setFormData({ ...formData, role: value })
                        }
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
                      {!isSuperAdmin && (
                        <p className="text-xs text-muted-foreground">
                          Only Super Admins can assign Admin or Super Admin roles.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Temporary Password</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={generatedPassword}
                            readOnly
                            className="pr-10 bg-muted"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This password will be shown only once. Copy it before creating the user.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateUser} disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create User
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-4 py-4">
                    <div className="p-4 rounded-lg bg-muted space-y-3">
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{formData.email}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Full Name</p>
                        <p className="text-sm text-muted-foreground">{formData.full_name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Role</p>
                        <Badge variant={getRoleBadgeVariant(formData.role)}>
                          {formatRoleName(formData.role)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Temporary Password</p>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="px-2 py-1 rounded bg-background text-sm">
                            {showPassword ? generatedPassword : '••••••••••••'}
                          </code>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={handleCopyPassword}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      ⚠️ Make sure to copy and securely share the temporary password with the user. They will need to change it when they first log in.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCloseDialog}>
                      Done
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No users found matching your search.' : 'No users found. Create your first user.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell
                    className="cursor-pointer"
                    onClick={() => handleOpenProfileDialog(user)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || user.email} />
                        <AvatarFallback className="text-sm font-semibold text-primary bg-primary/10">
                          {(user.full_name || user.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canModifyRole(user.role || 'sales') ? (
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleUpdateRole(user.user_id, value)}
                      >
                        <SelectTrigger className="w-36">
                          <Badge variant={getRoleBadgeVariant(user.role || 'sales')}>
                            {formatRoleName(user.role || 'sales')}
                          </Badge>
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
                      <Badge variant={getRoleBadgeVariant(user.role || 'sales')}>
                        {formatRoleName(user.role || 'sales')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.must_change_password ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                        Pending Password Change
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenProfileDialog(user)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(user.user_id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <UserProfileDialog
        user={selectedUser}
        open={isProfileDialogOpen}
        onOpenChange={setIsProfileDialogOpen}
        isSuperAdmin={isSuperAdmin}
        onSaved={fetchUsers}
      />
    </Card>
  );
}
