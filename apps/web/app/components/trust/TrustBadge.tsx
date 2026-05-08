/**
 * Trust Badge Component
 * 
 * Displays trust indicators and badges for users and listings:
 * - Verified badges (email, phone, identity)
 * - Superhost status
 * - Trust score level
 * - Response rate/time
 */

'use client';

import { Badge } from '~/components/ui/badge';
import { Shield, CheckCircle, Clock, Star, Award } from 'lucide-react';

interface TrustBadgeProps {
  level?: 'BEGINNER' | 'TRUSTED' | 'ESTABLISHED' | 'SUPERHOST' | 'LEGENDARY';
  score?: number;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  responseRate?: number;
  responseTime?: string;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function TrustBadge({
  level,
  score,
  emailVerified,
  phoneVerified,
  identityVerified,
  responseRate,
  responseTime,
  showScore = true,
  size = 'md',
}: TrustBadgeProps) {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'LEGENDARY':
        return 'bg-purple-500 hover:bg-purple-600';
      case 'SUPERHOST':
        return 'bg-amber-500 hover:bg-amber-600';
      case 'ESTABLISHED':
        return 'bg-green-500 hover:bg-green-600';
      case 'TRUSTED':
        return 'bg-blue-500 hover:bg-blue-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'LEGENDARY':
      case 'SUPERHOST':
        return <Award className="h-4 w-4" />;
      case 'ESTABLISHED':
        return <Star className="h-4 w-4" />;
      case 'TRUSTED':
        return <Shield className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {level && (
        <Badge className={`${getLevelColor(level)} ${sizeClasses[size]} text-white`}>
          {getLevelIcon(level)}
          <span className="ml-1">{level}</span>
          {showScore && score !== undefined && <span className="ml-1 opacity-80">({score})</span>}
        </Badge>
      )}

      {emailVerified && (
        <Badge variant="outline" className={sizeClasses[size]} title="Email Verified">
          <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
          Email
        </Badge>
      )}

      {phoneVerified && (
        <Badge variant="outline" className={sizeClasses[size]} title="Phone Verified">
          <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
          Phone
        </Badge>
      )}

      {identityVerified && (
        <Badge variant="outline" className={sizeClasses[size]} title="Identity Verified">
          <Shield className="h-3 w-3 mr-1 text-blue-500" />
          ID Verified
        </Badge>
      )}

      {responseRate !== undefined && responseRate > 0 && (
        <Badge variant="secondary" className={sizeClasses[size]} title={`Response Rate: ${Math.round(responseRate * 100)}%`}>
          <Clock className="h-3 w-3 mr-1" />
          {Math.round(responseRate * 100)}%
        </Badge>
      )}

      {responseTime && (
        <Badge variant="secondary" className={sizeClasses[size]} title={`Response Time: ${responseTime}`}>
          <Clock className="h-3 w-3 mr-1" />
          {responseTime}
        </Badge>
      )}
    </div>
  );
}
