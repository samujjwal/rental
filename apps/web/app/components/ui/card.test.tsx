import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from './card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('has rounded border and shadow', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass('rounded-lg', 'border', 'shadow-sm');
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="my-card">Content</Card>);
    expect(container.firstChild).toHaveClass('my-card');
  });

  it('forwards HTML attributes', () => {
    render(<Card data-testid="test-card">Content</Card>);
    expect(screen.getByTestId('test-card')).toBeInTheDocument();
  });
});

describe('CardContent', () => {
  it('renders children with padding', () => {
    const { container } = render(<CardContent>Body</CardContent>);
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('p-6');
  });

  it('merges custom className', () => {
    const { container } = render(<CardContent className="extra">Body</CardContent>);
    expect(container.firstChild).toHaveClass('extra');
  });
});

describe('CardHeader', () => {
  it('renders title and description when provided', () => {
    render(<CardHeader title="My Title" description="My Description" />);
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My Description')).toBeInTheDocument();
  });

  it('renders children instead of title/description', () => {
    render(<CardHeader>Custom header content</CardHeader>);
    expect(screen.getByText('Custom header content')).toBeInTheDocument();
  });

  it('does NOT render title h3 when title is not provided', () => {
    const { container } = render(<CardHeader description="Desc only" />);
    const h3s = container.querySelectorAll('h3');
    expect(h3s).toHaveLength(0);
  });
});

describe('CardTitle', () => {
  it('renders as h3 element', () => {
    const { container } = render(<CardTitle>Title</CardTitle>);
    expect(container.firstChild?.nodeName).toBe('H3');
    expect(screen.getByText('Title')).toBeInTheDocument();
  });
});

describe('CardDescription', () => {
  it('renders as p element with muted text', () => {
    const { container } = render(<CardDescription>Subtitle</CardDescription>);
    expect(container.firstChild?.nodeName).toBe('P');
    expect(container.firstChild).toHaveClass('text-muted-foreground');
  });
});

describe('CardFooter', () => {
  it('renders children with flex layout', () => {
    const { container } = render(<CardFooter>Footer buttons</CardFooter>);
    expect(screen.getByText('Footer buttons')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('flex', 'items-center');
  });
});

describe('Card composition', () => {
  it('renders a fully composed card', () => {
    render(
      <Card>
        <CardHeader title="Room Listing" description="Cozy apartment" />
        <CardContent>Rs. 5,000 / night</CardContent>
        <CardFooter>
          <button>Book Now</button>
        </CardFooter>
      </Card>,
    );

    expect(screen.getByText('Room Listing')).toBeInTheDocument();
    expect(screen.getByText('Cozy apartment')).toBeInTheDocument();
    expect(screen.getByText('Rs. 5,000 / night')).toBeInTheDocument();
    expect(screen.getByText('Book Now')).toBeInTheDocument();
  });
});
