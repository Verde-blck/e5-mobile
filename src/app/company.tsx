import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Container } from '@/shared/components/Container'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { CompanyLogo } from '@/shared/components/Logo'
import { LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { confirmAction } from '@/shared/lib/confirm'
import { useCan } from '@/shared/lib/permissions'
import { PRIMARY_PROBLEM_TEXT, brandFor, normaliseColour, primaryProblem } from '@/modules/branding/lib/colour'
import { LOGO_TYPES, describeCompanyError, logoProblem, validateCompany, type CompanyErrors } from '@/modules/branding/lib/validate'
import { useCompany, useRemoveLogo, useSaveCompany, useUploadLogo } from '@/modules/branding/hooks/useBranding'
import type { CompanyPatch, CompanyProfile } from '@/modules/branding/types'

type Form = { companyName: string; supportEmail: string; primaryColor: string; secondaryColor: string }

const fromProfile = (p: CompanyProfile): Form => ({ companyName: p.companyName ?? '', supportEmail: p.supportEmail ?? '', primaryColor: p.primaryColor ?? '', secondaryColor: p.secondaryColor ?? '' })

/** Some colours that are readable with white text and clearly not alarm colours. */
const SWATCHES = [
  { name: 'E5 teal', hex: '#0A6659' },
  { name: 'Blue', hex: '#0B5CAD' },
  { name: 'Indigo', hex: '#3730A3' },
  { name: 'Slate', hex: '#334155' },
  { name: 'Forest', hex: '#166534' },
]

function imageSize(uri: string): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve({})))
}

/**
 * The company's name, support address, logo and colours. Anyone signed in can see them; changing them needs administrator
 * settings. The colours are applied across the app the moment they are saved, with two safeguards (a colour white text can't be
 * read on, or one that looks like the alarm colours, is not applied) which are explained here where they are chosen.
 */
