import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ResumeJSON } from '@/types/resume'

const EMPTY_EXP: ResumeJSON['experience'][number] = {
  company: '', role: '', startDate: '', endDate: '', location: '', achievements: [],
}
const EMPTY_EDU: ResumeJSON['education'][number] = {
  institution: '', degree: '', graduationDate: '',
}

export default function SettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '', location: '', linkedin_url: '', portfolio_url: '' })
  const [resume, setResume] = useState<ResumeJSON | null>(null)
  const [saving, setSaving] = useState(false)

  const { isLoading } = useQuery({
    queryKey: ['settings-data', user?.id],
    queryFn: async () => {
      const [{ data: prof }, { data: base }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user!.id).single(),
        supabase.from('base_resumes').select('structured_content').eq('user_id', user!.id).maybeSingle(),
      ])

      setProfile({
        full_name: prof?.full_name ?? '',
        email: prof?.email ?? user?.email ?? '',
        phone: prof?.phone ?? '',
        location: prof?.location ?? '',
        linkedin_url: prof?.linkedin_url ?? '',
        portfolio_url: prof?.portfolio_url ?? '',
      })

      setResume(base?.structured_content ?? {
        personalInfo: { fullName: '', email: '', phone: '', location: '' },
        summary: '',
        experience: [],
        education: [],
        skills: { technical: [], soft: [], tools: [] },
      })

      return { prof, base }
    },
    enabled: !!user,
    staleTime: Infinity,
  })

  const save = async (section?: 'profile' | 'resume') => {
    setSaving(true)
    try {
      if (!section || section === 'profile') {
        const updatedPersonal = {
          full_name: profile.full_name,
          phone: profile.phone,
          location: profile.location,
          linkedin_url: profile.linkedin_url,
          portfolio_url: profile.portfolio_url,
        }
        const { error } = await supabase.from('profiles').update(updatedPersonal).eq('id', user!.id)
        if (error) throw error
      }

      if (resume && (!section || section === 'resume')) {
        const updatedResume: ResumeJSON = {
          ...resume,
          personalInfo: {
            ...resume.personalInfo,
            fullName: profile.full_name || resume.personalInfo?.fullName || '',
            email: profile.email || resume.personalInfo?.email || '',
            phone: profile.phone || resume.personalInfo?.phone || '',
            location: profile.location || resume.personalInfo?.location || '',
            linkedinUrl: profile.linkedin_url || resume.personalInfo?.linkedinUrl || '',
            portfolioUrl: profile.portfolio_url || resume.personalInfo?.portfolioUrl || '',
          },
        }
        const { error } = await supabase
          .from('base_resumes')
          .upsert({ user_id: user!.id, structured_content: updatedResume, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        if (error) throw error
      }

      queryClient.invalidateQueries({ queryKey: ['base-resume', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      toast.success('Saved!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Experience helpers
  const addExp = () => setResume((r) => r ? { ...r, experience: [...r.experience, { ...EMPTY_EXP }] } : r)
  const removeExp = (i: number) => setResume((r) => r ? { ...r, experience: r.experience.filter((_, idx) => idx !== i) } : r)
  const updateExp = (i: number, field: string, value: string | string[]) =>
    setResume((r) => {
      if (!r) return r
      const exp = [...r.experience]
      exp[i] = { ...exp[i], [field]: value }
      return { ...r, experience: exp }
    })

  // Education helpers
  const addEdu = () => setResume((r) => r ? { ...r, education: [...r.education, { ...EMPTY_EDU }] } : r)
  const removeEdu = (i: number) => setResume((r) => r ? { ...r, education: r.education.filter((_, idx) => idx !== i) } : r)
  const updateEdu = (i: number, field: string, value: string) =>
    setResume((r) => {
      if (!r) return r
      const edu = [...r.education]
      edu[i] = { ...edu[i], [field]: value }
      return { ...r, education: edu }
    })

  if (isLoading || !resume) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-500 text-sm mt-1">Your profile is the source of truth for all resume generation</p>
        </div>
        <Button onClick={() => navigate('/onboarding')} variant="outline" size="sm">
          <Upload className="h-4 w-4" />
          Re-import resume
        </Button>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        {/* PROFILE TAB */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Information</CardTitle>
              <CardDescription>Used in the header of every generated resume</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name">
                  <Input value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} placeholder="Jane Smith" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" />
                </Field>
                <Field label="Phone">
                  <Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
                </Field>
                <Field label="Location">
                  <Input value={profile.location} onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))} placeholder="San Francisco, CA" />
                </Field>
              </div>
              <Field label="LinkedIn URL">
                <Input value={profile.linkedin_url} onChange={(e) => setProfile((p) => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/yourname" />
              </Field>
              <Field label="Portfolio / Website">
                <Input value={profile.portfolio_url} onChange={(e) => setProfile((p) => ({ ...p, portfolio_url: e.target.value }))} placeholder="https://yoursite.com" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Professional Summary</CardTitle>
              <CardDescription>A brief overview. The AI rewrites this for each role.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="h-32 resize-none"
                placeholder="e.g. Full-stack engineer with 5 years building scalable SaaS products..."
                value={resume.summary ?? ''}
                onChange={(e) => setResume((r) => r ? { ...r, summary: e.target.value } : r)}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => save('profile')} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</Button>
          </div>
        </TabsContent>

        {/* EXPERIENCE TAB */}
        <TabsContent value="experience" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Write freely — the AI formats these into tailored bullets when generating.</p>
            <Button size="sm" onClick={addExp}><Plus className="h-4 w-4" />Add Role</Button>
          </div>

          {(resume.experience ?? []).length === 0 && (
            <Card><CardContent className="py-12 text-center text-gray-400 text-sm">No experience added yet. Click &quot;Add Role&quot; to get started.</CardContent></Card>
          )}

          {(resume.experience ?? []).map((exp, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">{exp.role || exp.company ? `${exp.role}${exp.role && exp.company ? ' @ ' : ''}${exp.company}` : `Role ${i + 1}`}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removeExp(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Job Title">
                    <Input value={exp.role} onChange={(e) => updateExp(i, 'role', e.target.value)} placeholder="Software Engineer" className="h-8 text-sm" />
                  </Field>
                  <Field label="Company">
                    <Input value={exp.company} onChange={(e) => updateExp(i, 'company', e.target.value)} placeholder="Acme Corp" className="h-8 text-sm" />
                  </Field>
                  <Field label="Start Date">
                    <Input value={exp.startDate} onChange={(e) => updateExp(i, 'startDate', e.target.value)} placeholder="01/2022" className="h-8 text-sm" />
                  </Field>
                  <Field label="End Date">
                    <Input value={exp.endDate} onChange={(e) => updateExp(i, 'endDate', e.target.value)} placeholder="Present" className="h-8 text-sm" />
                  </Field>
                </div>
                <Field label="Location">
                  <Input value={exp.location} onChange={(e) => updateExp(i, 'location', e.target.value)} placeholder="Remote / New York, NY" className="h-8 text-sm" />
                </Field>
                <Field label="What you did">
                  <Textarea
                    className="h-28 text-sm resize-none"
                    placeholder="Describe what you built, your responsibilities, and key achievements. Write naturally — the AI will shape this into optimized bullet points for each job you apply to."
                    value={(exp.achievements ?? []).join('\n')}
                    onChange={(e) => updateExp(i, 'achievements', e.target.value.split('\n'))}
                  />
                </Field>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button onClick={() => save('resume')} disabled={saving}>{saving ? 'Saving...' : 'Save Experience'}</Button>
          </div>
        </TabsContent>

        {/* EDUCATION TAB */}
        <TabsContent value="education" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={addEdu}><Plus className="h-4 w-4" />Add Education</Button>
          </div>

          {(resume.education ?? []).length === 0 && (
            <Card><CardContent className="py-12 text-center text-gray-400 text-sm">No education added yet.</CardContent></Card>
          )}

          {(resume.education ?? []).map((edu, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">{edu.institution || `Entry ${i + 1}`}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removeEdu(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Field label="Institution">
                  <Input value={edu.institution} onChange={(e) => updateEdu(i, 'institution', e.target.value)} placeholder="MIT" className="h-8 text-sm" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Degree">
                    <Input value={edu.degree} onChange={(e) => updateEdu(i, 'degree', e.target.value)} placeholder="B.S. Computer Science" className="h-8 text-sm" />
                  </Field>
                  <Field label="Graduation Date">
                    <Input value={edu.graduationDate} onChange={(e) => updateEdu(i, 'graduationDate', e.target.value)} placeholder="May 2020" className="h-8 text-sm" />
                  </Field>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button onClick={() => save('resume')} disabled={saving}>{saving ? 'Saving...' : 'Save Education'}</Button>
          </div>
        </TabsContent>

        {/* SKILLS TAB */}
        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills</CardTitle>
              <CardDescription>Comma-separated. The AI selects the most relevant ones per job.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Technical (languages, frameworks)">
                <Textarea
                  className="h-20 text-sm resize-none"
                  placeholder="TypeScript, React, Python, PostgreSQL, Docker..."
                  value={(resume.skills?.technical ?? []).join(', ')}
                  onChange={(e) => setResume((r) => r ? { ...r, skills: { ...r.skills, technical: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } } : r)}
                />
              </Field>
              <Field label="Tools & Platforms">
                <Textarea
                  className="h-20 text-sm resize-none"
                  placeholder="AWS, Vercel, Supabase, GitHub Actions, Figma..."
                  value={(resume.skills?.tools ?? []).join(', ')}
                  onChange={(e) => setResume((r) => r ? { ...r, skills: { ...r.skills, tools: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } } : r)}
                />
              </Field>
              <Field label="Soft Skills">
                <Textarea
                  className="h-20 text-sm resize-none"
                  placeholder="Communication, Leadership, Cross-functional collaboration..."
                  value={(resume.skills?.soft ?? []).join(', ')}
                  onChange={(e) => setResume((r) => r ? { ...r, skills: { ...r.skills, soft: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } } : r)}
                />
              </Field>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => save('resume')} disabled={saving}>{saving ? 'Saving...' : 'Save Skills'}</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      {children}
    </div>
  )
}
