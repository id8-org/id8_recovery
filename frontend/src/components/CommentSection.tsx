import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { getComments, addComment } from '@/lib/api';
import type { Idea, Comment } from '@/lib/api';

interface CommentSectionProps {
  idea: Idea;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ idea }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();
  }, [idea.id]);

  const fetchComments = async () => {
    try {
      const data = await getComments(idea.id);
      setComments(data);
    } catch (error) {
      toast({ title: "Error fetching comments", variant: "destructive" });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await addComment(idea.id, newComment);
      setNewComment('');
      fetchComments();
      toast({ title: "Comment added" });
    } catch (error) {
      toast({ title: "Error adding comment", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Comments & Feedback</h3>
      <div className="space-y-4">
        {comments.map(c => (
          <div key={c.id} className="p-3 border rounded">
            <p className="text-sm font-semibold">{c.user_id}</p>
            <p className="text-sm text-gray-700 mt-1">{c.content}</p>
            <p className="text-xs text-gray-400 mt-2">{new Date(c.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Textarea 
          placeholder="Leave a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <Button onClick={handleAddComment}>Post Comment</Button>
      </div>
    </div>
  );
}; 