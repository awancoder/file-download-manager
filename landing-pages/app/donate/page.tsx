import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Heart, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function DonatePage() {
  return (
    <div className="w-full">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-border z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
            <ArrowLeft className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-foreground">Support Us</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="max-w-4xl mx-auto text-center">
          <Heart className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
            Support File Download Manager
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            File Download Manager is free and always will be. Your donations help us continue development, improve features, and keep the service ad-free for everyone.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>100% goes to development</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>Transparent & traceable</span>
            </div>
          </div>
        </div>
      </section>

      {/* Donation Tiers */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">
            Choose Your Support Level
          </h2>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                amount: '$5',
                title: 'Coffee',
                description: 'Buy us a coffee',
                benefits: [
                  'Support ongoing development',
                  'Your name in supporters list (optional)',
                ],
              },
              {
                amount: '$25',
                title: 'Supporter',
                description: 'Regular supporter',
                benefits: [
                  'Everything in Coffee',
                  'Supporter badge in community',
                  'Monthly progress reports',
                  'Priority support',
                ],
                featured: true,
              },
              {
                amount: '$100',
                title: 'Contributor',
                description: 'Major contributor',
                benefits: [
                  'Everything in Supporter',
                  'Dedicated supporter page',
                  'Influence on roadmap',
                  'Beta access to new features',
                ],
              },
              {
                amount: 'Custom',
                title: 'Patron',
                description: 'For corporate sponsors',
                benefits: [
                  'Everything in Contributor',
                  'Company logo on website',
                  'Custom sponsorship package',
                  'Direct contact with team',
                ],
              },
            ].map((tier, idx) => (
              <Card
                key={idx}
                className={`border-0 shadow-sm hover:shadow-md transition flex flex-col ${
                  tier.featured ? 'ring-2 ring-primary md:scale-105' : ''
                }`}
              >
                <CardHeader>
                  {tier.featured && (
                    <div className="text-xs font-semibold text-white bg-primary px-3 py-1 rounded-full w-fit mb-4">
                      Most Popular
                    </div>
                  )}
                  <div className="text-3xl font-bold text-primary mb-2">{tier.amount}</div>
                  <CardTitle className="text-xl">{tier.title}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 mb-6 flex-1">
                    {tier.benefits.map((benefit, bidx) => (
                      <li key={bidx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={tier.featured ? 'default' : 'outline'}>
                    Donate {tier.amount !== 'Custom' ? tier.amount : 'Now'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">
            Payment Methods
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: 'PayPal',
                description: 'Secure payments worldwide',
                icon: '💳',
              },
              {
                name: 'Stripe',
                description: 'Credit & debit cards',
                icon: '🏦',
              },
              {
                name: 'Crypto',
                description: 'Bitcoin & Ethereum',
                icon: '₿',
              },
              {
                name: 'Bank Transfer',
                description: 'Direct bank donation',
                icon: '🏛️',
              },
            ].map((method, idx) => (
              <Card key={idx} className="border-0 bg-white shadow-sm text-center hover:shadow-md transition">
                <CardContent className="pt-8">
                  <div className="text-4xl mb-4">{method.icon}</div>
                  <h3 className="font-semibold text-foreground mb-2">{method.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6">{method.description}</p>
                  <Button variant="outline" className="w-full">
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-12 p-8 bg-white rounded-xl border border-border">
            <h3 className="font-semibold text-foreground mb-4">All payment methods are secure & encrypted</h3>
            <p className="text-muted-foreground mb-4">
              We use industry-standard payment processors (PayPal, Stripe) to ensure your financial information is secure. Your transaction is encrypted and your data is never shared with third parties.
            </p>
            <p className="text-sm text-muted-foreground">
              Donations are non-refundable but tax-deductible in some jurisdictions. We can provide documentation upon request.
            </p>
          </div>
        </div>
      </section>

      {/* How Donations Help */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">
            How Your Donation Helps
          </h2>
          <div className="space-y-8">
            {[
              {
                title: 'Feature Development',
                description: 'Your donations directly fund new features like advanced scheduling, cloud sync, and API access.',
                impact: '40%',
              },
              {
                title: 'Bug Fixes & Performance',
                description: 'We invest in stability improvements and optimization to make downloads faster and more reliable.',
                impact: '30%',
              },
              {
                title: 'Infrastructure & Servers',
                description: 'Maintaining our servers and infrastructure to keep the application running smoothly for everyone.',
                impact: '20%',
              },
              {
                title: 'Community Support',
                description: 'Supporting the community, documentation, tutorials, and helping users get the best experience.',
                impact: '10%',
              },
            ].map((item, idx) => (
              <Card key={idx} className="border-0 bg-white shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary/10">
                        <span className="text-lg font-bold text-primary">{item.impact}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Donor Leaderboard */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-4">
            Our Top Supporters
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Thank you to our amazing community of donors who make this project possible. Your generosity funds our development and keeps File Download Manager free for everyone.
          </p>
          
          <div className="space-y-4">
            {[
              { rank: 1, name: 'Alex Chen', amount: '$5,000', badge: 'Patron', date: '2 months ago' },
              { rank: 2, name: 'Maria Rodriguez', amount: '$2,500', badge: 'Contributor', date: '1 month ago' },
              { rank: 3, name: 'John Smith', amount: '$1,500', badge: 'Contributor', date: '3 weeks ago' },
              { rank: 4, name: 'TechCorp Inc.', amount: '$1,200', badge: 'Patron', date: '2 weeks ago' },
              { rank: 5, name: 'Emma Wilson', amount: '$750', badge: 'Supporter', date: '2 weeks ago' },
              { rank: 6, name: 'David Park', amount: '$500', badge: 'Supporter', date: '1 week ago' },
              { rank: 7, name: 'Lisa Thompson', amount: '$500', badge: 'Supporter', date: '5 days ago' },
              { rank: 8, name: 'James Anderson', amount: '$350', badge: 'Supporter', date: '3 days ago' },
              { rank: 9, name: 'Sophie Laurent', amount: '$250', badge: 'Coffee', date: '2 days ago' },
              { rank: 10, name: 'Michael Chang', amount: '$200', badge: 'Coffee', date: 'Today' },
            ].map((donor) => (
              <div
                key={donor.rank}
                className="flex items-center justify-between p-6 bg-white rounded-lg border border-border hover:shadow-md transition"
              >
                <div className="flex items-center gap-6 flex-1">
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      donor.rank === 1 ? 'bg-yellow-500' :
                      donor.rank === 2 ? 'bg-gray-400' :
                      donor.rank === 3 ? 'bg-orange-600' :
                      'bg-primary'
                    }`}>
                      #{donor.rank}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{donor.name}</h3>
                    <p className="text-sm text-muted-foreground">{donor.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-lg font-bold text-primary">{donor.amount}</div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      donor.badge === 'Patron' ? 'bg-purple-100 text-purple-700' :
                      donor.badge === 'Contributor' ? 'bg-blue-100 text-blue-700' :
                      donor.badge === 'Supporter' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {donor.badge}
                    </span>
                  </div>
                  <div className="sm:hidden text-right">
                    <div className="text-base font-bold text-primary">{donor.amount}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-8 bg-primary/5 rounded-xl border border-primary/20 text-center">
            <p className="text-foreground font-semibold mb-2">
              Want to see your name here?
            </p>
            <p className="text-muted-foreground mb-6">
              Join our growing community of supporters and help shape the future of File Download Manager.
            </p>
            <Button className="gap-2">
              <Heart className="w-5 h-5" />
              Become a Donor
            </Button>
          </div>
        </div>
      </section>

      {/* Donation Benefits */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">
            Donor Benefits
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'Recognition',
                items: [
                  'Your name on our supporters page',
                  'Badge in our community forums',
                  'Special thank you email',
                ],
              },
              {
                title: 'Exclusive Access',
                items: [
                  'Beta access to new features',
                  'Priority support channel',
                  'Early access to announcements',
                ],
              },
              {
                title: 'Impact',
                items: [
                  'Direct influence on roadmap',
                  'Monthly progress reports',
                  'Transparent budget breakdown',
                ],
              },
              {
                title: 'Community',
                items: [
                  'Join exclusive Discord channel',
                  'Monthly community calls',
                  'Direct access to developers',
                ],
              },
            ].map((benefit, idx) => (
              <Card key={idx} className="border-0 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {benefit.items.map((item, iidx) => (
                      <li key={iidx} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Transparency Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-8 sm:p-12 border border-primary/20">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Full Transparency
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              We believe in complete transparency about how donations are used. Every month, we publish a detailed breakdown of:
            </p>
            <ul className="space-y-4 mb-8">
              {[
                'Total donations received',
                'Operating expenses',
                'Development costs',
                'Team salaries and time',
                'Infrastructure costs',
                'Roadmap priorities funded by donors',
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Button size="lg">
              View Latest Financial Report
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">
            Donation FAQ
          </h2>
          <div className="space-y-6">
            {[
              {
                question: 'Is my donation tax-deductible?',
                answer: 'File Download Manager is registered as a non-profit organization. Donations may be tax-deductible depending on your jurisdiction. We can provide a receipt and documentation for your records.',
              },
              {
                question: 'Can I cancel my recurring donation?',
                answer: 'Yes, you can cancel anytime through your payment provider. No questions asked. We appreciate your support while you were able to contribute.',
              },
              {
                question: 'Is my payment information secure?',
                answer: 'We use industry-standard encryption and trusted payment processors. We never store your full payment details. All transactions are PCI-DSS compliant.',
              },
              {
                question: 'What if I want to donate more than listed?',
                answer: 'Absolutely! You can choose any custom amount. Click the "Custom" tier and enter your desired amount.',
              },
              {
                question: 'How will I know my donation was received?',
                answer: 'You&apos;ll receive a confirmation email immediately after your donation. We also send monthly impact reports to all donors.',
              },
              {
                question: 'Can companies donate?',
                answer: 'Yes! Corporate donations are welcome. We can create custom sponsorship packages. Contact support@filedownloadmanager.com for details.',
              },
            ].map((item, idx) => (
              <Card key={idx} className="border-0 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{item.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
            Every Donation Counts
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Whether it&apos;s $1 or $1,000, your support helps us build the best download manager for everyone.
          </p>
          <Button size="lg" className="gap-2 mb-8">
            <Heart className="w-5 h-5" />
            Make a Donation
          </Button>
          <p className="text-muted-foreground">
            Can&apos;t donate right now? Help us by sharing File Download Manager with friends and family!
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground/5 border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-foreground mb-2">File Download Manager</h3>
              <p className="text-sm text-muted-foreground">
                Free, fast, and secure download management for everyone.
              </p>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition">Back to Home</Link>
              <a href="#" className="hover:text-foreground transition">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition">Terms of Service</a>
            </div>
          </div>
          <div className="border-t border-border pt-8">
            <p className="text-center text-sm text-muted-foreground">
              &copy; 2024 File Download Manager. All rights reserved. Thank you for your support!
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
