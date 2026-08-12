import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LeadColumn } from './LeadColumn';
import { LeadCard } from './LeadCard';
import { LeadRow, PIPELINE_STAGES, PipelineStage } from './leadPipeline';

interface LeadsPipelineBoardProps {
  leads: LeadRow[];
  ownerNameById: Map<string, string>;
  onCardClick: (lead: LeadRow) => void;
}

export function LeadsPipelineBoard({ leads, ownerNameById, onCardClick }: LeadsPipelineBoardProps) {
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
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('leads').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData<LeadRow[]>(['leads']);
      queryClient.setQueryData<LeadRow[]>(['leads'], (old = []) =>
        old.map((l) => (l.id === id ? { ...l, status } : l))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['leads'], context.previous);
      toast.error('Failed to move lead');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
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

    const newStatus = over.id as string;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead || lead.status === newStatus) return;

    updateStatus.mutate({ id: lead.id as string, status: newStatus });
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
