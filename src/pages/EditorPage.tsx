import { useEffect, useState, Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Save, Eye, Edit3, Plus, Trash2, GripVertical } from 'lucide-react'
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

function SectionHeader({ title, onAdd, addLabel }: { title: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm">{title}</CardTitle>
      {onAdd && (
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-blue-600" onClick={onAdd}>
          <Plus className="h-3 w-3" /> {addLabel ?? 'Add'}
        </Button>
      )}
    </div>
  )
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const {
    editedResume,
    setEditedResume,
    updateSummary,
    updateExperienceMeta,
    updateExperienceAchievement,
    addExperienceAchievement,
    removeExperienceAchievement,
    addExperience,
    removeExperience,
    updateEducation,
    addEducation,
    removeEducation,
  } = useEditorStore()
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
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">Resume Editor</h2>
          {job && <p className="text-sm text-gray-500">{job.job_title} @ {job.company_name}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDiff(!showDiff)}>
            {showDiff ? <Edit3 className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showDiff ? 'Edit Mode' : 'Review Changes'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => saveResume.mutate()} disabled={saveResume.isPending}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <PDFDownloadLink document={<ResumePDF resume={editedResume} />} fileName={fileName}>
            {({ loading }) => (
              <Button size="sm" disabled={loading}>
                <Download className="h-4 w-4 mr-1" />
                {loading ? 'Preparing...' : 'Download PDF'}
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Editor */}
        <div className="space-y-4">

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <SectionHeader title="Contact Info" />
            </CardHeader>
            <CardContent className="space-y-3">
              {(['fullName', 'email', 'phone', 'location', 'linkedinUrl', 'portfolioUrl'] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs capitalize">{field.replace(/([A-Z])/g, ' $1').toLowerCase()}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={editedResume.personalInfo[field] ?? ''}
                    onChange={(e) => useEditorStore.getState().updatePersonalInfo({ [field]: e.target.value })}
                    placeholder={field === 'linkedinUrl' ? 'https://linkedin.com/in/...' : field === 'portfolioUrl' ? 'https://...' : ''}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Professional Summary */}
          <Card>
            <CardHeader><SectionHeader title="Professional Summary" /></CardHeader>
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
                  placeholder="Write a compelling professional summary..."
                />
              )}
            </CardContent>
          </Card>

          {/* Experience */}
          <Card>
            <CardHeader>
              <SectionHeader title="Experience" onAdd={addExperience} addLabel="Add Role" />
            </CardHeader>
            <CardContent className="space-y-6">
              {(editedResume.experience ?? []).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No experience entries. Click "Add Role" to add one.</p>
              )}
              {(editedResume.experience ?? []).map((exp, expIdx) => (
                <div key={expIdx} className="space-y-3 pb-4 border-b last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
                      <GripVertical className="h-3 w-3 text-gray-300" />
                      Role {expIdx + 1}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => removeExperience(expIdx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Meta fields */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Role / Title</Label>
                      <Input
                        className="h-8 text-sm"
                        value={exp.role}
                        onChange={(e) => updateExperienceMeta(expIdx, { role: e.target.value })}
                        placeholder="Software Engineer"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Company</Label>
                      <Input
                        className="h-8 text-sm"
                        value={exp.company}
                        onChange={(e) => updateExperienceMeta(expIdx, { company: e.target.value })}
                        placeholder="Acme Corp"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start Date</Label>
                      <Input
                        className="h-8 text-sm"
                        value={exp.startDate}
                        onChange={(e) => updateExperienceMeta(expIdx, { startDate: e.target.value })}
                        placeholder="Jan 2022"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Date</Label>
                      <Input
                        className="h-8 text-sm"
                        value={exp.endDate}
                        onChange={(e) => updateExperienceMeta(expIdx, { endDate: e.target.value })}
                        placeholder="Present"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Location</Label>
                      <Input
                        className="h-8 text-sm"
                        value={exp.location ?? ''}
                        onChange={(e) => updateExperienceMeta(expIdx, { location: e.target.value })}
                        placeholder="San Francisco, CA (or Remote)"
                      />
                    </div>
                  </div>

                  {/* Achievements */}
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Achievements / Bullet Points</Label>
                    {(exp.achievements ?? []).map((ach, achIdx) => (
                      <div key={achIdx} className="flex gap-1.5 items-start">
                        {showDiff && base ? (
                          <div className="flex-1 text-sm p-2 rounded border bg-gray-50 leading-relaxed">
                            <DiffText
                              original={base.experience[expIdx]?.achievements[achIdx] ?? ''}
                              modified={ach}
                            />
                          </div>
                        ) : (
                          <Textarea
                            className="flex-1 h-16 text-sm resize-none"
                            value={ach}
                            onChange={(e) => updateExperienceAchievement(expIdx, achIdx, e.target.value)}
                            placeholder="Describe an achievement with impact..."
                          />
                        )}
                        {!showDiff && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 mt-0.5 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => removeExperienceAchievement(expIdx, achIdx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {!showDiff && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs gap-1 border-dashed"
                        onClick={() => addExperienceAchievement(expIdx)}
                      >
                        <Plus className="h-3 w-3" /> Add Bullet
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Education */}
          <Card>
            <CardHeader>
              <SectionHeader title="Education" onAdd={addEducation} addLabel="Add School" />
            </CardHeader>
            <CardContent className="space-y-4">
              {(editedResume.education ?? []).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No education entries. Click "Add School" to add one.</p>
              )}
              {(editedResume.education ?? []).map((edu, eduIdx) => (
                <div key={eduIdx} className="space-y-2 pb-4 border-b last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Entry {eduIdx + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => removeEducation(eduIdx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Institution</Label>
                      <Input
                        className="h-8 text-sm"
                        value={edu.institution}
                        onChange={(e) => updateEducation(eduIdx, { institution: e.target.value })}
                        placeholder="University of California, Berkeley"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Degree</Label>
                        <Input
                          className="h-8 text-sm"
                          value={edu.degree}
                          onChange={(e) => updateEducation(eduIdx, { degree: e.target.value })}
                          placeholder="B.S. Computer Science"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Graduation Date</Label>
                        <Input
                          className="h-8 text-sm"
                          value={edu.graduationDate}
                          onChange={(e) => updateEducation(eduIdx, { graduationDate: e.target.value })}
                          placeholder="May 2023"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader><SectionHeader title="Skills" /></CardHeader>
            <CardContent className="space-y-3">
              {(
                [
                  { key: 'technical', label: 'Technical Skills', placeholder: 'Python, TypeScript, SQL, React...' },
                  { key: 'tools', label: 'Tools & Platforms', placeholder: 'AWS, Docker, Git, Figma...' },
                  { key: 'soft', label: 'Soft Skills', placeholder: 'Leadership, Communication, Problem Solving...' },
                ] as const
              ).map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={(editedResume.skills?.[key] ?? []).join(', ')}
                    onChange={(e) =>
                      useEditorStore.getState().updateSkills({
                        [key]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder={placeholder}
                  />
                  <p className="text-[10px] text-gray-400">Comma-separated</p>
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
