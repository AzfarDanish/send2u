import { LegalDocument } from '@/components/LegalDocument';
import { TERMS_OF_SERVICE } from '@/lib/legal-content';

/** In-app v1 Terms of Service, drafted from actual Send2U behavior. */
export default function TermsScreen() {
  return <LegalDocument title="Terms of Service" sections={TERMS_OF_SERVICE} />;
}
