import { useEffect, useState, Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Save, Eye, Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useEditorStore } from '@/store/editorStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ResumePDF from '@/components/ResumePDF'
import type { BaseResume, TailoredResume, ResumeJSON } from '@/types/resume'

function DiffText({ original, modified }: { original: string; modified: string }) {
  if (original === modified) return <span className="text-gray-700">{modified}</span>

  if (!original) return <span className="bg-green-100 text-green-800 rounded px-0.5">{modified}</span>

  return (
    <span>
      <span className="line-through text-red-400 mr-1">{original}</span>
      <span className="bg-green-100 text-green-800 rounded px-0.5">{modified}</span>
    </span>
  )
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { editedResume, setEditedResume, updateSummary, updateExperienceAchievement } = useEditorStore()
  const [showDiff, setShowDiff] = useState(false)

  const { data: tailoredData } = useQuery({
    queryKey: ['tailored-resume', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tailored_resumes')
        .select('*')
        .eq('job_id', id)
        .single()
      if (error) throw error
      return data as TailoredResume
    },
  })

  const { data: baseData } = useQuery({
    queryKey: ['base-resume', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('base_resumes')
        .select('*')
        .eq('user_id', user!.id)
        .single()
      if (error) throw error
      return data as BaseResume
    },
    enabled: !!user,
  })

  const { data: job } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data } = await supabase.from('job_tracker').select('company_name, job_title').eq('id', id!).single()
      return data
    },
  })

  useEffect(() => {
    if (tailoredData?.content) {
      setEditedResume(tailoredData.content)
    }
  }, [tailoredData, setEditedResume])

  const saveResume = useMutation({
    mutationFn: async () => {
      if (!editedResume) return
      const { error } = await supabase
        .from('tailored_resumes')
        .update({ content: editedResume })
        .eq('job_id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tailored-resume', id] })
      toast.success('Changes saved!')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!editedResume) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const base = baseData?.structured_content
  const fileName = `${editedResume.personalInfo.fullName.replace(/\s+/g, '_')}_${job?.company_name ?? 'Resume'}.pdf`

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">Resume Editor</h2>
          {job && <p className="text-sm text-gray-500">{job.job_title} @ {job.company_name}</p>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDiff(!showDiff)}
          >
            {showDiff ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showDiff ? 'Edit Mode' : 'Review Changes'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => saveResume.mutate()} disabled={saveResume.isPending}>
            <Save className="h-4 w-4" />
            Save
          </Button>
          <PDFDownloadLink
            document={<ResumePDF resume={editedResume} />}
            fileName={fileName}
          >
            {({ loading }) => (
              <Button size="sm" disabled={loading}>
                <Download className="h-4 w-4" />
                {loading ? 'Preparing...' : 'Download PDF'}
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Contact Info</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(['fullName', 'email', 'phone', 'location', 'linkedinUrl', 'portfolioUrl'] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs capitalize">{field.replace(/([A-Z])/g, ' $1').toLowerCase()}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={editedResume.personalInfo[field] ?? ''}
                    onChange={(e) => useEditorStore.getState().updatePersonalInfo({ [field]: e.target.value })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Professional Summary</CardTitle></CardHeader>
            <CardContent>
              {showDiff && base ? (
                <div className="text-sm p-2 rounded border bg-gray-50 leading-relaxed">
                  <DiffText original={base.summary} modified={editedResume.summary} />
                </div>
              ) : (
                <Textarea
                  className="h-28 text-sm"
                  value={editedResume.summary}
                  onChange={(e) => updateSummary(e.target.value)}
                />
              )}
            </CardContent>
          </Card>

          {(editedResume.experience ?? []).map((exp, expIdx) => (
            <Card key={expIdx}>
              <CardHeader>
                <CardTitle className="text-sm">{exp.role} @ {exp.company}</CardTitle>
                <p className="text-xs text-gray-400">{exp.startDate} – {exp.endDate}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {(exp.achievements ?? []).map((ach, achIdx) => (
                  <div key={achIdx}>
                    {showDiff && base ? (
                      <div className="text-sm p-2 rounded border bg-gray-50 leading-relaxed">
                        <DiffText
                          original={base.experience[expIdx]?.achievements[achIdx] ?? ''}
                          modified={ach}
                        />
                      </div>
                    ) : (
                      <Textarea
                        className="h-16 text-sm resize-none"
                        value={ach}
                        onChange={(e) => updateExperienceAchievement(expIdx, achIdx, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader><CardTitle className="text-sm">Skills</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(['technical', 'soft', 'tools'] as const).map((skillType) => (
                <div key={skillType} className="space-y-1">
                  <Label className="text-xs capitalize">{skillType}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={(editedResume.skills?.[skillType] ?? []).join(', ')}
                    onChange={(e) =>
                      useEditorStore.getState().updateSkills({
                        [skillType]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Comma-separated skills"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: PDF Preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">PDF Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Suspense fallback={<div className="h-96 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
                <ResumePreviewFrame resume={editedResume} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ResumePreviewFrame({ resume }: { resume: ResumeJSON }) {
  return (
    <PDFViewer width="100%" height={700} showToolbar={false}>
      <ResumePDF resume={resume} />
    </PDFViewer>
  )
}
