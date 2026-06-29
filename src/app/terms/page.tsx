import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Kubi",
};

export default function TermsPage() {
  return (
    <main className="container mx-auto py-12 px-4 md:px-8 max-w-4xl">
      <div className="space-y-6 text-sm text-foreground/80 leading-relaxed">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-muted-foreground">Effective Date: June 29, 2026</p>
        </div>

        <p>
          These Terms of Service explain the rules for using Kubi. By creating an account, subscribing, or using
          the service, you agree to these Terms.
        </p>
        <p>If you do not agree, do not use the service.</p>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. What Kubi is</h2>
          <p className="mb-4">
            Kubi is a parent-managed tool that helps parents choose and control YouTube videos and channels their
            children may watch.
          </p>
          <p className="mb-4">
            The service is designed for parents and legal guardians. Parents create the account, choose approved
            content, create child profiles, manage settings, and decide whether the service is appropriate for
            their child.
          </p>
          <p>Kubi is not a replacement for parental supervision.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. Parent responsibility</h2>
          <p className="mb-4">You are responsible for:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Creating and managing your account</li>
            <li>Choosing which videos, channels, and lists are approved</li>
            <li>Reviewing any YouTube content you add manually</li>
            <li>Deciding whether content is appropriate for your child</li>
            <li>Supervising how your child uses the service</li>
            <li>Keeping your login information secure</li>
          </ul>
          <p>Children may use the service only with permission from a parent or legal guardian.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. YouTube content and third-party services</h2>
          <p className="mb-4">
            Kubi relies on third-party services, including YouTube, Google, Vercel, Stripe, and PayPal.
          </p>
          <p className="mb-4">
            Because of this, parts of the service may change, stop working, become unavailable, or display
            differently at any time. This can happen without notice and may be outside our control.
          </p>
          <p className="mb-4">
            YouTube videos, thumbnails, titles, channels, availability, restrictions, ads, playback behavior, and
            metadata are controlled by YouTube and/or Google, not by Kubi.
          </p>
          <p>
            By using features that include YouTube content, you also agree to the YouTube Terms of Service and
            understand that Google's Privacy Policy may apply.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. Manually added content</h2>
          <p className="mb-4">Parents may manually add YouTube channels or videos.</p>
          <p className="mb-4">
            If you manually add content, you are responsible for reviewing that content and deciding whether it is
            appropriate. We are not responsible for the content, accuracy, safety, age-appropriateness, ads,
            changes, removals, or availability of YouTube videos or channels you choose to add.
          </p>
          <p>YouTube content can change or become unavailable after you add it.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Preconfigured content lists</h2>
          <p className="mb-4">
            Kubi may provide preconfigured channel or video lists to help parents get started.
          </p>
          <p className="mb-4">
            These lists are provided for convenience only. We do not guarantee that every video on a channel,
            every future upload, or every related piece of YouTube content will be appropriate for every child or
            family.
          </p>
          <p>Parents remain responsible for reviewing and approving content.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. Subscriptions, billing, and cancellation</h2>
          <p className="mb-4">Some features may require a paid subscription.</p>
          <p className="mb-4">
            Subscriptions may renew automatically unless canceled before the next billing date. The price, billing
            period, and renewal terms will be shown at checkout or in the account/subscription area.
          </p>
          <p className="mb-4">
            Payments are processed by Stripe and/or PayPal. We do not store full payment card numbers or PayPal
            login credentials.
          </p>
          <p className="mb-4">
            You may cancel your subscription through the account/subscription page or by contacting us at{" "}
            <a className="text-primary hover:underline" href="mailto:owner@kubi.kids">owner@kubi.kids</a>.
          </p>
          <p>Canceling a subscription stops future billing but does not automatically refund past payments.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. Refunds</h2>
          <p className="mb-4">
            Subscription payments are generally non-refundable unless required by law or expressly stated
            otherwise.
          </p>
          <p className="mb-4">We do not provide refunds or credits for:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Time when the service is unavailable</li>
            <li>YouTube, Google, Vercel, Stripe, PayPal, or other third-party outages</li>
            <li>YouTube videos, channels, or embeds becoming unavailable</li>
            <li>A parent choosing to remove content or delete an account</li>
            <li>A parent failing to cancel before renewal</li>
            <li>Partial billing periods</li>
            <li>Features changing or being discontinued</li>
          </ul>
          <p>
            If we choose to provide a refund, that does not mean we are required to provide the same refund in
            the future.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">8. Account deletion</h2>
          <p className="mb-4">You may delete your account through the service or by contacting us.</p>
          <p>
            Deleting your account may permanently remove parent account data, child profiles, approved lists,
            watch history, and related settings, except for limited records we may need to keep for billing, tax,
            accounting, fraud prevention, chargebacks, security, dispute resolution, or legal compliance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">9. Acceptable use</h2>
          <p className="mb-4">You agree not to misuse the service.</p>
          <p className="mb-4">You may not:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Hack, attack, overload, disrupt, or interfere with the service</li>
            <li>Try to access another user's account or data</li>
            <li>Bypass security, account limits, subscription limits, or access controls</li>
            <li>Scrape, copy, harvest, or mass-download data from the service</li>
            <li>Reverse engineer or attempt to extract private code, keys, or systems</li>
            <li>Use the service for illegal, harmful, abusive, or fraudulent activity</li>
            <li>Use the service to infringe copyrights or other rights</li>
            <li>Resell, sublicense, or commercially exploit the service without permission</li>
            <li>Share your account publicly or use it in a way that abuses the platform</li>
            <li>Submit false payment information or abuse trials, promotions, or refunds</li>
          </ul>
          <p>
            We may suspend or terminate accounts that violate these Terms or create risk for the service, other
            users, third-party providers, or us.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">10. No guarantee of uninterrupted service</h2>
          <p className="mb-4">
            We try to keep the service working, but we do not guarantee that it will always be available,
            uninterrupted, secure, or error-free.
          </p>
          <p className="mb-4">
            The service may be affected by maintenance, bugs, outages, internet problems, third-party service
            changes, YouTube API changes, payment processor issues, hosting provider issues, legal requirements,
            or other events outside our control.
          </p>
          <p>We may change, limit, suspend, or discontinue any part of the service at any time.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">11. Privacy</h2>
          <p>
            Your use of the service is also governed by our{" "}
            <a className="text-primary hover:underline" href="/privacy">Privacy Policy</a>.
            Please review the Privacy Policy to understand what information we collect, how we use it, how we
            protect it, and how parents can delete account or child profile data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">12. Ownership</h2>
          <p className="mb-4">
            Kubi, including its design, code, branding, text, features, and systems, belongs to Kubi Kids or its
            licensors.
          </p>
          <p className="mb-4">
            YouTube videos and related YouTube content belong to YouTube, Google, creators, or other rights
            holders. We do not own YouTube content.
          </p>
          <p>These Terms do not give you ownership of Kubi or any YouTube content.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">13. Feedback</h2>
          <p>
            If you send us ideas, suggestions, bug reports, or feedback, you allow us to use that feedback
            without owing you payment or credit.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">14. Disclaimers</h2>
          <p className="mb-4">The service is provided "as is" and "as available."</p>
          <p className="mb-4">We do not promise that:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>The service will always work</li>
            <li>YouTube videos will always play</li>
            <li>YouTube content will always be available</li>
            <li>Every video or channel will be appropriate for every child</li>
            <li>Third-party services will continue supporting the service</li>
            <li>The service will meet every family's needs</li>
          </ul>
          <p>
            Parents are responsible for deciding whether the service and any content are appropriate for their
            household.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">15. Limitation of liability</h2>
          <p className="mb-4">
            To the fullest extent allowed by law, Kubi and its owner/operators will not be liable for indirect,
            incidental, special, consequential, or punitive damages, including lost time, lost data, lost access,
            lost profits, subscription interruptions, third-party outages, or unavailable YouTube content.
          </p>
          <p className="mb-4">
            To the fullest extent allowed by law, our total liability for any claim related to the service will
            not exceed the amount you paid to Kubi in the three months before the claim arose.
          </p>
          <p>
            Some laws may not allow certain limits of liability, so some of these limits may not apply to you.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">16. Indemnification</h2>
          <p className="mb-4">
            You agree to defend and hold harmless Kubi and its owner/operators from claims, damages, losses,
            liabilities, and expenses arising from:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your misuse of the service</li>
            <li>Your violation of these Terms</li>
            <li>Content you choose to add, approve, or share through the service</li>
            <li>Your violation of law or third-party rights</li>
            <li>Your child's use of the service under your account</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">17. Termination</h2>
          <p className="mb-4">You may stop using the service at any time.</p>
          <p className="mb-4">We may suspend or terminate your account if:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>You violate these Terms</li>
            <li>Your payment fails or your subscription ends</li>
            <li>You misuse or abuse the service</li>
            <li>Your use creates legal, security, operational, or third-party-service risk</li>
            <li>We are required to do so by law or by a third-party provider</li>
          </ul>
          <p>Termination may result in loss of access to the service and account data.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">18. Changes to these Terms</h2>
          <p className="mb-4">We may update these Terms from time to time.</p>
          <p>
            If we make important changes, we may notify you by email, through the service, or by posting the
            updated Terms. Continued use of the service after changes means you accept the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">19. Governing law</h2>
          <p>
            These Terms are governed by the laws of the State of Florida, without regard to conflict-of-law
            rules.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">20. Contact</h2>
          <p>Questions about these Terms can be sent to:</p>
          <p className="mt-3">
            <a className="text-primary hover:underline" href="mailto:owner@kubi.kids">owner@kubi.kids</a>
          </p>
        </section>
      </div>
    </main>
  );
}
