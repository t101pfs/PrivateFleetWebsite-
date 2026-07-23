import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import pfLogo from '@/assets/pf-logo.png';
import pfPattern from '@/assets/pf-pattern.png';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'Message Sent',
      description: 'Thank you for contacting us. We will get back to you shortly.',
    });
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-[0.05]"
        style={{ 
          backgroundImage: `url(${pfPattern})`,
          backgroundSize: '350px',
          backgroundRepeat: 'repeat'
        }}
      />
      
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 md:px-8 py-4 md:py-6 gap-4">
        <Link to="/" className="min-w-0">
          <img src={pfLogo} alt="Private Fleet" className="h-16 sm:h-24 md:h-40 lg:h-56" />
        </Link>
        <div className="flex items-center gap-3 md:gap-6">
          <Link to="/" className="text-sm md:text-base text-foreground hover:text-primary font-medium transition-colors">
            Home
          </Link>
          <Link to="/contact" className="text-sm md:text-base text-primary font-medium transition-colors">
            Contact Us
          </Link>
        </div>
      </nav>

      {/* Contact Section */}
      <section className="relative z-10 px-4 md:px-8 py-12 md:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-primary mb-4 md:mb-6">
              Contact Us
            </h1>
            <p className="text-base md:text-xl text-foreground max-w-2xl mx-auto">
              Have questions about our platform? Get in touch with our team.
            </p>
          </div>

          <div className="grid gap-8 md:gap-12 lg:grid-cols-2">
            {/* Contact Info */}
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                  <Mail className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary mb-1">Email</h3>
                  <p className="text-foreground">info@privatefleetservices.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                  <Phone className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary mb-1">Phone</h3>
                  <p className="text-foreground">+920003455</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                  <MapPin className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary mb-1">Address</h3>
                  <p className="text-foreground">
                    King Abdulaziz Road<br />
                    Jeddah, Saudi Arabia
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle>Send us a message</CardTitle>
                <CardDescription>Fill out the form below and we'll get back to you.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="How can we help you?"
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-primary/20 py-6 md:py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-2">
            <img src={pfLogo} alt="Private Fleet" className="h-16 md:h-24" />
            <span className="text-xs md:text-sm text-foreground">
              Private Fleet Services © 2026. Enterprise Charter Management.
            </span>
          </div>
          <p className="text-xs md:text-sm text-foreground">
            Built with precision for the aviation industry.
          </p>
        </div>
      </footer>
    </div>
  );
}
