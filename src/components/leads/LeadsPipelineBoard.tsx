import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { LeadColumn } from './LeadColumn';
import { LeadCard } from './LeadCard';
import { logLeadActivity } from './LeadActivityFeed';
import { ensureLeadTeamChat } from './leadTeamChat';
import { LeadRow, PIPELINE_STAGES, PipelineStage, STAGE_PROBABILITY_DEFAULTS } from './leadPipeline';

interface LeadsPipelineBoardProps {
  leads: LeadRow[];
  ownerNameById: Map<string, string>;
  onCardClick: (lead: LeadRow) => void;
}

export function LeadsPipelineBoard({ leads, ownerNameById, onCardClick }: LeadsPipelineBoardProps) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeLead, setActiveLead] = useState<LeadRow | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const leadsByStage = useMemo(() => {
    const grouped = new Map<PipelineStage, LeadRow[]>();
    for (const stage of PIPELINE_STAGES) grouped.set(stage.value, []);
    for (const lead of leads) {
      const stage = lead.status as PipelineStage;
      if (grouped.has(stage)) grouped.get(stage)!.push(lead);
    }
    return grouped;
  }, [leads]);

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      probability,
      assignedTo,
    }: { id: string; status: PipelineStage; probability?: number; assignedTo?: string | null }) => {
      const update: Record<string, unknown> = { status };
      if (probability !== undefined) update.probability = probability;
      const { error } = await supabase.from('leads').update(update as any).eq('id', id);
      if (error) throw error;

      const stageLabel = PIPELINE_STAGES.find((s) => s.value === status)?.label || status;
      logLeadActivity(id, 'stage_change', `Moved to ${stageLabel}`, supabaseUser?.id, user?.name);

      if (status === 'qualified') {
        await ensureLeadTeamChat(id, assignedTo);
      }
    },
    onMutate: async ({ id, status, probability }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData<LeadRow[]>(['leads']);
      queryClient.setQueryData<LeadRow[]>(['leads'], (old = []) =>
        old.map((l) => (l.id === id ? { ...l, status, ...(probability !== undefined ? { probability } : {}) } : l))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['leads'], context.previous);
      toast.error('Failed to move lead');
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['lead-team-members', vars.id] });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find((l) => l.id === event.active.id);
    setActiveLead(lead || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const newStatus = over.id as PipelineStage;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead || lead.status === newStatus) return;

    const probability = lead.probability == null ? STAGE_PROBABILITY_DEFAULTS[newStatus] : undefined;
    updateStatus.mutate({ id: lead.id as string, status: newStatus, probability, assignedTo: lead.assigned_to });
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <LeadColumn
            key={stage.value}
            stage={stage}
            leads={leadsByStage.get(stage.value) || []}
            ownerNameById={ownerNameById}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead && (
          <LeadCard
            lead={activeLead}
            ownerName={activeLead.assigned_to ? ownerNameById.get(activeLead.assigned_to) : undefined}
            onClick={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