function CompanyScreen() {
  const company = useCompany()
  const canEdit = useCan('profile:write')
  const save = useSaveCompany()
  const upload = useUploadLogo()
  const removal = useRemoveLogo()
  const profile = company.data
  const [form, setForm] = useState<Form>({ companyName: '', supportEmail: '', primaryColor: '', secondaryColor: '' })
  const [errors, setErrors] = useState<CompanyErrors>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)

  // Reset the form when the saved profile really changed, not on every background refresh.
  const saved = profile ? JSON.stringify(fromProfile(profile)) : ''
  useEffect(() => {
    if (profile) setForm(fromProfile(profile))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved])

  if (company.isLoading || !profile) return <LoadingState label="Loading the company profile…" />

  const primary = normaliseColour(form.primaryColor)
  const accent = normaliseColour(form.secondaryColor)
  const issue = primaryProblem(primary)
  const preview = brandFor(primary)
  const original = fromProfile(profile)
  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => (k === 'primaryColor' || k === 'secondaryColor' ? (normaliseColour(form[k]) ?? form[k].trim()) : form[k].trim()) !== original[k])

  function submit() {
    const found = validateCompany(form)
    setErrors(found)
    setNotice(null)
    setProblem(null)
    if (Object.keys(found).length > 0) return
    // Only what changed is sent; an empty string clears a field.
    const patch: CompanyPatch = {}
    if (form.companyName.trim() !== original.companyName) patch.companyName = form.companyName.trim()
    if (form.supportEmail.trim() !== original.supportEmail) patch.supportEmail = form.supportEmail.trim()
    if ((primary ?? '') !== original.primaryColor) patch.primaryColor = primary ?? ''
    if ((accent ?? '') !== original.secondaryColor) patch.secondaryColor = accent ?? ''
    save.mutate(patch, {
      onSuccess: () => setNotice('Saved. The colours apply across the app straight away.'),
      onError: (error) => {
        const described = describeCompanyError(error)
        if (described.field && described.field !== 'logo') setErrors({ [described.field]: described.message })
        else setProblem(described.message)
      },
    })
  }

  async function chooseLogo() {
    setLogoError(null)
    setNotice(null)
    const result = await DocumentPicker.getDocumentAsync({ type: [...LOGO_TYPES], copyToCacheDirectory: true, multiple: false })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const found = logoProblem({ mimeType: asset.mimeType, name: asset.name, size: asset.size, ...(await imageSize(asset.uri)) })
    if (found) {
      setLogoError(found)
      return
    }
    upload.mutate(
      { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'image/png', file: (asset as { file?: Blob }).file },
      { onSuccess: () => setNotice('Logo updated.'), onError: (error) => setLogoError(describeCompanyError(error).message) }
    )
  }

  function askRemoveLogo() {
    confirmAction({
      title: 'Remove the logo?',
      message: 'The app goes back to showing the E5 Energy logo.',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => {
        setLogoError(null)
        removal.mutate(undefined, { onSuccess: () => setNotice('Logo removed.'), onError: (error) => setLogoError(describeCompanyError(error).message) })
      },
    })
  }

  const swatch = (hex: string | null, label: string) => <View accessibilityLabel={label} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: hex ?? '#E2E8F0', borderWidth: 1, borderColor: '#CBD5E1' }} />

  return (
    <Screen top={false}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-12 pt-3">
        <Container max={640}>
          {!canEdit ? <Text className="mb-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">You can view the company profile but not change it.</Text> : null}
          {notice ? <Text accessibilityRole="alert" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</Text> : null}

          <Card className="mb-4">
            <Text className="mb-3 font-sans-semibold text-base">Logo</Text>
            <View className="mb-3 items-center rounded-xl border border-slate-100 bg-white py-4">
              <CompanyLogo width={160} />
            </View>
            <Text className="mb-3 text-xs leading-5 text-slate-500">PNG, JPEG or WebP, up to 512 KB and 1024 px on each side. It shows on the sign-in screen and in About.</Text>
            {canEdit ? (
              <View className="flex-row gap-2">
                <Button title="Choose logo" icon="image" variant="secondary" className="h-11 flex-1" loading={upload.isPending} onPress={() => void chooseLogo()} />
                {profile.logoUrl ? <Button title="Remove" icon="trash-2" variant="secondary" className="h-11 flex-1" loading={removal.isPending} onPress={askRemoveLogo} /> : null}
              </View>
            ) : null}
            {logoError ? <Text accessibilityRole="alert" className="mt-2 text-sm text-red-600">{logoError}</Text> : null}
          </Card>

          <Card className="mb-4 gap-3">
            <TextField label="Company name" value={form.companyName} onChangeText={(companyName) => setForm({ ...form, companyName })} error={errors.companyName} editable={canEdit} maxLength={80} placeholder="E5 Energy" />
            <TextField label="Support email" value={form.supportEmail} onChangeText={(supportEmail) => setForm({ ...form, supportEmail })} error={errors.supportEmail} editable={canEdit} placeholder="support@e5energyng.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </Card>

          <Card className="mb-4">
            <Text className="mb-1 font-sans-semibold text-base">Colours</Text>
            <Text className="mb-3 text-xs leading-5 text-slate-500">The main colour is used for buttons, the active tab and links across the app. Leave both empty for the E5 look.</Text>
            <View className="flex-row items-end gap-3">
              <View className="flex-1">
                <TextField label="Main colour" value={form.primaryColor} onChangeText={(primaryColor) => setForm({ ...form, primaryColor })} error={errors.primaryColor} editable={canEdit} placeholder="#0B5CAD" autoCapitalize="none" autoCorrect={false} mono maxLength={7} />
              </View>
              <View className="pb-3">{swatch(primary, 'Main colour preview')}</View>
            </View>
            {canEdit ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {SWATCHES.map((s) => (
                  <Pressable key={s.hex} accessibilityRole="button" accessibilityLabel={`Use ${s.name}`} onPress={() => setForm({ ...form, primaryColor: s.hex })} className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 active:bg-slate-50">
                    {swatch(s.hex, '')}
                    <Text className="text-xs text-slate-600">{s.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {issue ? <Text accessibilityRole="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{PRIMARY_PROBLEM_TEXT[issue]}</Text> : null}

            <View className="mt-4 flex-row items-end gap-3">
              <View className="flex-1">
                <TextField label="Accent colour" value={form.secondaryColor} onChangeText={(secondaryColor) => setForm({ ...form, secondaryColor })} error={errors.secondaryColor} editable={canEdit} placeholder="#F28C28" autoCapitalize="none" autoCorrect={false} mono maxLength={7} />
              </View>
              <View className="pb-3">{swatch(accent, 'Accent colour preview')}</View>
            </View>
            <Text className="mt-2 text-xs leading-5 text-slate-500">Used only as a thin accent on the sign-in screen. It is never used for buttons or alarms: red and amber have to stay the most noticeable colours on screen.</Text>

            <Text className="mb-2 mt-4 text-xs text-slate-500">Preview</Text>
            <View accessibilityLabel="Colour preview" className="gap-2 rounded-xl p-3" style={{ backgroundColor: preview.tint }}>
              <View className="h-11 items-center justify-center rounded-xl" style={{ backgroundColor: preview.primary }}>
                <Text className="font-sans-semibold text-base text-white">A button</Text>
              </View>
              <View className="self-start rounded-full px-3 py-1" style={{ backgroundColor: preview.soft }}>
                <Text className="text-xs" style={{ color: preview.secondary }}>A selected chip</Text>
              </View>
            </View>
          </Card>

          {problem ? <Text accessibilityRole="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{problem}</Text> : null}
          {canEdit ? <Button title="Save" loading={save.isPending} disabled={!dirty} onPress={submit} /> : null}
        </Container>
      </ScrollView>
    </Screen>
  )
}

export default function CompanyRoute() {
  return (
    <RequirePermission permission="profile:read" fallback="/more">
      <CompanyScreen />
    </RequirePermission>
  )
}
