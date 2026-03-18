import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '~/lib/utils';
import { UnifiedButton as Button } from './unified-button';

interface ContextualHelpProps {
  title: string;
  content: string | React.ReactNode;
  variant?: 'tooltip' | 'modal' | 'inline';
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showOnMount?: boolean;
}

export function ContextualHelp({
  title,
  content,
  variant = 'tooltip',
  className,
  position = 'top',
  showOnMount = false
}: ContextualHelpProps) {
  const [isVisible, setIsVisible] = useState(showOnMount);

  if (variant === 'inline') {
    return (
      <div className={cn(
        'bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm',
        'dark:bg-blue-950 dark:border-blue-800',
        className
      )}>
        <div className="flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">{title}</h4>
            <div className="text-blue-800 dark:text-blue-200">
              {typeof content === 'string' ? <p>{content}</p> : content}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative inline-block', className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsVisible(!isVisible)}
        className="h-5 w-5 text-muted-foreground hover:text-foreground"
        aria-label={`Help: ${title}`}
      >
        <HelpCircle className="w-4 h-4" />
      </Button>
      
      {isVisible && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsVisible(false)}
          />
          
          {/* Tooltip/Modal */}
          <div className={cn(
            'absolute z-50 w-80 bg-background border border-border rounded-lg shadow-lg p-4',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            position === 'top' && 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
            position === 'bottom' && 'top-full left-1/2 transform -translate-x-1/2 mt-2',
            position === 'left' && 'right-full top-1/2 transform -translate-y-1/2 mr-2',
            position === 'right' && 'left-full top-1/2 transform -translate-y-1/2 ml-2',
            variant === 'modal' && 'fixed inset-4 w-auto max-w-2xl max-h-[80vh] overflow-auto'
          )}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-foreground">{title}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsVisible(false)}
                className="h-6 w-6"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {typeof content === 'string' ? <p>{content}</p> : content}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface QuickTipProps {
  children: React.ReactNode;
  tip: string;
  className?: string;
}

export function QuickTip({ children, tip, className }: QuickTipProps) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className={cn('relative inline-block', className)}>
      <div 
        className="inline-flex items-center gap-1 cursor-help"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        {children}
        <HelpCircle className="w-3 h-3 text-muted-foreground" />
      </div>
      
      {showTip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
          {tip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}

interface FirstTimeHelpProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  className?: string;
}

export function FirstTimeHelp({ 
  title, 
  description, 
  action, 
  onDismiss, 
  className 
}: FirstTimeHelpProps) {
  return (
    <div className={cn(
      'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4',
      'dark:from-blue-950 dark:to-indigo-950 dark:border-blue-800',
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2">
          <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">{title}</h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">{description}</p>
          <div className="flex items-center gap-2">
            {action && (
              <Button
                size="sm"
                onClick={action.onClick}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {action.label}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900"
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContextualHelp;
