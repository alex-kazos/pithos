import { LegalPageLayout } from './LegalPageLayout';
import { TERMS_OF_SERVICE_MARKDOWN } from '../../data/legalContent';

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      description="The terms governing your use of StockPilot, including your account, your data, and acceptable use."
      markdown={TERMS_OF_SERVICE_MARKDOWN}
    />
  );
}
