import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

interface QnAItem {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

interface IdeaVersionQnAProps {
  ideaId: string;
  versionNumber: number;
  fields: Record<string, any>;
  disabled?: boolean;
}

const IdeaVersionQnA: React.FC<IdeaVersionQnAProps> = ({ ideaId, versionNumber, fields, disabled }) => {
  const [question, setQuestion] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>(Object.keys(fields));
  const [qnaList, setQnaList] = useState<QnAItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchQnA();
    // eslint-disable-next-line
  }, [ideaId, versionNumber]);

  const fetchQnA = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/ideas/${ideaId}/versions/${versionNumber}/qna`);
      setQnaList(res.data || []);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to load Q&A', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/ideas/${ideaId}/versions/${versionNumber}/qna`, {
        question,
        context_fields: selectedFields,
      });
      setQuestion('');
      fetchQnA();
      toast({ title: 'LLM answered!', description: 'Your question was answered.' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to get answer', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span role="img" aria-label="AI">🤖</span> Ask the LLM about this version
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="llm-question">Your Question</Label>
            <Textarea
              id="llm-question"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask anything about this idea version..."
              rows={2}
              disabled={disabled || submitting}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Select context fields to include</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.keys(fields).map(field => (
                <Badge
                  key={field}
                  variant={selectedFields.includes(field) ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => {
                    setSelectedFields(sf =>
                      sf.includes(field)
                        ? sf.filter(f => f !== field)
                        : [...sf, field]
                    );
                  }}
                >
                  {field}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            onClick={handleAsk}
            disabled={disabled || submitting || !question.trim() || selectedFields.length === 0}
            className="mt-2"
          >
            {submitting ? 'Asking...' : 'Ask'}
          </Button>
        </div>
        <div className="mt-8">
          <h3 className="font-semibold mb-2 text-base">Previous Q&A for this version</h3>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : qnaList.length === 0 ? (
            <div className="text-muted-foreground italic">No questions asked yet for this version.</div>
          ) : (
            <div className="space-y-4">
              {qnaList.slice().reverse().map(qna => (
                <div key={qna.id} className="border rounded p-3 bg-slate-50">
                  <div className="text-xs text-muted-foreground mb-1">{new Date(qna.created_at).toLocaleString()}</div>
                  <div className="font-medium mb-1">Q: {qna.question}</div>
                  <div className="text-blue-900">A: {qna.answer || <span className="italic text-slate-400">No answer</span>}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default IdeaVersionQnA; 