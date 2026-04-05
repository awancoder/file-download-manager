import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Download,
  Zap,
  Shield,
  Globe,
  Settings,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Mail,
  Heart,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="w-full">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-border z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Download className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">File Download Manager</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition">
              Features
            </a>
            <a href="#guide" className="text-sm text-muted-foreground hover:text-foreground transition">
              How it Works
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition">
              FAQ
            </a>
            <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition">
              Contact
            </a>
            <Link href="/donate">
              <Button variant="outline" size="sm">
                Donate
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Download Faster, Smarter, Safer
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Manage all your downloads in one powerful application. With support for HTTP, HTTPS, and torrents, you&apos;ll get faster speeds and better control.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="gap-2">
                <Download className="w-5 h-5" />
                Download Now
              </Button>
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>100% Free</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>Open Source</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>No Ads</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-full max-w-sm aspect-square rounded-2xl bg-gradient-to-br from-secondary to-primary/20 p-8 flex items-center justify-center shadow-2xl">
              <Download className="w-32 h-32 text-primary opacity-30" />
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">
            Why Choose File Download Manager?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 bg-white shadow-sm hover:shadow-md transition">
              <CardHeader>
                <Zap className="w-8 h-8 text-primary mb-4" />
                <CardTitle className="text-xl">Lightning Fast</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Multi-threaded downloads accelerate your transfers up to 5x faster than standard browsers.
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white shadow-sm hover:shadow-md transition">
              <CardHeader>
                <Shield className="w-8 h-8 text-primary mb-4" />
                <CardTitle className="text-xl">Secure & Safe</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Built-in virus scanning, SSL verification, and safe deletion ensure your files are protected.
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white shadow-sm hover:shadow-md transition">
              <CardHeader>
                <Globe className="w-8 h-8 text-primary mb-4" />
                <CardTitle className="text-xl">Multi-Protocol</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Download from HTTP, HTTPS, and torrent sources all in one unified application.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">
            Powerful Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Globe,
                title: 'HTTP/HTTPS Downloads',
                description: 'Fast, reliable downloads from any web source with resume support.',
              },
              {
                icon: Download,
                title: 'Torrent Support',
                description: 'Built-in torrent engine for P2P file sharing and downloads.',
              },
              {
                icon: Zap,
                title: 'Multi-Threading',
                description: 'Accelerate downloads with parallel connections for maximum speed.',
              },
              {
                icon: BarChart3,
                title: 'Progress Monitoring',
                description: 'Real-time speed, ETA, and detailed progress tracking for all downloads.',
              },
              {
                icon: Settings,
                title: 'Browser Extension',
                description: 'Seamless integration with Chrome, Firefox, and Edge browsers.',
              },
              {
                icon: BarChart3,
                title: 'Usage Statistics',
                description: 'Detailed analytics on download history, speeds, and patterns.',
              },
            ].map((feature, idx) => (
              <Card key={idx} className="border-0 bg-white shadow-sm hover:shadow-md transition">
                <CardHeader>
                  <feature.icon className="w-7 h-7 text-primary mb-3" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshot Showcase Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-4">
            See It In Action
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto text-lg">
            Clean, intuitive interface with powerful download management at your fingertips.
          </p>
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-border">
            <Image
              src="/app-screenshot.jpg"
              alt="File Download Manager Application Interface"
              width={1200}
              height={675}
              className="w-full h-auto"
              priority
            />
          </div>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Card className="border-0 bg-muted/30 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Manage Downloads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View all your downloads in one organized list with real-time status updates.
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-muted/30 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Track Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Monitor speed, ETA, and completion percentage for each file in real-time.
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-muted/30 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Pause, resume, cancel, or delete downloads with a single click.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">
            Get File Download Manager
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { name: 'Windows', icon: '🪟' },
              { name: 'macOS', icon: '🍎' },
              { name: 'Linux', icon: '🐧' },
            ].map((platform) => (
              <Card key={platform.name} className="border-0 bg-white shadow-sm text-center">
                <CardHeader>
                  <div className="text-4xl mb-4 flex justify-center">{platform.icon}</div>
                  <CardTitle>{platform.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button className="w-full gap-2" size="lg">
                    <Download className="w-5 h-5" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-muted-foreground mt-8">
            Version 1.0 • Requires OS 10.10+
          </p>
        </div>
      </section>

      {/* How to Use Section */}
      <section id="guide" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">
            How to Get Started
          </h2>
          <div className="space-y-8">
            {[
              {
                step: 1,
                title: 'Download & Install',
                description: 'Download the installer for your operating system and follow the simple setup wizard. It takes less than a minute.',
              },
              {
                step: 2,
                title: 'Add Downloads',
                description: 'Paste a link, drag and drop a file, or use the browser extension to instantly capture downloads from any website.',
              },
              {
                step: 3,
                title: 'Watch & Manage',
                description: 'Monitor real-time progress, pause, resume, or schedule downloads. Organize files into custom categories.',
              },
            ].map((item) => (
              <Card key={item.step} className="border-0 bg-white shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-lg font-bold text-white">{item.step}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="space-y-4">
            {[
              {
                question: 'Is File Download Manager free?',
                answer: 'Yes! File Download Manager is completely free and open-source. We don&apos;t charge for basic features or embed any ads.',
              },
              {
                question: 'Does it work with all websites?',
                answer: 'It works with most HTTP and HTTPS websites. Some websites with special DRM protection may require additional configuration.',
              },
              {
                question: 'Can I use it for torrent downloads?',
                answer: 'Absolutely! We have a built-in torrent engine that allows you to download torrents just like regular files.',
              },
              {
                question: 'How much faster is it than my browser?',
                answer: 'With multi-threading enabled, you can see speed improvements of 2-5x compared to standard browser downloads.',
              },
              {
                question: 'Is my data secure?',
                answer: 'Yes. We don&apos;t collect personal data. Your download history stays on your computer. All connections use SSL encryption.',
              },
              {
                question: 'What about the browser extension?',
                answer: 'The browser extension seamlessly captures downloads and sends them to File Download Manager for faster processing.',
              },
            ].map((item, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`} className="border border-border rounded-lg px-6">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <span className="text-lg font-semibold text-left">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-8 sm:p-12 text-white text-center">
            <Mail className="w-12 h-12 mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Need Help?</h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Have questions or feedback? We&apos;d love to hear from you. Get in touch with our support team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="gap-2">
                <Mail className="w-5 h-5" />
                support@filedownloadmanager.com
              </Button>
              <Button size="lg" variant="secondary">
                Community Forum
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
            Ready to Download Smarter?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of users downloading files faster and safer.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="gap-2">
              <Download className="w-5 h-5" />
              Download for Free
            </Button>
            <Link href="/donate">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                <Heart className="w-5 h-5" />
                Support the Project
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground/5 border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-foreground">File Download Manager</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Fast, secure, and easy-to-use download management for everyone.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition">Features</a></li>
                <li><a href="#guide" className="hover:text-foreground transition">How to Use</a></li>
                <li><a href="#faq" className="hover:text-foreground transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#contact" className="hover:text-foreground transition">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground transition">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition">Community</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition">License</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8">
            <p className="text-center text-sm text-muted-foreground">
              &copy; 2024 File Download Manager. All rights reserved. Open source & free forever.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
