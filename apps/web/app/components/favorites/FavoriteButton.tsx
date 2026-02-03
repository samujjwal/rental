import { IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Heart } from 'lucide-react';
import { useToggleFavorite, useIsFavorited } from '~/hooks/useFavorites';
import { useAuthStore } from '~/lib/store/auth';
import { useNavigate } from 'react-router';
import { PressableScale } from '~/components/animations';

export interface FavoriteButtonProps {
    listingId: string;
    size?: 'small' | 'medium' | 'large';
    showTooltip?: boolean;
    className?: string;
    iconClassName?: string;
}

/**
 * FavoriteButton Component
 * Toggle favorite status with optimistic updates and animations
 */
export function FavoriteButton({
    listingId,
    size = 'medium',
    showTooltip = true,
    className = '',
    iconClassName = '',
}: FavoriteButtonProps) {
    const { isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const { data: favorite, isLoading: isCheckingFavorite } = useIsFavorited(listingId);
    const { mutate: toggleFavorite, isPending: isToggling } = useToggleFavorite();

    const isFavorited = favorite !== null && favorite !== undefined;
    const isLoading = isCheckingFavorite || isToggling;

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated) {
            navigate('/auth/login?redirect=' + encodeURIComponent(window.location.pathname));
            return;
        }

        if (!isLoading) {
            toggleFavorite({ listingId });
        }
    };

    const iconSize = size === 'small' ? 16 : size === 'large' ? 28 : 20;

    const button = (
        <IconButton
            onClick={handleClick}
            disabled={isLoading}
            size={size}
            className={className}
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            sx={{
                color: isFavorited ? 'error.main' : 'text.secondary',
                '&:hover': {
                    color: 'error.main',
                    backgroundColor: 'error.light',
                },
            }}
        >
            {isLoading ? (
                <CircularProgress size={iconSize} />
            ) : (
                <PressableScale>
                    <Heart
                        size={iconSize}
                        fill={isFavorited ? 'currentColor' : 'none'}
                        className={`transition-all ${iconClassName}`}
                    />
                </PressableScale>
            )}
        </IconButton>
    );

    if (showTooltip) {
        return (
            <Tooltip
                title={
                    !isAuthenticated
                        ? 'Login to add favorites'
                        : isFavorited
                            ? 'Remove from favorites'
                            : 'Add to favorites'
                }
            >
                {button}
            </Tooltip>
        );
    }

    return button;
}

/**
 * Compact FavoriteButton for cards
 */
export function CompactFavoriteButton({
    listingId,
    className = '',
}: {
    listingId: string;
    className?: string;
}) {
    return (
        <FavoriteButton
            listingId={listingId}
            size="small"
            showTooltip={false}
            className={`absolute top-2 right-2 bg-white/90 backdrop-blur-sm hover:bg-white shadow-md ${className}`}
        />
    );
}
