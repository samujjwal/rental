# Web Application

React Router v7 Framework Mode web application for the Universal Rental Portal.

## Tech Stack

- **Framework**: React Router v7 (Framework Mode with SSR)
- **UI Library**: React 19
- **Styling**: TailwindCSS 3.4 with custom design system
- **State Management**: Zustand 5.0 (global state) + TanStack Query 5.59 (server state)
- **Forms**: React Hook Form 7.54 with Zod 3.24 validation
- **Build Tool**: Vite 6.0
- **Language**: TypeScript 5.9 (strict mode)
- **Real-time**: Socket.io-client 4.8

## Project Structure

```
app/
├── components/          # Reusable UI components
├── lib/
│   ├── api/            # API client functions
│   ├── store/          # Zustand stores
│   └── validation/     # Zod schemas
├── routes/             # React Router v7 routes
├── types/              # TypeScript type definitions
├── root.tsx            # Root layout component
└── tailwind.css        # Global styles and design tokens
```

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3401`

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Environment Variables

Create a `.env` file in the `apps/web` directory:

```env
API_URL=http://localhost:3400/api/v1
```

## Features Implemented

### Authentication

- ✅ Login page with form validation
- ✅ Signup page with password strength indicator
- ✅ Forgot password flow
- ✅ Reset password flow
- ✅ Auth state management (Zustand)
- ✅ Protected routes
- ✅ JWT token management with refresh

### Design System

- ✅ Custom color palette (primary, secondary, destructive)
- ✅ Light and dark theme support
- ✅ Animations (fade-in, slide-up)
- ✅ Responsive grid system
- ✅ Inter font family

### API Integration

- ✅ Axios client with interceptors
- ✅ Token refresh logic
- ✅ Error handling
- ✅ TypeScript type safety

## Next Steps

1. **Listing Management**
   - Browse listings page
   - Listing detail page
   - Create/edit listing forms
   - Image upload component

2. **Search & Discovery**
   - Search page with filters
   - Map view integration
   - Category filtering
   - Sort and pagination

3. **Booking Flow**
   - Calendar component
   - Booking creation
   - Booking management
   - Price calculation

4. **User Dashboard**
   - Profile page
   - Bookings list
   - Listings management
   - Analytics

5. **Real-time Messaging**
   - Socket.io setup
   - Conversation list
   - Message thread
   - Typing indicators

6. **Payment Integration**
   - Stripe Elements
   - Payment methods
   - Payout setup
   - Transaction history

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Design System

### Colors

- **Primary**: Blue (#0ea5e9) - Brand color, CTAs, links
- **Secondary**: Light gray - Backgrounds, secondary buttons
- **Destructive**: Red - Errors, warnings, delete actions
- **Muted**: Gray - Disabled states, subtle text
- **Accent**: Blue variant - Highlights, notifications

### Typography

- **Font Family**: Inter (Google Fonts)
- **Headings**: Bold, larger sizes
- **Body**: Regular, comfortable reading size

### Spacing

- Consistent 4px grid system
- Standard padding: 1rem, 1.5rem, 2rem
- Consistent gaps in layouts

## Code Quality

- TypeScript strict mode enabled
- ESLint with recommended rules
- Prettier for consistent formatting
- Zod for runtime validation
- React Hook Form for performant forms
