import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Wand2, FileEdit, Briefcase, LayoutGrid, List } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { callGemini } from '@/lib/openrouter'
import { TAILOR_RESUME_SYSTEM_PROMPT } from '@/lib/prompts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { JobEntry, JobStatus, ResumeJSON } from '@/types/resume'

const COLUMNS: { status: JobStatus; label: string; color: string; header: string; dot: string }[] = [
  { status: 'Saved',        label: 'Saved',        color: 'bg-gray-50',    header: 'border-gray-300',   dot: 'bg-gray-400' },
  { status: 'Applied',      label: 'Applied',      color: 'bg-purple-50',  header: 'border-purple-400', dot: 'bg-purple-400' },
  { status: 'Interviewing', label: 'Interviewing', color: 'bg-yellow-50',  header: 'border-yellow-400', dot: 'bg-yellow-400' },
  { status: 'Offer',        label: 'Offer',        color: 'bg-green-50',   header: 'border-green-400',  dot: 'bg-green-500' },
  { status: 'Rejected',     label: 'Rejected',     color: 'bg-red-50',     header: 'border-red-400',    dot: 'bg-red-400' },
]

const STATUS_DOT: Record<JobStatus, string> = Object.fromEntries(
  COLUMNS.map((c) => [c.status, c.dot])
) as Record<JobStatus, string>

const addSchema = z.object({
  company_name: z.string().min(1, 'Required'),
  job_title: z.string().min(1, 'Required'),
  job_description: z.string().optional(),
})
type AddFormData = z.infer<typeof addSchema>

// ── Draggable card ──────────────────────────────────────────────────────────

