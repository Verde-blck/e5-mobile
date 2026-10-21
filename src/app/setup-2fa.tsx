import { SecurityScreen } from '@/modules/auth/components/SecurityScreen'

/** The only screen shown while the company requires two-step verification and this account hasn't set it up. */
export default function SetupTwoFactorRoute() {
  return <SecurityScreen forced />
}
