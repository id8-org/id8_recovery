import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings as SettingsIcon, Bell, Shield, Palette, Database } from 'lucide-react';
import { Link } from 'react-router-dom';

const Settings = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">Please log in to access settings</p>
          <Link to="/auth">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Account Settings
              </CardTitle>
              <CardDescription>
                Manage your account preferences and information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  <strong>Email:</strong> {user.email}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Name:</strong> {user.first_name} {user.last_name}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Account Status:</strong> {user.is_verified ? 'Verified' : 'Unverified'}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Tier:</strong> <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${user.tier === 'premium' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{user.tier ? user.tier.charAt(0).toUpperCase() + user.tier.slice(1) : 'Free'}</span>
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Account Type:</strong> <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${user.account_type === 'team' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{user.account_type ? user.account_type.charAt(0).toUpperCase() + user.account_type.slice(1) : 'Solo'}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Configure your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Notification settings will be available soon.
              </p>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Security
              </CardTitle>
              <CardDescription>
                Manage your privacy and security settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Privacy and security settings will be available soon.
              </p>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Appearance settings will be available soon.
              </p>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
              <CardDescription>
                Manage your data and export options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Data management options will be available soon.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings; 