function DraggableCard({
  job,
  onSelect,
  onDelete,
}: {
  job: JobEntry
  onSelect: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      className="bg-white rounded-md p-2.5 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group touch-none"
      onClick={(e) => {
        // only fire click if not a drag
        if (!isDragging) { e.stopPropagation(); onSelect() }
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{job.job_title}</p>
          <p className="text-xs text-gray-500 truncate">{job.company_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{format(new Date(job.created_at), 'MMM d')}</p>
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity shrink-0 mt-0.5"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ── Droppable column ────────────────────────────────────────────────────────

function DroppableColumn({
  col,
  jobs,
  onSelect,
  onDelete,
}: {
  col: (typeof COLUMNS)[number]
  jobs: JobEntry[]
  onSelect: (j: JobEntry) => void
  onDelete: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border-t-4 ${col.header} ${col.color} p-2 min-h-[200px] transition-colors ${isOver ? 'ring-2 ring-blue-300' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide truncate">{col.label}</h3>
        <span className="text-xs text-gray-400 font-medium shrink-0 ml-1">{jobs.length}</span>
      </div>
      <div className="space-y-1.5 flex-1">
        {jobs.map((job) => (
          <DraggableCard
            key={job.id}
            job={job}
            onSelect={() => onSelect(job)}
            onDelete={() => onDelete(job.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Overlay card (shown while dragging) ────────────────────────────────────

function OverlayCard({ job }: { job: JobEntry }) {
  return (
    <div className="bg-white rounded-md p-2.5 shadow-lg border border-gray-200 w-40 cursor-grabbing">
      <p className="text-xs font-semibold text-gray-900 truncate">{job.job_title}</p>
      <p className="text-xs text-gray-500 truncate">{job.company_name}</p>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<JobEntry | null>(null)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [activeJob, setActiveJob] = useState<JobEntry | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_tracker').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
      if (error) throw error
      return data as JobEntry[]
    },
    enabled: !!user,
  })

  const { data: baseResume } = useQuery({
    queryKey: ['base-resume', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('base_resumes').select('id').eq('user_id', user!.id).maybeSingle()
      return data
    },
    enabled: !!user,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AddFormData>({
    resolver: zodResolver(addSchema),
  })

  const createJob = useMutation({
    mutationFn: async (data: AddFormData) => {
      const { error } = await supabase.from('job_tracker').insert({
        user_id: user!.id,
        company_name: data.company_name,
        job_title: data.job_title,
        job_description: data.job_description ?? '',
        status: 'Saved' as JobStatus,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', user?.id] })
      toast.success('Job added!')
      reset()
      setAddOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('job_tracker').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', user?.id] })
      if (selectedJob) setSelectedJob(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: JobStatus }) => {
      const { error } = await supabase.from('job_tracker').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs', user?.id] }),
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDragStart = (event: DragStartEvent) => {
    const job = jobs.find((j) => j.id === event.active.id)
    setActiveJob(job ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveJob(null)
    const { active, over } = event
    if (!over) return
    const job = jobs.find((j) => j.id === active.id)
    const newStatus = over.id as JobStatus
    if (job && job.status !== newStatus) {
      updateStatus.mutate({ id: job.id, status: newStatus })
    }
  }

  if (!baseResume && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Briefcase className="h-16 w-16 text-gray-300" />
        <h2 className="text-2xl font-bold text-gray-900">Welcome to Resumo!</h2>
        <p className="text-gray-500 max-w-sm">Upload your resume first so we can tailor it for each application.</p>
        <Button onClick={() => window.location.href = '/onboarding'}>Upload your resume</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Applications</h2>
          <p className="text-gray-500 text-sm mt-0.5">{jobs.length} tracked</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            <button
              className={`p-1.5 transition-colors ${view === 'board' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              onClick={() => setView('board')}
              title="Board view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              className={`p-1.5 transition-colors ${view === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              onClick={() => setView('list')}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" />Add Job</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Add new job</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit((d) => createJob.mutate(d))} className="space-y-4 mt-2">
                <div className="space-y-1">
                  <Label>Company</Label>
                  <Input placeholder="Acme Corp" {...register('company_name')} />
                  {errors.company_name && <p className="text-xs text-red-500">{errors.company_name.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Job Title</Label>
                  <Input placeholder="Senior Software Engineer" {...register('job_title')} />
                  {errors.job_title && <p className="text-xs text-red-500">{errors.job_title.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Job Description <span className="text-gray-400">(optional)</span></Label>
                  <Textarea placeholder="Paste the job description here..." className="h-28" {...register('job_description')} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>Add Job</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-5 gap-2">
          {COLUMNS.map((col) => (
            <div key={col.status} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : view === 'board' ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-5 gap-2">
            {COLUMNS.map((col) => (
              <DroppableColumn
                key={col.status}
                col={col}
                jobs={jobs.filter((j) => j.status === col.status)}
                onSelect={setSelectedJob}
                onDelete={(id) => deleteJob.mutate(id)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeJob ? <OverlayCard job={activeJob} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List view */
        <div className="space-y-2">
          {jobs.length === 0 && (
            <div className="text-center text-gray-400 py-16 text-sm">No jobs tracked yet. Add one above.</div>
          )}
          {jobs.map((job) => {
            const col = COLUMNS.find((c) => c.status === job.status) ?? COLUMNS[0]
            return (
              <div
                key={job.id}
                className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 px-4 py-3 hover:shadow-sm transition-shadow cursor-pointer group"
                onClick={() => setSelectedJob(job)}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[job.status] ?? 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 items-center">
                  <p className="text-sm font-medium text-gray-900 truncate">{job.job_title}</p>
                  <p className="text-sm text-gray-500 truncate">{job.company_name}</p>
                  <p className="text-xs text-gray-400">{col.label}</p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">{format(new Date(job.created_at), 'MMM d, yyyy')}</p>
                <button
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); deleteJob.mutate(job.id) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {selectedJob && (
        <GenerateModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onStatusChange={() => queryClient.invalidateQueries({ queryKey: ['jobs', user?.id] })}
        />
      )}
    </div>
  )
}

// ── Generate modal ──────────────────────────────────────────────────────────

function GenerateModal({ job, onClose, onStatusChange }: {
  job: JobEntry
  onClose: () => void
  onStatusChange: () => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [jd, setJd] = useState(job.job_description)
  const [generating, setGenerating] = useState(false)

  const { data: tailored } = useQuery({
    queryKey: ['tailored-resume-exists', job.id],
    queryFn: async () => {
      const { data } = await supabase.from('tailored_resumes').select('id').eq('job_id', job.id).maybeSingle()
      return data
    },
  })

  const generate = async () => {
    if (!jd.trim()) { toast.error('Paste a job description first'); return }
    setGenerating(true)
    try {
      const { data: base, error: baseErr } = await supabase
        .from('base_resumes').select('structured_content').eq('user_id', user!.id).single()
      if (baseErr) throw new Error('No base resume found — add your experience in Settings first.')

      const jsonStr = await callGemini(
        TAILOR_RESUME_SYSTEM_PROMPT,
        `Base Resume JSON:\n${JSON.stringify(base.structured_content, null, 2)}\n\nJob Description:\n${jd}`
      )

      const tailoredResume: ResumeJSON = JSON.parse(jsonStr)

      const { error: upsertErr } = await supabase.from('tailored_resumes').upsert(
        { job_id: job.id, user_id: user!.id, content: tailoredResume },
        { onConflict: 'job_id' }
      )
      if (upsertErr) throw upsertErr

      await supabase.from('job_tracker')
        .update({ job_description: jd })
        .eq('id', job.id)

      // Pre-populate EditorPage's cache so it renders immediately on mount
      queryClient.setQueryData(['tailored-resume', job.id], {
        job_id: job.id,
        user_id: user!.id,
        content: tailoredResume,
      })
      queryClient.invalidateQueries({ queryKey: ['tailored-resume-exists', job.id] })
      onStatusChange()
      navigate(`/editor/${job.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{job.job_title}</DialogTitle>
          <p className="text-sm text-gray-500">{job.company_name}</p>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          <div className="space-y-1">
            <Label>Job Description</Label>
            <Textarea
              className="h-52 resize-none"
              placeholder="Paste the full job description here..."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              disabled={generating}
            />
          </div>

          <div className="flex gap-2 justify-end">
            {tailored && (
              <Button variant="outline" onClick={() => navigate(`/editor/${job.id}`)}>
                <FileEdit className="h-4 w-4" />
                Open Editor
              </Button>
            )}
            <Button onClick={generate} disabled={generating}>
              <Wand2 className="h-4 w-4" />
              {generating ? 'Generating...' : tailored ? 'Regenerate' : 'Generate Tailored Resume'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
