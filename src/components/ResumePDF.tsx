import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ResumeJSON } from '@/types/resume'

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: '28 42',
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  name: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    fontSize: 8.5,
    color: '#555',
    marginBottom: 8,
  },
  contactItem: { fontSize: 8.5, color: '#555' },
  separator: { color: '#ccc', marginHorizontal: 3 },
  sectionTitle: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    borderBottom: '0.75 solid #e5e7eb',
    paddingBottom: 1.5,
    marginBottom: 4,
    marginTop: 8,
    color: '#111',
  },
  summary: { fontSize: 9.5, lineHeight: 1.4, color: '#333' },
  expEntry: { marginBottom: 6 },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
  expRole: { fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  expDates: { fontSize: 8.5, color: '#666' },
  expCompany: { fontSize: 8.5, color: '#555', marginBottom: 2 },
  bullet: { flexDirection: 'row', marginBottom: 1 },
  bulletDot: { width: 9, fontSize: 9.5 },
  bulletText: { flex: 1, fontSize: 9, lineHeight: 1.35, color: '#222' },
  eduEntry: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  eduInstitution: { fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  eduDegree: { fontSize: 9, color: '#444' },
  eduDate: { fontSize: 8.5, color: '#666' },
  skillsSection: { flexDirection: 'row', gap: 12 },
  skillGroup: { flex: 1 },
  skillLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 1.5 },
  skillText: { fontSize: 8.5, color: '#333', lineHeight: 1.3 },
})

type Props = { resume: ResumeJSON }

export default function ResumePDF({ resume }: Props) {
  const { personalInfo = {} as ResumeJSON['personalInfo'], summary = '', experience = [], education = [], skills = { technical: [], soft: [], tools: [] } } = resume ?? {}
  const contactParts = [
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
    personalInfo.linkedinUrl,
    personalInfo.portfolioUrl,
  ].filter(Boolean)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{personalInfo.fullName}</Text>
        <View style={styles.contactRow}>
          {contactParts.map((part, i) => (
            <Text key={i} style={styles.contactItem}>
              {part}{i < contactParts.length - 1 ? '  ·' : ''}
            </Text>
          ))}
        </View>

        {summary && (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summary}>{summary}</Text>
          </>
        )}

        {(experience ?? []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Experience</Text>
            {(experience ?? []).map((exp, i) => (
              <View key={i} style={styles.expEntry}>
                <View style={styles.expHeader}>
                  <Text style={styles.expRole}>{exp.role}</Text>
                  <Text style={styles.expDates}>{exp.startDate} – {exp.endDate}</Text>
                </View>
                <Text style={styles.expCompany}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</Text>
                {(exp.achievements ?? []).map((ach, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{ach}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {(education ?? []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Education</Text>
            {(education ?? []).map((edu, i) => (
              <View key={i} style={styles.eduEntry}>
                <View>
                  <Text style={styles.eduInstitution}>{edu.institution}</Text>
                  <Text style={styles.eduDegree}>{edu.degree}</Text>
                </View>
                <Text style={styles.eduDate}>{edu.graduationDate}</Text>
              </View>
            ))}
          </>
        )}

        {((skills?.technical ?? []).length > 0 || (skills?.tools ?? []).length > 0 || (skills?.soft ?? []).length > 0) && (
          <>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsSection}>
              {(skills?.technical ?? []).length > 0 && (
                <View style={styles.skillGroup}>
                  <Text style={styles.skillLabel}>Technical</Text>
                  <Text style={styles.skillText}>{(skills.technical ?? []).join(', ')}</Text>
                </View>
              )}
              {(skills?.tools ?? []).length > 0 && (
                <View style={styles.skillGroup}>
                  <Text style={styles.skillLabel}>Tools</Text>
                  <Text style={styles.skillText}>{(skills.tools ?? []).join(', ')}</Text>
                </View>
              )}
              {(skills?.soft ?? []).length > 0 && (
                <View style={styles.skillGroup}>
                  <Text style={styles.skillLabel}>Soft Skills</Text>
                  <Text style={styles.skillText}>{(skills.soft ?? []).join(', ')}</Text>
                </View>
              )}
            </View>
          </>
        )}
      </Page>
    </Document>
  )
}
