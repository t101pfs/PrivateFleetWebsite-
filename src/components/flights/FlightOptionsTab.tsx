import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlightOptions } from '@/hooks/useFlightOptions';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';
import { FlightOptionCard } from './FlightOptionCard';
import { AddFlightOptionDialog } from './AddFlightOptionDialog';
import { EditFlightOptionDialog } from './EditFlightOptionDialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Percent, CheckCircle2, Package, UserPlus } from 'lucide-react';
import type { CreateOptionInput, FlightOption } from '@/hooks/useFlightOptions';

interface FlightOptionsTabProps {
  flightId: string;
  optionsStatus: string | null;
  commissionPercent: number | null;
  hasQuotation: boolean;
  canAssignToSelf?: boolean;
  canConfirm?: boolean;
  flightRoute?: {
    from: string;
    to: string;
    departureTime: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assignToMe?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  confirmFlight?: any;
}

export function FlightOptionsTab({
  flightId,
  optionsStatus,
  commissionPercent,
  hasQuotation,
  canAssignToSelf,
  canConfirm,
  flightRoute,
  assignToMe,
  confirmFlight,
}: FlightOptionsTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    options,
    isLoading,
    createOption,
    updateOption,
    deleteOption,
    isSales,
    isOperationsOrAdmin,
  } = useFlightOptions(flightId);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<FlightOption | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const canEdit = isOperationsOrAdmin && !hasQuotation;

  const notifyOptionMentions = async (aircraftNotes: string | undefined, optionId: string) => {
    const mentionedIds = extractMentionedUserIds(aircraftNotes || '', profiles).filter((uid) => uid !== user?.id);
    if (mentionedIds.length > 0) {
      await notifyMentionedUsers(mentionedIds, {
        title: 'You were mentioned',
        message: `${user?.name || 'Someone'} mentioned you in aircraft notes for a flight option`,
        flightId,
        sourceTable: 'flight_options',
        sourceId: optionId,
      });
    }
  };

  const handleAddOption = (data: CreateOptionInput) => {
    createOption.mutate(data, {
      onSuccess: (created) => {
        setAddDialogOpen(false);
        notifyOptionMentions(data.aircraft_notes, created.id);
      },
    });
  };

  const handleEditOption = (option: FlightOption) => {
    setEditingOption(option);
    setEditDialogOpen(true);
  };

  const handleUpdateOption = (optionId: string, updates: Partial<FlightOption>) => {
    updateOption.mutate({ optionId, updates }, {
      onSuccess: () => {
        setEditDialogOpen(false);
        setEditingOption(null);
        if (updates.aircraft_notes !== undefined) {
          notifyOptionMentions(updates.aircraft_notes || undefined, optionId);
        }
      },
    });
  };

  const handleDeleteOption = (optionId: string) => {
    if (confirm('Are you sure you want to delete this option?')) {
      deleteOption.mutate(optionId);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Operations: Assign to Me */}
      {canAssignToSelf && assignToMe && (
        <Button onClick={() => assignToMe.mutate(flightId)} className="w-full h-8 text-xs" disabled={assignToMe.isPending}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />{assignToMe.isPending ? 'Assigning...' : 'Assign to Me'}
        </Button>
      )}

      {/* Operations: Confirm Flight */}
      {canConfirm && confirmFlight && (
        <Button onClick={() => confirmFlight.mutate(flightId)} className="w-full h-8 text-xs bg-accent hover:bg-accent/90 text-accent-foreground" disabled={confirmFlight.isPending}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Confirm Flight
        </Button>
      )}

      {(canAssignToSelf || canConfirm) && options.length > 0 && <Separator />}

      {/* Status Badge */}
      {optionsStatus && (
        <div className="flex items-center gap-2">
          <Badge variant={
            optionsStatus === 'quotation_issued' ? 'default' :
            optionsStatus === 'options_selected' ? 'secondary' :
            'outline'
          }>
            {optionsStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
          {commissionPercent !== null && (
            <Badge variant="outline">
              <Percent className="h-3 w-3 mr-1" />
              {commissionPercent}% commission
            </Badge>
          )}
        </div>
      )}

      {/* Operations: Add Options Button */}
      {isOperationsOrAdmin && canEdit && (
        <Button onClick={() => setAddDialogOpen(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> Add Aircraft Option
        </Button>
      )}

      {/* Options List */}
      {options.length === 0 ? (
        <div className="text-center py-8">
          <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {isOperationsOrAdmin
              ? 'No options added yet. Add aircraft options for Sales to review.'
              : 'Waiting for Operations to upload aircraft options.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((option, index) => (
            <FlightOptionCard
              key={option.id}
              option={option}
              optionNumber={`A${index + 1}`}
              isSales={isSales}
              isOperationsOrAdmin={isOperationsOrAdmin}
              canEdit={canEdit}
              onDelete={() => handleDeleteOption(option.id)}
              onEdit={canEdit ? () => handleEditOption(option) : undefined}
              onPublish={canEdit ? () => updateOption.mutate({ optionId: option.id, updates: { is_draft: false } }) : undefined}
            />
          ))}
        </div>
      )}

      {/* Sales: options review, selection, approval and quotation now live on
          the dedicated Sourcing Workspace page, not here — keeps a single
          place where Sales selects an option instead of two divergent UIs. */}
      {isSales && (
        <>
          <Separator />
          <Button variant="outline" className="w-full" onClick={() => navigate(`/flights/${flightId}`)}>
            Review & select options in the Sourcing Workspace
          </Button>
        </>
      )}

      <AddFlightOptionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddOption}
        flightId={flightId}
        isPending={createOption.isPending}
        flightRoute={flightRoute}
      />

      {editingOption && (
        <EditFlightOptionDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingOption(null);
          }}
          option={editingOption}
          onSubmit={handleUpdateOption}
          isPending={updateOption.isPending}
          flightRoute={flightRoute}
        />
      )}
    </div>
  );
}
