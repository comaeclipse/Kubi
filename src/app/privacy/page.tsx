import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Kubi",
};

export default function PrivacyPage() {
  return (
    <main className="container mx-auto py-12 px-4 md:px-8 max-w-4xl">
      <div className="space-y-6 text-sm text-foreground/80 leading-relaxed">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">Effective Date: June 29, 2026</p>
        </div>

        <p>
          Kubi is a parent-managed service that helps parents choose and control YouTube videos and channels their
          children may watch.
        </p>
        <p>
          We built Kubi to collect as little information as possible. We do not sell personal information, we do
          not run third-party ads, and we do not ask children for emails, birthdays, real names, phone numbers,
          addresses, or payment information.
        </p>
        <p>
          This Privacy Policy explains what we collect, why we collect it, how we protect it, and how parents can
          delete it.
        </p>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. Parent-managed accounts</h2>
          <p className="mb-4">
            Accounts must be created and managed by a parent or legal guardian.
          </p>
          <p>
            Parents choose the videos, channels, profiles, and settings used in the service. Children may use the
            service only with parent permission and under the parent's control.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. Information we collect</h2>
          <p className="mb-4">We collect only the information needed to provide the service.</p>

          <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Parent account information</h3>
          <p className="mb-4">When a parent creates an account, we collect:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Email address</li>
            <li>Password, stored in hashed form</li>
            <li>Subscription status</li>
            <li>Payment processor customer or subscription IDs</li>
            <li>Account settings</li>
          </ul>
          <p className="mb-4">We do not store plaintext passwords.</p>

          <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Child profile information</h3>
          <p className="mb-4">
            Parents may create child profiles. A profile name can be a nickname, initials, household label,
            random text, or any other label the parent chooses. Real names are not required.
          </p>
          <p className="mb-4">
            Because a parent may choose to enter a real name, we treat profile names as personal information and
            protect them accordingly.
          </p>
          <p className="mb-4">For child profiles, we may store:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Profile name or label</li>
            <li>Avatar color or profile settings</li>
            <li>Parent-approved channels, videos, and lists</li>
            <li>Watch history for that profile</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Watch history</h3>
          <p className="mb-4">
            We store limited watch history so the service can remember viewing progress and help parents manage
            what has been watched.
          </p>
          <p className="mb-4">
            Watch history is stored in a privacy-protective way. Our database does not store the plain YouTube
            video ID in watch-history records. Instead, we use a protected one-way identifier so the service can
            recognize progress for a video without exposing the actual YouTube video ID in raw database records.
          </p>
          <p>
            Parents can clear a child profile's watch history without deleting the child profile. Parents can
            also delete a child profile or delete the entire account.
          </p>

          <h3 className="text-lg font-medium text-foreground mt-6 mb-2">YouTube video information</h3>
          <p className="mb-4">
            We may use YouTube API Services to find, display, and cache basic YouTube video and channel
            information, such as video IDs, titles, thumbnails, channel names, and related metadata.
          </p>
          <p className="mb-4">
            We do not ask users to sign in with a YouTube or Google account, and we do not collect or store
            YouTube login credentials.
          </p>
          <p>
            Our own watch pages use internal video identifiers instead of showing the real YouTube video ID in
            the website URL where practical.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. Information we do not collect</h2>
          <p className="mb-4">We do not intentionally collect:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Children's email addresses</li>
            <li>Children's birthdays or ages</li>
            <li>Children's phone numbers</li>
            <li>Children's home addresses</li>
            <li>Comments, messages, or social posts</li>
            <li>Search history outside the parent-approved content list</li>
            <li>Full payment card numbers</li>
            <li>PayPal login credentials</li>
            <li>YouTube or Google login credentials</li>
          </ul>
          <p>
            The service does not include comments, messaging, public profiles, user uploads, or third-party
            advertising.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. How we use information</h2>
          <p className="mb-4">We use information to:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Create and secure parent accounts</li>
            <li>Keep parents signed in</li>
            <li>Provide subscriptions and billing status</li>
            <li>Let parents create and manage child profiles</li>
            <li>Let parents approve channels and videos</li>
            <li>Show approved YouTube content</li>
            <li>Save viewing progress and watch history</li>
            <li>Let parents clear watch history or delete profiles</li>
            <li>Provide customer support</li>
            <li>Maintain security and prevent misuse</li>
            <li>Comply with legal, tax, accounting, and payment obligations</li>
          </ul>
          <p>We do not use personal information for third-party advertising.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Cookies and analytics</h2>
          <p className="mb-4">
            We use cookies only for login, session, and security purposes. These cookies help keep parents signed
            in and help the service work safely.
          </p>
          <p className="mb-4">
            We use Vercel Web Analytics to understand basic site usage. Vercel Web Analytics is designed to
            provide aggregated analytics without using cookies.
          </p>
          <p>
            Embedded YouTube videos may use cookies or similar technologies controlled by YouTube or Google. We
            do not control YouTube's or Google's data practices.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. Payments</h2>
          <p className="mb-4">Payments are processed by Stripe and/or PayPal.</p>
          <p className="mb-4">
            We do not store full credit card numbers, debit card numbers, bank account numbers, or PayPal login
            credentials. Stripe and PayPal may collect and process payment information under their own privacy
            policies.
          </p>
          <p>
            We may store limited billing-related information, such as subscription status, plan, renewal or
            cancellation status, payment processor customer IDs, subscription IDs, invoice status, and related
            records needed for billing, accounting, fraud prevention, chargebacks, tax, and legal compliance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. YouTube, Google, and embedded videos</h2>
          <p className="mb-4">
            Kubi uses YouTube videos, YouTube embeds, and YouTube API Services.
          </p>
          <p className="mb-4">
            Because of this, use of YouTube content may also be subject to the{" "}
            <a className="text-primary hover:underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>{" "}
            and{" "}
            <a className="text-primary hover:underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
            YouTube and Google may collect information when YouTube content is loaded, played, or interacted
            with.
          </p>
          <p>
            We do not control YouTube's or Google's data practices. Parents should review Google's Privacy Policy
            and YouTube's Terms of Service to understand how YouTube and Google handle information.
          </p>
          <p className="mt-4">Where practical, we use privacy-protective YouTube embed options.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">8. Service providers</h2>
          <p className="mb-4">
            We use trusted service providers to operate the service, including:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Vercel for hosting, infrastructure, logs, and analytics</li>
            <li>Stripe for payment processing</li>
            <li>PayPal for payment processing</li>
            <li>YouTube/Google for YouTube videos, embeds, and YouTube API Services</li>
          </ul>
          <p>
            These services may collect and process information under their own privacy policies. We cannot control
            how Vercel, Stripe, PayPal, YouTube, or Google process information through their own services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">9. Children's privacy</h2>
          <p className="mb-4">
            Kubi is designed to be managed by parents. Parents create the account, choose approved content,
            create or delete child profiles, and control how the service is used.
          </p>
          <p className="mb-4">
            We do not require children to provide personal contact information. We do not knowingly ask children
            to provide emails, birthdays, phone numbers, addresses, or payment information.
          </p>
          <p className="mb-4">
            Parents may review, change, clear, or delete child profile information by using the account settings
            or by contacting us.
          </p>
          <p>
            If you believe a child provided information without parent permission, contact us and we will take
            appropriate steps to delete it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">10. Parent choices and deletion</h2>
          <p className="mb-4">Parents can:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Rename a child profile</li>
            <li>Clear a child profile's watch history</li>
            <li>Delete a child profile</li>
            <li>Delete the entire parent account</li>
            <li>Cancel the subscription</li>
            <li>Contact us with privacy questions or deletion requests</li>
          </ul>
          <p className="mb-4">
            When a parent clears watch history, we delete the watch-history records for that child profile.
          </p>
          <p className="mb-4">
            When a parent deletes a child profile, we delete the profile information, settings, approved lists,
            and watch history associated with that profile.
          </p>
          <p>
            When a parent deletes the entire account, we delete the parent account, child profiles, approved
            lists, watch history, and related account data, except for limited records we may need to keep for
            legal, payment, tax, accounting, security, fraud prevention, chargeback, or dispute purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">11. Data retention</h2>
          <p className="mb-4">
            We keep information only as long as reasonably necessary to provide the service, maintain security,
            comply with law, and handle billing or support issues.
          </p>
          <p className="mb-4">Our general retention practices are:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Active account data is kept while the account is active.</li>
            <li>
              Child profile data and watch history are kept until the parent clears the history, deletes the
              profile, deletes the account, or the account becomes inactive under this policy.
            </li>
            <li>
              If a paid account is canceled, we may keep account data for up to 90 days in case the parent wants
              to reactivate the account or needs support.
            </li>
            <li>
              If an account is inactive for 12 months, we may delete or de-identify parent account data, child
              profiles, approved lists, and watch history.
            </li>
            <li>
              Limited billing, tax, accounting, fraud prevention, chargeback, and legal records may be kept
              longer when necessary.
            </li>
            <li>
              Backup copies may remain for a limited time until they are overwritten or deleted in the normal
              backup cycle.
            </li>
          </ul>
          <p>We do not keep child profile data or watch history forever.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">12. Security</h2>
          <p className="mb-4">
            We use reasonable administrative, technical, and organizational measures to protect personal
            information.
          </p>
          <p className="mb-4">
            These measures include limiting the information we collect, encrypting certain account and profile
            information, using protected identifiers for watch-history records, using access controls, and
            limiting administrative access.
          </p>
          <p className="mb-4">
            Only authorized personnel may access account information. At this time, administrative access is
            limited to the site owner/admin for account and subscription support.
          </p>
          <p>
            No website or online service can guarantee perfect security, but we take privacy and security
            seriously and work to limit both the amount of information collected and who can access it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">13. International users</h2>
          <p className="mb-4">
            Kubi is operated from the United States. If you use the service from outside the United States, your
            information may be processed and stored in the United States.
          </p>
          <p>
            At this time, the service is intended for users in the United States unless otherwise stated.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">14. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. If we make important changes, we will update the
            effective date and may provide notice by email or through the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">15. Contact us</h2>
          <p>For privacy questions, account deletion, or parent requests, contact us at:</p>
          <p className="mt-3">
            <a className="text-primary hover:underline" href="mailto:owner@kubi.kids">owner@kubi.kids</a>
          </p>
        </section>
      </div>
    </main>
  );
}
