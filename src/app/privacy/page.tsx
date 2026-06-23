import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Kubi",
};

export default function PrivacyPage() {
  return (
    <main className="container mx-auto py-12 px-4 md:px-8 max-w-4xl">
      <div className="space-y-6 text-sm text-foreground/80 leading-relaxed">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">PRIVACY POLICY</h1>
          <p className="text-muted-foreground">Last updated June 22, 2026</p>
        </div>

        <section>
          <p className="mb-4">
            This Privacy Notice for Kubi Kids ("we," "us," or "our") describes how and why we collect, store, use,
            and/or share ("process") your personal information when you use our services (the "Services"), including
            when you visit our website at{" "}
            <a className="text-primary hover:underline" target="_blank" href="https://kubi.kids">https://kubi.kids</a>,
            create an account, or otherwise engage with us.
          </p>
          <p className="mb-4">
            Reading this Privacy Notice will help you understand your privacy rights and choices. If you do not agree
            with our policies and practices, please do not use our Services. If you have questions, contact us at{" "}
            <a className="text-primary hover:underline" href="mailto:owner@kubi.kids">owner@kubi.kids</a>.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-muted/40 p-5">
          <h2 className="text-lg font-semibold text-foreground mb-3">The short version</h2>
          <p className="mb-3 text-muted-foreground">Here's the plain-English summary. The full notice below is the official version, but this is the gist:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>To make an account, all we need is your <strong>email and a password</strong>. We encrypt your email, and we only store a scrambled (hashed) version of your password — even we can't read it.</li>
            <li>When you set up a profile for a kid, you choose a <strong>display name and an avatar color</strong>. The name doesn't have to be real — "Junior" or "Boo Boo" is perfectly fine.</li>
            <li>We remember <strong>watch progress and playlists</strong> so the app works, and our host (Vercel) logs basic technical info like your IP address and which page you visited.</li>
            <li>We <strong>don't sell your data, don't show ads, and don't track you</strong> around the internet.</li>
            <li>Payments go <strong>straight to Stripe and PayPal</strong> — we never see your card number.</li>
            <li>You can <strong>see, change, or delete</strong> your information anytime — just email us at owner@kubi.kids.</li>
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-muted/40 p-5">
          <h2 className="text-lg font-semibold text-foreground mb-3">Children's privacy</h2>
          <p className="mb-3">
            Kubi uses a parent-managed model: one adult owns the account and sets up a profile for each person who
            watches. We've designed it so that children never interact with us directly.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Only an <strong>adult (18 or older)</strong> can create an account, and only the account holder creates and manages the profiles on it.</li>
            <li>Children do not sign up, log in, or provide information to us. The <strong>parent or guardian provides everything</strong> on the child's behalf and consents to its use.</li>
            <li>The only things attached to a child's profile are a <strong>display name and an avatar color</strong>. The display name does not need to be a real name — a nickname like "Junior" works great, and we encourage it. Profile names are encrypted at rest.</li>
            <li>Because a parent or guardian sets up and controls every profile, they can <strong>review, change, or delete</strong> a profile and everything tied to it (such as watch history) at any time from account settings or by emailing us.</li>
            <li>If you believe a child provided us personal information without a parent's or guardian's involvement, email us at owner@kubi.kids and we will delete it.</li>
          </ul>
        </section>

        <section id="infocollect">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. WHAT INFORMATION DO WE COLLECT?</h2>
          <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Information you provide</h3>
          <p className="mb-4">We collect only the information needed to run the Services:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Email address</strong> — used to sign in and to contact you. It is encrypted at rest.</li>
            <li><strong>Password</strong> — stored only as a securely salted, one-way hash. We never store, see, or have access to your password in readable form.</li>
            <li><strong>Children's profiles</strong> — the display name and avatar color you choose for each child profile. Profile names are encrypted at rest.</li>
          </ul>
          <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Information created as you use the Services</h3>
          <p className="mb-4">As you and your children use the Services, we store the basic activity needed to make features work — such as watch progress, playlists, and which channels you have enabled.</p>
          <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Information collected automatically</h3>
          <p className="mb-4">Our hosting provider (Vercel) automatically collects limited technical information when you visit, such as your IP address, approximate location (country), and the pages you view. We use this only to operate, secure, and understand usage of the Services — not for advertising.</p>
          <p className="mb-4"><strong>Sensitive information.</strong> We do not collect or process sensitive information.</p>
          <p className="mb-4">
            <strong>Payment data.</strong> If you subscribe, your payment details are collected and stored directly by our
            payment processors (Stripe and PayPal); we never receive or store your full card number. We retain only the
            identifiers needed to manage your subscription (such as a customer or subscription ID) and your subscription
            status. You can review Stripe's privacy notice at{" "}
            <a className="text-primary hover:underline" target="_blank" href="https://stripe.com/privacy">https://stripe.com/privacy</a>{" "}
            and PayPal's at{" "}
            <a className="text-primary hover:underline" target="_blank" href="https://www.paypal.com/us/legalhub/privacy-full">https://www.paypal.com/us/legalhub/privacy-full</a>.
          </p>
          <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Google API</h3>
          <p className="mb-4">
            Our use of information received from Google APIs adheres to the{" "}
            <a className="text-primary hover:underline" href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">Google API Services User Data Policy</a>,
            including the{" "}
            <a className="text-primary hover:underline" href="https://developers.google.com/terms/api-services-user-data-policy#limited-use" rel="noopener noreferrer" target="_blank">Limited Use requirements</a>.
          </p>
        </section>

        <section id="infouse">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. HOW DO WE PROCESS YOUR INFORMATION?</h2>
          <p className="mb-4">We process your information to provide, improve, and administer our Services, to communicate with you, for security and fraud prevention, and to comply with the law. Specifically, we process your information to:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Create and manage your account</strong> so you can log in and keep your account in working order.</li>
            <li><strong>Deliver the Services</strong> you have requested.</li>
            <li><strong>Protect a person's vital interests,</strong> such as to prevent harm.</li>
          </ul>
          <p className="mb-4">We may also process your information for other purposes with your consent.</p>
        </section>

        <section id="legalbases">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. WHAT LEGAL BASES DO WE RELY ON?</h2>
          <p className="mb-4">We only process your personal information when we have a valid legal reason to do so.</p>
          <p className="mb-4"><strong>If you are located in the EU or UK,</strong> we rely on one of the following legal bases:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Consent</strong> — where you have given us permission for a specific purpose. You can withdraw your consent at any time.</li>
            <li><strong>Performance of a contract</strong> — where processing is necessary to provide the Services to you.</li>
            <li><strong>Legal obligations</strong> — where processing is necessary to comply with the law.</li>
            <li><strong>Vital interests</strong> — where processing is necessary to protect your or another person's safety.</li>
          </ul>
          <p className="mb-4"><strong>If you are located in Canada,</strong> we process your information where you have given express or implied consent, or where we are otherwise permitted to do so under applicable law. You can withdraw your consent at any time.</p>
        </section>

        <section id="whoshare">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. WHEN AND WITH WHOM DO WE SHARE YOUR INFORMATION?</h2>
          <p className="mb-4">We share your personal information only with the service providers we rely on to operate the Services — such as our hosting, database, and payment providers — and only to the extent they need it to perform that work for us. We do not share your information with anyone else, and we do not allow these providers to use it for their own purposes.</p>
          <p className="mb-4"><strong>We have never sold, rented, or traded your personal information, and we never will.</strong> We do not share it for advertising, and we will not transfer it to any third party for that third party's own use. This is a permanent commitment — not a current preference we might change later.</p>
        </section>

        <section id="cookies">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. DO WE USE COOKIES AND TRACKING TECHNOLOGIES?</h2>
          <p className="mb-4">
            We use cookies and similar technologies only as needed to maintain the security of the Services and your
            account, remember your preferences, and keep basic site functions working. We do not use cookies for
            targeted advertising and we do not sell or share your information with advertisers.
          </p>
          <p className="mb-4">
            <strong>Login session cookie.</strong> To keep you signed in, we set a single strictly necessary cookie that
            stores a secure session token. It expires 30 days after you sign in, after which you will need to log in
            again. This cookie is essential for you to access your account and is not used for tracking.
          </p>
          <p className="mb-4">
            Most browsers let you remove or reject cookies; doing so may log you out or affect certain features of the
            Services.
          </p>
        </section>

        <section id="inforetain">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. HOW LONG DO WE KEEP YOUR INFORMATION?</h2>
          <p className="mb-4">We keep your personal information only for as long as necessary for the purposes set out in this notice — generally for as long as you have an account with us — unless a longer period is required or permitted by law. When we no longer need your information, we will delete or anonymize it, or securely store and isolate it until deletion is possible.</p>
        </section>

        <section id="infosafe">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. HOW DO WE KEEP YOUR INFORMATION SAFE?</h2>
          <p className="mb-4">We have implemented reasonable technical and organizational measures to protect your personal information. However, no transmission over the internet or method of storage is 100% secure, so we cannot guarantee absolute security. Transmission of personal information to and from our Services is at your own risk, and you should only access the Services within a secure environment.</p>
        </section>

        <section id="privacyrights">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">8. WHAT ARE YOUR PRIVACY RIGHTS?</h2>
          <p className="mb-4">Depending on where you live, you may have rights to request access to, correction of, or deletion of your personal information, to request a copy of it, to restrict or object to its processing, and to withdraw any consent you have given. You can exercise these rights by emailing us at{" "}
            <a className="text-primary hover:underline" href="mailto:owner@kubi.kids">owner@kubi.kids</a>. We will respond in accordance with applicable data protection laws.</p>
          <p className="mb-4">If you are located in the EEA or UK and believe we are unlawfully processing your information, you have the right to complain to your local data protection authority. If you are located in Switzerland, you may contact the Federal Data Protection and Information Commissioner.</p>
          <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Account information</h3>
          <p className="mb-4">You can review or change the information in your account, or terminate your account, by logging in to your account settings. Upon termination we will deactivate or delete your account, though we may retain limited information to prevent fraud, comply with legal requirements, or enforce our terms.</p>
        </section>

        <section id="DNT">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">9. CONTROLS FOR DO-NOT-TRACK FEATURES</h2>
          <p className="mb-4">Most browsers include a Do-Not-Track ("DNT") feature. Because no uniform standard for recognizing DNT signals has been finalized, we do not currently respond to them. If a standard is adopted in the future, we will update this notice accordingly.</p>
        </section>

        <section id="uslaws">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">10. DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?</h2>
          <p className="mb-4">If you are a resident of a US state with a comprehensive privacy law (such as California, Colorado, Connecticut, Florida, Texas, Virginia, and others), you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>know whether we are processing your personal data and access it;</li>
            <li>correct inaccuracies in your personal data;</li>
            <li>request deletion of your personal data;</li>
            <li>obtain a copy of the data you previously shared with us; and</li>
            <li>not be discriminated against for exercising your rights.</li>
          </ul>
          <p className="mb-4">We collect identifiers such as your email address and account credentials, the profile information you set up for your children, and limited technical data such as your IP address. We have not sold or shared personal information for targeted advertising in the preceding twelve (12) months, and we will not do so in the future.</p>
          <p className="mb-4">To exercise these rights, email us at{" "}
            <a className="text-primary hover:underline" href="mailto:owner@kubi.kids">owner@kubi.kids</a>. We will verify your identity before acting on your request. If we decline a request, you may appeal by emailing us at the same address.</p>
        </section>

        <section id="policyupdates">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">11. DO WE MAKE UPDATES TO THIS NOTICE?</h2>
          <p className="mb-4">We may update this Privacy Notice from time to time. The updated version will be indicated by a revised "Last updated" date at the top. If we make material changes, we may notify you by posting a prominent notice or by contacting you directly.</p>
        </section>

        <section id="contact">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">12. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</h2>
          <p className="mb-4">If you have questions or comments about this notice, you may email us at{" "}
            <a className="text-primary hover:underline" href="mailto:owner@kubi.kids">owner@kubi.kids</a>.</p>
        </section>

        <section id="request">
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">13. HOW CAN YOU REVIEW, UPDATE, OR DELETE YOUR DATA?</h2>
          <p className="mb-4">Depending on the laws of your country or US state of residence, you may have the right to request access to, correction of, or deletion of the personal information we collect, and to withdraw your consent to our processing of it. To make such a request, email us at{" "}
            <a className="text-primary hover:underline" href="mailto:owner@kubi.kids">owner@kubi.kids</a>.</p>
        </section>
      </div>
    </main>
  );
}
