import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Mail, User, Crown, Trash2, RefreshCw, XCircle, ArrowRight } from 'lucide-react';
import {
  getTeamMembersAndInvites,
  sendTeamInvite,
  revokeInvite,
  transferTeamOwnership,
  Invite,
  Team,
} from '@/lib/api';

// Types for team and invites
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  status: 'active' | 'pending';
}
interface Invite {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
}
interface TeamManagerProps {
  team: TeamMember[];
  invites: Invite[];
  currentUser: TeamMember;
  onTeamChange?: () => void;
}

export const TeamManager: React.FC<TeamManagerProps> = ({ team, invites, currentUser, onTeamChange }) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const { toast } = useToast();
  const maxTeamMembers = 5; // TODO: get from config/props

  // Placeholder for API wiring
  const handleInvite = async () => {
    if (!inviteEmail.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    if (team.length + invites.length >= maxTeamMembers) {
      toast({ title: 'Team limit reached', description: `You can invite up to ${maxTeamMembers} members.`, variant: 'destructive' });
      return;
    }
    setIsInviting(true);
    // TODO: Call backend invite API
    setTimeout(() => {
      toast({ title: 'Invite sent', description: `${inviteEmail} has been invited.` });
      setInviteEmail('');
      setIsInviting(false);
      onTeamChange && onTeamChange();
    }, 1000);
  };

  const handleRevoke = (inviteId: string) => {
    // TODO: Call backend revoke API
    toast({ title: 'Invite revoked', description: 'The invite has been revoked.' });
    onTeamChange && onTeamChange();
  };

  const handleResend = (inviteId: string) => {
    // TODO: Call backend resend API
    toast({ title: 'Invite resent', description: 'A new invite email has been sent.' });
    onTeamChange && onTeamChange();
  };

  const handleRemove = (memberId: string) => {
    // TODO: Call backend remove API
    toast({ title: 'Member removed', description: 'The team member has been removed.' });
    onTeamChange && onTeamChange();
  };

  const handleTransferOwnership = (memberId: string) => {
    // TODO: Call backend transfer ownership API
    toast({ title: 'Ownership transferred', description: 'You have transferred team ownership.' });
    onTeamChange && onTeamChange();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Team Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite new member */}
        <div className="space-y-2">
          <Label htmlFor="invite-email">Invite Team Member</Label>
          <div className="flex gap-2 flex-wrap">
            <Input
              id="invite-email"
              type="email"
              placeholder="Enter email address"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="w-64"
              disabled={isInviting}
            />
            <Button onClick={handleInvite} disabled={isInviting || !inviteEmail} size={'sm' as const} variant={'ghost' as const}>
              {isInviting ? <RefreshCw className="animate-spin w-4 h-4 mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Invite
            </Button>
          </div>
          <div className="text-xs text-gray-500">You can invite up to {maxTeamMembers} members. Pending invites count toward your limit.</div>
        </div>
        {/* Team members list */}
        <div>
          <Label className="mb-2 block">Current Team</Label>
          <div className="space-y-2">
            {team.length === 0 && <div className="text-gray-500 text-sm">No team members yet.</div>}
            {team.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-2 border rounded bg-slate-50">
                <User className="w-5 h-5 text-blue-600" />
                <span className="font-medium">{member.name}</span>
                <span className="text-xs text-gray-500">{member.email}</span>
                {member.role === 'owner' && <Badge className="bg-yellow-100 text-yellow-800 ml-2"><Crown className="w-4 h-4 mr-1 inline" />Owner</Badge>}
                {member.status === 'pending' && <Badge className="bg-gray-100 text-gray-600 ml-2">Pending</Badge>}
                <div className="flex-1" />
                {currentUser.role === 'owner' && member.role !== 'owner' && (
                  <>
                    <Button size={'sm' as const} variant={'ghost' as const} onClick={() => handleRemove(member.id)}><Trash2 className="w-4 h-4 mr-1" />Remove</Button>
                    <Button size={'sm' as const} variant={'outline' as const} onClick={() => handleTransferOwnership(member.id)}><ArrowRight className="w-4 h-4 mr-1" />Make Owner</Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Pending invites */}
        <div>
          <Label className="mb-2 block">Pending Invites</Label>
          <div className="space-y-2">
            {invites.length === 0 && <div className="text-gray-500 text-sm">No pending invites.</div>}
            {invites.map(invite => (
              <div key={invite.id} className="flex items-center gap-3 p-2 border rounded bg-slate-50">
                <Mail className="w-5 h-5 text-green-600" />
                <span className="font-medium">{invite.email}</span>
                <Badge className="bg-gray-100 text-gray-600 ml-2">{invite.status === 'pending' ? 'Pending' : invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}</Badge>
                <div className="flex-1" />
                <Button size={'sm' as const} variant={'ghost' as const} onClick={() => handleRevoke(invite.id)}><XCircle className="w-4 h-4 mr-1" />Revoke</Button>
                <Button size={'sm' as const} variant={'outline' as const} onClick={() => handleResend(invite.id)}><RefreshCw className="w-4 h-4 mr-1" />Resend</Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 