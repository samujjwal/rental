/**
 * Trust Score Display Component
 * 
 * Displays detailed trust score information:
 * - Overall score and level
 * - Breakdown of trust indicators
 * - Progress bars for each indicator
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Shield, CheckCircle, Clock, Star, Award, TrendingUp } from 'lucide-react';
import { TrustBadge } from './TrustBadge';

interface TrustScoreDisplayProps {
  score: number;
  level: string;
  indicators: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    responseRate: number;
    responseTime: string;
    totalReviews: number;
    averageRating: number;
    successfulBookings: number;
    disputeFreeRate: number;
    accountAge: number;
    completedBookings: number;
    cancelledBookings: number;
    superhostStatus: boolean;
  };
  showDetails?: boolean;
}

export function TrustScoreDisplay({ score, level, indicators, showDetails = false }: TrustScoreDisplayProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-purple-500';
    if (score >= 75) return 'text-amber-500';
    if (score >= 60) return 'text-green-500';
    if (score >= 40) return 'text-blue-500';
    return 'text-gray-500';
  };

  const getProgressColor = (value: number) => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-blue-500';
    if (value >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Trust Score</CardTitle>
            <CardDescription>Your marketplace reputation</CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</div>
            <TrustBadge level={level as any} score={score} size="lg" />
          </div>
        </div>
      </CardHeader>
      {showDetails && (
        <CardContent className="space-y-4">
          {/* Verification Status */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Verification Status</h4>
            <div className="flex gap-2 flex-wrap">
              {indicators.emailVerified && (
                <Badge variant="outline" className="bg-green-50 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                  Email Verified
                </Badge>
              )}
              {indicators.phoneVerified && (
                <Badge variant="outline" className="bg-green-50 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                  Phone Verified
                </Badge>
              )}
              {indicators.identityVerified && (
                <Badge variant="outline" className="bg-blue-50 border-blue-200">
                  <Shield className="h-3 w-3 mr-1 text-blue-500" />
                  Identity Verified
                </Badge>
              )}
              {!indicators.emailVerified && !indicators.phoneVerified && !indicators.identityVerified && (
                <span className="text-sm text-muted-foreground">No verifications yet</span>
              )}
            </div>
          </div>

          {/* Response Metrics */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Response Rate
              </span>
              <span className="font-medium">{Math.round(indicators.responseRate * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressColor(indicators.responseRate * 100)}`}
                style={{ width: `${indicators.responseRate * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Response Time: {indicators.responseTime}</span>
            </div>
          </div>

          {/* Reviews */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center">
                <Star className="h-4 w-4 mr-2" />
                Average Rating
              </span>
              <span className="font-medium">{indicators.averageRating.toFixed(1)}/5.0</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressColor((indicators.averageRating / 5) * 100)}`}
                style={{ width: `${(indicators.averageRating / 5) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{indicators.totalReviews} reviews</span>
            </div>
          </div>

          {/* Bookings */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                Successful Bookings
              </span>
              <span className="font-medium">{indicators.successfulBookings}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Completed: {indicators.completedBookings}</div>
              <div>Cancelled: {indicators.cancelledBookings}</div>
            </div>
          </div>

          {/* Dispute-Free Rate */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Dispute-Free Rate
              </span>
              <span className="font-medium">{Math.round(indicators.disputeFreeRate * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressColor(indicators.disputeFreeRate * 100)}`}
                style={{ width: `${indicators.disputeFreeRate * 100}%` }}
              />
            </div>
          </div>

          {/* Account Age */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Account Age</span>
            <span className="font-medium">
              {indicators.accountAge >= 365
                ? `${Math.floor(indicators.accountAge / 365)} years`
                : `${indicators.accountAge} days`}
            </span>
          </div>

          {/* Superhost Status */}
          {indicators.superhostStatus && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-700">
                <Award className="h-5 w-5" />
                <span className="font-semibold">Superhost Status</span>
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Congratulations! You've earned Superhost status for exceptional performance.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
