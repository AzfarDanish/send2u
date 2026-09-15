import { LegalDocument } from '@/components/LegalDocument';
import { PRIVACY_POLICY } from '@/lib/legal-content';

/** In-app v1 Privacy Policy, drafted from actual Send2U behavior. */
export default function PrivacyScreen() {
  return <LegalDocument title="Privacy Policy" sections={PRIVACY_POLICY} />;
}
