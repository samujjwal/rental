import { Heart, Loader2 } from 'lucide-react';
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

const sizeMap = {
    small: { icon: 16, btn: 'h-8 w-8' },
    medium: { icon: 20, btn: 'h-10 w-10' },
    large: { icon: 28, btn: 'h-12 w-12' },
};

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
            navigate('/auth/login?redirectTo=' + encodeURIComponent(window.location.pathname));
            return;
        }

        if (!isLoading) {
            toggleFavorite({ listingId });
        }
    };

    const { icon: iconSize, btn: btnSize } = sizeMap[size];

    const tooltipText = !isAuthenticated
        ? 'Login to add favorites'
        : isFavorited
            ? 'Remove from favorites'
            : 'Add to favorites';

    const button = (
        <button
            type="button"
            onClick={handleClick}
            disabled={isLoading}
            className={`inline-flex items-center justify-center rounded-lg transition-colors
                ${btnSize}
                ${isFavorited ? 'text-red-500' : 'text-gray-500'}
                hover:text-red-500 hover:bg-red-50
                disabled:opacity-50 disabled:cursor-not-allowed
                ${className}`}
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            title={showTooltip ? tooltipText : undefined}
        >
            {isLoading ? (
                <Loader2 size={iconSize} className="animate-spin" />
            ) : (
                <PressableScale>
                    <Heart
                        size={iconSize}
                        fill={isFavorited ? 'currentColor' : 'none'}
                        className={`transition-all ${iconClassName}`}
                    />
                </PressableScale>
            )}
        </button>
    );

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
            className={`bg-white/90 backdrop-blur-sm hover:bg-white shadow-md rounded-full ${className}`}
        />
    );
}
