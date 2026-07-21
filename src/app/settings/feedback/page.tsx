
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export default function FeedbackPage() {
    const { toast } = useToast();
    const [feedbackType, setFeedbackType] = useState('');
    const [message, setMessage] = useState('');
    const recipientEmail = 'aviraly26@gmail.com';

    const handleCompose = (target: 'default' | 'gmail') => {
        if (!feedbackType || !message) {
            toast({
                title: 'Missing Information',
                description: 'Please select a feedback type and write a message.',
                variant: 'destructive',
            });
            return;
        }

        const subject = `Vibez Feedback: ${feedbackType}`;
        const body = encodeURIComponent(message);
        
        if (target === 'gmail') {
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipientEmail}&su=${encodeURIComponent(subject)}&body=${body}`;
            window.open(gmailUrl, '_blank');
        } else {
            window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${body}`;
        }
    };

    return (
        <motion.div 
          className="space-y-8"
          initial="initial"
          animate="animate"
          variants={{
            animate: {
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
        >
            <motion.header variants={cardVariants}>
                <h1 className="text-3xl font-bold font-heading">Feedback</h1>
                <p className="text-muted-foreground mt-1">We'd love to hear your thoughts!</p>
            </motion.header>

            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Send Your Feedback</CardTitle>
                        <CardDescription>
                            Your feedback helps us improve Vibez. Please fill out the form below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="feedback-type">What is this about?</Label>
                                <Select onValueChange={setFeedbackType} value={feedbackType}>
                                    <SelectTrigger id="feedback-type" className="w-full">
                                        <SelectValue placeholder="Select feedback type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Bug Report">Bug Report</SelectItem>
                                        <SelectItem value="Feature Request">Feature Request</SelectItem>
                                        <SelectItem value="General Feedback">General Feedback</SelectItem>
                                        <SelectItem value="Question">Question</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="feedback-message">Your Message</Label>
                                <Textarea
                                    id="feedback-message"
                                    placeholder="Tell us what you're thinking..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={6}
                                />
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                <Button onClick={() => handleCompose('default')} className="flex-grow sm:flex-grow-0" asChild>
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <Mail className="mr-2 h-4 w-4" />
                                        Compose in Default App
                                    </motion.button>
                                </Button>
                                 <Button onClick={() => handleCompose('gmail')} variant="secondary" className="flex-grow sm:flex-grow-0" asChild>
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M22 5.88V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6c0-.56.23-1.05.59-1.41L12 15l9.41-10.41c.36.36.59.85.59 1.41zM12 13L2.59 4.59A1.99 1.99 0 0 1 4 4h16a2 2 0 0 1 1.41.59L12 13z"/>
                                        </svg>
                                        Compose in Gmail
                                    </motion.button>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
