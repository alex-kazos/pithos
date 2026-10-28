import { LegalPageLayout } from './LegalPageLayout';
import { PRIVACY_POLICY_MARKDOWN } from '../../data/legalContent';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="How StockPilot collects, uses, and protects your data, including store data accessed via Shopify/WooCommerce and data shared with Firebase and OpenAI."
      markdown={PRIVACY_POLICY_MARKDOWN}
    />
  );
}
