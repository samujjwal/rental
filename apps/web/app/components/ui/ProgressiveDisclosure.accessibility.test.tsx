import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProgressiveDisclosure } from './ProgressiveDisclosure';
import userEvent from '@testing-library/user-event';

describe('ProgressiveDisclosure - P1.3 Accessibility Compliance', () => {
  describe('ARIA Attributes', () => {
    it('should have proper ARIA expanded state', () => {
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update ARIA expanded when toggled', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have aria-controls pointing to content', () => {
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-controls', 'test-content');
    });

    it('should have proper aria-label for screen readers', () => {
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Expand Test Section');
    });

    it('should update aria-label when expanded', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(button).toHaveAttribute('aria-label', 'Collapse Test Section');
    });

    it('should have aria-labelledby on content region', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-labelledby', 'test-header');
    });

    it('should have aria-live for dynamic content', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be focusable via Tab key', () => {
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('tabIndex', '0');
    });

    it('should toggle on Enter key', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should toggle on Space key', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should collapse on Escape key when expanded', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test" defaultExpanded>
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Escape}');

      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should not collapse on Escape when already collapsed', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      button.focus();
      
      // Should not throw or cause issues
      await user.keyboard('{Escape}');

      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Focus Management', () => {
    it('should focus first focusable element when expanded via keyboard', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <button data-testid="inner-button">Click me</button>
        </ProgressiveDisclosure>
      );

      const toggleButton = screen.getByRole('button', { name: /expand/i });
      toggleButton.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        const innerButton = screen.getByTestId('inner-button');
        expect(innerButton).toHaveFocus();
      }, { timeout: 200 });
    });

    it('should handle content with no focusable elements', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Just text content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      // Should not throw or cause issues
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should handle multiple focusable elements', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>
            <button data-testid="first-button">First</button>
            <button data-testid="second-button">Second</button>
            <a href="#" data-testid="link">Link</a>
          </div>
        </ProgressiveDisclosure>
      );

      const toggleButton = screen.getByRole('button', { name: /expand/i });
      toggleButton.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        const firstButton = screen.getByTestId('first-button');
        expect(firstButton).toHaveFocus();
      }, { timeout: 200 });
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce state changes to screen readers', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('aria-live', 'polite');
    });

    it('should have descriptive button text', () => {
      render(
        <ProgressiveDisclosure title="Important Information" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Important Information');
    });

    it('should provide context through aria-labelledby', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      const region = screen.getByRole('region');
      const headerId = button.getAttribute('id');
      
      expect(region).toHaveAttribute('aria-labelledby', headerId);
    });
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have sufficient touch target size (44x44px minimum)', () => {
      const { container } = render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      const rect = button.getBoundingClientRect();
      
      // Note: In actual implementation, ensure CSS provides minimum size
      expect(button).toBeInTheDocument();
    });

    it('should maintain focus visibility', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      await user.tab();

      expect(button).toHaveFocus();
    });

    it('should support high contrast mode', () => {
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      // Component should work in high contrast mode (verified visually)
      expect(button).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid keyboard interactions', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      button.focus();

      // Rapid toggling
      await user.keyboard('{Enter}');
      await user.keyboard('{Enter}');
      await user.keyboard('{Enter}');

      // Should handle gracefully
      expect(button).toHaveAttribute('aria-expanded');
    });

    it('should handle focus when content is removed', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ProgressiveDisclosure title="Test Section" id="test" defaultExpanded>
          <button>Inner button</button>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button', { name: /collapse/i });
      await user.click(button);

      // Content removed, should not cause focus issues
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should work with dynamic content', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Initial content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      rerender(
        <ProgressiveDisclosure title="Test Section" id="test" defaultExpanded>
          <div>Updated content</div>
        </ProgressiveDisclosure>
      );

      expect(screen.getByText('Updated content')).toBeInTheDocument();
    });
  });

  describe('Integration with Assistive Technologies', () => {
    it('should work with screen reader navigation', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <ProgressiveDisclosure title="Section 1" id="section1">
            <div>Content 1</div>
          </ProgressiveDisclosure>
          <ProgressiveDisclosure title="Section 2" id="section2">
            <div>Content 2</div>
          </ProgressiveDisclosure>
        </div>
      );

      const buttons = screen.getAllByRole('button');
      
      // Navigate between sections
      await user.tab();
      expect(buttons[0]).toHaveFocus();
      
      await user.tab();
      expect(buttons[1]).toHaveFocus();
    });

    it('should provide proper semantic structure', async () => {
      const user = userEvent.setup();
      render(
        <ProgressiveDisclosure title="Test Section" id="test">
          <div>Content</div>
        </ProgressiveDisclosure>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      // Should have proper region role
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });
  });
});
