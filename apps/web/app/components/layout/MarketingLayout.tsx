import { Link, Outlet } from "react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "~/components/theme";
import { LanguageSelector } from "~/components/language";
import { CurrencySelector } from "~/components/CurrencySelector";

/**
 * Shared layout for public/marketing pages (about, careers, press, help, etc.).
 * Provides a consistent header/footer with navigation.
 */
export function MarketingLayout() {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/search", label: t('nav.browseRentals', 'Browse Rentals') },
    { href: "/how-it-works", label: t('nav.howItWorks', 'How It Works') },
    { href: "/owner-guide", label: t('nav.becomeOwner', 'Become an Owner') },
    { href: "/help", label: t('nav.help', 'Help') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className="text-2xl font-bold text-primary hover:text-primary/90 transition-colors"
            >
              GharBatai
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Auth actions */}
            <div className="hidden md:flex items-center gap-3">
              <LanguageSelector size="sm" />
              <CurrencySelector />
              <ThemeToggle size="sm" />
              <Link
                to="/auth/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/auth/signup"
                className="text-sm font-medium text-primary-foreground bg-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t('nav.getStarted', 'Get Started')}
              </Link>
            </div>

            {/* Mobile menu toggle */}
            <button
              type="button"
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? t('common.closeMenu', 'Close menu') : t('common.openMenu', 'Open menu')}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile nav */}
          {mobileMenuOpen && (
            <nav className="md:hidden py-4 border-t space-y-2" aria-label="Mobile navigation">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="block px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t flex flex-col gap-2">
                <Link
                  to="/auth/login"
                  className="px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/auth/signup"
                  className="px-2 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('nav.getStarted', 'Get Started')}
                </Link>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold text-foreground mb-3">{t('footer.product', 'Product')}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/how-it-works" className="hover:text-foreground">{t('nav.howItWorks', 'How It Works')}</Link></li>
                <li><Link to="/search" className="hover:text-foreground">{t('nav.browseRentals', 'Browse Rentals')}</Link></li>
                <li><Link to="/insurance" className="hover:text-foreground">{t('footer.insurance', 'Insurance')}</Link></li>
                <li><Link to="/safety" className="hover:text-foreground">{t('footer.safety', 'Safety')}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3">{t('footer.company', 'Company')}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground">{t('footer.about')}</Link></li>
                <li><Link to="/careers" className="hover:text-foreground">{t('footer.careers', 'Careers')}</Link></li>
                <li><Link to="/press" className="hover:text-foreground">{t('footer.press', 'Press')}</Link></li>
                <li><Link to="/contact" className="hover:text-foreground">{t('footer.contact')}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3">{t('footer.owners', 'Owners')}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/owner-guide" className="hover:text-foreground">{t('nav.ownerGuide', 'Owner Guide')}</Link></li>
                <li><Link to="/earnings" className="hover:text-foreground">{t('dashboard.earnings')}</Link></li>
                <li><Link to="/become-owner" className="hover:text-foreground">{t('footer.listYourItem', 'List Your Item')}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3">{t('footer.legal', 'Legal')}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/terms" className="hover:text-foreground">{t('footer.terms')}</Link></li>
                <li><Link to="/privacy" className="hover:text-foreground">{t('footer.privacy')}</Link></li>
                <li><Link to="/cookies" className="hover:text-foreground">{t('footer.cookies', 'Cookie Policy')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
    </div>
  );
}
