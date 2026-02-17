import { useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  delay: number;
}

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#F8C471", "#82E0AA",
];

function generatePieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100, // % from left
    y: -10 - Math.random() * 20, // start above viewport
    rotation: Math.random() * 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    delay: Math.random() * 0.8,
  }));
}

export interface ConfettiCelebrationProps {
  /** Whether to show the confetti animation */
  show: boolean;
  /** Number of confetti pieces */
  count?: number;
  /** Duration in ms before auto-hiding */
  duration?: number;
  /** Callback when animation completes */
  onComplete?: () => void;
}

/**
 * Confetti celebration component.
 * Renders animated confetti pieces that fall from the top of the screen.
 */
export function ConfettiCelebration({
  show,
  count = 60,
  duration = 3000,
  onComplete,
}: ConfettiCelebrationProps) {
  const pieces = useRef(generatePieces(count));
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (show) {
      pieces.current = generatePieces(count);
      timerRef.current = setTimeout(() => {
        onComplete?.();
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show, count, duration, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <div
          className="fixed inset-0 pointer-events-none z-[100] overflow-hidden"
          aria-hidden="true"
        >
          {pieces.current.map((piece) => (
            <motion.div
              key={piece.id}
              initial={{
                x: `${piece.x}vw`,
                y: `${piece.y}vh`,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                y: "110vh",
                rotate: piece.rotation + 720,
                opacity: [1, 1, 0.8, 0],
              }}
              transition={{
                duration: 2.5 + Math.random(),
                delay: piece.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              style={{
                position: "absolute",
                width: piece.size,
                height: piece.size * 0.6,
                backgroundColor: piece.color,
                borderRadius: "2px",
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * SuccessCelebration — full-screen success overlay with confetti + message
 */
export interface SuccessCelebrationProps {
  show: boolean;
  title?: string;
  message?: string;
  onClose?: () => void;
}

export function SuccessCelebration({
  show,
  title = "Success!",
  message = "Your action was completed successfully.",
  onClose,
}: SuccessCelebrationProps) {
  const handleComplete = useCallback(() => {
    onClose?.();
  }, [onClose]);

  return (
    <AnimatePresence>
      {show && (
        <>
          <ConfettiCelebration show={show} onComplete={handleComplete} />
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed inset-0 z-[99] flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="bg-card rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.3,
                  type: "spring",
                  stiffness: 200,
                  damping: 10,
                }}
                className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
              >
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <motion.path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
                  />
                </svg>
              </motion.div>
              <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm">{message}</p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                Continue
              </button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
